/**
 * GAME RENDERER
 *
 * Handles all 3D rendering using Three.js:
 * - Scene setup
 * - Arena and towers
 * - Units
 * - Effects
 * - Camera control
 */

import * as THREE from 'three';
import { ARENA, CARDS, TOWERS } from '../../../shared/constants.js';

export class GameRenderer {
  constructor() {
    this.container = document.getElementById('game-container');
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.playerNumber = 1;

    // Object pools for performance
    this.unitMeshes = new Map(); // unitId -> mesh
    this.towerMeshes = new Map(); // towerId -> mesh
    this.effectMeshes = [];

    // Deploy preview
    this.deployPreview = null;
    this.deployArea = null;

    // Raycaster for mouse picking
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.init();
  }

  init() {
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );

    // Background
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Lighting
    this.setupLighting();

    // Handle resize
    window.addEventListener('resize', () => this.onResize());

    console.log('Renderer initialized');
  }

  setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    // Main directional light (sun)
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    this.scene.add(sun);

    // Rim light for depth
    const rim = new THREE.DirectionalLight(0x4a90d9, 0.3);
    rim.position.set(-10, 10, -10);
    this.scene.add(rim);
  }

  /**
   * Initialize arena based on player number
   */
  initializeArena(playerNumber) {
    this.playerNumber = playerNumber;

    // Set camera position based on player
    // Player 1 is at bottom (negative Z), Player 2 at top
    const cameraZ = playerNumber === 1 ? -25 : 25;
    const cameraLookZ = 0;

    this.camera.position.set(0, 20, cameraZ);
    this.camera.lookAt(0, 0, cameraLookZ);

    // Rotate camera slightly for Player 2
    if (playerNumber === 2) {
      this.camera.rotation.z = Math.PI;
    }

    // Create arena ground
    this.createArena();

    // Create initial towers
    this.createTowers();

    // Create deploy area indicator
    this.createDeployArea();

    console.log(`Arena initialized for Player ${playerNumber}`);
  }

  createArena() {
    // Main ground
    const groundGeo = new THREE.PlaneGeometry(ARENA.WIDTH, ARENA.LENGTH);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // River
    const riverGeo = new THREE.PlaneGeometry(ARENA.WIDTH, ARENA.RIVER_WIDTH);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x4a90d9,
      roughness: 0.3,
      transparent: true,
      opacity: 0.8
    });
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.y = 0.01;
    river.position.z = ARENA.RIVER_Z;
    this.scene.add(river);

    // Bridges
    this.createBridge(ARENA.BRIDGE_X_LEFT);
    this.createBridge(ARENA.BRIDGE_X_RIGHT);

    // Arena boundaries (walls)
    this.createWalls();

    // Grid lines for visual reference
    this.createGrid();
  }

  createBridge(x) {
    const bridgeGeo = new THREE.BoxGeometry(ARENA.BRIDGE_WIDTH, 0.3, ARENA.RIVER_WIDTH + 1);
    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.7
    });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.set(x, 0.15, ARENA.RIVER_Z);
    bridge.castShadow = true;
    bridge.receiveShadow = true;
    this.scene.add(bridge);
  }

  createWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x3d3d5c,
      roughness: 0.6
    });

    const wallHeight = 2;
    const wallThickness = 0.5;

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, ARENA.LENGTH),
      wallMat
    );
    leftWall.position.set(-ARENA.WIDTH / 2 - wallThickness / 2, wallHeight / 2, 0);
    this.scene.add(leftWall);

    // Right wall
    const rightWall = leftWall.clone();
    rightWall.position.x = ARENA.WIDTH / 2 + wallThickness / 2;
    this.scene.add(rightWall);
  }

  createGrid() {
    const gridHelper = new THREE.GridHelper(
      Math.max(ARENA.WIDTH, ARENA.LENGTH),
      20,
      0x444466,
      0x333355
    );
    gridHelper.position.y = 0.02;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    this.scene.add(gridHelper);
  }

  createTowers() {
    // Create towers for both players
    for (const playerKey of ['player1', 'player2']) {
      const isEnemy = (playerKey === 'player1' && this.playerNumber === 2) ||
                      (playerKey === 'player2' && this.playerNumber === 1);
      const color = isEnemy ? 0xe94560 : 0x4ade80;

      for (const towerKey of ['main', 'left', 'right']) {
        const isMain = towerKey === 'main';
        const pos = ARENA.TOWER_POSITIONS[playerKey][towerKey];
        const tower = this.createTowerMesh(isMain, color);

        tower.position.set(pos.x, 0, pos.z);
        this.scene.add(tower);
        this.towerMeshes.set(`${playerKey}_${towerKey}`, tower);
      }
    }
  }

  createTowerMesh(isMain, color) {
    const group = new THREE.Group();

    // Tower base
    const radius = isMain ? TOWERS.main.radius : TOWERS.side.radius;
    const height = isMain ? 4 : 3;

    // Cylindrical tower
    const towerGeo = new THREE.CylinderGeometry(radius * 0.8, radius, height, 8);
    const towerMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.6,
      metalness: 0.2
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = height / 2;
    tower.castShadow = true;
    group.add(tower);

    // Tower top
    const topGeo = new THREE.ConeGeometry(radius, 1.5, 8);
    const top = new THREE.Mesh(topGeo, towerMat);
    top.position.y = height + 0.75;
    top.castShadow = true;
    group.add(top);

    // Health bar (will be updated)
    const healthBar = this.createHealthBar(radius * 2);
    healthBar.position.y = height + 2.5;
    healthBar.name = 'healthBar';
    group.add(healthBar);

    return group;
  }

  createHealthBar(width) {
    const group = new THREE.Group();

    // Background
    const bgGeo = new THREE.PlaneGeometry(width, 0.3);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    group.add(bg);

    // Health fill
    const fillGeo = new THREE.PlaneGeometry(width, 0.25);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.z = 0.01;
    fill.name = 'fill';
    group.add(fill);

    // Make health bar always face camera
    group.lookAt(this.camera.position);

    return group;
  }

  createDeployArea() {
    // Visual indicator for valid deploy area
    const halfLength = ARENA.HALF_LENGTH;
    const width = ARENA.WIDTH;

    const areaGeo = new THREE.PlaneGeometry(width, halfLength - 2);
    const areaMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    this.deployArea = new THREE.Mesh(areaGeo, areaMat);
    this.deployArea.rotation.x = -Math.PI / 2;

    // Position based on player
    const zPos = this.playerNumber === 1 ? -halfLength / 2 - 1 : halfLength / 2 + 1;
    this.deployArea.position.set(0, 0.03, zPos);
    this.scene.add(this.deployArea);

    // Deploy preview circle
    const previewGeo = new THREE.RingGeometry(0.8, 1, 32);
    const previewMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    this.deployPreview = new THREE.Mesh(previewGeo, previewMat);
    this.deployPreview.rotation.x = -Math.PI / 2;
    this.deployPreview.position.y = 0.05;
    this.deployPreview.visible = false;
    this.scene.add(this.deployPreview);
  }

  /**
   * Update scene from game state
   */
  updateFromState(state, playerNumber) {
    // Update towers
    this.updateTowers(state.towers);

    // Update units
    this.updateUnits(state.units);

    // Update effects
    this.updateEffects(state.effects);
  }

  updateTowers(towers) {
    for (const playerKey of ['player1', 'player2']) {
      for (const towerKey of ['main', 'left', 'right']) {
        const towerData = towers[playerKey][towerKey];
        const mesh = this.towerMeshes.get(`${playerKey}_${towerKey}`);

        if (!mesh) continue;

        // Update health bar
        const healthRatio = Math.max(0, towerData.health / towerData.maxHealth);
        const healthBar = mesh.getObjectByName('healthBar');

        if (healthBar) {
          const fill = healthBar.getObjectByName('fill');
          if (fill) {
            fill.scale.x = healthRatio;
            fill.position.x = -(1 - healthRatio) * (mesh.children[0].geometry.parameters.radiusBottom);

            // Color based on health
            if (healthRatio > 0.5) {
              fill.material.color.setHex(0x4ade80);
            } else if (healthRatio > 0.25) {
              fill.material.color.setHex(0xfbbf24);
            } else {
              fill.material.color.setHex(0xe94560);
            }
          }

          // Face camera
          healthBar.lookAt(this.camera.position);
        }

        // Hide destroyed towers
        mesh.visible = towerData.health > 0;
      }
    }
  }

  updateUnits(units) {
    const activeIds = new Set();

    for (const unit of units) {
      activeIds.add(unit.id);

      let mesh = this.unitMeshes.get(unit.id);

      // Create mesh if it doesn't exist
      if (!mesh) {
        mesh = this.createUnitMesh(unit);
        this.unitMeshes.set(unit.id, mesh);
        this.scene.add(mesh);
      }

      // Update position
      mesh.position.set(unit.position.x, mesh.userData.yOffset, unit.position.z);
      mesh.rotation.y = unit.rotation || 0;

      // Update health bar
      this.updateUnitHealthBar(mesh, unit.health / unit.maxHealth);
    }

    // Remove meshes for dead/removed units
    for (const [id, mesh] of this.unitMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.unitMeshes.delete(id);
      }
    }
  }

  createUnitMesh(unit) {
    const card = CARDS[unit.cardId];
    const group = new THREE.Group();

    // Unit body (simple shapes for now)
    const isFlying = card.stats?.flying;
    const yOffset = isFlying ? 2 : 0.5;

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.6, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: card.color,
      roughness: 0.5
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = yOffset;
    body.castShadow = true;
    group.add(body);

    // Team indicator ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.4, 16);
    const ringColor = unit.owner === this.playerNumber ? 0x4ade80 : 0xe94560;
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    // Health bar
    const healthBar = this.createHealthBar(0.8);
    healthBar.position.y = yOffset + 0.8;
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
      fill.position.x = -(1 - healthRatio) * 0.4;
    }

    healthBar.lookAt(this.camera.position);
  }

  updateEffects(effects) {
    // Remove old effects
    for (const mesh of this.effectMeshes) {
      this.scene.remove(mesh);
    }
    this.effectMeshes = [];

    // Create new effects
    for (const effect of effects) {
      if (effect.type === 'fireball') {
        const effectMesh = this.createFireballEffect(effect);
        this.scene.add(effectMesh);
        this.effectMeshes.push(effectMesh);
      }
    }
  }

  createFireballEffect(effect) {
    const geo = new THREE.SphereGeometry(effect.radius, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6b35,
      transparent: true,
      opacity: 0.6
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(effect.position.x, 1, effect.position.z);
    return mesh;
  }

  /**
   * Show/hide deploy preview
   */
  showDeployPreview(show) {
    this.deployPreview.visible = show;
    this.deployArea.material.opacity = show ? 0.15 : 0;
  }

  /**
   * Update deploy preview position
   */
  updateDeployPreview(x, z, playerNumber) {
    // Clamp to valid area
    const halfWidth = ARENA.WIDTH / 2 - 1;
    x = Math.max(-halfWidth, Math.min(halfWidth, x));

    // Clamp Z to player's side
    if (playerNumber === 1) {
      z = Math.min(z, ARENA.RIVER_Z - ARENA.RIVER_WIDTH / 2 - 0.5);
      z = Math.max(z, -ARENA.HALF_LENGTH + 2);
    } else {
      z = Math.max(z, ARENA.RIVER_Z + ARENA.RIVER_WIDTH / 2 + 0.5);
      z = Math.min(z, ARENA.HALF_LENGTH - 2);
    }

    this.deployPreview.position.set(x, 0.05, z);

    // Color based on validity
    const isValid = this.isValidDeployPosition(x, z, playerNumber);
    this.deployPreview.material.color.setHex(isValid ? 0x4ade80 : 0xe94560);
  }

  isValidDeployPosition(x, z, playerNumber) {
    if (Math.abs(x) > ARENA.WIDTH / 2 - 1) return false;

    if (playerNumber === 1) {
      return z < ARENA.RIVER_Z - ARENA.RIVER_WIDTH / 2;
    } else {
      return z > ARENA.RIVER_Z + ARENA.RIVER_WIDTH / 2;
    }
  }

  /**
   * Convert screen coordinates to world position
   */
  screenToWorld(clientX, clientY) {
    const mouse = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);

    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersection);

    if (hit) {
      return { x: intersection.x, z: intersection.z };
    }
    return null;
  }

  /**
   * Main update loop
   */
  update(state) {
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Handle window resize
   */
  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
