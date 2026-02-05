/**
 * MAIN ENTRY POINT
 *
 * Initializes all game systems:
 * - Three.js renderer
 * - Socket.IO connection
 * - UI controllers
 * - Drag and drop card deployment
 */

import { GameRenderer } from './core/GameRenderer.js';
import { NetworkManager } from './core/NetworkManager.js';
import { UIController } from './ui/UIController.js';
import { GameState } from './game/GameState.js';

// Server URL - change for production
const SERVER_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://clash-strategy-server.onrender.com';

class Game {
  constructor() {
    this.renderer = new GameRenderer();
    this.network = new NetworkManager(SERVER_URL);
    this.ui = new UIController();
    this.state = new GameState();

    this.playerNumber = null;
    this.draggedCard = null;
    this.isDragging = false;

    this.init();
  }

  init() {
    this.setupNetworkHandlers();
    this.setupUIHandlers();
    this.setupDragAndDrop();

    // Start render loop
    this.animate();

    console.log('Game initialized');
  }

  setupNetworkHandlers() {
    // Room joined
    this.network.on('room_joined', (data) => {
      this.playerNumber = data.playerNumber;
      this.ui.showStatus(`Joined as Player ${data.playerNumber}. Waiting for opponent...`);

      if (data.playersConnected === 2) {
        this.ui.showStatus('Opponent connected! Starting soon...');
      }
    });

    // Countdown
    this.network.on('countdown', (data) => {
      this.ui.showCountdown(data.count);
    });

    // Game start
    this.network.on('game_start', (data) => {
      this.ui.hideLobby();
      this.ui.showHUD();
      this.state.initialize(data.state);
      this.renderer.initializeArena(this.playerNumber);
      this.ui.updateCards(data.state.players[this.playerNumber].hand, data.state.players[this.playerNumber].elixir);
    });

    // Game state update
    this.network.on('game_state', (data) => {
      this.state.update(data.state, data.tick);

      // Update UI
      const myState = data.state.players[this.playerNumber];
      this.ui.updateElixir(myState.elixir);
      this.ui.updateCards(myState.hand, myState.elixir);
      this.ui.updateNextCard(myState.nextCard);
      this.ui.updateTimer(data.elapsed, data.isDoubleElixir);
      this.ui.updateTowerHP(data.state.towers, this.playerNumber);

      // Update 3D scene
      this.renderer.updateFromState(data.state, this.playerNumber);
    });

    // Sudden death
    this.network.on('sudden_death', () => {
      this.ui.showSuddenDeath();
    });

    // Game over
    this.network.on('game_over', (data) => {
      const isWinner = data.winner === this.playerNumber;
      this.ui.showGameOver(isWinner, data.reason);
    });

    // Error
    this.network.on('error', (data) => {
      console.error('Server error:', data.message);
      this.ui.showError(data.message);
    });

    // Player left
    this.network.on('player_left', () => {
      this.ui.showStatus('Opponent disconnected');
    });
  }

  setupUIHandlers() {
    // Join button
    this.ui.onJoin((roomId) => {
      if (!roomId) {
        roomId = Math.random().toString(36).substring(2, 10);
      }

      const url = new URL(window.location);
      url.searchParams.set('room', roomId);
      window.history.pushState({}, '', url);

      this.ui.showStatus('Connecting...');
      this.network.joinRoom(roomId);
    });

    // Check URL for room ID
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) {
      document.getElementById('room-input').value = roomId;
    }
  }

  setupDragAndDrop() {
    const container = document.getElementById('game-container');

    // Card drag start (from UI)
    this.ui.onCardDragStart((cardId, clientX, clientY) => {
      this.draggedCard = cardId;
      this.isDragging = true;
      this.renderer.startDrag(cardId, clientX, clientY);
      this.ui.setDragging(true, cardId);
    });

    // Global mouse/touch move
    const handleMove = (clientX, clientY) => {
      if (!this.isDragging || !this.draggedCard) return;
      this.renderer.updateDrag(clientX, clientY);
    };

    // Global mouse/touch end
    const handleEnd = (clientX, clientY) => {
      if (!this.isDragging || !this.draggedCard) return;

      const result = this.renderer.updateDrag(clientX, clientY);
      const pos = this.renderer.endDrag();

      if (result && result.isValid) {
        // Deploy the card
        this.network.deployCard(this.draggedCard, pos.x, pos.z);
      }

      this.draggedCard = null;
      this.isDragging = false;
      this.ui.setDragging(false, null);
    };

    // Mouse events
    document.addEventListener('mousemove', (e) => {
      handleMove(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', (e) => {
      handleEnd(e.clientX, e.clientY);
    });

    // Touch events
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (e.changedTouches.length > 0) {
        handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    });

    // Cancel drag with right-click or escape
    document.addEventListener('contextmenu', (e) => {
      if (this.isDragging) {
        e.preventDefault();
        this.renderer.cancelDrag();
        this.draggedCard = null;
        this.isDragging = false;
        this.ui.setDragging(false, null);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isDragging) {
        this.renderer.cancelDrag();
        this.draggedCard = null;
        this.isDragging = false;
        this.ui.setDragging(false, null);
      }
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Interpolate state for smooth rendering
    this.state.interpolate();

    // Update renderer
    this.renderer.update(this.state.getInterpolatedState());
  }
}

// Start game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
