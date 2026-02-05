/**
 * UI CONTROLLER - Enhanced Version
 *
 * Features:
 * - Modern card design
 * - Drag and drop support
 * - Smooth animations
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
    this.currentHand = [];
    this.currentElixir = 0;
    this.draggingCardId = null;

    // Callbacks
    this.onJoinCallback = null;
    this.onCardDragStartCallback = null;

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

  onJoin(callback) {
    this.onJoinCallback = callback;
  }

  onCardDragStart(callback) {
    this.onCardDragStartCallback = callback;
  }

  setDragging(isDragging, cardId) {
    this.draggingCardId = isDragging ? cardId : null;

    const cards = this.cardHand.querySelectorAll('.card');
    cards.forEach(card => {
      if (isDragging && card.dataset.cardId === cardId) {
        card.classList.add('dragging');
      } else {
        card.classList.remove('dragging');
      }
    });
  }

  showStatus(message) {
    this.lobbyStatus.textContent = message;
  }

  hideLobby() {
    this.lobby.classList.add('hidden');
  }

  showHUD() {
    this.hud.classList.add('active');
  }

  showCountdown(count) {
    this.countdown.style.display = 'block';
    this.countdown.textContent = count === 0 ? 'GO!' : count;

    if (count === 0) {
      setTimeout(() => {
        this.countdown.style.display = 'none';
      }, 1000);
    }
  }

  updateElixir(elixir) {
    this.currentElixir = elixir;
    const percentage = (elixir / 10) * 100;
    this.elixirFill.style.width = `${percentage}%`;
    this.elixirText.textContent = Math.floor(elixir);
    this.updateCardAffordability();
  }

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

  createCardElement(cardId, card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = cardId;

    // Card icon with gradient
    const icon = document.createElement('div');
    icon.className = 'card-icon';
    const colorHex = card.color.toString(16).padStart(6, '0');
    icon.style.background = `linear-gradient(135deg, #${colorHex} 0%, #${this.darkenColor(colorHex)} 100%)`;
    el.appendChild(icon);

    // Card name
    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = card.name;
    el.appendChild(name);

    // Elixir cost badge
    const cost = document.createElement('div');
    cost.className = 'card-cost';
    cost.textContent = card.elixirCost;
    el.appendChild(cost);

    // Drag hint
    const hint = document.createElement('div');
    hint.className = 'card-hint';
    hint.textContent = 'DRAG';
    el.appendChild(hint);

    // Drag handlers
    const startDrag = (clientX, clientY) => {
      if (this.currentElixir < card.elixirCost) return;
      if (this.onCardDragStartCallback) {
        this.onCardDragStartCallback(cardId, clientX, clientY);
      }
    };

    // Mouse drag
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    });

    // Touch drag
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    return el;
  }

  darkenColor(hex) {
    const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 40);
    const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 40);
    const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 40);
    return r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
  }

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

  updateNextCard(cardId) {
    const card = CARDS[cardId];
    if (!card) return;

    this.nextCardSlot.innerHTML = '';

    const el = document.createElement('div');
    el.className = 'card mini';

    const icon = document.createElement('div');
    icon.className = 'card-icon';
    const colorHex = card.color.toString(16).padStart(6, '0');
    icon.style.background = `linear-gradient(135deg, #${colorHex} 0%, #${this.darkenColor(colorHex)} 100%)`;
    el.appendChild(icon);

    this.nextCardSlot.appendChild(el);
  }

  updateTimer(elapsed, isDoubleElixir) {
    const remaining = Math.max(0, MATCH_DURATION - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);

    this.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (isDoubleElixir) {
      this.timer.style.color = '#d946ef';
      this.timer.style.textShadow = '0 0 10px rgba(217, 70, 239, 0.5)';
    } else {
      this.timer.style.color = '#fff';
      this.timer.style.textShadow = 'none';
    }
  }

  updateTowerHP(towers, playerNumber) {
    const enemyPlayer = playerNumber === 1 ? 'player2' : 'player1';
    const friendlyPlayer = playerNumber === 1 ? 'player1' : 'player2';

    this.enemyTowers.innerHTML = '';
    this.createTowerHPElements(towers[enemyPlayer], this.enemyTowers, 'enemy');

    this.friendlyTowers.innerHTML = '';
    this.createTowerHPElements(towers[friendlyPlayer], this.friendlyTowers, 'friendly');
  }

  createTowerHPElements(playerTowers, container, type) {
    for (const key of ['left', 'main', 'right']) {
      const tower = playerTowers[key];
      const el = document.createElement('div');
      el.className = `tower-hp-item ${type}`;

      if (tower.health <= 0) {
        el.innerHTML = key === 'main' ? '<span class="tower-icon">👑</span> X' : '<span class="tower-icon">🏰</span> X';
        el.style.opacity = '0.5';
      } else {
        const icon = key === 'main' ? '👑' : '🏰';
        const percent = Math.round((tower.health / tower.maxHealth) * 100);
        el.innerHTML = `<span class="tower-icon">${icon}</span> ${percent}%`;
      }

      container.appendChild(el);
    }
  }

  showSuddenDeath() {
    this.countdown.style.display = 'block';
    this.countdown.textContent = 'SUDDEN DEATH!';
    this.countdown.style.color = '#e94560';

    setTimeout(() => {
      this.countdown.style.display = 'none';
      this.countdown.style.color = '#fff';
    }, 2000);
  }

  showGameOver(isWinner, reason) {
    this.gameOver.classList.add('active');

    if (isWinner) {
      this.gameOverText.textContent = 'VICTORY!';
      this.gameOverText.className = 'game-over-text win';
    } else {
      this.gameOverText.textContent = 'DEFEAT';
      this.gameOverText.className = 'game-over-text lose';
    }

    const reasonTexts = {
      'main_tower_destroyed': 'Main tower destroyed',
      'tower_count': 'More towers destroyed',
      'tiebreak': 'Higher total tower HP',
      'opponent_left': 'Opponent disconnected'
    };
    this.gameOverReason.textContent = reasonTexts[reason] || reason;
  }

  showError(message) {
    console.error('Error:', message);
  }

  // Legacy compatibility (not used anymore)
  onCardSelect(callback) {}
  onCardDeselect(callback) {}
  selectCard(cardId) {}
  deselectCard() {}
}
