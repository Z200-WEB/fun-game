/**
 * HAND UI - Modern Card Hand Management
 *
 * Features:
 * - Curved fan layout (arc positioning)
 * - Smooth card add/remove animations
 * - Automatic rebalancing when cards change
 * - Drag-to-play support
 * - Card hover prioritization (hovered card on top)
 * - Responsive design (adapts to screen size)
 *
 * Architecture:
 * - HandUI manages CardUI instances
 * - Emits events for game integration
 * - Handles layout calculations
 */

import { gsap } from 'gsap';
import { CardUI } from './CardUI.js';

// ===================
// LAYOUT CONFIGURATION
// ===================

const DEFAULT_CONFIG = {
  // Container positioning
  position: 'bottom-center',    // 'bottom-center', 'bottom-left', 'bottom-right'
  offsetY: 20,                  // Distance from bottom edge

  // Card sizing
  cardWidth: 100,
  cardHeight: 140,
  cardGap: -20,                 // Negative for overlap

  // Fan/Arc settings
  enableArc: true,              // Use curved layout
  arcRadius: 800,               // Radius of the arc curve
  arcAngle: 25,                 // Total arc angle in degrees
  tiltMultiplier: 0.4,          // How much cards tilt based on position

  // Animation
  layoutDuration: 0.4,          // Time to animate layout changes
  staggerDelay: 0.05,           // Stagger between cards

  // Interaction
  hoverLift: 30,                // How much hovered card lifts
  hoverScale: 1.15,             // Hovered card scale
  maxCards: 4,                  // Maximum cards in hand

  // Z-index management
  baseZIndex: 100
};

// ===================
// HAND UI CLASS
// ===================

export class HandUI {
  /**
   * @param {HTMLElement} container - Parent container element
   * @param {Object} config - Configuration options
   */
  constructor(container, config = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Card management
    this.cards = new Map();      // cardId -> CardUI
    this.cardOrder = [];         // Array of cardIds in display order

    // State
    this.hoveredCardId = null;
    this.selectedCardId = null;
    this.isDragging = false;
    this.isDisabled = false;
    this.currentElixir = 0;

    // DOM
    this.element = null;

    // Event callbacks
    this.eventCallbacks = new Map();

    this._build();
    this._setupGlobalEvents();
  }

  // ===================
  // DOM CONSTRUCTION
  // ===================

  _build() {
    this.element = document.createElement('div');
    this.element.className = 'hand-ui';
    this.element.style.cssText = `
      position: fixed;
      bottom: ${this.config.offsetY}px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      justify-content: center;
      align-items: flex-end;
      pointer-events: none;
      z-index: ${this.config.baseZIndex};
      height: ${this.config.cardHeight + 60}px;
      padding: 20px 40px;
    `;

    // Cards container (for relative positioning)
    this.cardsContainer = document.createElement('div');
    this.cardsContainer.className = 'hand-cards-container';
    this.cardsContainer.style.cssText = `
      position: relative;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      pointer-events: auto;
    `;
    this.element.appendChild(this.cardsContainer);

    this.container.appendChild(this.element);
  }

  _setupGlobalEvents() {
    // Listen for card events via event delegation
    this.cardsContainer.addEventListener('card:selected', (e) => {
      this._onCardSelected(e.detail.card);
    });

    this.cardsContainer.addEventListener('card:hover', (e) => {
      if (e.detail.entering) {
        this._onCardHoverStart(e.detail.card.id);
      } else {
        this._onCardHoverEnd(e.detail.card.id);
      }
    });

    this.cardsContainer.addEventListener('card:dragmove', (e) => {
      this._onCardDragMove(e.detail);
    });
  }

  // ===================
  // CARD MANAGEMENT
  // ===================

  /**
   * Add a card to the hand
   * @param {CardData} cardData - Card data object
   * @param {boolean} animate - Whether to animate the addition
   */
  addCard(cardData, animate = true) {
    if (this.cards.has(cardData.id)) {
      console.warn(`HandUI: Card ${cardData.id} already in hand`);
      return;
    }

    if (this.cardOrder.length >= this.config.maxCards) {
      console.warn('HandUI: Hand is full');
      return;
    }

    // Create CardUI instance
    const cardUI = new CardUI(cardData, {
      width: this.config.cardWidth,
      height: this.config.cardHeight
    });

    // Add to tracking
    this.cards.set(cardData.id, cardUI);
    this.cardOrder.push(cardData.id);

    // Add to DOM
    this.cardsContainer.appendChild(cardUI.getElement());

    // Update playability based on current elixir
    cardUI.setPlayable(this.currentElixir >= cardData.cost);

    // Animate and layout
    if (animate) {
      cardUI.animateDraw();
    }

    this._updateLayout(animate);
    this._emit('hand:cardAdded', { card: cardData });
  }

  /**
   * Remove a card from the hand
   * @param {string} cardId - Card ID to remove
   * @param {Object} options - Animation options
   */
  removeCard(cardId, options = {}) {
    const cardUI = this.cards.get(cardId);
    if (!cardUI) return;

    const { animate = true, targetX, targetY } = options;

    if (animate && targetX !== undefined && targetY !== undefined) {
      // Animate card flying to target position
      cardUI.animatePlay(targetX, targetY).then(() => {
        this._finalizeRemoval(cardId);
      });
    } else {
      // Instant removal
      this._finalizeRemoval(cardId);
    }
  }

  _finalizeRemoval(cardId) {
    const cardUI = this.cards.get(cardId);
    if (!cardUI) return;

    // Remove from tracking
    this.cards.delete(cardId);
    this.cardOrder = this.cardOrder.filter(id => id !== cardId);

    // Dispose CardUI
    cardUI.dispose();

    // Update layout
    this._updateLayout(true);
    this._emit('hand:cardRemoved', { cardId });
  }

  /**
   * Update the entire hand with new cards
   * @param {CardData[]} cardsData - Array of card data
   */
  setCards(cardsData) {
    // Find cards to remove
    const newIds = new Set(cardsData.map(c => c.id));
    const toRemove = this.cardOrder.filter(id => !newIds.has(id));

    // Remove old cards
    toRemove.forEach(id => {
      const cardUI = this.cards.get(id);
      if (cardUI) cardUI.dispose();
      this.cards.delete(id);
    });

    // Add/update new cards
    this.cardOrder = [];
    cardsData.forEach(cardData => {
      if (this.cards.has(cardData.id)) {
        // Update existing
        this.cards.get(cardData.id).updateData(cardData);
        this.cardOrder.push(cardData.id);
      } else {
        // Add new
        const cardUI = new CardUI(cardData, {
          width: this.config.cardWidth,
          height: this.config.cardHeight
        });
        this.cards.set(cardData.id, cardUI);
        this.cardOrder.push(cardData.id);
        this.cardsContainer.appendChild(cardUI.getElement());
        cardUI.setPlayable(this.currentElixir >= cardData.cost);
      }
    });

    this._updateLayout(true);
  }

  /**
   * Update current elixir and card playability
   * @param {number} elixir - Current elixir amount
   */
  updateElixir(elixir) {
    this.currentElixir = elixir;

    this.cards.forEach((cardUI, id) => {
      const isPlayable = elixir >= cardUI.data.cost;
      cardUI.setPlayable(isPlayable);
    });
  }

  // ===================
  // LAYOUT CALCULATIONS
  // ===================

  _updateLayout(animate = true) {
    const count = this.cardOrder.length;
    if (count === 0) return;

    // Calculate positions for each card
    const positions = this._calculateCardPositions(count);

    // Apply positions
    this.cardOrder.forEach((cardId, index) => {
      const cardUI = this.cards.get(cardId);
      if (!cardUI) return;

      const pos = positions[index];
      const element = cardUI.getElement();

      // Set z-index (middle cards on top, unless hovered)
      const isHovered = cardId === this.hoveredCardId;
      const baseZ = count - Math.abs(index - Math.floor(count / 2));
      element.style.zIndex = isHovered ? 1000 : this.config.baseZIndex + baseZ;

      if (animate) {
        gsap.to(element, {
          x: pos.x,
          y: isHovered ? pos.y - this.config.hoverLift : pos.y,
          rotation: pos.rotation,
          duration: this.config.layoutDuration,
          delay: index * this.config.staggerDelay,
          ease: 'power2.out'
        });
      } else {
        gsap.set(element, {
          x: pos.x,
          y: pos.y,
          rotation: pos.rotation
        });
      }
    });
  }

  _calculateCardPositions(count) {
    const positions = [];
    const { cardWidth, cardGap, enableArc, arcRadius, arcAngle, tiltMultiplier } = this.config;

    if (count === 1) {
      // Single card - centered
      positions.push({ x: 0, y: 0, rotation: 0 });
      return positions;
    }

    // Calculate total width needed
    const totalWidth = count * cardWidth + (count - 1) * cardGap;
    const startX = -totalWidth / 2 + cardWidth / 2;

    for (let i = 0; i < count; i++) {
      // Base horizontal position
      const progress = count > 1 ? i / (count - 1) : 0.5; // 0 to 1
      const centered = progress - 0.5; // -0.5 to 0.5

      let x = startX + i * (cardWidth + cardGap);
      let y = 0;
      let rotation = 0;

      if (enableArc && count > 2) {
        // Arc calculations
        const angleRad = (centered * arcAngle * Math.PI) / 180;

        // Y offset based on arc
        y = Math.cos(angleRad) * arcRadius - arcRadius;
        y = Math.max(y, -50); // Clamp

        // Rotation based on position in arc
        rotation = centered * arcAngle * tiltMultiplier;
      }

      positions.push({ x, y, rotation });
    }

    return positions;
  }

  // ===================
  // EVENT HANDLERS
  // ===================

  _onCardHoverStart(cardId) {
    this.hoveredCardId = cardId;
    this._updateLayout(true);
  }

  _onCardHoverEnd(cardId) {
    if (this.hoveredCardId === cardId) {
      this.hoveredCardId = null;
      this._updateLayout(true);
    }
  }

  _onCardSelected(cardData) {
    if (this.isDisabled) return;

    // Check if card is playable
    if (this.currentElixir < cardData.cost) {
      this._emit('hand:cardNotPlayable', { card: cardData, reason: 'not_enough_elixir' });
      return;
    }

    this.selectedCardId = cardData.id;
    this._emit('hand:cardSelected', { card: cardData });
  }

  _onCardDragMove(detail) {
    this._emit('hand:cardDragging', detail);
  }

  // ===================
  // PUBLIC API
  // ===================

  /**
   * Get a card by ID
   */
  getCard(cardId) {
    return this.cards.get(cardId);
  }

  /**
   * Get all cards
   */
  getAllCards() {
    return Array.from(this.cards.values());
  }

  /**
   * Get card count
   */
  getCardCount() {
    return this.cards.size;
  }

  /**
   * Set disabled state for entire hand
   */
  setDisabled(disabled) {
    this.isDisabled = disabled;
    this.cards.forEach(cardUI => cardUI.setDisabled(disabled));
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedCardId = null;
  }

  /**
   * Get selected card
   */
  getSelectedCard() {
    return this.selectedCardId ? this.cards.get(this.selectedCardId) : null;
  }

  /**
   * Subscribe to events
   * Events: hand:cardAdded, hand:cardRemoved, hand:cardSelected, hand:cardNotPlayable, hand:cardDragging
   */
  on(event, callback) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event).push(callback);
    return this;
  }

  /**
   * Unsubscribe from events
   */
  off(event, callback) {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
    return this;
  }

  /**
   * Show the hand
   */
  show() {
    gsap.to(this.element, {
      y: 0,
      opacity: 1,
      duration: 0.5,
      ease: 'back.out(1.7)'
    });
  }

  /**
   * Hide the hand
   */
  hide() {
    gsap.to(this.element, {
      y: 100,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in'
    });
  }

  /**
   * Dispose and cleanup
   */
  dispose() {
    // Dispose all cards
    this.cards.forEach(cardUI => cardUI.dispose());
    this.cards.clear();
    this.cardOrder = [];

    // Remove DOM
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    // Clear callbacks
    this.eventCallbacks.clear();
  }

  // ===================
  // PRIVATE HELPERS
  // ===================

  _emit(event, detail) {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(detail));
    }
  }
}

// ===================
// CONVENIENCE FACTORY
// ===================

/**
 * Create a hand UI with default settings
 * @param {HTMLElement} container - Parent container
 * @param {Object} config - Optional configuration
 */
export function createHandUI(container = document.body, config = {}) {
  return new HandUI(container, config);
}
