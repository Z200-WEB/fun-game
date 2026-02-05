/**
 * GAME ROOM
 *
 * Manages a single 1v1 match:
 * - Player connections
 * - Game state lifecycle
 * - Broadcasting updates
 */

import { GameEngine } from './GameEngine.js';
import {
  MSG,
  GAME_STATES,
  TICK_RATE,
  TICK_INTERVAL,
  MATCH_DURATION,
  SUDDEN_DEATH_DURATION
} from '../shared/constants.js';

export class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;

    // Player socket IDs
    this.players = {
      1: null,
      2: null
    };

    // Game state
    this.gameState = GAME_STATES.WAITING;
    this.engine = null;
    this.gameLoop = null;
    this.matchStartTime = null;

    // Callback for cleanup
    this.onDestroy = null;

    // Auto-destroy empty room after timeout
    this.emptyTimeout = setTimeout(() => {
      if (this.getPlayerCount() === 0) {
        this.destroy();
      }
    }, 60000); // 1 minute timeout for empty rooms
  }

  /**
   * Adds a player to the room
   * Returns { success: boolean, playerNumber?: number, error?: string }
   */
  addPlayer(socketId) {
    clearTimeout(this.emptyTimeout);

    // Find an empty slot
    if (!this.players[1]) {
      this.players[1] = socketId;
      this.checkGameStart();
      return { success: true, playerNumber: 1 };
    }

    if (!this.players[2]) {
      this.players[2] = socketId;
      this.checkGameStart();
      return { success: true, playerNumber: 2 };
    }

    return { success: false, error: 'Room is full' };
  }

  /**
   * Removes a player from the room
   */
  removePlayer(socketId) {
    let removedPlayer = null;

    if (this.players[1] === socketId) {
      this.players[1] = null;
      removedPlayer = 1;
    } else if (this.players[2] === socketId) {
      this.players[2] = null;
      removedPlayer = 2;
    }

    if (removedPlayer !== null) {
      // Notify other player
      this.broadcast(MSG.PLAYER_LEFT, { playerNumber: removedPlayer });

      // End game if in progress
      if (this.gameState === GAME_STATES.PLAYING ||
          this.gameState === GAME_STATES.SUDDEN_DEATH) {
        const winner = removedPlayer === 1 ? 2 : 1;
        this.endGame(winner, 'opponent_left');
      }
    }

    // Destroy room if empty
    if (this.getPlayerCount() === 0) {
      this.destroy();
    }
  }

  /**
   * Gets the number of connected players
   */
  getPlayerCount() {
    return (this.players[1] ? 1 : 0) + (this.players[2] ? 1 : 0);
  }

  /**
   * Checks if both players are connected and starts the game
   */
  checkGameStart() {
    if (this.players[1] && this.players[2] && this.gameState === GAME_STATES.WAITING) {
      this.startCountdown();
    }
  }

  /**
   * Starts the 3-2-1 countdown
   */
  startCountdown() {
    this.gameState = GAME_STATES.COUNTDOWN;

    // Broadcast countdown
    let count = 3;
    const countdownInterval = setInterval(() => {
      this.broadcast('countdown', { count });
      count--;

      if (count < 0) {
        clearInterval(countdownInterval);
        this.startGame();
      }
    }, 1000);
  }

  /**
   * Starts the actual game
   */
  startGame() {
    this.gameState = GAME_STATES.PLAYING;
    this.matchStartTime = Date.now();

    // Initialize game engine
    this.engine = new GameEngine();

    // Broadcast game start
    this.broadcast(MSG.GAME_START, {
      state: this.engine.getState()
    });

    // Start game loop
    this.gameLoop = setInterval(() => this.tick(), TICK_INTERVAL);

    console.log(`Game started in room ${this.roomId}`);
  }

  /**
   * Main game tick - runs at TICK_RATE Hz
   */
  tick() {
    if (!this.engine) return;

    const elapsedSeconds = (Date.now() - this.matchStartTime) / 1000;

    // Check for sudden death transition
    if (this.gameState === GAME_STATES.PLAYING && elapsedSeconds >= MATCH_DURATION) {
      // Check if there's a winner
      const state = this.engine.getState();
      const p1Towers = this.countTowers(state.towers, 1);
      const p2Towers = this.countTowers(state.towers, 2);

      if (p1Towers !== p2Towers) {
        // Someone has more towers, they win
        this.endGame(p1Towers > p2Towers ? 1 : 2, 'tower_count');
        return;
      }

      // Equal towers, go to sudden death
      this.gameState = GAME_STATES.SUDDEN_DEATH;
      this.broadcast('sudden_death', {});
    }

    // Check sudden death timeout
    if (this.gameState === GAME_STATES.SUDDEN_DEATH) {
      if (elapsedSeconds >= MATCH_DURATION + SUDDEN_DEATH_DURATION) {
        // Compare tower HP for tiebreaker
        const winner = this.engine.getTiebreakWinner();
        this.endGame(winner, 'tiebreak');
        return;
      }
    }

    // Update game engine
    const isDoubleElixir = elapsedSeconds >= MATCH_DURATION - 60;
    const result = this.engine.update(isDoubleElixir);

    // Check for game over conditions
    if (result.gameOver) {
      this.endGame(result.winner, result.reason);
      return;
    }

    // Broadcast state to all players
    this.broadcast(MSG.GAME_STATE, {
      tick: this.engine.tickCount,
      elapsed: elapsedSeconds,
      isDoubleElixir,
      state: this.engine.getState()
    });
  }

  /**
   * Counts remaining towers for a player
   */
  countTowers(towers, playerNumber) {
    let count = 0;
    const playerTowers = towers[`player${playerNumber}`];
    if (playerTowers.main.health > 0) count++;
    if (playerTowers.left.health > 0) count++;
    if (playerTowers.right.health > 0) count++;
    return count;
  }

  /**
   * Handles a card deployment request from a player
   */
  handleCardDeploy(playerNumber, data) {
    if (this.gameState !== GAME_STATES.PLAYING &&
        this.gameState !== GAME_STATES.SUDDEN_DEATH) {
      return;
    }

    const { cardId, x, z } = data;

    // Validate and process through engine
    const result = this.engine.deployCard(playerNumber, cardId, x, z);

    if (!result.success) {
      // Send error only to the requesting player
      const socketId = this.players[playerNumber];
      if (socketId) {
        this.io.to(socketId).emit(MSG.ERROR, { message: result.error });
      }
    }
  }

  /**
   * Ends the game
   */
  endGame(winner, reason) {
    this.gameState = GAME_STATES.FINISHED;

    // Stop game loop
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }

    // Broadcast game over
    this.broadcast(MSG.GAME_OVER, {
      winner,
      reason,
      finalState: this.engine ? this.engine.getState() : null
    });

    console.log(`Game ended in room ${this.roomId}. Winner: Player ${winner} (${reason})`);

    // Destroy room after a delay
    setTimeout(() => this.destroy(), 10000);
  }

  /**
   * Broadcasts a message to all players in the room
   */
  broadcast(event, data) {
    this.io.to(this.roomId).emit(event, data);
  }

  /**
   * Cleans up and destroys the room
   */
  destroy() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }
    clearTimeout(this.emptyTimeout);

    if (this.onDestroy) {
      this.onDestroy();
    }
  }
}
