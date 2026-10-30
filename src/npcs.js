/* =========================================================================
   npcs.js — Personnages dans le bureau (affluence)
   ========================================================================= */

import * as THREE from 'three';

const WALK_SPEED = 1.2;

function buildCharacter(color = 0x4a90d9) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1f2a3a, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.28), bodyMat);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skinMat);
  head.position.y = 1.5;
  head.castShadow = true;
  group.add(head);

  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), bodyMat);
    arm.position.set(s * 0.28, 1.0, 0);
    arm.castShadow = true;
    group.add(arm);
  }

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.1, 0.68, 0);
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), legMat);
  leftLeg.position.y = -0.32;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);
  group.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.1, 0.68, 0);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), legMat);
  rightLeg.position.y = -0.32;
  rightLeg.castShadow = true;
  rightLegPivot.add(rightLeg);
  group.add(rightLegPivot);

  group.userData = { leftLegPivot, rightLegPivot };
  return group;
}

const DIALOGUES = [
  "Bonjour ! Bienvenue chez LEBIATECH.",
  "Le dossier est dans l'un des bureaux.",
  "Attention au temps, il ne reste que 90 secondes !",
  "Tu cherches quelque chose ?",
  "LEBIATECH, solutions numériques.",
  "Bonne chance pour ta mission !",
];

export class NPC {
  constructor(scene, position, color) {
    this.scene = scene;
    this.position = position.clone();
    this.target = this._randomTarget();
    this.walkPhase = 0;
    this.moving = false;
    this.dialogue = DIALOGUES[Math.floor(Math.random() * DIALOGUES.length)];
    this.mesh = buildCharacter(color);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  _randomTarget() {
    // Reste à l'intérieur du bâtiment
    return new THREE.Vector3(
      -10 + Math.random() * 20,
      0,
      -1 + Math.random() * 9
    );
  }

  update(dt) {
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.0) {
      this.target = this._randomTarget();
      return;
    }
    const vx = (dx / dist) * WALK_SPEED;
    const vz = (dz / dist) * WALK_SPEED;
    this.position.x += vx * dt;
    this.position.z += vz * dt;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = Math.atan2(vx, vz);
    this.moving = true;
    this.walkPhase += dt * 6;
    const { leftLegPivot, rightLegPivot } = this.mesh.userData;
    const amp = 0.5;
    leftLegPivot.rotation.x = Math.sin(this.walkPhase) * amp;
    rightLegPivot.rotation.x = Math.sin(this.walkPhase + Math.PI) * amp;
  }

  dispose() {
    this.scene.remove(this.mesh);
  }
}

export class NPCManager {
  constructor(scene) {
    this.scene = scene;
    this.npcs = [];
    const colors = [0x4a90d9, 0xe53935, 0x43a047, 0xfbc02d, 0x8e24aa, 0xff7043, 0x26a69a, 0x7e57c2];
    const count = 12;
    for (let i = 0; i < count; i++) {
      const pos = new THREE.Vector3(
        -10 + Math.random() * 20,
        0,
        -1 + Math.random() * 9
      );
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.npcs.push(new NPC(scene, pos, color));
    }
  }

  update(dt) {
    for (const npc of this.npcs) npc.update(dt);
  }

  nearest(playerPos, radius = 2.5) {
    let best = null, bestDist = radius;
    for (const npc of this.npcs) {
      const d = Math.hypot(npc.position.x - playerPos.x, npc.position.z - playerPos.z);
      if (d < bestDist) { bestDist = d; best = npc; }
    }
    return best;
  }

  dispose() {
    for (const npc of this.npcs) npc.dispose();
    this.npcs = [];
  }
}
