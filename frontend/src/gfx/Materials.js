/**
 * MATERIALS - Centralized Material System
 *
 * Supercell-style visual design principles:
 * - Saturated, vibrant colors
 * - Consistent roughness (0.4-0.7 range for cartoon look)
 * - Minimal metalness (keeps it painterly)
 * - Team colors are bold and readable
 * - Environment uses earthy, natural tones
 */

import * as THREE from 'three';

// ===================
// COLOR PALETTE
// ===================
export const COLORS = {
  // Team colors
  FRIENDLY: 0x36c445,        // Bright green
  FRIENDLY_DARK: 0x208b20,   // Dark green (accents)
  ENEMY: 0xc44536,           // Bright red
  ENEMY_DARK: 0x8b2020,      // Dark red (accents)

  // UI feedback
  VALID: 0x4ade80,           // Mint green (deploy OK)
  INVALID: 0xe94560,         // Coral red (deploy NO)
  WARNING: 0xfbbf24,         // Amber (low health)

  // Environment
  GRASS: 0x2d5a27,           // Rich grass green
  GRASS_FRIENDLY: 0x3d6b3d,  // Friendly zone tint
  GRASS_ENEMY: 0x5d3d3d,     // Enemy zone tint
  WATER: 0x3a8fd9,           // River blue
  RIVER_BANK: 0x4a3728,      // Muddy brown

  // Structures
  WOOD_LIGHT: 0x8b6914,      // Bridge deck
  WOOD_DARK: 0x5a4510,       // Bridge rails
  STONE: 0x4a4a5a,           // Tower base

  // Effects
  FIREBALL: 0xff6b35,        // Orange
  FIREBALL_GLOW: 0xffaa00,   // Yellow-orange
  PARTICLE_HIT: 0xff4444,    // Red flash

  // UI
  HEALTH_FULL: 0x4ade80,     // Green
  HEALTH_MID: 0xfbbf24,      // Yellow
  HEALTH_LOW: 0xe94560,      // Red
  UI_DARK: 0x222222,         // Background
  SHADOW: 0x000000           // Black
};

// ===================
// MATERIAL PRESETS
// ===================

/**
 * Standard stylized material - the base for most game objects
 * Roughness 0.4-0.6 gives a painted/clay look
 */
const createStylized = (color, roughness = 0.5, metalness = 0.0) => {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: false  // Smooth shading for rounder look
  });
};

/**
 * Transparent overlay material - for zones, indicators
 */
const createOverlay = (color, opacity = 0.3) => {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    transparent: true,
    opacity,
    depthWrite: false  // Prevents z-fighting with ground
  });
};

/**
 * Unlit material - for UI elements that shouldn't be affected by lighting
 */
const createUnlit = (color, options = {}) => {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: options.depthWrite ?? true
  });
};

/**
 * Glossy material - for water, metallic accents
 */
const createGlossy = (color, opacity = 1) => {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.1,
    metalness: 0.3,
    transparent: opacity < 1,
    opacity
  });
};

// ===================
// MATERIAL LIBRARY
// ===================
export const Materials = {
  // ----- ENVIRONMENT -----
  ground: () => createStylized(COLORS.GRASS, 0.9),

  zoneFriendly: () => createOverlay(COLORS.GRASS_FRIENDLY, 0.3),
  zoneEnemy: () => createOverlay(COLORS.GRASS_ENEMY, 0.3),

  river: () => createGlossy(COLORS.WATER, 0.85),
  riverBank: () => createStylized(COLORS.RIVER_BANK, 0.8),

  bridgeDeck: () => createStylized(COLORS.WOOD_LIGHT, 0.7),
  bridgeRail: () => createStylized(COLORS.WOOD_DARK, 0.6),

  // ----- TOWERS -----
  towerBase: () => createStylized(COLORS.STONE, 0.6),

  towerBody: (isEnemy) => createStylized(
    isEnemy ? COLORS.ENEMY : COLORS.FRIENDLY,
    0.4,
    0.1  // Slight metalness for sheen
  ),

  towerRoof: (isEnemy) => createStylized(
    isEnemy ? COLORS.ENEMY_DARK : COLORS.FRIENDLY_DARK,
    0.5
  ),

  towerGlow: (isEnemy) => createUnlit(
    isEnemy ? COLORS.ENEMY : COLORS.FRIENDLY,
    { transparent: true, opacity: 0.3, doubleSide: true }
  ),

  // ----- UNITS -----
  unitBody: (color) => createStylized(color, 0.4, 0.1),

  unitTeamRing: (isFriendly) => createUnlit(
    isFriendly ? COLORS.VALID : COLORS.INVALID,
    { transparent: true, opacity: 0.8, doubleSide: true }
  ),

  unitShadow: () => createUnlit(COLORS.SHADOW, {
    transparent: true,
    opacity: 0.3,
    depthWrite: false
  }),

  // ----- UI / INDICATORS -----
  healthBarBg: () => createUnlit(COLORS.UI_DARK, {
    transparent: true,
    opacity: 0.8
  }),

  healthBarFill: (ratio) => {
    let color = COLORS.HEALTH_FULL;
    if (ratio <= 0.25) color = COLORS.HEALTH_LOW;
    else if (ratio <= 0.5) color = COLORS.HEALTH_MID;
    return createUnlit(color);
  },

  dragPreview: (isValid) => createUnlit(
    isValid ? COLORS.VALID : COLORS.INVALID,
    { transparent: true, opacity: 0.7, doubleSide: true }
  ),

  dragPreviewInner: (isValid) => createUnlit(
    isValid ? COLORS.VALID : COLORS.INVALID,
    { transparent: true, opacity: 0.2, doubleSide: true }
  ),

  // ----- EFFECTS -----
  particle: (color) => createUnlit(color, {
    transparent: true,
    opacity: 1
  }),

  fireball: () => createUnlit(COLORS.FIREBALL, {
    transparent: true,
    opacity: 0.6
  }),

  fireballRing: () => createUnlit(COLORS.FIREBALL_GLOW, {
    transparent: true,
    opacity: 0.8,
    doubleSide: true
  })
};

// ===================
// HELPER FUNCTIONS
// ===================

/**
 * Get team color based on ownership
 */
export function getTeamColor(isEnemy) {
  return isEnemy ? COLORS.ENEMY : COLORS.FRIENDLY;
}

/**
 * Get team accent color (darker variant)
 */
export function getTeamAccentColor(isEnemy) {
  return isEnemy ? COLORS.ENEMY_DARK : COLORS.FRIENDLY_DARK;
}

/**
 * Get health bar color based on ratio
 */
export function getHealthColor(ratio) {
  if (ratio <= 0.25) return COLORS.HEALTH_LOW;
  if (ratio <= 0.5) return COLORS.HEALTH_MID;
  return COLORS.HEALTH_FULL;
}

/**
 * Darken a hex color by amount (0-255)
 */
export function darkenColor(hex, amount = 40) {
  const r = Math.max(0, ((hex >> 16) & 0xff) - amount);
  const g = Math.max(0, ((hex >> 8) & 0xff) - amount);
  const b = Math.max(0, (hex & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

/**
 * Lighten a hex color by amount (0-255)
 */
export function lightenColor(hex, amount = 40) {
  const r = Math.min(255, ((hex >> 16) & 0xff) + amount);
  const g = Math.min(255, ((hex >> 8) & 0xff) + amount);
  const b = Math.min(255, (hex & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}
