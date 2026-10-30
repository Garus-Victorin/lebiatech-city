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
import { createUI } from './ui.js';
import { createMinimap } from './minimap.js';
import { NPCManager } from './npcs.js';

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

/* ------------------------------ PNJ ------------------------------ */
const npcManager = new NPCManager(scene);

const minimap = createMinimap(player, world);

/* =========================================================================
   Gestion des écrans / pointer lock
   ========================================================================= */

let phase = 'menu'; // 'menu' | 'playing' | 'paused'

function startGame() {
  phase = 'playing';
  player.enabled = true;
  player.reset();
  ui.hideScreen();
  if (document.activeElement) document.activeElement.blur();
  player.requestLock();
}

function restartGame() {
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

const interactEl = document.getElementById('interact');

let currentNPC = null;

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && phase === 'playing' && currentNPC) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = currentNPC.dialogue;
      toast.classList.remove('hidden');
      void toast.offsetWidth;
      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.classList.add('hidden'), 260);
      }, 3000);
    }
  }
});

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
  npcManager.update(dt);

  // Prompt d'interaction
  if (phase === 'playing') {
    currentNPC = npcManager.nearest(player.position, 2.5);
    if (currentNPC) {
      interactEl.textContent = 'E — Parler';
      interactEl.classList.remove('hidden');
    } else {
      interactEl.classList.add('hidden');
    }
  } else {
    interactEl.classList.add('hidden');
  }

  minimap.draw();

  // Info caméra
  const camInfo = document.getElementById('cam-info');
  if (camInfo && player.enabled) {
    camInfo.textContent = `Caméra : ${player.camDistance.toFixed(1)}m (molette / C)`;
    camInfo.classList.remove('hidden');
  } else if (camInfo) {
    camInfo.classList.add('hidden');
  }

  renderer.render(scene, camera);
}
animate();

/* ------------------------------ Resize ------------------------------ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});