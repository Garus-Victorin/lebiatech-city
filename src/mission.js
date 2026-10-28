/* =========================================================================
   mission.js — Logique de la mission : objet à trouver + timer 90 s
   --------------------------------------------------------------------------
   Cycle de vie :
     "idle"    → écran de démarrage, rien ne bouge
     "running" → timer décompte, il faut trouver l'objet puis revenir au départ
     "won"     → "Mission accomplie !"
     "lost"    → "Game Over" (temps écoulé)

   L'objet (un cube coloré qui pulse) est placé au hasard parmi les emplacements
   définis dans world.js (un par pièce), à chaque nouvelle partie.
   ========================================================================= */

import * as THREE from 'three';

const DURATION = 90; // durée de la mission en secondes
const PICKUP_DISTANCE = 1.5; // distance de ramassage de l'objet (marge confortable autour des meubles)
const RETURN_DISTANCE = 1.8; // distance du point de départ pour gagner

export class Mission {
  /**
   * @param {object} deps
   * @param {THREE.Scene} deps.scene
   * @param {Array} deps.spots  emplacements candidats (world.OBJECTIVE_SPOTS)
   * @param {THREE.Vector3} deps.startPoint  point de départ
   * @param {object} deps.ui  façade UI (voir ui.js)
   * @param {object} deps.player  instance de Player
   * @param {function} deps.onEnd  appelé avec true (gagné) / false (perdu)
   */
  constructor({ scene, spots, startPoint, ui, player, onEnd }) {
    this.scene = scene;
    this.spots = spots;
    this.startPoint = startPoint;
    this.ui = ui;
    this.player = player;
    this.onEnd = onEnd;

    this.state = 'idle';
    this.timeLeft = DURATION;
    this.collected = false;
    this.currentSpot = null;

    // --- L'objet de la mission : un cube lumineux ---
    const geometry = new THREE.BoxGeometry(0.42, 0.55, 0.32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffcc33,
      emissive: 0xff9900,
      emissiveIntensity: 0.9,
      roughness: 0.35,
      metalness: 0.1,
      name: 'dossier',
    });
    this.objectMesh = new THREE.Mesh(geometry, material);
    this.objectMesh.castShadow = true;
    this.objectMesh.name = 'objectif';

    // Petite sphère qui repère l'objet par terre (halo)
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.75, 32),
      new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.27;
    this.objectMesh.add(halo);
    this.halo = halo;

    // Lumière attirante l'œil vers l'objet
    this.objectLight = new THREE.PointLight(0xffbb33, 8, 6, 2);
    this.objectMesh.add(this.objectLight);

    this.objectMesh.visible = false;
    scene.add(this.objectMesh);
  }

  /** (Re)démarre une partie : nouvel objet au hasard, timer remis à 90 s */
  start() {
    this.state = 'running';
    this.timeLeft = DURATION;
    this.collected = false;

    // Choix aléatoire d'un emplacement (en évitant celui de la partie précédente)
    let spot;
    do {
      spot = this.spots[Math.floor(Math.random() * this.spots.length)];
    } while (this.spots.length > 1 && spot === this.currentSpot);
    this.currentSpot = spot;

    this.objectMesh.position.copy(spot.pos);
    this.objectMesh.visible = true;

    this.ui.setTimer(this.timeLeft);
    this.ui.setHint('Trouve le dossier !');
    this.ui.toast('Trouve le dossier et reviens au départ !', 2600);
  }

  /** Met à jour le timer et les objectifs ; appelé à chaque frame */
  update(dt) {
    // Animation du cube : léger flottement + rotation
    if (this.objectMesh.visible) {
      const t = performance.now() * 0.001;
      this.objectMesh.rotation.y = t * 0.9;
      this.objectMesh.position.y = this.currentSpot.pos.y + Math.sin(t * 2) * 0.06;
      this.halo.material.opacity = 0.35 + Math.sin(t * 3) * 0.15;
    }

    if (this.state !== 'running') return;

    // --- Décompte du timer ---
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.ui.setTimer(this.timeLeft);
    if (this.timeLeft <= 0) {
      this.state = 'lost';
      this.objectMesh.visible = false;
      this.onEnd(false);
      return;
    }

    // --- Étape 1 : ramasser l'objet ---
    if (!this.collected) {
      if (this.player.distanceTo(this.objectMesh.position) < PICKUP_DISTANCE) {
        this.collected = true;
        this.objectMesh.visible = false;
        this.ui.setHint('Retourne au point de départ !');
        this.ui.toast('Objet trouvé ! Retourne au départ', 2800);
      }
      return;
    }

    // --- Étape 2 : revenir au point de départ ---
    if (this.player.distanceTo(this.startPoint) < RETURN_DISTANCE) {
      this.state = 'won';
      this.onEnd(true);
    }
  }

  /** Réinitialisation complète (bouton "Rejouer") */
  restart() {
    this.objectMesh.visible = false;
    this.state = 'idle';
    this.collected = false;
    this.timeLeft = DURATION;
    this.ui.setTimer(this.timeLeft);
  }
}