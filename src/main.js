/* =========================================================================
   main.js — Point d'entrée : scène, boucle de jeu, orchestration des modules
   --------------------------------------------------------------------------
   Rôles :
     - créer le renderer WebGL, la scène et la caméra
     - construire le monde (world.js)
     - créer le joueur (player.js), la mission (mission.js) et l'UI (ui.js)
     - gérer les états global : menu → partie → pause → victoire/défaite
   ========================================================================= */

import * as THREE from 'three';
import './style.css';
import { createWorld } from './world.js';
import { Player } from './player.js';
import { Mission } from './mission.js';
import { createUI } from './ui.js';
import { createMinimap } from './minimap.js';

/* ------------------------------ Renderer ------------------------------ */
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

/* ------------------------------ Scène / caméra ------------------------------ */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 120);

/* ------------------------------ Monde ------------------------------ */
const world = createWorld(scene);

/* ------------------------------ UI ------------------------------ */
const ui = createUI();

/* ------------------------------ Joueur ------------------------------ */
const player = new Player(camera, renderer.domElement, world.colliders, world.startPoint, scene);

/* ------------------------------ Mission ------------------------------ */
// machine à états simple du jeu
let phase = 'menu'; // 'menu' | 'playing' | 'paused' | 'ended'

const mission = new Mission({
  scene,
  spots: world.objectiveSpots,
  startPoint: world.startPoint,
  ui,
  player,
  onEnd: (won) => {
    phase = 'ended';
    player.enabled = false;
    player.exitLock();
    ui.showEnd(won, mission.timeLeft, restartGame);
  },
});

const minimap = createMinimap(player, mission, world);

/* =========================================================================
   Gestion des écrans / pointer lock
   ========================================================================= */

function startGame() {
  mission.start();
  phase = 'playing';
  player.enabled = true;
  player.reset();
  ui.hideScreen();
  player.requestLock();
}

function restartGame() {
  // "Rejouer" : on repart directement dans une nouvelle partie
  mission.restart();
  startGame();
}

function resumeGame() {
  phase = 'playing';
  player.enabled = true;
  ui.hideScreen();
  player.requestLock();
}

// Pointer lock perdu (Échap, alt+tab...) → pause seulement si la partie tournait
player.onLockChange = (locked) => {
  if (locked) return;
  if (phase === 'playing') {
    phase = 'paused';
    player.enabled = false;
    ui.showPause(resumeGame);
  }
};

// Clic sur le canvas pendant la partie = reprendre (si le lock a été perdu)
renderer.domElement.addEventListener('click', () => {
  if (phase === 'paused') resumeGame();
});

// Écran de démarrage
ui.showStart(startGame);

/* =========================================================================
   Boucle de jeu
   ========================================================================= */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  // dt plafonné pour éviter les "sauts" de collision après un ralentissement
  const dt = Math.min(clock.getDelta(), 0.05);

  player.update(dt);
  mission.update(dt);
  minimap.draw();

  renderer.render(scene, camera);
}
animate();

/* ------------------------------ Resize ------------------------------ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});