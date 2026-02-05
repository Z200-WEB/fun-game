/**
 * UI CONTROLLER
 *
 * Manages all HTML UI elements:
 * - Lobby
 * - HUD (timer, elixir, towers)
 * - Card hand
 * - Game over screen
 */

import { CARDS, MATCH_DURATION } from '../../../shared/constants.js';

export class UIController {
  constructor() {
    // UI Elements
    this.lobby = document.getElementById('lobby');
    this.hud = document.getElementById('hud');
    this.roomInput = document.getElementById('room-input');
    this.joinBtn = document.getElementById('join-btn');
    this.lobbyStatus = document.getElementById('lobby-status');

    this.timer = document.getElementById('timer');
    this.elixirFill = document.getElementById('elixir-fill');
    this.elixirText = document.getElementById('elixir-text');
    this.cardHand = document.getElementById('card-hand');
    this.nextCardSlot = document.getElementById('next-card-slot');
    this.enemyTowers = document.getElementById('enemy-towers');
    this.friendlyTowers = document.getElementById('friendly-towers');

    this.countdown = document.getElementById('countdown');
    this.gameOver = document.getElementById('game-over');
    this.gameOverText = document.getElementById('game-over-text');
    this.gameOverReason = document.getElementById('game-over-reason');

    // State
    this.selectedCardId = null;
    this.currentHand = [];
    this.currentElixir = 0;

    // Callbacks
    this.onJoinCallback = null;
    this.onCardSelectCallback = null;
    this.onCardDeselectCallback = null;

    this.init();
  }

  init() {
    // Join button handler
    this.joinBtn.addEventListener('click', () => {
      if (this.onJoinCallback) {
        this.onJoinCallback(this.roomInput.value.trim());
      }
    });

    // Enter key in room input
    this.roomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && this.onJoinCallback) {
        this.onJoinCallback(this.roomInput.value.trim());
      }
    });
  }

  /**
   * Register join callback
   */
  onJoin(callback) {
    this.onJoinCallback = callback;
  }

  /**
   * Register card select callback
   */
  onCardSelect(callback) {
    this.onCardSelectCallback = callback;
  }

  /**
   * Register card deselect callback
   */
  onCardDeselect(callback) {
    this.onCardDeselectCallback = callback;
  }

  /**
   * Show status message in lobby
   */
  showStatus(message) {
    this.lobbyStatus.textContent = message;
  }

  /**
   * Hide lobby
   */
  hideLobby() {
    this.lobby.classList.add('hidden');
  }

  /**
   * Show game HUD
   */
  showHUD() {
    this.hud.classList.add('active');
  }

  /**
   * Show countdown number
   */
  showCountdown(count) {
    this.countdown.style.display = 'block';
    this.countdown.textContent = count === 0 ? 'GO!' : count;

    if (count === 0) {
      setTimeout(() => {
        this.countdown.style.display = 'none';
      }, 1000);
    }
  }

  /**
   * Update elixir display
   */
  updateElixir(elixir) {
    this.currentElixir = elixir;
    const percentage = (elixir / 10) * 100;
    this.elixirFill.style.width = `${percentage}%`;
    this.elixirText.textContent = Math.floor(elixir);

    // Update card affordability
    this.updateCardAffordability();
  }

  /**
   * Update card hand display
   */
  updateCards(hand, elixir) {
    this.currentHand = hand;
    this.currentElixir = elixir;

    // Clear existing cards
    this.cardHand.innerHTML = '';

    // Create card elements
    hand.forEach((cardId) => {
      const card = CARDS[cardId];
      const cardEl = this.createCardElement(cardId, card);
      this.cardHand.appendChild(cardEl);
    });

    this.updateCardAffordability();
  }

  /**
   * Create a card element
   */
  createCardElement(cardId, card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = cardId;

    // Card icon (colored circle for now)
    const icon = document.createElement('div');
    icon.className = 'card-icon';
    icon.style.backgroundColor = `#${card.color.toString(16).padStart(6, '0')}`;
    el.appendChild(icon);

    // Card name
    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = card.name;
    el.appendChild(name);

    // Elixir cost
    const cost = document.createElement('div');
    cost.className = 'card-cost';
    cost.textContent = card.elixirCost;
    el.appendChild(cost);

    // Click handler
    el.addEventListener('click', (e) => {
      e.stopPropagation();

      // Check if can afford
      if (this.currentElixir < card.elixirCost) {
        return;
      }

      // Toggle selection
      if (this.selectedCardId === cardId) {
        this.deselectCard();
      } else {
        this.selectCard(cardId);
      }
    });

    return el;
  }

  /**
   * Select a card
   */
  selectCard(cardId) {
    // Deselect previous
    this.deselectCard();

    this.selectedCardId = cardId;

    // Highlight selected card
    const cards = this.cardHand.querySelectorAll('.card');
    cards.forEach(card => {
      if (card.dataset.cardId === cardId) {
        card.classList.add('selected');
      }
    });

    if (this.onCardSelectCallback) {
      this.onCardSelectCallback(cardId);
    }
  }

  /**
   * Deselect current card
   */
  deselectCard() {
    this.selectedCardId = null;

    const cards = this.cardHand.querySelectorAll('.card');
    cards.forEach(card => {
      card.classList.remove('selected');
    });

    if (this.onCardDeselectCallback) {
      this.onCardDeselectCallback();
    }
  }

  /**
   * Update card affordability based on elixir
   */
  updateCardAffordability() {
    const cards = this.cardHand.querySelectorAll('.card');

    cards.forEach(cardEl => {
      const cardId = cardEl.dataset.cardId;
      const card = CARDS[cardId];

      if (this.currentElixir >= card.elixirCost) {
        cardEl.classList.remove('disabled');
      } else {
        cardEl.classList.add('disabled');
      }
    });
  }

  /**
   * Update next card display
   */
  updateNextCard(cardId) {
    const card = CARDS[cardId];
    if (!card) return;

    this.nextCardSlot.innerHTML = '';

    const el = document.createElement('div');
    el.className = 'card';

    const icon = document.createElement('div');
    icon.className = 'card-icon';
    icon.style.backgroundColor = `#${card.color.toString(16).padStart(6, '0')}`;
    icon.style.width = '25px';
    icon.style.height = '25px';
    el.appendChild(icon);

    this.nextCardSlot.appendChild(el);
  }

  /**
   * Update timer display
   */
  updateTimer(elapsed, isDoubleElixir) {
    const remaining = Math.max(0, MATCH_DURATION - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);

    this.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Double elixir indicator
    if (isDoubleElixir) {
      this.timer.style.color = '#d946ef';
    } else {
      this.timer.style.color = '#fff';
    }
  }

  /**
   * Update tower HP displays
   */
  updateTowerHP(towers, playerNumber) {
    const enemyPlayer = playerNumber === 1 ? 'player2' : 'player1';
    const friendlyPlayer = playerNumber === 1 ? 'player1' : 'player2';

    // Enemy towers
    this.enemyTowers.innerHTML = '';
    this.createTowerHPElements(towers[enemyPlayer], this.enemyTowers, 'enemy');

    // Friendly towers
    this.friendlyTowers.innerHTML = '';
    this.createTowerHPElements(towers[friendlyPlayer], this.friendlyTowers, 'friendly');
  }

  createTowerHPElements(playerTowers, container, type) {
    for (const key of ['left', 'main', 'right']) {
      const tower = playerTowers[key];
      const el = document.createElement('div');
      el.className = `tower-hp-item ${type}`;

      if (tower.health <= 0) {
        el.textContent = key === 'main' ? '👑 X' : `🏰 X`;
        el.style.opacity = '0.5';
      } else {
        const icon = key === 'main' ? '👑' : '🏰';
        el.textContent = `${icon} ${tower.health}`;
      }

      container.appendChild(el);
    }
  }

  /**
   * Show sudden death notification
   */
  showSuddenDeath() {
    this.countdown.style.display = 'block';
    this.countdown.textContent = 'SUDDEN DEATH!';
    this.countdown.style.color = '#e94560';

    setTimeout(() => {
      this.countdown.style.display = 'none';
      this.countdown.style.color = '#fff';
    }, 2000);
  }

  /**
   * Show game over screen
   */
  showGameOver(isWinner, reason) {
    this.gameOver.classList.add('active');

    if (isWinner) {
      this.gameOverText.textContent = 'VICTORY!';
      this.gameOverText.className = 'game-over-text win';
    } else {
      this.gameOverText.textContent = 'DEFEAT';
      this.gameOverText.className = 'game-over-text lose';
    }

    // Reason text
    const reasonTexts = {
      'main_tower_destroyed': 'Main tower destroyed',
      'tower_count': 'More towers destroyed',
      'tiebreak': 'Higher total tower HP',
      'opponent_left': 'Opponent disconnected'
    };
    this.gameOverReason.textContent = reasonTexts[reason] || reason;
  }

  /**
   * Show error message
   */
  showError(message) {
    // Simple alert for now - could be improved with toast notifications
    console.error('Error:', message);
  }
}
