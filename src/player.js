/* =========================================================================
   player.js — Contrôles FPS (pointer lock, ZQSD/WASD, collisions AABB)
   --------------------------------------------------------------------------
   - Vue première personne, caméra collée à 1,65 m au-dessus du sol.
   - Souris : regard (yaw/pitch) via Pointer Lock.
   - Clavier : ZQSD (AZERTY) et WASD (QWERTY) détectés par `event.code`,
     donc un seul fonctionne quel que soit le clavier.
   - Déplacement : demi-cercle de vitesse + glissement (lerp) pour la douceur.
   - Collisions : test AABB 2D (XZ) mur par mur, résolu axe par axe, ce qui
     permet de "caler" le long des murs sans traverser ni vibrer.
   ========================================================================= */

import * as THREE from 'three';

const EYE_HEIGHT = 1.65; // hauteur des yeux
const RADIUS = 0.35; // rayon du joueur (marge par rapport aux murs)
const WALK_SPEED = 4.2; // m/s
const RUN_SPEED = 7.0; // m/s en courant (Maj)
const ACCEL = 14; // vitesse d'accélération (lerp par seconde)
const MOUSE_SENSITIVITY = 0.0022; // radians par pixel
const MAX_PITCH = Math.PI / 2 - 0.05; // évite de se retourner la nuque

export class Player {
  /**
   * @param {THREE.Camera} camera  caméra de rendu (perspective)
   * @param {HTMLElement} domElement  élément qui reçoit le pointer lock (canvas)
   * @param {Array} colliders  AABB issues de world.js ({minX,maxX,minZ,maxZ})
   * @param {THREE.Vector3} spawn  point de départ
   */
  constructor(camera, domElement, colliders, spawn) {
    this.camera = camera;
    this.domElement = domElement;
    this.colliders = colliders;
    this.spawn = spawn.clone();

    // État du joueur
    this.position = spawn.clone(); // position au sol (les pieds)
    // Orientation initiale : le joueur regarde vers +X, donc vers l'intérieur
    // du couloir depuis le point de départ (le mur ouest est derrière lui).
    // rappel : direction avant = (-sin(yaw), -cos(yaw)) → yaw = -PI/2 avance vers +X.
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.velocity = new THREE.Vector3(); // vitesse horizontale courante
    this.enabled = false; // false = le joueur ne bouge pas (menu / pause / fin)

    // Entrées
    this.keys = new Set();
    this.locked = false;

    // Écouteurs
    this._onMouseMove = (e) => this._handleMouseMove(e);
    this._onKeyDown = (e) => {
      this.keys.add(e.code);
      // Empêche le défilement de la page avec espace/flèches
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.domElement;
      if (this.onLockChange) this.onLockChange(this.locked);
    };
    // Si le navigateur refuse le pointer lock (permission, geste absent...),
    // on prévient l'orchestrateur pour afficher l'écran de pause/clic.
    this._onLockError = () => {
      this.locked = false;
      if (this.onLockChange) this.onLockChange(false);
    };

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('pointerlockerror', this._onLockError);

    this.reset();
  }

  /* Remet le joueur au point de départ (nouvelle partie) */
  reset() {
    this.position.copy(this.spawn);
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.velocity.set(0, 0, 0);
    this.keys.clear();
    this._syncCamera();
  }

  /* Demande le pointer lock (appelé au clic sur "Jouer") */
  requestLock() {
    try {
      const result = this.domElement.requestPointerLock();
      // Certains navigateurs renvoient une Promise (rejet = refus du lock)
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
    this.yaw -= e.movementX * MOUSE_SENSITIVITY; // regarder à droite = tourner à droite
    this.pitch -= e.movementY * MOUSE_SENSITIVITY;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
  }

  /** true si la position (x,z) chevauche un collider (cercle joueur vs AABB) */
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
      return;
    }

    // --- 1. Direction voulue dans le repère du joueur (yaw) ---
    let inputX = 0;
    let inputZ = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inputZ += 1; // avancer
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inputZ -= 1; // reculer
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) inputX += 1; // strafe droite
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) inputX -= 1; // strafe gauche

    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = running ? RUN_SPEED : WALK_SPEED;

    // Normalisation pour qu'aller en diagonale ne soit pas plus rapide
    const len = Math.hypot(inputX, inputZ);
    let targetX = 0;
    let targetZ = 0;
    if (len > 0) {
      inputX /= len;
      inputZ /= len;
      // Rotation du vecteur local (avant/gauche) selon le yaw de la caméra
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      targetX = (inputX * cos - inputZ * sin) * speed;
      targetZ = (-inputX * sin - inputZ * cos) * speed;
    }

    // --- 2. Lissage de la vitesse (accélération/décélération) ---
    const t = 1 - Math.exp(-ACCEL * dt); // lerp indépendant du framerate
    this.velocity.x += (targetX - this.velocity.x) * t;
    this.velocity.z += (targetZ - this.velocity.z) * t;

    // --- 3. Déplacement axe par axe (résolution de collision) ---
    const nextX = this.position.x + this.velocity.x * dt;
    if (!this._hits(nextX, this.position.z)) {
      this.position.x = nextX;
    } else {
      this.velocity.x = 0; // impact : on annule la composante X
    }

    const nextZ = this.position.z + this.velocity.z * dt;
    if (!this._hits(this.position.x, nextZ)) {
      this.position.z = nextZ;
    } else {
      this.velocity.z = 0;
    }

    this._syncCamera();
  }

  /** Applique position + orientation à la caméra */
  _syncCamera() {
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
    // Ordre YXZ : d'abord le lacet (yaw), puis le tangage (pitch)
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  /** Distance horizontale jusqu'un point donné */
  distanceTo(point) {
    const dx = this.position.x - point.x;
    const dz = this.position.z - point.z;
    return Math.hypot(dx, dz);
  }

  dispose() {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    document.removeEventListener('pointerlockerror', this._onLockError);
  }
}