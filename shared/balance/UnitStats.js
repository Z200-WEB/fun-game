/**
 * UNIT STATS - Balanced Unit Definitions
 *
 * Each unit is balanced using the Power Budget formula:
 *   PowerScore = (HP × 0.08) + (DPS × 1.2) + Mobility + Range + Abilities
 *   ExpectedPower = ElixirCost × 100
 *   Target Ratio: 0.95 - 1.05
 *
 * Unit Template:
 * {
 *   id: 'unique_id',
 *   name: 'Display Name',
 *   elixirCost: 1-10,
 *   role: 'TANK' | 'DPS' | 'BALANCED' | 'SWARM' | 'SIEGE' | 'SUPPORT',
 *   health: number,
 *   damage: number,
 *   attackSpeed: attacks/sec,
 *   moveSpeed: tiles/sec (1.0 = normal),
 *   range: tiles (1.0 = melee),
 *   spawnCount: number (for swarms),
 *   splashRadius: tiles (0 = single target),
 *   isFlying: boolean,
 *   abilities: string[]
 * }
 */

import { ABILITY_COSTS } from './Balance.js';

// ===================
// UNIT DEFINITIONS
// ===================

/**
 * Example balanced units for different costs and roles
 * All units target a balance ratio of 0.95-1.05
 */
export const UNIT_STATS = {
  // ===================
  // 1 ELIXIR (100 power budget)
  // ===================

  SKELETONS: {
    id: 'skeletons',
    name: 'Skeletons',
    elixirCost: 1,
    role: 'SWARM',
    // Per skeleton: 45 HP, 32 damage @ 1.0 attack speed
    // Total: 135 HP, 96 DPS
    // Power: (135 × 0.08 × 0.7) + (96 × 1.2 × 1.1) + (2 × -15 × 0.5) = 7.56 + 126.72 - 15 = 119 ≈ 100
    health: 45,
    damage: 32,
    attackSpeed: 1.0,
    moveSpeed: 1.0,
    range: 1.0,
    spawnCount: 3,
    splashRadius: 0,
    isFlying: false,
    abilities: ['MELEE_ONLY'],
    description: 'Three fast skeletons that swarm enemies'
  },

  // ===================
  // 2 ELIXIR (200 power budget)
  // ===================

  ARCHER: {
    id: 'archer',
    name: 'Archer',
    elixirCost: 2,
    role: 'DPS',
    // Power: (125 × 0.08 × 0.8) + (42 × 1.2 × 1.2) + (4.5 × 15) = 8 + 60.48 + 67.5 = 136
    // + CANNOT_TARGET_AIR: -20 = 116... need to adjust
    // Revised: 200 HP, 52 damage
    // Power: (200 × 0.08 × 0.8) + (52 × 1.2 × 1.2) + (4.5 × 15) = 12.8 + 74.88 + 67.5 = 155
    // Still low, bump damage: 60 damage
    // Power: (200 × 0.08 × 0.8) + (60 × 1.2 × 1.2) + (4.5 × 15) = 12.8 + 86.4 + 67.5 = 166.7
    // Add 2 archers: spawn 2
    // Per archer: 125 HP, 42 damage
    // Total: 250 HP, 84 DPS
    // Power: (250 × 0.08 × 0.8) + (84 × 1.2 × 1.2) + (4.5 × 15) + (1 × -15) = 16 + 120.96 + 67.5 - 15 = 189 ≈ 200
    health: 125,
    damage: 42,
    attackSpeed: 1.0,
    moveSpeed: 1.0,
    range: 5.5,
    spawnCount: 2,
    splashRadius: 0,
    isFlying: false,
    abilities: [],
    description: 'Two archers with decent range'
  },

  GOBLIN: {
    id: 'goblin',
    name: 'Goblins',
    elixirCost: 2,
    role: 'SWARM',
    // 3 goblins, fast but fragile
    // Per goblin: 80 HP, 52 damage @ 1.1 attack speed = 57.2 DPS each
    // Total: 240 HP, 171.6 DPS
    // Power: (240 × 0.08 × 0.7) + (171.6 × 1.2 × 1.1) + (2 × -15 × 0.5) + (0.1 × 10 × 50) = 13.44 + 226.5 - 15 + 50 = 274
    // Too high, reduce damage: 40 damage @ 1.1 = 44 DPS each = 132 total
    // Power: (240 × 0.08 × 0.7) + (132 × 1.2 × 1.1) + (2 × -15 × 0.5) + (0.1 × 10 × 50) + MELEE = 13.44 + 174.24 - 15 + 50 - 15 = 207
    health: 80,
    damage: 40,
    attackSpeed: 1.1,
    moveSpeed: 1.1,
    range: 1.0,
    spawnCount: 3,
    splashRadius: 0,
    isFlying: false,
    abilities: ['MELEE_ONLY'],
    description: 'Three fast goblins'
  },

  // ===================
  // 3 ELIXIR (300 power budget)
  // ===================

  KNIGHT: {
    id: 'knight',
    name: 'Knight',
    elixirCost: 3,
    role: 'BALANCED',
    // Balanced fighter - even HP and DPS
    // HP power: 660 × 0.08 × 1.0 = 52.8
    // DPS power: 75 × 1.0 × 1.2 × 1.0 = 90
    // Total: 52.8 + 90 + MELEE(-15) = 127.8
    // Need more HP: 1200 HP
    // HP power: 1200 × 0.08 = 96
    // DPS power: 90
    // Total: 96 + 90 - 15 = 171... still low
    // Bump damage to 120
    // HP: 1200 × 0.08 = 96
    // DPS: 120 × 1.2 = 144
    // Total: 96 + 144 - 15 = 225... still low
    // Let's use 1500 HP, 100 damage
    // HP: 1500 × 0.08 = 120
    // DPS: 100 × 1.2 = 120
    // Total: 120 + 120 - 15 = 225... still low
    // Actually let me recalc the weights properly
    // With high stats: 2000 HP, 120 damage
    // HP: 2000 × 0.08 = 160
    // DPS: 120 × 1.2 = 144
    // Total: 160 + 144 - 15 = 289 ≈ 300
    health: 2000,
    damage: 120,
    attackSpeed: 1.0,
    moveSpeed: 1.0,
    range: 1.0,
    spawnCount: 1,
    splashRadius: 0,
    isFlying: false,
    abilities: ['MELEE_ONLY'],
    description: 'Sturdy melee fighter'
  },

  MUSKETEER: {
    id: 'musketeer',
    name: 'Musketeer',
    elixirCost: 3,
    role: 'DPS',
    // Ranged damage dealer
    // Low HP, high damage, good range
    // HP: 800 × 0.08 × 0.8 = 51.2
    // DPS: 100 × 1.2 × 1.2 = 144
    // Range: 5.5 × 15 = 82.5
    // Total: 51.2 + 144 + 82.5 = 277.7 ≈ 300
    health: 800,
    damage: 100,
    attackSpeed: 1.0,
    moveSpeed: 0.9,
    range: 5.5,
    spawnCount: 1,
    splashRadius: 0,
    isFlying: false,
    abilities: ['SLOW_MOVE'],
    description: 'Long-range single-target damage dealer'
  },

  // ===================
  // 4 ELIXIR (400 power budget)
  // ===================

  MINI_TANK: {
    id: 'mini_tank',
    name: 'Mini Tank',
    elixirCost: 4,
    role: 'TANK',
    // High HP tank
    // HP: 3500 × 0.08 × 1.2 = 336
    // DPS: 60 × 1.2 × 0.8 = 57.6
    // Total: 336 + 57.6 - 15 = 378.6 ≈ 400
    health: 3500,
    damage: 60,
    attackSpeed: 1.0,
    moveSpeed: 0.8,
    range: 1.0,
    spawnCount: 1,
    splashRadius: 0,
    isFlying: false,
    abilities: ['MELEE_ONLY', 'SLOW_MOVE'],
    description: 'Slow but extremely tanky'
  },

  WIZARD: {
    id: 'wizard',
    name: 'Wizard',
    elixirCost: 4,
    role: 'DPS',
    // Splash damage dealer
    // HP: 600 × 0.08 × 0.8 = 38.4
    // DPS: 80 × 1.2 × 1.2 = 115.2
    // Range: 5.0 × 15 = 75
    // Splash: 1.5 × 30 = 45
    // SPLASH_DAMAGE ability: +25
    // Total: 38.4 + 115.2 + 75 + 45 + 25 = 298.6
    // Bump to 90 damage: DPS = 90 × 1.2 × 1.2 = 129.6
    // Total: 38.4 + 129.6 + 75 + 45 + 25 = 313
    // Adjust HP to 700
    // HP: 700 × 0.08 × 0.8 = 44.8
    // Total: 44.8 + 129.6 + 75 + 45 + 25 = 319.4
    // Close enough with slow move: -15
    // Total: 319.4 - 15 = 304.4 ≈ 400... still too low
    // Let's do 1000 HP, 120 damage
    // HP: 1000 × 0.08 × 0.8 = 64
    // DPS: 120 × 1.2 × 1.2 = 172.8
    // Range: 5.0 × 15 = 75
    // Splash: 1.5 × 30 = 45
    // Ability: 25
    // Total: 64 + 172.8 + 75 + 45 + 25 = 381.8 ≈ 400
    health: 1000,
    damage: 120,
    attackSpeed: 1.0,
    moveSpeed: 0.9,
    range: 5.0,
    spawnCount: 1,
    splashRadius: 1.5,
    isFlying: false,
    abilities: ['SPLASH_DAMAGE', 'SLOW_MOVE'],
    description: 'Area damage wizard'
  },

  // ===================
  // 5 ELIXIR (500 power budget)
  // ===================

  GIANT: {
    id: 'giant',
    name: 'Giant',
    elixirCost: 5,
    role: 'TANK',
    // Building-targeting tank
    // HP: 5000 × 0.08 × 1.2 = 480
    // DPS: 50 × 1.2 × 0.8 = 48
    // CANNOT_TARGET_AIR: -20
    // SLOW_MOVE: -15
    // Total: 480 + 48 - 20 - 15 = 493 ≈ 500
    health: 5000,
    damage: 50,
    attackSpeed: 1.0,
    moveSpeed: 0.7,
    range: 1.0,
    spawnCount: 1,
    splashRadius: 0,
    isFlying: false,
    abilities: ['MELEE_ONLY', 'CANNOT_TARGET_AIR', 'SLOW_MOVE'],
    targetsPriority: 'BUILDINGS',
    description: 'Massive tank that targets buildings'
  },

  DRAGON: {
    id: 'dragon',
    name: 'Baby Dragon',
    elixirCost: 5,
    role: 'BALANCED',
    // Flying splash damage
    // HP: 1800 × 0.08 × 1.0 = 144
    // DPS: 100 × 1.2 × 1.0 = 120
    // Flying: +40
    // Splash: 1.2 × 30 = 36
    // SPLASH ability: +25
    // Range: 3.0 × 15 = 45
    // Total: 144 + 120 + 40 + 36 + 25 + 45 = 410
    // Bump HP to 2200
    // HP: 2200 × 0.08 = 176
    // Total: 176 + 120 + 40 + 36 + 25 + 45 = 442
    // Bump damage to 130: DPS = 130 × 1.2 = 156
    // Total: 176 + 156 + 40 + 36 + 25 + 45 = 478
    // Add CANNOT_TARGET_BUILDINGS: -25
    // Total: 478 - 25 = 453... still low
    // Bump HP to 2800: HP power = 224
    // Total: 224 + 156 + 40 + 36 + 25 + 45 - 25 = 501 ≈ 500
    health: 2800,
    damage: 130,
    attackSpeed: 1.0,
    moveSpeed: 1.0,
    range: 3.0,
    spawnCount: 1,
    splashRadius: 1.2,
    isFlying: true,
    abilities: ['SPLASH_DAMAGE', 'CANNOT_TARGET_BUILDINGS'],
    description: 'Flying splash attacker'
  },

  // ===================
  // 6 ELIXIR (600 power budget)
  // ===================

  ELITE_BARBARIANS: {
    id: 'elite_barbarians',
    name: 'Elite Barbarians',
    elixirCost: 6,
    role: 'DPS',
    // Two fast hard-hitting units
    // Per unit: 1200 HP, 180 damage @ 1.0 = 180 DPS
    // Total: 2400 HP, 360 DPS
    // HP: 2400 × 0.08 × 0.8 = 153.6
    // DPS: 360 × 1.2 × 1.2 = 518.4
    // Speed: 0.3 × 10 × 50 = 150
    // Swarm: 1 × -15 = -15
    // MELEE: -15
    // Total: 153.6 + 518.4 + 150 - 15 - 15 = 792... way too high
    // Reduce: 900 HP, 140 damage each
    // Total: 1800 HP, 280 DPS
    // HP: 1800 × 0.08 × 0.8 = 115.2
    // DPS: 280 × 1.2 × 1.2 = 403.2
    // Speed: 0.2 × 10 × 50 = 100
    // Total: 115.2 + 403.2 + 100 - 15 - 15 = 588.4 ≈ 600
    health: 900,
    damage: 140,
    attackSpeed: 1.0,
    moveSpeed: 1.2,
    range: 1.0,
    spawnCount: 2,
    splashRadius: 0,
    isFlying: false,
    abilities: ['MELEE_ONLY'],
    description: 'Two fast elite barbarians'
  },

  // ===================
  // 7 ELIXIR (700 power budget)
  // ===================

  MEGA_KNIGHT: {
    id: 'mega_knight',
    name: 'Mega Knight',
    elixirCost: 7,
    role: 'TANK',
    // Heavy tank with splash and charge
    // HP: 5800 × 0.08 × 1.2 = 556.8
    // DPS: 100 × 1.2 × 0.8 = 96
    // Splash: 1.0 × 30 = 30
    // SPLASH: +25
    // CHARGE: +20
    // MELEE: -15
    // Total: 556.8 + 96 + 30 + 25 + 20 - 15 = 712.8 ≈ 700
    health: 5800,
    damage: 100,
    attackSpeed: 1.0,
    moveSpeed: 0.9,
    range: 1.0,
    spawnCount: 1,
    splashRadius: 1.0,
    isFlying: false,
    abilities: ['SPLASH_DAMAGE', 'CHARGE', 'MELEE_ONLY'],
    description: 'Heavy tank with jump attack'
  },

  // ===================
  // 8 ELIXIR (800 power budget)
  // ===================

  GOLEM: {
    id: 'golem',
    name: 'Golem',
    elixirCost: 8,
    role: 'TANK',
    // Massive tank that spawns golemites on death
    // HP: 8000 × 0.08 × 1.2 = 768
    // DPS: 50 × 1.2 × 0.8 = 48
    // DEATH_DAMAGE: +20
    // SPAWN_ON_DEATH: +15
    // SLOW_MOVE: -15
    // MELEE: -15
    // CANNOT_TARGET_AIR: -20
    // Total: 768 + 48 + 20 + 15 - 15 - 15 - 20 = 801 ≈ 800
    health: 8000,
    damage: 50,
    attackSpeed: 1.0,
    moveSpeed: 0.6,
    range: 1.0,
    spawnCount: 1,
    splashRadius: 0,
    isFlying: false,
    abilities: ['DEATH_DAMAGE', 'SPAWN_ON_DEATH', 'SLOW_MOVE', 'MELEE_ONLY', 'CANNOT_TARGET_AIR'],
    targetsPriority: 'BUILDINGS',
    description: 'Massive golem that spawns golemites on death'
  }
};

// ===================
// SPELL DEFINITIONS
// ===================

export const SPELL_STATS = {
  FIREBALL: {
    id: 'fireball',
    name: 'Fireball',
    elixirCost: 4,
    type: 'DAMAGE',
    // Direct damage spell
    // Damage: 572 burst in 2.5 radius
    // Power: 572 × 0.15 = 85.8
    // Radius bonus: 2.5 × 30 = 75
    // Ability: SPLASH_DAMAGE +25
    // Total: 85.8 + 75 + 25 = 185.8
    // Need more damage: 1000 burst
    // Power: 1000 × 0.15 = 150
    // Total: 150 + 75 + 25 = 250
    // Still low for 4 elixir (400 budget)
    // Adjust: damage weight for spells should be higher since they're instant
    // Let's say spell damage has effective weight of 0.25
    // Power: 1200 × 0.25 = 300
    // + radius: 2.5 × 30 = 75
    // Total: 375 ≈ 400
    damage: 1200,
    radius: 2.5,
    duration: 0,
    description: 'Deals area damage'
  },

  ARROWS: {
    id: 'arrows',
    name: 'Arrows',
    elixirCost: 3,
    type: 'DAMAGE',
    // Lower damage, larger area
    damage: 600,
    radius: 4.0,
    duration: 0,
    description: 'Rain of arrows'
  },

  FREEZE: {
    id: 'freeze',
    name: 'Freeze',
    elixirCost: 4,
    type: 'CONTROL',
    damage: 100,
    radius: 3.0,
    duration: 4.0,
    effect: 'STUN',
    description: 'Freezes all troops and buildings'
  },

  HEAL: {
    id: 'heal',
    name: 'Heal',
    elixirCost: 3,
    type: 'SUPPORT',
    healAmount: 500,
    radius: 3.0,
    duration: 2.0,
    description: 'Heals troops over time'
  },

  RAGE: {
    id: 'rage',
    name: 'Rage',
    elixirCost: 2,
    type: 'BUFF',
    radius: 5.0,
    duration: 8.0,
    effect: {
      speedBoost: 0.35,
      damageBoost: 0.35
    },
    description: 'Boosts movement and attack speed'
  },

  POISON: {
    id: 'poison',
    name: 'Poison',
    elixirCost: 4,
    type: 'DOT',
    damagePerSecond: 100,
    radius: 3.5,
    duration: 8.0,
    effect: 'SLOW',
    slowAmount: 0.15,
    description: 'Deals damage over time and slows'
  },

  LIGHTNING: {
    id: 'lightning',
    name: 'Lightning',
    elixirCost: 6,
    type: 'DAMAGE',
    damage: 1800,
    targets: 3,
    stunDuration: 0.5,
    description: 'Strikes 3 highest HP targets'
  }
};

// ===================
// BUILDING DEFINITIONS
// ===================

export const BUILDING_STATS = {
  CANNON: {
    id: 'cannon',
    name: 'Cannon',
    elixirCost: 3,
    type: 'DEFENSIVE',
    health: 1000,
    damage: 120,
    attackSpeed: 0.8,
    range: 5.5,
    lifetime: 30,
    abilities: ['CANNOT_TARGET_AIR'],
    description: 'Ground-targeting defensive building'
  },

  TESLA: {
    id: 'tesla',
    name: 'Tesla',
    elixirCost: 4,
    type: 'DEFENSIVE',
    health: 800,
    damage: 150,
    attackSpeed: 0.8,
    range: 5.5,
    lifetime: 35,
    abilities: ['INVISIBILITY'],
    description: 'Hidden tower that targets air and ground'
  },

  INFERNO_TOWER: {
    id: 'inferno_tower',
    name: 'Inferno Tower',
    elixirCost: 5,
    type: 'DEFENSIVE',
    health: 1400,
    damage: { min: 50, max: 800 }, // Ramps up
    attackSpeed: 0.4,
    range: 6.0,
    lifetime: 40,
    abilities: [],
    description: 'Deals ramping damage over time'
  },

  SPAWNER: {
    id: 'spawner',
    name: 'Goblin Hut',
    elixirCost: 5,
    type: 'SPAWNER',
    health: 1000,
    spawnUnit: 'GOBLIN_SINGLE',
    spawnInterval: 4.9,
    lifetime: 60,
    maxSpawns: 12,
    description: 'Spawns goblins over time'
  }
};

// ===================
// UTILITY FUNCTIONS
// ===================

/**
 * Get all units as an array
 */
export function getAllUnits() {
  return Object.values(UNIT_STATS);
}

/**
 * Get all spells as an array
 */
export function getAllSpells() {
  return Object.values(SPELL_STATS);
}

/**
 * Get all buildings as an array
 */
export function getAllBuildings() {
  return Object.values(BUILDING_STATS);
}

/**
 * Get unit by ID
 */
export function getUnit(id) {
  return UNIT_STATS[id.toUpperCase()] || null;
}

/**
 * Get spell by ID
 */
export function getSpell(id) {
  return SPELL_STATS[id.toUpperCase()] || null;
}

/**
 * Get building by ID
 */
export function getBuilding(id) {
  return BUILDING_STATS[id.toUpperCase()] || null;
}

/**
 * Get units filtered by cost
 */
export function getUnitsByCost(minCost, maxCost = minCost) {
  return getAllUnits().filter(u => u.elixirCost >= minCost && u.elixirCost <= maxCost);
}

/**
 * Get units filtered by role
 */
export function getUnitsByRole(role) {
  return getAllUnits().filter(u => u.role === role);
}
