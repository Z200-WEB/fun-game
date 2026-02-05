/**
 * GAME RENDERER - Enhanced Version
 *
 * Features:
 * - Stylized low-poly 3D graphics
 * - Particle effects
 * - Smooth animations with GSAP
 * - Drag and drop support
 */

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ARENA, CARDS, TOWERS } from '../../../shared/constants.js';

export class GameRenderer {
  constructor() {
    this.container = document.getElementById('game-container');
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.playerNumber = 1;

    // Object pools
    this.unitMeshes = new Map();
    this.towerMeshes = new Map();
    this.effectMeshes = [];
    this.particles = [];

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

    // Background
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 35, 70);

    // Enhanced lighting
    this.setupLighting();

    // Handle resize
    window.addEventListener('resize', () => this.onResize());

    console.log('Renderer initialized');
  }

  setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambient);

    // Main sun light
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sun.position.set(15, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    this.scene.add(sun);

    // Blue rim light
    const rim = new THREE.DirectionalLight(0x4a9eff, 0.4);
    rim.position.set(-15, 15, -15);
    this.scene.add(rim);

    // Hemisphere light
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.3);
    this.scene.add(hemi);
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
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.9
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
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
    const side1Geo = new THREE.PlaneGeometry(ARENA.WIDTH, ARENA.HALF_LENGTH - 2);
    const side1Mat = new THREE.MeshStandardMaterial({
      color: this.playerNumber === 1 ? 0x3d6b3d : 0x5d3d3d,
      roughness: 0.9,
      transparent: true,
      opacity: 0.3
    });
    const side1 = new THREE.Mesh(side1Geo, side1Mat);
    side1.rotation.x = -Math.PI / 2;
    side1.position.set(0, 0.02, -ARENA.HALF_LENGTH / 2 - 1);
    this.scene.add(side1);

    const side2Mat = new THREE.MeshStandardMaterial({
      color: this.playerNumber === 2 ? 0x3d6b3d : 0x5d3d3d,
      roughness: 0.9,
      transparent: true,
      opacity: 0.3
    });
    const side2 = new THREE.Mesh(side1Geo, side2Mat);
    side2.rotation.x = -Math.PI / 2;
    side2.position.set(0, 0.02, ARENA.HALF_LENGTH / 2 + 1);
    this.scene.add(side2);
  }

  createRiver() {
    const riverGeo = new THREE.PlaneGeometry(ARENA.WIDTH + 4, ARENA.RIVER_WIDTH + 0.5);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x3a8fd9,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85
    });
    this.river = new THREE.Mesh(riverGeo, riverMat);
    this.river.rotation.x = -Math.PI / 2;
    this.river.position.set(0, -0.1, ARENA.RIVER_Z);
    this.scene.add(this.river);

    // Banks
    const bankMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.8 });
    const bankGeo = new THREE.BoxGeometry(ARENA.WIDTH + 4, 0.3, 0.4);

    const bank1 = new THREE.Mesh(bankGeo, bankMat);
    bank1.position.set(0, 0, ARENA.RIVER_Z - ARENA.RIVER_WIDTH / 2 - 0.2);
    this.scene.add(bank1);

    const bank2 = bank1.clone();
    bank2.position.z = ARENA.RIVER_Z + ARENA.RIVER_WIDTH / 2 + 0.2;
    this.scene.add(bank2);
  }

  createBridge(x) {
    const bridgeGroup = new THREE.Group();

    const deckGeo = new THREE.BoxGeometry(ARENA.BRIDGE_WIDTH + 0.5, 0.4, ARENA.RIVER_WIDTH + 2);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.7 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 0.2;
    deck.castShadow = true;
    deck.receiveShadow = true;
    bridgeGroup.add(deck);

    // Railings
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5a4510, roughness: 0.6 });
    for (const side of [-1, 1]) {
      const railGeo = new THREE.BoxGeometry(0.15, 0.5, ARENA.RIVER_WIDTH + 2);
      const rail = new THREE.Mesh(railGeo, railMat);
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

    const baseColor = isEnemy ? 0xc44536 : 0x36c445;
    const accentColor = isEnemy ? 0x8b2020 : 0x208b20;
    const radius = isMain ? TOWERS.main.radius : TOWERS.side.radius;
    const height = isMain ? 5 : 3.5;

    // Base
    const baseGeo = new THREE.CylinderGeometry(radius * 1.2, radius * 1.4, 0.5, 6);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 0.6 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.25;
    base.castShadow = true;
    group.add(base);

    // Body
    const bodyGeo = new THREE.CylinderGeometry(radius * 0.8, radius, height, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.4, metalness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height / 2 + 0.5;
    body.castShadow = true;
    group.add(body);

    // Top
    const topGeo = new THREE.CylinderGeometry(radius * 1.0, radius * 0.8, 0.4, 8);
    const top = new THREE.Mesh(topGeo, baseMat);
    top.position.y = height + 0.7;
    group.add(top);

    // Roof
    const roofGeo = new THREE.ConeGeometry(radius * 1.1, 2, 8);
    const roofMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
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
    const glowMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.05;
    group.add(glow);

    return group;
  }

  createHealthBar(width) {
    const group = new THREE.Group();

    const bgGeo = new THREE.PlaneGeometry(width, 0.4);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.8 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    group.add(bg);

    const fillGeo = new THREE.PlaneGeometry(width - 0.1, 0.3);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.z = 0.01;
    fill.name = 'fill';
    fill.userData.maxWidth = width - 0.1;
    group.add(fill);

    return group;
  }

  createDragPreview() {
    const ringGeo = new THREE.RingGeometry(0.8, 1.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    this.dragPreview = new THREE.Mesh(ringGeo, ringMat);
    this.dragPreview.rotation.x = -Math.PI / 2;
    this.dragPreview.position.y = 0.1;
    this.dragPreview.visible = false;
    this.scene.add(this.dragPreview);

    const innerGeo = new THREE.CircleGeometry(0.7, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
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
    const color = isValid ? 0x4ade80 : 0xe94560;
    this.dragPreview.material.color.setHex(color);
    if (this.dragPreview.children[0]) {
      this.dragPreview.children[0].material.color.setHex(color);
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

            if (healthRatio > 0.5) fill.material.color.setHex(0x4ade80);
            else if (healthRatio > 0.25) fill.material.color.setHex(0xfbbf24);
            else fill.material.color.setHex(0xe94560);
          }
          healthBar.lookAt(this.camera.position);
        }

        if (towerData.health <= 0 && mesh.visible) {
          this.spawnParticles(mesh.position, 0xff6b35, 20);
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
        this.spawnParticles(mesh.position, 0xff4444, 8);
        gsap.to(mesh.scale, {
          x: 0, y: 0, z: 0, duration: 0.2,
          onComplete: () => {
            this.scene.remove(mesh);
            this.unitMeshes.delete(id);
          }
        });
      }
    }
  }

  createUnitMesh(unit) {
    const card = CARDS[unit.cardId];
    const group = new THREE.Group();

    const isFlying = card.stats?.flying;
    const yOffset = isFlying ? 2.5 : 0.5;
    const color = card.color;

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.35, 0.5, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = yOffset;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = yOffset + 0.55;
    group.add(head);

    // Team ring
    const ringColor = unit.owner === this.playerNumber ? 0x4ade80 : 0xe94560;
    const ringGeo = new THREE.RingGeometry(0.35, 0.45, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    // Shadow
    const shadowGeo = new THREE.CircleGeometry(0.4, 16);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    group.add(shadow);

    // Health bar
    const healthBar = this.createHealthBar(0.8);
    healthBar.position.y = yOffset + 1;
    healthBar.scale.set(0.8, 0.8, 0.8);
    healthBar.name = 'healthBar';
    group.add(healthBar);

    group.userData.yOffset = yOffset;
    group.userData.cardId = unit.cardId;

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
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const particle = new THREE.Mesh(geo, mat);
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
    const mat = new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.6 });
    const sphere = new THREE.Mesh(geo, mat);
    group.add(sphere);

    const ringGeo = new THREE.RingGeometry(effect.radius - 0.2, effect.radius + 0.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    group.position.set(effect.position.x, 1, effect.position.z);
    gsap.to(group.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.3, ease: 'power2.out' });
    gsap.to(mat, { opacity: 0, duration: 0.5 });
    gsap.to(ringMat, { opacity: 0, duration: 0.5 });

    return group;
  }

  update(state) {
    const delta = this.clock.getDelta();
    if (this.river) {
      const time = this.clock.getElapsedTime();
      this.river.position.y = -0.1 + Math.sin(time * 2) * 0.02;
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
