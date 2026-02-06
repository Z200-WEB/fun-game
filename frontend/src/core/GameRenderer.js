/**
 * GAME RENDERER - Enhanced Version
 *
 * Features:
 * - Stylized low-poly 3D graphics
 * - Particle effects
 * - Smooth animations with GSAP
 * - Drag and drop support
 * - Centralized materials and lighting
 */

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ARENA, CARDS, TOWERS } from '../../../shared/constants.js';
import { Materials, COLORS, getHealthColor } from '../gfx/Materials.js';
import { LightingSystem } from '../gfx/Lighting.js';
import {
  preloadUnitModels,
  getUnitModel,
  getModelConfig,
  areModelsPreloaded,
  createAnimationMixer
} from '../gfx/UnitModels.js';

export class GameRenderer {
  constructor() {
    this.container = document.getElementById('game-container');
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.playerNumber = 1;

    // Lighting system
    this.lighting = null;

    // Object pools
    this.unitMeshes = new Map();
    this.towerMeshes = new Map();
    this.effectMeshes = [];
    this.particles = [];

    // Animation mixers for GLB models
    this.unitAnimationMixers = new Map();
    this.modelsLoaded = false;

    // Drag and drop
    this.dragPreview = null;
    this.isDragging = false;
    this.dragCardId = null;

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Animation clock
    this.clock = new THREE.Clock();

    this.init();
  }

  init() {
    // Renderer with better settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      150
    );

    // Initialize lighting system
    this.lighting = new LightingSystem(this.scene);
    this.lighting.setup('DAY');

    // Handle resize
    window.addEventListener('resize', () => this.onResize());

    console.log('Renderer initialized');
  }

  /**
   * Preload all GLB models before game starts
   * @param {Function} onProgress - Progress callback (percent, filename)
   * @returns {Promise<void>}
   */
  async preloadModels(onProgress = null) {
    console.log('Preloading 3D models...');
    await preloadUnitModels((percent, file) => {
      console.log(`Loading models: ${(percent * 100).toFixed(0)}% - ${file}`);
      if (onProgress) onProgress(percent, file);
    });
    this.modelsLoaded = true;
    console.log('All models preloaded');
  }

  initializeArena(playerNumber) {
    this.playerNumber = playerNumber;

    // Camera position
    const cameraZ = playerNumber === 1 ? -28 : 28;
    this.camera.position.set(0, 22, cameraZ);
    this.camera.lookAt(0, 0, 0);

    // Build arena
    this.createArena();
    this.createTowers();
    this.createDragPreview();

    console.log(`Arena initialized for Player ${playerNumber}`);
  }

  createArena() {
    // Ground
    const groundGeo = new THREE.PlaneGeometry(ARENA.WIDTH + 4, ARENA.LENGTH + 4, 20, 40);
    const ground = new THREE.Mesh(groundGeo, Materials.ground());
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Player side indicators
    this.createSideIndicators();

    // River
    this.createRiver();

    // Bridges
    this.createBridge(ARENA.BRIDGE_X_LEFT);
    this.createBridge(ARENA.BRIDGE_X_RIGHT);
  }

  createSideIndicators() {
    const sideGeo = new THREE.PlaneGeometry(ARENA.WIDTH, ARENA.HALF_LENGTH - 2);

    // Bottom side (Player 1's territory)
    const side1Mat = this.playerNumber === 1 ? Materials.zoneFriendly() : Materials.zoneEnemy();
    const side1 = new THREE.Mesh(sideGeo, side1Mat);
    side1.rotation.x = -Math.PI / 2;
    side1.position.set(0, 0.02, -ARENA.HALF_LENGTH / 2 - 1);
    this.scene.add(side1);

    // Top side (Player 2's territory)
    const side2Mat = this.playerNumber === 2 ? Materials.zoneFriendly() : Materials.zoneEnemy();
    const side2 = new THREE.Mesh(sideGeo, side2Mat);
    side2.rotation.x = -Math.PI / 2;
    side2.position.set(0, 0.02, ARENA.HALF_LENGTH / 2 + 1);
    this.scene.add(side2);
  }

  createRiver() {
    const riverGeo = new THREE.PlaneGeometry(ARENA.WIDTH + 4, ARENA.RIVER_WIDTH + 0.5);
    this.river = new THREE.Mesh(riverGeo, Materials.river());
    this.river.rotation.x = -Math.PI / 2;
    this.river.position.set(0, -0.1, ARENA.RIVER_Z);
    this.scene.add(this.river);

    // Banks
    const bankGeo = new THREE.BoxGeometry(ARENA.WIDTH + 4, 0.3, 0.4);

    const bank1 = new THREE.Mesh(bankGeo, Materials.riverBank());
    bank1.position.set(0, 0, ARENA.RIVER_Z - ARENA.RIVER_WIDTH / 2 - 0.2);
    this.scene.add(bank1);

    const bank2 = new THREE.Mesh(bankGeo, Materials.riverBank());
    bank2.position.z = ARENA.RIVER_Z + ARENA.RIVER_WIDTH / 2 + 0.2;
    this.scene.add(bank2);
  }

  createBridge(x) {
    const bridgeGroup = new THREE.Group();

    const deckGeo = new THREE.BoxGeometry(ARENA.BRIDGE_WIDTH + 0.5, 0.4, ARENA.RIVER_WIDTH + 2);
    const deck = new THREE.Mesh(deckGeo, Materials.bridgeDeck());
    deck.position.y = 0.2;
    deck.castShadow = true;
    deck.receiveShadow = true;
    bridgeGroup.add(deck);

    // Railings
    for (const side of [-1, 1]) {
      const railGeo = new THREE.BoxGeometry(0.15, 0.5, ARENA.RIVER_WIDTH + 2);
      const rail = new THREE.Mesh(railGeo, Materials.bridgeRail());
      rail.position.set(side * (ARENA.BRIDGE_WIDTH / 2 + 0.1), 0.65, 0);
      bridgeGroup.add(rail);
    }

    bridgeGroup.position.set(x, 0, ARENA.RIVER_Z);
    this.scene.add(bridgeGroup);
  }

  createTowers() {
    for (const playerKey of ['player1', 'player2']) {
      const isEnemy = (playerKey === 'player1' && this.playerNumber === 2) ||
                      (playerKey === 'player2' && this.playerNumber === 1);

      for (const towerKey of ['main', 'left', 'right']) {
        const isMain = towerKey === 'main';
        const pos = ARENA.TOWER_POSITIONS[playerKey][towerKey];
        const tower = this.createTowerMesh(isMain, isEnemy);

        tower.position.set(pos.x, 0, pos.z);
        this.scene.add(tower);
        this.towerMeshes.set(`${playerKey}_${towerKey}`, tower);

        // Spawn animation
        tower.scale.set(0, 0, 0);
        gsap.to(tower.scale, {
          x: 1, y: 1, z: 1,
          duration: 0.5,
          ease: 'back.out(1.7)',
          delay: Math.random() * 0.3
        });
      }
    }
  }

  createTowerMesh(isMain, isEnemy) {
    const group = new THREE.Group();

    const radius = isMain ? TOWERS.main.radius : TOWERS.side.radius;
    const height = isMain ? 5 : 3.5;

    // Base
    const baseGeo = new THREE.CylinderGeometry(radius * 1.2, radius * 1.4, 0.5, 6);
    const base = new THREE.Mesh(baseGeo, Materials.towerBase());
    base.position.y = 0.25;
    base.castShadow = true;
    group.add(base);

    // Body
    const bodyGeo = new THREE.CylinderGeometry(radius * 0.8, radius, height, 8);
    const body = new THREE.Mesh(bodyGeo, Materials.towerBody(isEnemy));
    body.position.y = height / 2 + 0.5;
    body.castShadow = true;
    group.add(body);

    // Top
    const topGeo = new THREE.CylinderGeometry(radius * 1.0, radius * 0.8, 0.4, 8);
    const top = new THREE.Mesh(topGeo, Materials.towerBase());
    top.position.y = height + 0.7;
    group.add(top);

    // Roof
    const roofGeo = new THREE.ConeGeometry(radius * 1.1, 2, 8);
    const roof = new THREE.Mesh(roofGeo, Materials.towerRoof(isEnemy));
    roof.position.y = height + 1.9;
    roof.castShadow = true;
    group.add(roof);

    // Health bar
    const healthBar = this.createHealthBar(radius * 2.5);
    healthBar.position.y = height + 4;
    healthBar.name = 'healthBar';
    group.add(healthBar);

    // Glow ring
    const glowGeo = new THREE.RingGeometry(radius * 1.3, radius * 1.5, 32);
    const glow = new THREE.Mesh(glowGeo, Materials.towerGlow(isEnemy));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.05;
    group.add(glow);

    return group;
  }

  createHealthBar(width) {
    const group = new THREE.Group();

    const bgGeo = new THREE.PlaneGeometry(width, 0.4);
    const bg = new THREE.Mesh(bgGeo, Materials.healthBarBg());
    group.add(bg);

    const fillGeo = new THREE.PlaneGeometry(width - 0.1, 0.3);
    const fill = new THREE.Mesh(fillGeo, Materials.healthBarFill(1));
    fill.position.z = 0.01;
    fill.name = 'fill';
    fill.userData.maxWidth = width - 0.1;
    group.add(fill);

    return group;
  }

  createDragPreview() {
    const ringGeo = new THREE.RingGeometry(0.8, 1.2, 32);
    this.dragPreview = new THREE.Mesh(ringGeo, Materials.dragPreview(true));
    this.dragPreview.rotation.x = -Math.PI / 2;
    this.dragPreview.position.y = 0.1;
    this.dragPreview.visible = false;
    this.scene.add(this.dragPreview);

    const innerGeo = new THREE.CircleGeometry(0.7, 32);
    const inner = new THREE.Mesh(innerGeo, Materials.dragPreviewInner(true));
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.05;
    inner.name = 'dragInner';
    this.dragPreview.add(inner);
  }

  // Drag and drop
  startDrag(cardId, clientX, clientY) {
    this.isDragging = true;
    this.dragCardId = cardId;
    this.dragPreview.visible = true;

    gsap.to(this.dragPreview.scale, {
      x: 1.1, y: 1.1, z: 1.1,
      duration: 0.5,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    });

    this.updateDrag(clientX, clientY);
  }

  updateDrag(clientX, clientY) {
    if (!this.isDragging) return null;

    const worldPos = this.screenToWorld(clientX, clientY);
    if (!worldPos) return null;

    const halfWidth = ARENA.WIDTH / 2;
    let x = Math.max(-halfWidth, Math.min(halfWidth, worldPos.x));
    let z = worldPos.z;

    if (this.playerNumber === 1) {
      z = Math.min(z, ARENA.RIVER_Z - 0.5);
      z = Math.max(z, -ARENA.HALF_LENGTH + 1);
    } else {
      z = Math.max(z, ARENA.RIVER_Z + 0.5);
      z = Math.min(z, ARENA.HALF_LENGTH - 1);
    }

    this.dragPreview.position.set(x, 0.1, z);

    const isValid = this.isValidDeployPosition(x, z, this.playerNumber);

    // Update materials based on validity
    this.dragPreview.material = Materials.dragPreview(isValid);
    if (this.dragPreview.children[0]) {
      this.dragPreview.children[0].material = Materials.dragPreviewInner(isValid);
    }

    return { x, z, isValid };
  }

  endDrag() {
    this.isDragging = false;
    this.dragCardId = null;
    this.dragPreview.visible = false;
    gsap.killTweensOf(this.dragPreview.scale);
    this.dragPreview.scale.set(1, 1, 1);

    return {
      x: this.dragPreview.position.x,
      z: this.dragPreview.position.z
    };
  }

  cancelDrag() {
    this.isDragging = false;
    this.dragCardId = null;
    this.dragPreview.visible = false;
    gsap.killTweensOf(this.dragPreview.scale);
    this.dragPreview.scale.set(1, 1, 1);
  }

  isValidDeployPosition(x, z, playerNumber) {
    if (Math.abs(x) > ARENA.WIDTH / 2) return false;
    return playerNumber === 1 ? z < ARENA.RIVER_Z : z > ARENA.RIVER_Z;
  }

  screenToWorld(clientX, clientY) {
    const mouse = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersection);
    return hit ? { x: intersection.x, z: intersection.z } : null;
  }

  // Update methods
  updateFromState(state, playerNumber) {
    this.updateTowers(state.towers);
    this.updateUnits(state.units);
    this.updateEffects(state.effects || []);
  }

  updateTowers(towers) {
    for (const playerKey of ['player1', 'player2']) {
      for (const towerKey of ['main', 'left', 'right']) {
        const towerData = towers[playerKey][towerKey];
        const mesh = this.towerMeshes.get(`${playerKey}_${towerKey}`);
        if (!mesh) continue;

        const healthRatio = Math.max(0, towerData.health / towerData.maxHealth);
        const healthBar = mesh.getObjectByName('healthBar');

        if (healthBar) {
          const fill = healthBar.getObjectByName('fill');
          if (fill) {
            gsap.to(fill.scale, { x: healthRatio, duration: 0.3 });
            fill.position.x = -(1 - healthRatio) * fill.userData.maxWidth / 2;

            // Update health bar color using centralized colors
            fill.material.color.setHex(getHealthColor(healthRatio));
          }
          healthBar.lookAt(this.camera.position);
        }

        if (towerData.health <= 0 && mesh.visible) {
          this.spawnParticles(mesh.position, COLORS.FIREBALL, 20);
          gsap.to(mesh.scale, { x: 0, y: 0, z: 0, duration: 0.5, ease: 'back.in(2)' });
        }
        mesh.visible = towerData.health > 0;
      }
    }
  }

  updateUnits(units) {
    const activeIds = new Set();

    for (const unit of units) {
      activeIds.add(unit.id);
      let mesh = this.unitMeshes.get(unit.id);

      if (!mesh) {
        mesh = this.createUnitMesh(unit);
        this.unitMeshes.set(unit.id, mesh);
        this.scene.add(mesh);

        mesh.scale.set(0, 0, 0);
        gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'back.out(2)' });
        this.spawnParticles(
          new THREE.Vector3(unit.position.x, 0.5, unit.position.z),
          CARDS[unit.cardId]?.color || 0xffffff, 10
        );
      }

      gsap.to(mesh.position, {
        x: unit.position.x,
        y: mesh.userData.yOffset,
        z: unit.position.z,
        duration: 0.05
      });

      mesh.rotation.y = unit.rotation || 0;
      this.updateUnitHealthBar(mesh, unit.health / unit.maxHealth);
    }

    for (const [id, mesh] of this.unitMeshes) {
      if (!activeIds.has(id)) {
        this.spawnParticles(mesh.position, COLORS.PARTICLE_HIT, 8);
        gsap.to(mesh.scale, {
          x: 0, y: 0, z: 0, duration: 0.2,
          onComplete: () => {
            this.scene.remove(mesh);
            this.unitMeshes.delete(id);
            // Cleanup animation mixer
            if (this.unitAnimationMixers.has(id)) {
              this.unitAnimationMixers.delete(id);
            }
          }
        });
      }
    }
  }

  createUnitMesh(unit) {
    const card = CARDS[unit.cardId];
    const group = new THREE.Group();
    const modelConfig = getModelConfig(unit.cardId);

    const isFlying = card.stats?.flying;
    const defaultYOffset = isFlying ? 2.5 : 0;
    const yOffset = modelConfig?.yOffset ?? defaultYOffset;
    const color = card.color;

    // Try to use GLB model if available
    const glbModel = this.modelsLoaded ? getUnitModel(unit.cardId) : null;

    if (glbModel) {
      // Use GLB model
      glbModel.position.y = yOffset;

      // Apply rotation offset from config
      if (modelConfig?.rotationOffset) {
        glbModel.rotation.y = modelConfig.rotationOffset;
      }

      // Enable shadows on all meshes in the model
      glbModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      group.add(glbModel);

      // Setup animation mixer if model has animations
      const animMixer = createAnimationMixer(glbModel, unit.cardId);
      if (animMixer) {
        this.unitAnimationMixers.set(unit.id, animMixer);
        // Auto-play first animation (usually idle/walk)
        animMixer.play('idle') || animMixer.play('walk') || animMixer.play(null);
      }

      group.userData.hasGLBModel = true;
    } else {
      // Fallback to primitive geometry
      const bodyGeo = new THREE.CapsuleGeometry(0.35, 0.5, 4, 8);
      const body = new THREE.Mesh(bodyGeo, Materials.unitBody(color));
      body.position.y = yOffset + 0.5;
      body.castShadow = true;
      group.add(body);

      const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
      const head = new THREE.Mesh(headGeo, Materials.unitBody(color));
      head.position.y = yOffset + 1.05;
      group.add(head);

      group.userData.hasGLBModel = false;
    }

    // Team ring (always add)
    const isFriendly = unit.owner === this.playerNumber;
    const ringGeo = new THREE.RingGeometry(0.5, 0.65, 16);
    const ring = new THREE.Mesh(ringGeo, Materials.unitTeamRing(isFriendly));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    // Shadow (always add)
    const shadowGeo = new THREE.CircleGeometry(0.5, 16);
    const shadow = new THREE.Mesh(shadowGeo, Materials.unitShadow());
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    group.add(shadow);

    // Health bar
    const healthBarY = glbModel ? (yOffset + 2.5) : (yOffset + 1.5);
    const healthBar = this.createHealthBar(1.0);
    healthBar.position.y = healthBarY;
    healthBar.scale.set(0.8, 0.8, 0.8);
    healthBar.name = 'healthBar';
    group.add(healthBar);

    group.userData.yOffset = 0;  // Group stays at ground level
    group.userData.cardId = unit.cardId;
    group.userData.unitId = unit.id;

    return group;
  }

  updateUnitHealthBar(mesh, healthRatio) {
    const healthBar = mesh.getObjectByName('healthBar');
    if (!healthBar) return;
    const fill = healthBar.getObjectByName('fill');
    if (fill) {
      fill.scale.x = Math.max(0.01, healthRatio);
      fill.position.x = -(1 - healthRatio) * fill.userData.maxWidth / 2;
    }
    healthBar.lookAt(this.camera.position);
  }

  spawnParticles(position, color, count) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.1, 4, 4);
      const particle = new THREE.Mesh(geo, Materials.particle(color));
      particle.position.copy(position);
      this.scene.add(particle);

      const vx = (Math.random() - 0.5) * 3;
      const vy = Math.random() * 3 + 1;
      const vz = (Math.random() - 0.5) * 3;

      gsap.to(particle.position, { x: position.x + vx, y: position.y + vy, z: position.z + vz, duration: 0.5, ease: 'power2.out' });
      gsap.to(particle.material, { opacity: 0, duration: 0.5, onComplete: () => this.scene.remove(particle) });
      gsap.to(particle.scale, { x: 0, y: 0, z: 0, duration: 0.5 });
    }
  }

  updateEffects(effects) {
    for (const mesh of this.effectMeshes) this.scene.remove(mesh);
    this.effectMeshes = [];

    for (const effect of effects) {
      if (effect.type === 'fireball') {
        const effectMesh = this.createFireballEffect(effect);
        this.scene.add(effectMesh);
        this.effectMeshes.push(effectMesh);
      }
    }
  }

  createFireballEffect(effect) {
    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(effect.radius, 16, 16);
    const mat = Materials.fireball();
    const sphere = new THREE.Mesh(geo, mat);
    group.add(sphere);

    const ringGeo = new THREE.RingGeometry(effect.radius - 0.2, effect.radius + 0.2, 32);
    const ringMat = Materials.fireballRing();
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    group.position.set(effect.position.x, 1, effect.position.z);
    gsap.to(group.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.3, ease: 'power2.out' });
    gsap.to(mat, { opacity: 0, duration: 0.5 });
    gsap.to(ringMat, { opacity: 0, duration: 0.5 });

    return group;
  }

  /**
   * Switch lighting preset (for game phase changes)
   */
  setLightingPreset(preset) {
    if (this.lighting) {
      this.lighting.transitionTo(preset);
    }
  }

  update(state) {
    const delta = this.clock.getDelta();

    // Update river animation
    if (this.river) {
      const time = this.clock.getElapsedTime();
      this.river.position.y = -0.1 + Math.sin(time * 2) * 0.02;
    }

    // Update all unit animation mixers
    for (const [id, animMixer] of this.unitAnimationMixers) {
      if (animMixer && animMixer.update) {
        animMixer.update(delta);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Legacy compatibility
  showDeployPreview(show) {}
  updateDeployPreview(x, z, playerNumber) {}
}
