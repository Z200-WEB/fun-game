/**
 * GAME MODULE - Core Game Logic
 *
 * Shared between client and server for:
 * - Unit state management
 * - AI behavior system
 * - Target selection
 *
 * All classes are deterministic for multiplayer sync.
 */

// Unit
export {
  Unit,
  UnitState,
  UnitType,
  TargetPriority
} from './Unit.js';

// AI
export {
  UnitAI,
  AIManager
} from './UnitAI.js';

// Target Selection
export {
  TargetSelector,
  NearestTargetSelector,
  LowestHPSelector,
  HighestHPSelector,
  PriorityTargetSelector,
  ThreatBasedSelector,
  CompositeSelector,
  LineOfSightSelector,
  createTargetSelector,
  createCompositeSelector
} from './TargetSelector.js';
