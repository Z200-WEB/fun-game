/**
 * GAME STATE
 *
 * Client-side state management with interpolation:
 * - Stores recent server states
 * - Interpolates between states for smooth rendering
 * - Handles state prediction for responsive feel
 */

import { TICK_RATE, TICK_INTERVAL } from '../../../shared/constants.js';

export class GameState {
  constructor() {
    // State buffer for interpolation
    this.stateBuffer = [];
    this.maxBufferSize = 5;

    // Current interpolated state
    this.interpolatedState = null;

    // Timing
    this.lastUpdateTime = 0;
    this.serverTickTime = TICK_INTERVAL;

    // Interpolation settings
    this.interpolationDelay = TICK_INTERVAL * 2; // 2 ticks behind (100ms)
  }

  /**
   * Initialize with first state from server
   */
  initialize(state) {
    this.stateBuffer = [{
      state: this.deepClone(state),
      timestamp: performance.now()
    }];
    this.interpolatedState = this.deepClone(state);
    this.lastUpdateTime = performance.now();
  }

  /**
   * Update with new state from server
   */
  update(state, tick) {
    const now = performance.now();

    // Add to buffer
    this.stateBuffer.push({
      state: this.deepClone(state),
      timestamp: now,
      tick
    });

    // Keep buffer size limited
    while (this.stateBuffer.length > this.maxBufferSize) {
      this.stateBuffer.shift();
    }

    this.lastUpdateTime = now;
  }

  /**
   * Interpolate between states for smooth rendering
   * Called every frame
   */
  interpolate() {
    if (this.stateBuffer.length < 2) {
      // Not enough states to interpolate, use latest
      if (this.stateBuffer.length === 1) {
        this.interpolatedState = this.deepClone(this.stateBuffer[0].state);
      }
      return;
    }

    // Target render time (slightly behind real-time)
    const renderTime = performance.now() - this.interpolationDelay;

    // Find the two states to interpolate between
    let older = null;
    let newer = null;

    for (let i = 0; i < this.stateBuffer.length - 1; i++) {
      if (this.stateBuffer[i].timestamp <= renderTime &&
          this.stateBuffer[i + 1].timestamp >= renderTime) {
        older = this.stateBuffer[i];
        newer = this.stateBuffer[i + 1];
        break;
      }
    }

    // Fallback to most recent states if no valid pair found
    if (!older || !newer) {
      const len = this.stateBuffer.length;
      older = this.stateBuffer[len - 2];
      newer = this.stateBuffer[len - 1];
    }

    // Calculate interpolation factor
    const timeDiff = newer.timestamp - older.timestamp;
    const t = timeDiff > 0 ? (renderTime - older.timestamp) / timeDiff : 1;
    const clampedT = Math.max(0, Math.min(1, t));

    // Interpolate
    this.interpolatedState = this.interpolateStates(older.state, newer.state, clampedT);
  }

  /**
   * Interpolate between two game states
   */
  interpolateStates(stateA, stateB, t) {
    const result = this.deepClone(stateB);

    // Interpolate unit positions
    result.units = stateB.units.map(unitB => {
      // Find matching unit in older state
      const unitA = stateA.units.find(u => u.id === unitB.id);

      if (unitA) {
        // Interpolate position
        return {
          ...unitB,
          position: {
            x: this.lerp(unitA.position.x, unitB.position.x, t),
            z: this.lerp(unitA.position.z, unitB.position.z, t)
          },
          rotation: this.lerpAngle(unitA.rotation || 0, unitB.rotation || 0, t)
        };
      }

      // New unit - no interpolation
      return unitB;
    });

    // Interpolate elixir (smooth filling)
    for (const playerNum of [1, 2]) {
      const elixirA = stateA.players[playerNum]?.elixir || 0;
      const elixirB = stateB.players[playerNum]?.elixir || 0;
      result.players[playerNum].elixir = this.lerp(elixirA, elixirB, t);
    }

    return result;
  }

  /**
   * Linear interpolation
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Interpolate angles (handling wrap-around)
   */
  lerpAngle(a, b, t) {
    // Normalize angles
    while (a < 0) a += Math.PI * 2;
    while (b < 0) b += Math.PI * 2;
    while (a >= Math.PI * 2) a -= Math.PI * 2;
    while (b >= Math.PI * 2) b -= Math.PI * 2;

    // Find shortest path
    let diff = b - a;
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;

    return a + diff * t;
  }

  /**
   * Get current interpolated state
   */
  getInterpolatedState() {
    return this.interpolatedState;
  }

  /**
   * Get latest server state (for UI updates)
   */
  getLatestState() {
    if (this.stateBuffer.length === 0) return null;
    return this.stateBuffer[this.stateBuffer.length - 1].state;
  }

  /**
   * Deep clone an object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    const clone = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clone[key] = this.deepClone(obj[key]);
      }
    }
    return clone;
  }
}
