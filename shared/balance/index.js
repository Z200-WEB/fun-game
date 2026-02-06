/**
 * BALANCE MODULE - Card Game Balance Framework
 *
 * Provides tools for balancing units, spells, and buildings
 * using a power budget system where each elixir grants ~100 power.
 *
 * Main exports:
 * - PowerCalculator: Calculate and analyze unit power
 * - BalanceDebugger: Generate balance reports
 * - UNIT_STATS, SPELL_STATS, BUILDING_STATS: Balanced definitions
 * - Config presets: DEV, PROD, TOURNAMENT, CASUAL
 */

// Core Balance System
export {
  BALANCE_CONSTANTS,
  STAT_WEIGHTS,
  ROLES,
  ABILITY_COSTS,
  PowerCalculator,
  BalanceDebugger,
  getBalanceCalculator,
  getBalanceDebugger
} from './Balance.js';

// Unit & Spell Definitions
export {
  UNIT_STATS,
  SPELL_STATS,
  BUILDING_STATS,
  getAllUnits,
  getAllSpells,
  getAllBuildings,
  getUnit,
  getSpell,
  getBuilding,
  getUnitsByCost,
  getUnitsByRole
} from './UnitStats.js';

// Configuration
export {
  DEV_CONFIG,
  PROD_CONFIG,
  TOURNAMENT_CONFIG,
  CASUAL_CONFIG,
  AGGRESSIVE_META,
  DEFENSIVE_META,
  SWARM_META,
  SPELL_META,
  DIFFICULTY_SCALING,
  LEVEL_SCALING,
  ELIXIR_CONFIG,
  TOWER_CONFIG,
  PHASE_CONFIG,
  setBalanceConfig,
  setMetaConfig,
  getActiveConfig,
  getFullConfig,
  resetConfig
} from './BalanceConfig.js';

// Debug Visualization
export {
  BalanceVisualizer,
  createBalanceOverlay
} from './BalanceDebug.js';
