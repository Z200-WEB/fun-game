/**
 * BALANCE DEBUG - Visual Debug Tools for Balance System
 *
 * Provides real-time visualization of:
 * - Unit power scores
 * - Balance ratios
 * - Stat breakdowns
 * - Live adjustments
 *
 * Can be used in browser or Node.js (with HTML output)
 */

import { PowerCalculator, BalanceDebugger, BALANCE_CONSTANTS } from './Balance.js';
import { getAllUnits } from './UnitStats.js';

// ===================
// BALANCE VISUALIZER
// ===================

export class BalanceVisualizer {
  constructor(calculator = null) {
    this.calculator = calculator || new PowerCalculator();
    this.debugger = new BalanceDebugger(this.calculator);

    // Cached calculations
    this.powerCache = new Map();

    // UI state (for browser)
    this.container = null;
    this.isVisible = false;
  }

  // ===================
  // POWER BAR GENERATION
  // ===================

  /**
   * Generate ASCII power bar for terminal/console
   * @param {Object} unit - Unit definition
   * @param {number} width - Bar width in characters
   * @returns {string} - Formatted power bar
   */
  generatePowerBar(unit, width = 40) {
    const power = this.getPower(unit);
    const ratio = power.balanceRatio;

    // Clamp ratio to display range (0.5 to 1.5)
    const displayRatio = Math.max(0.5, Math.min(1.5, ratio));

    // Calculate positions
    const idealPos = Math.floor(width / 2);
    const currentPos = Math.floor(((displayRatio - 0.5) / 1.0) * width);

    // Build bar
    let bar = '';
    for (let i = 0; i < width; i++) {
      if (i === idealPos) {
        bar += '│';  // Ideal marker
      } else if (i === currentPos) {
        bar += ratio > 1 ? '▶' : '◀';
      } else if (i > Math.min(idealPos, currentPos) && i < Math.max(idealPos, currentPos)) {
        bar += ratio > 1 ? '═' : '─';
      } else {
        bar += '·';
      }
    }

    return `[${bar}] ${(ratio * 100).toFixed(0)}%`;
  }

  /**
   * Generate HTML power bar for browser
   * @param {Object} unit - Unit definition
   * @returns {string} - HTML string
   */
  generateHTMLPowerBar(unit) {
    const power = this.getPower(unit);
    const ratio = power.balanceRatio;

    // Calculate percentage for CSS
    const position = ((Math.min(1.5, Math.max(0.5, ratio)) - 0.5) / 1.0) * 100;

    // Determine color based on balance
    let color = '#4CAF50';  // Green for balanced
    if (ratio < 0.9) color = '#FF9800';  // Orange for weak
    if (ratio < 0.8) color = '#f44336';  // Red for very weak
    if (ratio > 1.1) color = '#FF9800';  // Orange for strong
    if (ratio > 1.2) color = '#f44336';  // Red for very strong

    return `
      <div class="balance-bar" data-unit="${unit.id}">
        <div class="balance-bar-label">${unit.name} (${unit.elixirCost})</div>
        <div class="balance-bar-track">
          <div class="balance-bar-ideal"></div>
          <div class="balance-bar-marker" style="left: ${position}%; background: ${color};"></div>
        </div>
        <div class="balance-bar-value" style="color: ${color};">${(ratio * 100).toFixed(0)}%</div>
      </div>
    `;
  }

  // ===================
  // BREAKDOWN GENERATION
  // ===================

  /**
   * Generate detailed breakdown for a unit
   * @param {Object} unit - Unit definition
   * @returns {Object} - Breakdown data
   */
  generateBreakdown(unit) {
    const power = this.getPower(unit);

    return {
      unit: unit.id,
      name: unit.name,
      cost: unit.elixirCost,
      role: unit.role,

      // Power summary
      totalPower: Math.round(power.totalPower),
      expectedPower: power.expectedPower,
      ratio: power.balanceRatio,
      status: power.balanceStatus,

      // Component breakdown
      components: {
        hp: {
          label: 'Health',
          value: Math.round(power.components.HP || 0),
          percent: ((power.components.HP || 0) / power.totalPower * 100).toFixed(1)
        },
        dps: {
          label: 'Damage',
          value: Math.round(power.components.DPS || 0),
          percent: ((power.components.DPS || 0) / power.totalPower * 100).toFixed(1)
        },
        mobility: {
          label: 'Mobility',
          value: Math.round(power.components.MOBILITY || 0),
          percent: ((power.components.MOBILITY || 0) / power.totalPower * 100).toFixed(1)
        },
        range: {
          label: 'Range',
          value: Math.round(power.components.RANGE || 0),
          percent: ((power.components.RANGE || 0) / power.totalPower * 100).toFixed(1)
        }
      },

      // Abilities
      abilities: power.abilities,

      // Raw stats
      stats: {
        health: unit.health,
        damage: unit.damage,
        dps: unit.damage * (unit.attackSpeed || 1),
        attackSpeed: unit.attackSpeed || 1,
        moveSpeed: unit.moveSpeed || 1,
        range: unit.range || 1,
        spawnCount: unit.spawnCount || 1
      }
    };
  }

  /**
   * Generate HTML breakdown panel
   */
  generateHTMLBreakdown(unit) {
    const breakdown = this.generateBreakdown(unit);

    let abilitiesHTML = '';
    for (const [ability, cost] of Object.entries(breakdown.abilities)) {
      const sign = cost >= 0 ? '+' : '';
      const color = cost >= 0 ? '#f44336' : '#4CAF50';
      abilitiesHTML += `<span class="ability-tag" style="color: ${color}">${ability} (${sign}${cost})</span>`;
    }

    return `
      <div class="balance-breakdown" data-unit="${unit.id}">
        <div class="breakdown-header">
          <h3>${breakdown.name}</h3>
          <span class="cost-badge">${breakdown.cost} Elixir</span>
          <span class="role-badge">${breakdown.role}</span>
        </div>

        <div class="breakdown-summary">
          <div class="power-total">
            <span class="label">Power:</span>
            <span class="value">${breakdown.totalPower}</span>
            <span class="expected">/ ${breakdown.expectedPower}</span>
          </div>
          <div class="balance-ratio status-${breakdown.status.toLowerCase()}">
            ${breakdown.status.replace('_', ' ')}
          </div>
        </div>

        <div class="breakdown-components">
          ${Object.values(breakdown.components).map(c => `
            <div class="component-row">
              <span class="component-label">${c.label}</span>
              <div class="component-bar">
                <div class="component-fill" style="width: ${c.percent}%"></div>
              </div>
              <span class="component-value">${c.value} (${c.percent}%)</span>
            </div>
          `).join('')}
        </div>

        ${abilitiesHTML ? `<div class="breakdown-abilities">${abilitiesHTML}</div>` : ''}

        <div class="breakdown-stats">
          <div class="stat">HP: ${breakdown.stats.health}</div>
          <div class="stat">DMG: ${breakdown.stats.damage}</div>
          <div class="stat">DPS: ${breakdown.stats.dps.toFixed(0)}</div>
          <div class="stat">SPD: ${breakdown.stats.moveSpeed}</div>
          <div class="stat">RNG: ${breakdown.stats.range}</div>
        </div>
      </div>
    `;
  }

  // ===================
  // COMPARISON
  // ===================

  /**
   * Generate comparison table for multiple units
   */
  generateComparisonTable(units) {
    const rows = units.map(unit => {
      const power = this.getPower(unit);
      return {
        id: unit.id,
        name: unit.name,
        cost: unit.elixirCost,
        power: Math.round(power.totalPower),
        expected: power.expectedPower,
        ratio: power.balanceRatio,
        status: power.balanceStatus,
        powerPerElixir: (power.totalPower / unit.elixirCost).toFixed(1)
      };
    });

    // Sort by power-per-elixir
    rows.sort((a, b) => b.powerPerElixir - a.powerPerElixir);

    return rows;
  }

  /**
   * Print comparison table to console
   */
  printComparisonTable(units) {
    const rows = this.generateComparisonTable(units);

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    BALANCE COMPARISON TABLE                    ║');
    console.log('╠════════════════════╦══════╦════════╦══════════╦═══════╦════════╣');
    console.log('║ Unit               ║ Cost ║ Power  ║ Expected ║ Ratio ║ Status ║');
    console.log('╠════════════════════╬══════╬════════╬══════════╬═══════╬════════╣');

    for (const row of rows) {
      const statusIcon = this._getStatusIcon(row.status);
      console.log(
        `║ ${row.name.padEnd(18)} ║` +
        ` ${row.cost.toString().padStart(4)} ║` +
        ` ${row.power.toString().padStart(6)} ║` +
        ` ${row.expected.toString().padStart(8)} ║` +
        ` ${(row.ratio * 100).toFixed(0).padStart(4)}% ║` +
        ` ${statusIcon.padEnd(6)} ║`
      );
    }

    console.log('╚════════════════════╩══════╩════════╩══════════╩═══════╩════════╝\n');
  }

  _getStatusIcon(status) {
    switch (status) {
      case 'PERFECT': return '✓ OK';
      case 'SLIGHTLY_WEAK': return '↓ LOW';
      case 'SLIGHTLY_STRONG': return '↑ HIGH';
      case 'UNDERPOWERED': return '⚠ WEAK';
      case 'OVERPOWERED': return '🔴 OP';
      default: return '? ???';
    }
  }

  // ===================
  // BROWSER OVERLAY
  // ===================

  /**
   * Create and inject debug overlay into DOM
   */
  createOverlay() {
    if (typeof document === 'undefined') {
      console.warn('BalanceVisualizer: No DOM available');
      return null;
    }

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'balance-debug-overlay';
    this.container.innerHTML = this._getOverlayHTML();
    this.container.style.cssText = this._getOverlayStyles();

    // Add styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = this._getDebugStyles();
    document.head.appendChild(styleSheet);

    // Add to DOM
    document.body.appendChild(this.container);

    // Bind events
    this._bindOverlayEvents();

    return this.container;
  }

  /**
   * Show/hide the overlay
   */
  toggleOverlay() {
    if (!this.container) {
      this.createOverlay();
    }

    this.isVisible = !this.isVisible;
    this.container.style.display = this.isVisible ? 'block' : 'none';

    if (this.isVisible) {
      this.refreshOverlay();
    }
  }

  /**
   * Refresh overlay content
   */
  refreshOverlay() {
    if (!this.container) return;

    const content = this.container.querySelector('.balance-content');
    if (!content) return;

    const units = getAllUnits();
    content.innerHTML = units.map(unit => this.generateHTMLPowerBar(unit)).join('');
  }

  _getOverlayHTML() {
    return `
      <div class="balance-header">
        <span>Balance Debugger</span>
        <button class="balance-close">×</button>
      </div>
      <div class="balance-controls">
        <button data-action="refresh">Refresh</button>
        <button data-action="export">Export</button>
        <select id="balance-filter">
          <option value="all">All Units</option>
          <option value="underpowered">Underpowered</option>
          <option value="overpowered">Overpowered</option>
          <option value="balanced">Balanced</option>
        </select>
      </div>
      <div class="balance-content">
        <!-- Power bars injected here -->
      </div>
    `;
  }

  _getOverlayStyles() {
    return `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 350px;
      max-height: 80vh;
      background: rgba(0, 0, 0, 0.9);
      border: 1px solid #444;
      border-radius: 8px;
      z-index: 10000;
      font-family: monospace;
      color: #fff;
      display: none;
      overflow: hidden;
    `;
  }

  _getDebugStyles() {
    return `
      #balance-debug-overlay .balance-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background: #333;
        border-bottom: 1px solid #444;
      }

      #balance-debug-overlay .balance-close {
        background: none;
        border: none;
        color: #fff;
        font-size: 20px;
        cursor: pointer;
      }

      #balance-debug-overlay .balance-controls {
        display: flex;
        gap: 5px;
        padding: 10px;
        background: #222;
      }

      #balance-debug-overlay .balance-controls button,
      #balance-debug-overlay .balance-controls select {
        padding: 5px 10px;
        background: #444;
        border: none;
        color: #fff;
        border-radius: 4px;
        cursor: pointer;
      }

      #balance-debug-overlay .balance-content {
        padding: 10px;
        max-height: calc(80vh - 100px);
        overflow-y: auto;
      }

      .balance-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 0;
        border-bottom: 1px solid #333;
      }

      .balance-bar-label {
        width: 120px;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .balance-bar-track {
        flex: 1;
        height: 8px;
        background: #333;
        border-radius: 4px;
        position: relative;
      }

      .balance-bar-ideal {
        position: absolute;
        left: 50%;
        top: 0;
        bottom: 0;
        width: 2px;
        background: #fff;
        opacity: 0.5;
      }

      .balance-bar-marker {
        position: absolute;
        top: -2px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        transform: translateX(-50%);
      }

      .balance-bar-value {
        width: 40px;
        text-align: right;
        font-size: 11px;
      }
    `;
  }

  _bindOverlayEvents() {
    if (!this.container) return;

    // Close button
    const closeBtn = this.container.querySelector('.balance-close');
    closeBtn?.addEventListener('click', () => this.toggleOverlay());

    // Refresh button
    const refreshBtn = this.container.querySelector('[data-action="refresh"]');
    refreshBtn?.addEventListener('click', () => this.refreshOverlay());

    // Export button
    const exportBtn = this.container.querySelector('[data-action="export"]');
    exportBtn?.addEventListener('click', () => this.exportReport());

    // Filter
    const filter = this.container.querySelector('#balance-filter');
    filter?.addEventListener('change', (e) => this.filterUnits(e.target.value));
  }

  /**
   * Export balance report as JSON
   */
  exportReport() {
    const units = getAllUnits();
    const report = this.debugger.generateReport(units);

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-report-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Filter displayed units
   */
  filterUnits(filter) {
    const units = getAllUnits().filter(unit => {
      const power = this.getPower(unit);

      switch (filter) {
        case 'underpowered':
          return power.balanceRatio < 0.9;
        case 'overpowered':
          return power.balanceRatio > 1.1;
        case 'balanced':
          return power.balanceRatio >= 0.9 && power.balanceRatio <= 1.1;
        default:
          return true;
      }
    });

    const content = this.container?.querySelector('.balance-content');
    if (content) {
      content.innerHTML = units.map(unit => this.generateHTMLPowerBar(unit)).join('');
    }
  }

  // ===================
  // UTILITY
  // ===================

  /**
   * Get cached power calculation
   */
  getPower(unit) {
    const cacheKey = unit.id;

    if (!this.powerCache.has(cacheKey)) {
      this.powerCache.set(cacheKey, this.calculator.calculatePower(unit));
    }

    return this.powerCache.get(cacheKey);
  }

  /**
   * Clear power cache (call after stat changes)
   */
  clearCache() {
    this.powerCache.clear();
  }

  /**
   * Dispose and cleanup
   */
  dispose() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.powerCache.clear();
  }
}

// ===================
// FACTORY FUNCTION
// ===================

let visualizerInstance = null;

/**
 * Create or get the balance overlay instance
 */
export function createBalanceOverlay(calculator) {
  if (!visualizerInstance) {
    visualizerInstance = new BalanceVisualizer(calculator);
  }
  return visualizerInstance;
}

// ===================
// KEYBOARD SHORTCUT
// ===================

// Register keyboard shortcut if in browser
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Shift + B to toggle balance debugger
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
      e.preventDefault();
      const visualizer = createBalanceOverlay();
      visualizer.toggleOverlay();
    }
  });
}
