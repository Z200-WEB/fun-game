/**
 * CARD UI - Modern 2026-Style Card Component
 *
 * Features:
 * - Data-driven rendering (no hardcoded visuals)
 * - Smooth GSAP animations (hover, select, play)
 * - 3D tilt effect on hover
 * - Glow effects based on rarity
 * - Touch and mouse support
 * - Event emission for game integration
 *
 * Architecture:
 * - CardUI is a pure view component
 * - Receives CardData, emits events
 * - Does not manage game state
 */

import { gsap } from 'gsap';

// ===================
// CARD DATA INTERFACE
// ===================

/**
 * @typedef {Object} CardData
 * @property {string} id - Unique card identifier
 * @property {string} name - Display name
 * @property {number} cost - Elixir/mana cost
 * @property {'unit'|'spell'|'building'} type - Card type
 * @property {'common'|'rare'|'epic'|'legendary'} rarity - Rarity tier
 * @property {string} [artwork] - URL to artwork image (optional)
 * @property {number} [color] - Hex color for card accent
 * @property {string} [description] - Card description text
 * @property {Object} [stats] - Card stats (damage, health, etc.)
 */

// ===================
// RARITY CONFIGURATIONS
// ===================

const RARITY_CONFIG = {
  common: {
    borderColor: 'rgba(156, 163, 175, 0.6)',
    glowColor: 'rgba(156, 163, 175, 0.3)',
    gradient: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
    label: 'COMMON'
  },
  rare: {
    borderColor: 'rgba(59, 130, 246, 0.7)',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    label: 'RARE'
  },
  epic: {
    borderColor: 'rgba(168, 85, 247, 0.8)',
    glowColor: 'rgba(168, 85, 247, 0.5)',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    label: 'EPIC'
  },
  legendary: {
    borderColor: 'rgba(251, 191, 36, 0.9)',
    glowColor: 'rgba(251, 191, 36, 0.6)',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    label: 'LEGENDARY'
  }
};

const TYPE_ICONS = {
  unit: '⚔️',
  spell: '✨',
  building: '🏰'
};

// ===================
// CARD UI CLASS
// ===================

export class CardUI {
  /**
   * @param {CardData} data - Card data object
   * @param {Object} options - Configuration options
   */
  constructor(data, options = {}) {
    this.data = data;
    this.options = {
      width: options.width || 100,
      height: options.height || 140,
      interactive: options.interactive !== false,
      showStats: options.showStats !== false,
      ...options
    };

    // State
    this.isHovered = false;
    this.isSelected = false;
    this.isDisabled = false;
    this.isPlayable = true;

    // DOM Elements
    this.element = null;
    this.artworkEl = null;
    this.glowEl = null;

    // Event handlers storage (for cleanup)
    this._handlers = new Map();

    // Build the card
    this._build();
    this._setupInteractions();
  }

  // ===================
  // DOM CONSTRUCTION
  // ===================

  _build() {
    const rarity = RARITY_CONFIG[this.data.rarity] || RARITY_CONFIG.common;

    // Main card container
    this.element = document.createElement('div');
    this.element.className = 'card-ui';
    this.element.dataset.cardId = this.data.id;
    this.element.style.cssText = `
      width: ${this.options.width}px;
      height: ${this.options.height}px;
      position: relative;
      border-radius: 12px;
      cursor: ${this.options.interactive ? 'grab' : 'default'};
      transform-style: preserve-3d;
      perspective: 1000px;
      user-select: none;
      touch-action: none;
    `;

    // Glow layer (behind card)
    this.glowEl = document.createElement('div');
    this.glowEl.className = 'card-glow';
    this.glowEl.style.cssText = `
      position: absolute;
      inset: -4px;
      border-radius: 16px;
      background: ${rarity.glowColor};
      filter: blur(12px);
      opacity: 0;
      z-index: -1;
      transition: opacity 0.3s;
    `;
    this.element.appendChild(this.glowEl);

    // Card body
    const body = document.createElement('div');
    body.className = 'card-body';
    body.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, rgba(30, 30, 45, 0.95) 0%, rgba(20, 20, 35, 0.98) 100%);
      border: 2px solid ${rarity.borderColor};
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    `;
    this.element.appendChild(body);

    // Shine overlay
    const shine = document.createElement('div');
    shine.className = 'card-shine';
    shine.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 100%);
      border-radius: 10px 10px 0 0;
      pointer-events: none;
    `;
    body.appendChild(shine);

    // Cost badge
    const cost = document.createElement('div');
    cost.className = 'card-cost';
    cost.textContent = this.data.cost;
    cost.style.cssText = `
      position: absolute;
      top: -8px;
      left: -8px;
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      color: #fff;
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 3px 10px rgba(139, 92, 246, 0.5);
      z-index: 10;
    `;
    body.appendChild(cost);

    // Type badge
    const type = document.createElement('div');
    type.className = 'card-type';
    type.textContent = TYPE_ICONS[this.data.type] || '❓';
    type.style.cssText = `
      position: absolute;
      top: -6px;
      right: -6px;
      width: 24px;
      height: 24px;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      z-index: 10;
    `;
    body.appendChild(type);

    // Artwork container
    const artworkContainer = document.createElement('div');
    artworkContainer.className = 'card-artwork-container';
    artworkContainer.style.cssText = `
      flex: 1;
      margin: 8px;
      margin-top: 12px;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    `;
    body.appendChild(artworkContainer);

    // Artwork (image or color placeholder)
    this.artworkEl = document.createElement('div');
    this.artworkEl.className = 'card-artwork';

    if (this.data.artwork) {
      this.artworkEl.style.cssText = `
        width: 100%;
        height: 100%;
        background-image: url(${this.data.artwork});
        background-size: cover;
        background-position: center;
      `;
    } else {
      // Color-based placeholder with icon
      const colorHex = (this.data.color || 0x888888).toString(16).padStart(6, '0');
      this.artworkEl.style.cssText = `
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #${colorHex} 0%, #${this._darkenColor(colorHex)} 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
      `;
      this.artworkEl.textContent = TYPE_ICONS[this.data.type] || '⚔️';
    }
    artworkContainer.appendChild(this.artworkEl);

    // Rarity indicator strip
    const rarityStrip = document.createElement('div');
    rarityStrip.className = 'card-rarity';
    rarityStrip.style.cssText = `
      height: 3px;
      background: ${rarity.gradient};
      margin: 0 8px;
    `;
    body.appendChild(rarityStrip);

    // Name section
    const nameSection = document.createElement('div');
    nameSection.className = 'card-name-section';
    nameSection.style.cssText = `
      padding: 6px 8px 8px;
      text-align: center;
    `;
    body.appendChild(nameSection);

    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = this.data.name;
    name.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    nameSection.appendChild(name);

    // Disabled overlay
    this.disabledOverlay = document.createElement('div');
    this.disabledOverlay.className = 'card-disabled-overlay';
    this.disabledOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 12px;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 20;
    `;
    const lockIcon = document.createElement('span');
    lockIcon.textContent = '🔒';
    lockIcon.style.fontSize = '24px';
    this.disabledOverlay.appendChild(lockIcon);
    body.appendChild(this.disabledOverlay);
  }

  // ===================
  // INTERACTIONS
  // ===================

  _setupInteractions() {
    if (!this.options.interactive) return;

    // Mouse events
    this._addHandler(this.element, 'mouseenter', (e) => this._onHoverStart(e));
    this._addHandler(this.element, 'mouseleave', (e) => this._onHoverEnd(e));
    this._addHandler(this.element, 'mousemove', (e) => this._onMouseMove(e));
    this._addHandler(this.element, 'mousedown', (e) => this._onPointerDown(e));
    this._addHandler(this.element, 'mouseup', (e) => this._onPointerUp(e));

    // Touch events
    this._addHandler(this.element, 'touchstart', (e) => this._onTouchStart(e), { passive: false });
    this._addHandler(this.element, 'touchend', (e) => this._onTouchEnd(e));
    this._addHandler(this.element, 'touchmove', (e) => this._onTouchMove(e), { passive: false });
  }

  _addHandler(element, event, handler, options) {
    element.addEventListener(event, handler, options);
    this._handlers.set(`${event}-${handler}`, { element, event, handler, options });
  }

  _onHoverStart(e) {
    if (this.isDisabled) return;
    this.isHovered = true;

    // Scale up with spring animation
    gsap.to(this.element, {
      scale: 1.15,
      y: -20,
      duration: 0.4,
      ease: 'back.out(1.7)'
    });

    // Show glow
    gsap.to(this.glowEl, {
      opacity: 1,
      duration: 0.3
    });

    // Emit event
    this._emit('card:hover', { card: this.data, entering: true });
  }

  _onHoverEnd(e) {
    if (this.isDisabled) return;
    this.isHovered = false;

    // Reset transform
    gsap.to(this.element, {
      scale: 1,
      y: 0,
      rotateX: 0,
      rotateY: 0,
      duration: 0.4,
      ease: 'power2.out'
    });

    // Hide glow
    gsap.to(this.glowEl, {
      opacity: 0,
      duration: 0.3
    });

    this._emit('card:hover', { card: this.data, entering: false });
  }

  _onMouseMove(e) {
    if (this.isDisabled || !this.isHovered) return;

    const rect = this.element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate tilt based on mouse position
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * 15;
    const rotateX = ((centerY - y) / centerY) * 10;

    gsap.to(this.element, {
      rotateX: rotateX,
      rotateY: rotateY,
      duration: 0.1,
      ease: 'power1.out'
    });
  }

  _onPointerDown(e) {
    if (this.isDisabled) return;
    e.preventDefault();

    gsap.to(this.element, {
      scale: 1.05,
      duration: 0.1
    });

    this.element.style.cursor = 'grabbing';
  }

  _onPointerUp(e) {
    if (this.isDisabled) return;

    gsap.to(this.element, {
      scale: this.isHovered ? 1.15 : 1,
      duration: 0.2,
      ease: 'back.out(1.7)'
    });

    this.element.style.cursor = 'grab';

    // Emit selection event
    this._emit('card:selected', { card: this.data });
  }

  _onTouchStart(e) {
    if (this.isDisabled) return;
    e.preventDefault();

    this.touchStartTime = Date.now();
    this.isHovered = true;

    gsap.to(this.element, {
      scale: 1.1,
      y: -15,
      duration: 0.3,
      ease: 'back.out(1.7)'
    });

    gsap.to(this.glowEl, { opacity: 1, duration: 0.2 });
  }

  _onTouchEnd(e) {
    if (this.isDisabled) return;

    const touchDuration = Date.now() - this.touchStartTime;

    // Reset visual state
    gsap.to(this.element, {
      scale: 1,
      y: 0,
      duration: 0.3,
      ease: 'power2.out'
    });

    gsap.to(this.glowEl, { opacity: 0, duration: 0.2 });
    this.isHovered = false;

    // If quick tap, emit selection
    if (touchDuration < 300) {
      this._emit('card:selected', { card: this.data });
    }
  }

  _onTouchMove(e) {
    // Allow parent to handle drag
    e.preventDefault();
    this._emit('card:dragmove', {
      card: this.data,
      touch: e.touches[0]
    });
  }

  // ===================
  // PUBLIC API
  // ===================

  /**
   * Get the DOM element
   */
  getElement() {
    return this.element;
  }

  /**
   * Update card data
   */
  updateData(newData) {
    this.data = { ...this.data, ...newData };
    // Could re-render specific parts here
  }

  /**
   * Set disabled state
   */
  setDisabled(disabled) {
    this.isDisabled = disabled;
    this.disabledOverlay.style.display = disabled ? 'flex' : 'none';
    this.element.style.cursor = disabled ? 'not-allowed' : 'grab';

    if (disabled) {
      gsap.to(this.element, { filter: 'grayscale(0.7)', duration: 0.3 });
    } else {
      gsap.to(this.element, { filter: 'grayscale(0)', duration: 0.3 });
    }
  }

  /**
   * Set playable state (enough resources)
   */
  setPlayable(playable) {
    this.isPlayable = playable;
    if (!playable) {
      gsap.to(this.element, { opacity: 0.5, duration: 0.2 });
    } else {
      gsap.to(this.element, { opacity: 1, duration: 0.2 });
    }
  }

  /**
   * Animate card being played
   */
  animatePlay(targetX, targetY) {
    return new Promise((resolve) => {
      gsap.to(this.element, {
        x: targetX - this.element.getBoundingClientRect().left,
        y: targetY - this.element.getBoundingClientRect().top,
        scale: 0.5,
        opacity: 0,
        rotation: 360,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: resolve
      });
    });
  }

  /**
   * Animate card draw (from deck)
   */
  animateDraw() {
    gsap.set(this.element, {
      scale: 0.3,
      opacity: 0,
      y: 100,
      rotateY: 180
    });

    return gsap.to(this.element, {
      scale: 1,
      opacity: 1,
      y: 0,
      rotateY: 0,
      duration: 0.5,
      ease: 'back.out(1.7)'
    });
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    this.element.addEventListener(event, callback);
    return this;
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    this.element.removeEventListener(event, callback);
    return this;
  }

  /**
   * Dispose and cleanup
   */
  dispose() {
    // Remove all handlers
    this._handlers.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this._handlers.clear();

    // Kill all GSAP animations
    gsap.killTweensOf(this.element);
    gsap.killTweensOf(this.glowEl);

    // Remove from DOM
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  // ===================
  // PRIVATE HELPERS
  // ===================

  _emit(eventName, detail) {
    const event = new CustomEvent(eventName, {
      bubbles: true,
      detail
    });
    this.element.dispatchEvent(event);
  }

  _darkenColor(hex) {
    const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 40);
    const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 40);
    const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 40);
    return r.toString(16).padStart(2, '0') +
           g.toString(16).padStart(2, '0') +
           b.toString(16).padStart(2, '0');
  }
}
