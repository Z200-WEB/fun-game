/**
 * MAIN ENTRY POINT
 *
 * Initializes all game systems:
 * - Three.js renderer
 * - Socket.IO connection
 * - UI controllers
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
    this.selectedCard = null;

    this.init();
  }

  init() {
    // Set up event handlers
    this.setupNetworkHandlers();
    this.setupUIHandlers();
    this.setupInputHandlers();

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
      // Generate random room ID if empty
      if (!roomId) {
        roomId = Math.random().toString(36).substring(2, 10);
      }

      // Update URL for sharing
      const url = new URL(window.location);
      url.searchParams.set('room', roomId);
      window.history.pushState({}, '', url);

      this.ui.showStatus('Connecting...');
      this.network.joinRoom(roomId);
    });

    // Card selection
    this.ui.onCardSelect((cardId) => {
      this.selectedCard = cardId;
      this.renderer.showDeployPreview(true);
    });

    // Card deselect
    this.ui.onCardDeselect(() => {
      this.selectedCard = null;
      this.renderer.showDeployPreview(false);
    });
  }

  setupInputHandlers() {
    // Mouse/touch input for deployment
    const container = document.getElementById('game-container');

    container.addEventListener('click', (e) => {
      if (!this.selectedCard) return;

      // Get world position from click
      const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      if (!worldPos) return;

      // Deploy card
      this.network.deployCard(this.selectedCard, worldPos.x, worldPos.z);

      // Deselect card
      this.selectedCard = null;
      this.ui.deselectCard();
      this.renderer.showDeployPreview(false);
    });

    // Mouse move for preview
    container.addEventListener('mousemove', (e) => {
      if (!this.selectedCard) return;

      const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      if (worldPos) {
        this.renderer.updateDeployPreview(worldPos.x, worldPos.z, this.playerNumber);
      }
    });

    // Right-click to cancel
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.selectedCard = null;
      this.ui.deselectCard();
      this.renderer.showDeployPreview(false);
    });

    // Check URL for room ID
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) {
      document.getElementById('room-input').value = roomId;
    }
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
