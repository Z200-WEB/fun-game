/**
 * GAME ENGINE
 *
 * Server-authoritative game simulation:
 * - Unit spawning and lifecycle
 * - Movement and pathfinding
 * - Combat system
 * - Tower AI
 * - Elixir management
 *
 * This is the single source of truth for game state.
 */

import {
  CARDS,
  DEFAULT_DECK,
  ARENA,
  TOWERS,
  TICK_RATE,
  ELIXIR_REGEN_RATE,
  ELIXIR_REGEN_RATE_DOUBLE,
  MAX_ELIXIR,
  STARTING_ELIXIR,
  UNIT_TYPES
} from '../shared/constants.js';

// Helper to generate unique IDs
let nextUnitId = 1;
function generateUnitId() {
  return nextUnitId++;
}

export class GameEngine {
  constructor() {
    this.tickCount = 0;

    // Player states
    this.players = {
      1: {
        elixir: STARTING_ELIXIR,
        deck: [...DEFAULT_DECK],
        hand: [], // Current 4 cards in hand
        nextCard: null // Next card to be drawn
      },
      2: {
        elixir: STARTING_ELIXIR,
        deck: [...DEFAULT_DECK],
        hand: [],
        nextCard: null
      }
    };

    // Initialize hands
    this.initializeHands();

    // Tower states
    this.towers = {
      player1: {
        main: { ...TOWERS.main, id: 't1_main' },
        left: { ...TOWERS.side, id: 't1_left' },
        right: { ...TOWERS.side, id: 't1_right' }
      },
      player2: {
        main: { ...TOWERS.main, id: 't2_main' },
        left: { ...TOWERS.side, id: 't2_left' },
        right: { ...TOWERS.side, id: 't2_right' }
      }
    };

    // Add tower positions
    Object.keys(ARENA.TOWER_POSITIONS.player1).forEach(key => {
      this.towers.player1[key].position = { ...ARENA.TOWER_POSITIONS.player1[key] };
    });
    Object.keys(ARENA.TOWER_POSITIONS.player2).forEach(key => {
      this.towers.player2[key].position = { ...ARENA.TOWER_POSITIONS.player2[key] };
    });

    // Active units on the field
    this.units = [];

    // Active spells/effects
    this.effects = [];

    // Tower attack cooldowns
    this.towerCooldowns = {};
  }

  /**
   * Initialize player hands with first 4 cards
   */
  initializeHands() {
    for (const playerNum of [1, 2]) {
      const player = this.players[playerNum];
      // Shuffle deck
      player.deck = this.shuffleArray([...player.deck]);
      // Draw 4 cards
      player.hand = player.deck.slice(0, 4);
      player.nextCard = player.deck[4];
    }
  }

  /**
   * Fisher-Yates shuffle
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Main update loop - called every tick
   */
  update(isDoubleElixir) {
    this.tickCount++;
    const deltaTime = 1 / TICK_RATE;

    // 1. Regenerate elixir
    this.updateElixir(deltaTime, isDoubleElixir);

    // 2. Update all units
    this.updateUnits(deltaTime);

    // 3. Process tower attacks
    this.updateTowers(deltaTime);

    // 4. Process effects (spells, etc.)
    this.updateEffects(deltaTime);

    // 5. Check win conditions
    return this.checkWinCondition();
  }

  /**
   * Regenerate elixir for both players
   */
  updateElixir(deltaTime, isDoubleElixir) {
    const rate = isDoubleElixir ? ELIXIR_REGEN_RATE_DOUBLE : ELIXIR_REGEN_RATE;

    for (const playerNum of [1, 2]) {
      this.players[playerNum].elixir = Math.min(
        MAX_ELIXIR,
        this.players[playerNum].elixir + rate * deltaTime
      );
    }
  }

  /**
   * Update all units (movement and combat)
   */
  updateUnits(deltaTime) {
    const unitsToRemove = [];

    for (const unit of this.units) {
      // Skip dead units
      if (unit.health <= 0) {
        unitsToRemove.push(unit.id);
        continue;
      }

      // Find target
      const target = this.findTarget(unit);

      if (target) {
        const distance = this.getDistance(unit.position, target.position);
        const range = unit.stats.range;

        if (distance <= range) {
          // In range - attack
          this.processUnitAttack(unit, target, deltaTime);
        } else {
          // Move towards target
          this.moveUnit(unit, target.position, deltaTime);
        }
      } else {
        // No target - move towards enemy towers
        const enemyPlayer = unit.owner === 1 ? 2 : 1;
        const targetTower = this.getClosestEnemyTower(unit.position, enemyPlayer);

        if (targetTower) {
          this.moveUnit(unit, targetTower.position, deltaTime);
        }
      }
    }

    // Remove dead units
    this.units = this.units.filter(u => !unitsToRemove.includes(u.id));
  }

  /**
   * Find the best target for a unit
   */
  findTarget(unit) {
    const enemyPlayer = unit.owner === 1 ? 2 : 1;
    const priorities = unit.stats.targetsPriority;

    // Can this unit target flying?
    const canTargetFlying = !unit.stats.cannotTargetFlying;

    let bestTarget = null;
    let bestDistance = Infinity;

    // Check for unit targets
    if (priorities.includes('unit')) {
      for (const other of this.units) {
        if (other.owner === unit.owner) continue;
        if (other.health <= 0) continue;
        if (other.stats.flying && !canTargetFlying) continue;

        const distance = this.getDistance(unit.position, other.position);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestTarget = other;
        }
      }

      // If found a close unit, return it
      if (bestTarget && bestDistance <= unit.stats.range + 2) {
        return bestTarget;
      }
    }

    // Check for building targets
    if (priorities.includes('building')) {
      const tower = this.getClosestEnemyTower(unit.position, enemyPlayer);
      if (tower) {
        const towerDist = this.getDistance(unit.position, tower.position);
        // Buildings-only units always prefer buildings
        if (priorities.length === 1 || towerDist < bestDistance) {
          return tower;
        }
      }
    }

    return bestTarget;
  }

  /**
   * Get the closest enemy tower that is still alive
   */
  getClosestEnemyTower(position, enemyPlayer) {
    const towers = this.towers[`player${enemyPlayer}`];
    let closestTower = null;
    let closestDist = Infinity;

    // Must destroy side towers before main (if they're in the way)
    const mainTower = towers.main;

    // Check side towers first
    for (const key of ['left', 'right']) {
      const tower = towers[key];
      if (tower.health <= 0) continue;

      const dist = this.getDistance(position, tower.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestTower = tower;
      }
    }

    // Check main tower (can only attack if path is clear or side tower is down)
    if (mainTower.health > 0) {
      const mainDist = this.getDistance(position, mainTower.position);
      // Allow attacking main if closer than side towers or side towers are down
      if (!closestTower || mainDist < closestDist) {
        closestTower = mainTower;
      }
    }

    return closestTower;
  }

  /**
   * Move a unit towards a target position
   */
  moveUnit(unit, targetPos, deltaTime) {
    const dx = targetPos.x - unit.position.x;
    const dz = targetPos.z - unit.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 0.1) return;

    // Normalize direction
    const dirX = dx / distance;
    const dirZ = dz / distance;

    // Calculate movement
    const moveSpeed = unit.stats.moveSpeed;
    const movement = moveSpeed * deltaTime;

    // Handle river crossing - units must use bridges
    const newZ = unit.position.z + dirZ * movement;
    if (this.crossesRiver(unit.position.z, newZ, unit.owner)) {
      // Check if on a bridge
      if (!this.isOnBridge(unit.position.x)) {
        // Move towards nearest bridge
        const nearestBridgeX = unit.position.x < 0 ? ARENA.BRIDGE_X_LEFT : ARENA.BRIDGE_X_RIGHT;
        const toBridgeX = nearestBridgeX - unit.position.x;
        if (Math.abs(toBridgeX) > 0.1) {
          unit.position.x += Math.sign(toBridgeX) * Math.min(movement, Math.abs(toBridgeX));
          return;
        }
      }
    }

    // Normal movement
    unit.position.x += dirX * movement;
    unit.position.z += dirZ * movement;

    // Update facing direction
    unit.rotation = Math.atan2(dirX, dirZ);
  }

  /**
   * Check if movement crosses the river
   */
  crossesRiver(oldZ, newZ, playerNum) {
    const riverMin = ARENA.RIVER_Z - ARENA.RIVER_WIDTH / 2;
    const riverMax = ARENA.RIVER_Z + ARENA.RIVER_WIDTH / 2;

    if (playerNum === 1) {
      // Player 1 moves from negative Z to positive Z
      return oldZ < riverMin && newZ >= riverMin;
    } else {
      // Player 2 moves from positive Z to negative Z
      return oldZ > riverMax && newZ <= riverMax;
    }
  }

  /**
   * Check if position is on a bridge
   */
  isOnBridge(x) {
    const halfBridge = ARENA.BRIDGE_WIDTH / 2;
    return (
      (x >= ARENA.BRIDGE_X_LEFT - halfBridge && x <= ARENA.BRIDGE_X_LEFT + halfBridge) ||
      (x >= ARENA.BRIDGE_X_RIGHT - halfBridge && x <= ARENA.BRIDGE_X_RIGHT + halfBridge)
    );
  }

  /**
   * Process a unit's attack
   */
  processUnitAttack(unit, target, deltaTime) {
    // Check cooldown
    unit.attackCooldown = unit.attackCooldown || 0;
    unit.attackCooldown -= deltaTime;

    if (unit.attackCooldown <= 0) {
      // Deal damage
      const damage = unit.stats.damage;

      // Handle splash damage
      if (unit.stats.splashRadius) {
        // Damage all enemies in radius
        const targets = this.getUnitsInRadius(target.position, unit.stats.splashRadius, unit.owner);
        targets.forEach(t => {
          t.health -= damage;
        });
      } else {
        target.health -= damage;
      }

      // Reset cooldown
      unit.attackCooldown = unit.stats.attackSpeed;

      // Mark unit as attacking (for client animation)
      unit.lastAttackTick = this.tickCount;
    }
  }

  /**
   * Get all enemy units in a radius
   */
  getUnitsInRadius(position, radius, excludeOwner) {
    return this.units.filter(u => {
      if (u.owner === excludeOwner) return false;
      if (u.health <= 0) return false;
      return this.getDistance(position, u.position) <= radius;
    });
  }

  /**
   * Update tower attacks
   */
  updateTowers(deltaTime) {
    for (const playerNum of [1, 2]) {
      const towers = this.towers[`player${playerNum}`];

      for (const key of ['main', 'left', 'right']) {
        const tower = towers[key];
        if (tower.health <= 0) continue;

        // Find target for tower
        const target = this.findTowerTarget(tower, playerNum);
        if (!target) continue;

        // Check cooldown
        const cooldownKey = tower.id;
        this.towerCooldowns[cooldownKey] = this.towerCooldowns[cooldownKey] || 0;
        this.towerCooldowns[cooldownKey] -= deltaTime;

        if (this.towerCooldowns[cooldownKey] <= 0) {
          // Tower attacks
          target.health -= tower.damage;
          this.towerCooldowns[cooldownKey] = 1 / tower.attackSpeed;
          tower.lastAttackTick = this.tickCount;
          tower.lastTarget = target.id;
        }
      }
    }
  }

  /**
   * Find target for a tower
   */
  findTowerTarget(tower, ownerPlayer) {
    const enemyPlayer = ownerPlayer === 1 ? 2 : 1;
    let closestUnit = null;
    let closestDist = tower.range;

    for (const unit of this.units) {
      if (unit.owner !== enemyPlayer) continue;
      if (unit.health <= 0) continue;

      const dist = this.getDistance(tower.position, unit.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestUnit = unit;
      }
    }

    return closestUnit;
  }

  /**
   * Update spell effects
   */
  updateEffects(deltaTime) {
    // Process any pending effects
    this.effects = this.effects.filter(effect => {
      effect.duration -= deltaTime;
      return effect.duration > 0;
    });
  }

  /**
   * Deploy a card
   */
  deployCard(playerNumber, cardId, x, z) {
    const player = this.players[playerNumber];
    const card = CARDS[cardId];

    // Validation
    if (!card) {
      return { success: false, error: 'Invalid card' };
    }

    if (!player.hand.includes(cardId)) {
      return { success: false, error: 'Card not in hand' };
    }

    if (player.elixir < card.elixirCost) {
      return { success: false, error: 'Not enough elixir' };
    }

    // Validate position (must be on own side, accounting for tower destruction)
    if (!this.isValidDeployPosition(playerNumber, x, z)) {
      return { success: false, error: 'Invalid deploy position' };
    }

    // Deduct elixir
    player.elixir -= card.elixirCost;

    // Handle spell cards
    if (card.type === 'spell') {
      this.processSpell(cardId, playerNumber, x, z);
    } else {
      // Spawn units
      this.spawnUnits(card, playerNumber, x, z);
    }

    // Update hand
    const cardIndex = player.hand.indexOf(cardId);
    player.hand.splice(cardIndex, 1);
    player.hand.push(player.nextCard);

    // Draw new next card (cycle through deck)
    const usedIndex = player.deck.indexOf(cardId);
    player.deck.push(player.deck.splice(usedIndex, 1)[0]);
    player.nextCard = player.deck[4];

    return { success: true };
  }

  /**
   * Check if a position is valid for deployment
   */
  isValidDeployPosition(playerNumber, x, z) {
    // Must be within arena bounds
    if (Math.abs(x) > ARENA.WIDTH / 2) return false;
    if (Math.abs(z) > ARENA.HALF_LENGTH) return false;

    // Must be on own side (with some tolerance at the river)
    if (playerNumber === 1) {
      // Player 1 deploys on negative Z side
      if (z > ARENA.RIVER_Z - ARENA.RIVER_WIDTH / 2 + 0.5) return false;
    } else {
      // Player 2 deploys on positive Z side
      if (z < ARENA.RIVER_Z + ARENA.RIVER_WIDTH / 2 - 0.5) return false;
    }

    return true;
  }

  /**
   * Spawn units from a card
   */
  spawnUnits(card, owner, x, z) {
    const count = card.count || 1;

    // Offset positions for multiple units
    const offsets = [
      { x: 0, z: 0 },
      { x: 0.5, z: 0.5 },
      { x: -0.5, z: 0.5 },
      { x: 0.5, z: -0.5 }
    ];

    for (let i = 0; i < count; i++) {
      const offset = offsets[i] || { x: 0, z: 0 };

      const unit = {
        id: generateUnitId(),
        cardId: card.id,
        owner,
        position: {
          x: x + offset.x,
          z: z + offset.z
        },
        rotation: owner === 1 ? 0 : Math.PI, // Face enemy side
        stats: { ...card.stats },
        health: card.stats.health,
        attackCooldown: 0,
        spawnTick: this.tickCount
      };

      this.units.push(unit);
    }
  }

  /**
   * Process a spell card
   */
  processSpell(cardId, owner, x, z) {
    const card = CARDS[cardId];

    if (cardId === 'fireball') {
      // Damage all enemies in radius
      const enemyOwner = owner === 1 ? 2 : 1;

      // Damage units
      for (const unit of this.units) {
        if (unit.owner !== enemyOwner) continue;

        const dist = this.getDistance({ x, z }, unit.position);
        if (dist <= card.stats.radius) {
          unit.health -= card.stats.damage;
        }
      }

      // Damage towers
      const towers = this.towers[`player${enemyOwner}`];
      for (const key of ['main', 'left', 'right']) {
        const tower = towers[key];
        if (tower.health <= 0) continue;

        const dist = this.getDistance({ x, z }, tower.position);
        if (dist <= card.stats.radius) {
          tower.health -= card.stats.towerDamage;
        }
      }

      // Add visual effect
      this.effects.push({
        type: 'fireball',
        position: { x, z },
        radius: card.stats.radius,
        duration: 0.5
      });
    }
  }

  /**
   * Calculate distance between two positions
   */
  getDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Check win conditions
   */
  checkWinCondition() {
    // Check if main tower is destroyed
    if (this.towers.player1.main.health <= 0) {
      return { gameOver: true, winner: 2, reason: 'main_tower_destroyed' };
    }

    if (this.towers.player2.main.health <= 0) {
      return { gameOver: true, winner: 1, reason: 'main_tower_destroyed' };
    }

    return { gameOver: false };
  }

  /**
   * Get winner by tiebreak (total tower HP)
   */
  getTiebreakWinner() {
    let p1HP = 0, p2HP = 0;

    for (const key of ['main', 'left', 'right']) {
      p1HP += Math.max(0, this.towers.player1[key].health);
      p2HP += Math.max(0, this.towers.player2[key].health);
    }

    return p1HP >= p2HP ? 1 : 2;
  }

  /**
   * Get serializable game state for clients
   */
  getState() {
    return {
      tick: this.tickCount,
      players: {
        1: {
          elixir: Math.floor(this.players[1].elixir * 10) / 10,
          hand: this.players[1].hand,
          nextCard: this.players[1].nextCard
        },
        2: {
          elixir: Math.floor(this.players[2].elixir * 10) / 10,
          hand: this.players[2].hand,
          nextCard: this.players[2].nextCard
        }
      },
      towers: {
        player1: {
          main: this.serializeTower(this.towers.player1.main),
          left: this.serializeTower(this.towers.player1.left),
          right: this.serializeTower(this.towers.player1.right)
        },
        player2: {
          main: this.serializeTower(this.towers.player2.main),
          left: this.serializeTower(this.towers.player2.left),
          right: this.serializeTower(this.towers.player2.right)
        }
      },
      units: this.units.map(u => this.serializeUnit(u)),
      effects: this.effects
    };
  }

  /**
   * Serialize a tower for network transmission
   */
  serializeTower(tower) {
    return {
      id: tower.id,
      health: tower.health,
      maxHealth: tower.id.includes('main') ? TOWERS.main.health : TOWERS.side.health,
      position: tower.position,
      lastAttackTick: tower.lastAttackTick,
      lastTarget: tower.lastTarget
    };
  }

  /**
   * Serialize a unit for network transmission
   */
  serializeUnit(unit) {
    return {
      id: unit.id,
      cardId: unit.cardId,
      owner: unit.owner,
      position: unit.position,
      rotation: unit.rotation,
      health: unit.health,
      maxHealth: unit.stats.health,
      lastAttackTick: unit.lastAttackTick,
      spawnTick: unit.spawnTick
    };
  }
}
