/**
 * SHARED CONSTANTS
 * Used by both client and server to ensure consistency
 */

// ===================
// GAME TIMING
// ===================
export const TICK_RATE = 20; // Server updates per second
export const TICK_INTERVAL = 1000 / TICK_RATE; // 50ms between ticks
export const MATCH_DURATION = 180; // 3 minutes in seconds
export const SUDDEN_DEATH_DURATION = 60; // 1 minute overtime
export const ELIXIR_REGEN_RATE = 2.8; // Elixir per second (normal)
export const ELIXIR_REGEN_RATE_DOUBLE = 5.6; // Double elixir (last minute)
export const MAX_ELIXIR = 10;
export const STARTING_ELIXIR = 5;

// ===================
// ARENA DIMENSIONS
// ===================
export const ARENA = {
  WIDTH: 18,      // X axis
  LENGTH: 32,     // Z axis (longer direction)
  HALF_LENGTH: 16,

  // River in the middle
  RIVER_Z: 0,
  RIVER_WIDTH: 2,
  BRIDGE_WIDTH: 3,
  BRIDGE_X_LEFT: -6,
  BRIDGE_X_RIGHT: 6,

  // Tower positions (relative to center)
  TOWER_POSITIONS: {
    // Player 1 (bottom, z < 0)
    player1: {
      main: { x: 0, z: -14 },
      left: { x: -6, z: -10 },
      right: { x: 6, z: -10 }
    },
    // Player 2 (top, z > 0)
    player2: {
      main: { x: 0, z: 14 },
      left: { x: -6, z: 10 },
      right: { x: 6, z: 10 }
    }
  }
};

// ===================
// TOWER STATS
// ===================
export const TOWERS = {
  main: {
    health: 4000,
    damage: 100,
    attackSpeed: 0.8, // attacks per second
    range: 7,
    radius: 2
  },
  side: {
    health: 2500,
    damage: 80,
    attackSpeed: 0.8,
    range: 6,
    radius: 1.5
  }
};

// ===================
// UNIT TYPES
// ===================
export const UNIT_TYPES = {
  MELEE: 'melee',
  RANGED: 'ranged',
  FLYING: 'flying',
  BUILDING: 'building'
};

// ===================
// CARD DEFINITIONS
// ===================
export const CARDS = {
  knight: {
    id: 'knight',
    name: 'Knight',
    elixirCost: 3,
    type: UNIT_TYPES.MELEE,
    count: 1, // Units spawned
    stats: {
      health: 800,
      damage: 75,
      attackSpeed: 1.1,
      moveSpeed: 1.0,
      range: 0.8,
      hitboxRadius: 0.4,
      targetsPriority: ['unit', 'building']
    },
    color: 0x4a90d9
  },

  archer: {
    id: 'archer',
    name: 'Archers',
    elixirCost: 3,
    type: UNIT_TYPES.RANGED,
    count: 2, // Spawns 2 archers
    stats: {
      health: 250,
      damage: 50,
      attackSpeed: 1.2,
      moveSpeed: 1.0,
      range: 5.0,
      hitboxRadius: 0.3,
      targetsPriority: ['unit', 'building']
    },
    color: 0xd94a8c
  },

  giant: {
    id: 'giant',
    name: 'Giant',
    elixirCost: 5,
    type: UNIT_TYPES.MELEE,
    count: 1,
    stats: {
      health: 2000,
      damage: 120,
      attackSpeed: 1.5,
      moveSpeed: 0.5,
      range: 0.8,
      hitboxRadius: 0.6,
      targetsPriority: ['building'] // Only attacks buildings
    },
    color: 0x8b4513
  },

  minions: {
    id: 'minions',
    name: 'Minions',
    elixirCost: 3,
    type: UNIT_TYPES.FLYING,
    count: 3,
    stats: {
      health: 150,
      damage: 40,
      attackSpeed: 1.0,
      moveSpeed: 1.5,
      range: 2.0,
      hitboxRadius: 0.25,
      targetsPriority: ['unit', 'building'],
      flying: true
    },
    color: 0x9b59b6
  },

  fireball: {
    id: 'fireball',
    name: 'Fireball',
    elixirCost: 4,
    type: 'spell',
    stats: {
      damage: 325,
      radius: 2.5,
      towerDamage: 130 // Reduced damage to towers
    },
    color: 0xff6b35
  },

  skeleton: {
    id: 'skeleton',
    name: 'Skeletons',
    elixirCost: 1,
    type: UNIT_TYPES.MELEE,
    count: 3,
    stats: {
      health: 80,
      damage: 35,
      attackSpeed: 1.0,
      moveSpeed: 1.2,
      range: 0.5,
      hitboxRadius: 0.2,
      targetsPriority: ['unit', 'building']
    },
    color: 0xecf0f1
  },

  musketeer: {
    id: 'musketeer',
    name: 'Musketeer',
    elixirCost: 4,
    type: UNIT_TYPES.RANGED,
    count: 1,
    stats: {
      health: 500,
      damage: 100,
      attackSpeed: 1.1,
      moveSpeed: 0.9,
      range: 6.0,
      hitboxRadius: 0.35,
      targetsPriority: ['unit', 'building']
    },
    color: 0xe74c3c
  },

  bomber: {
    id: 'bomber',
    name: 'Bomber',
    elixirCost: 2,
    type: UNIT_TYPES.RANGED,
    count: 1,
    stats: {
      health: 200,
      damage: 100,
      splashRadius: 1.5,
      attackSpeed: 1.9,
      moveSpeed: 0.9,
      range: 4.5,
      hitboxRadius: 0.3,
      targetsPriority: ['unit', 'building'],
      cannotTargetFlying: true
    },
    color: 0x2c3e50
  }
};

// Default deck (all players get the same 8 cards)
export const DEFAULT_DECK = [
  'knight',
  'archer',
  'giant',
  'minions',
  'fireball',
  'skeleton',
  'musketeer',
  'bomber'
];

// ===================
// GAME STATES
// ===================
export const GAME_STATES = {
  WAITING: 'waiting',      // Waiting for players
  COUNTDOWN: 'countdown',  // 3-2-1 countdown
  PLAYING: 'playing',      // Main game
  SUDDEN_DEATH: 'sudden_death',
  FINISHED: 'finished'
};

// ===================
// MESSAGE TYPES
// ===================
export const MSG = {
  // Client -> Server
  JOIN_ROOM: 'join_room',
  DEPLOY_CARD: 'deploy_card',
  LEAVE_ROOM: 'leave_room',

  // Server -> Client
  ROOM_JOINED: 'room_joined',
  GAME_START: 'game_start',
  GAME_STATE: 'game_state',
  GAME_OVER: 'game_over',
  ERROR: 'error',
  PLAYER_LEFT: 'player_left'
};
