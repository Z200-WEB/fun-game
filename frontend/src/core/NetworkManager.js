/**
 * NETWORK MANAGER
 *
 * Handles all WebSocket communication with the game server:
 * - Connection management
 * - Message sending/receiving
 * - Event dispatching
 */

import { io } from 'socket.io-client';

export class NetworkManager {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.handlers = new Map();
    this.connected = false;

    this.connect();
  }

  /**
   * Connect to the game server
   */
  connect() {
    console.log(`Connecting to ${this.serverUrl}...`);

    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.connected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });

    // Set up message handlers
    this.setupMessageHandlers();
  }

  /**
   * Set up handlers for all message types
   */
  setupMessageHandlers() {
    const messageTypes = [
      'room_joined',
      'countdown',
      'game_start',
      'game_state',
      'sudden_death',
      'game_over',
      'error',
      'player_left'
    ];

    messageTypes.forEach(type => {
      this.socket.on(type, (data) => {
        this.emit(type, data);
      });
    });
  }

  /**
   * Register an event handler
   */
  on(event, callback) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(callback);
  }

  /**
   * Emit an event to registered handlers
   */
  emit(event, data) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Join a game room
   */
  joinRoom(roomId) {
    this.socket.emit('join_room', { roomId });
  }

  /**
   * Deploy a card
   */
  deployCard(cardId, x, z) {
    this.socket.emit('deploy_card', { cardId, x, z });
  }

  /**
   * Leave current room
   */
  leaveRoom() {
    this.socket.emit('leave_room');
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
