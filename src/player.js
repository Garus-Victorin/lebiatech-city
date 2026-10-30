/* =========================================================================
   player.js — Contrôles type GTA (vue 3e personne, personnage visible)
   --------------------------------------------------------------------------
   - Personnage visible (bonhomme procédural) qui se déplace dans le monde.
   - Caméra 3e personne : derrière et au-dessus du personnage, suit le yaw.
   - Souris : yaw/pitch via Pointer Lock (la caméra tourne autour du personnage).
   - Clavier : ZQSD/WASD + flèches, course avec Maj.
   - Collisions AABB XZ inchangées (glissement le long des murs).
   ========================================================================= */

import * as THREE from 'three';

const EYE_HEIGHT = 1.65;
const RADIUS = 0.35;
const WALK_SPEED = 4.2;
const RUN_SPEED = 7.0;
const ACCEL = 14;
const MOUSE_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.05;

// Caméra 3e personne
const CAM_DISTANCE = 5.0;
const CAM_HEIGHT = 2.6;
const CAM_LERP = 12;

export class Player {
  constructor(camera, domElement, colliders, spawn, scene) {
    this.camera = camera;
    this.domElement = domElement;
    this.colliders = colliders;
    this.spawn = spawn.clone();
    this.scene = scene;

    this.position = spawn.clone();
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.velocity = new THREE.Vector3();
    this.enabled = false;

    this.keys = new Set();
    this.locked = false;

    // Personnage visible
    this.character = this._buildCharacter();
    this.character.position.copy(this.position);
    if (scene) scene.add(this.character);

    // Animation de marche
    this.walkPhase = 0;
    this.moving = false;

    this._onMouseMove = (e) => this._handleMouseMove(e);
    this._onWheel = (e) => {
      this.camDistance = Math.max(2, Math.min(12, this.camDistance + e.deltaY * 0.01));
    };
    this._onKeyDown = (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyC') {
        if (this.camDistance < 4) this.camDistance = 5.0;
        else if (this.camDistance < 7) this.camDistance = 8.0;
        else this.camDistance = 3.0;
      }
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.domElement;
      if (this.onLockChange) this.onLockChange(this.locked);
    };
    this._onLockError = () => {
      this.locked = false;
      if (this.onLockChange) this.onLockChange(false);
    };

    document.addEventListener('wheel', this._onWheel, { passive: true });
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('pointerlockerror', this._onLockError);

  // Caméra 3e personne (distance réglable)
  this.camDistance = 5.0;
  this.camHeight = 2.6;
  this.camLerp = 12;
    // Caméra lissée
    this.camPos = new THREE.Vector3();
    this._syncCamera(true);
  }

  _buildCharacter() {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b5fa8, roughness: 0.6 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1f2a3a, roughness: 0.7 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 });

    // Corps
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bodyMat);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    // Tête
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), headMat);
    head.position.y = 1.55;
    head.castShadow = true;
    group.add(head);

    // Bras
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), bodyMat);
      arm.position.set(s * 0.32, 1.05, 0);
      arm.castShadow = true;
      group.add(arm);
    }

    // Jambes (pivots)
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.12, 0.7, 0);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), legMat);
    leftLeg.position.y = -0.35;
    leftLeg.castShadow = true;
    leftLegPivot.add(leftLeg);
    group.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.12, 0.7, 0);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), legMat);
    rightLeg.position.y = -0.35;
    rightLeg.castShadow = true;
    rightLegPivot.add(rightLeg);
    group.add(rightLegPivot);

    group.userData = { leftLegPivot, rightLegPivot };
    return group;
  }

  reset() {
    this.position.copy(this.spawn);
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.velocity.set(0, 0, 0);
    this.keys.clear();
    this.walkPhase = 0;
    if (this.character) this.character.position.copy(this.position);
    this._syncCamera(true);
  }

  requestLock() {
    try {
      const result = this.domElement.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => this._onLockError());
    } catch (_e) {
      this._onLockError();
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _handleMouseMove(e) {
    if (!this.locked || !this.enabled) return;
    this.yaw -= e.movementX * MOUSE_SENSITIVITY;
    this.pitch -= e.movementY * MOUSE_SENSITIVITY;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
  }

  _hits(x, z) {
    for (const c of this.colliders) {
      const nearX = Math.max(c.minX, Math.min(x, c.maxX));
      const nearZ = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nearX;
      const dz = z - nearZ;
      if (dx * dx + dz * dz < RADIUS * RADIUS) return true;
    }
    return false;
  }

  update(dt) {
    if (!this.enabled) {
      this._syncCamera();
      if (this.character) this.character.position.copy(this.position);
      return;
    }

    let inputX = 0;
    let inputZ = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inputZ += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inputZ -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) inputX += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) inputX -= 1;

    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = running ? RUN_SPEED : WALK_SPEED;

    const len = Math.hypot(inputX, inputZ);
    let targetX = 0;
    let targetZ = 0;
    if (len > 0) {
      inputX /= len;
      inputZ /= len;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      targetX = (inputX * cos - inputZ * sin) * speed;
      targetZ = (-inputX * sin - inputZ * cos) * speed;
    }

    const t = 1 - Math.exp(-ACCEL * dt);
    this.velocity.x += (targetX - this.velocity.x) * t;
    this.velocity.z += (targetZ - this.velocity.z) * t;

    const nextX = this.position.x + this.velocity.x * dt;
    if (!this._hits(nextX, this.position.z)) {
      this.position.x = nextX;
    } else {
      this.velocity.x = 0;
    }

    const nextZ = this.position.z + this.velocity.z * dt;
    if (!this._hits(this.position.x, nextZ)) {
      this.position.z = nextZ;
    } else {
      this.velocity.z = 0;
    }

    // Animation de marche
    const speedMag = Math.hypot(this.velocity.x, this.velocity.z);
    this.moving = speedMag > 0.3;
    if (this.moving) {
      this.walkPhase += dt * (running ? 10 : 6);
    } else {
      this.walkPhase *= 0.85;
    }
    this._animateCharacter();

    // Orientation du personnage = yaw
    if (this.character) {
      this.character.position.copy(this.position);
      this.character.rotation.y = this.yaw + Math.PI; // face à la caméra derrière? ajuster
    }

    this._syncCamera();
  }

  _animateCharacter() {
    if (!this.character) return;
    const { leftLegPivot, rightLegPivot } = this.character.userData;
    const amp = this.moving ? 0.6 : 0;
    leftLegPivot.rotation.x = Math.sin(this.walkPhase) * amp;
    rightLegPivot.rotation.x = Math.sin(this.walkPhase + Math.PI) * amp;
  }

  _syncCamera(force = false) {
    // Position désirée de la caméra (derrière le personnage)
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const desiredX = this.position.x + sin * this.camDistance;
    const desiredZ = this.position.z + cos * this.camDistance;
    const desiredY = this.position.y + this.camHeight + Math.sin(this.pitch) * 1.5;

    if (force || this.camPos.lengthSq() === 0) {
      this.camPos.set(desiredX, desiredY, desiredZ);
    } else {
      const factor = 1 - Math.exp(-this.camLerp * 0.016);
      this.camPos.x += (desiredX - this.camPos.x) * factor;
      this.camPos.y += (desiredY - this.camPos.y) * factor;
      this.camPos.z += (desiredZ - this.camPos.z) * factor;
    }

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.position.x, this.position.y + 1.2, this.position.z);
  }

  distanceTo(point) {
    const dx = this.position.x - point.x;
    const dz = this.position.z - point.z;
    return Math.hypot(dx, dz);
  }

  dispose() {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('wheel', this._onWheel);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    document.removeEventListener('pointerlockerror', this._onLockError);
    if (this.character && this.scene) this.scene.remove(this.character);
  }
}
