/* =========================================================================
   world.js — Intérieur réaliste du bureau LEBIATECH (refonte Rockstar-style)
   --------------------------------------------------------------------------
   - Géométrie procédurale riche : murs, plafonds moulurés, spots encastrés,
     climatisations, mobilier détaillé, affiches uniques (ClampToEdge).
   - Collisions AABB XZ pour tous les obstacles.
   ========================================================================= */

import * as THREE from 'three';

/* =========================================================================
   1. SLOTS DE TEXTURES (surfaces répétitives) — vides = couleurs de repli
   ========================================================================= */
export const TEXTURE_SLOTS = {
  floor: '',
  wall: '',
  ceiling: '',
  door: '',
  desk: '',
};

const BASE_COLORS = {
  floor: 0xc9b896,   // carrelage beige clair
  wall: 0xe6dcc8,    // crépis clair
  ceiling: 0xf2f2f2, // blanc
  door: 0x8a6b4a,
  desk: 0x8a6b4a,
};

/* Photos réelles du lieu (affiches uniques, non répétées) */
export const ENV_PHOTOS = {
  facade1: '/textures/environnement/photo1.jpg',
  facade2: '/textures/environnement/photo3.jpg',
  interior: '/textures/environnement/photo4.jpg',
  banner: '/textures/environnement/photo7.jpg',
};

/* Constantes du bâtiment */
const BUILDING = {
  minX: -12,
  maxX: 12,
  minZ: -2,
  maxZ: 8,
  corridorMinZ: -2,
  corridorMaxZ: 2,
  height: 3,
  thickness: 0.2,
};

export const START_POINT = new THREE.Vector3(-10, 0, 0);

export const OBJECTIVE_SPOTS = [
  { room: 'Bureau A', pos: new THREE.Vector3(-9.5, 1.0, 6.4) },
  { room: 'Bureau A', pos: new THREE.Vector3(-5.0, 0.35, 4.0) },
  { room: 'Salle de réunion', pos: new THREE.Vector3(0.5, 1.0, 5.5) },
  { room: 'Salle de réunion', pos: new THREE.Vector3(2.8, 0.35, 3.0) },
  { room: 'Réserve', pos: new THREE.Vector3(10.6, 1.0, 6.2) },
  { room: 'Réserve', pos: new THREE.Vector3(7.0, 0.35, 3.2) },
];

/* =========================================================================
   2. OUTILS TEXTURE / MATÉRIAUX
   ========================================================================= */
const textureLoader = new THREE.TextureLoader();

function loadSlotTexture(slotKey, repeatX, repeatY) {
  const url = TEXTURE_SLOTS[slotKey];
  if (!url) return null;
  const texture = textureLoader.load(url, undefined, undefined,
    () => console.warn(`[world] Texture introuvable pour le slot "${slotKey}" : ${url}`));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return texture;
}

function slotMaterial(slotKey, repeatX = 1, repeatY = 1) {
  const map = loadSlotTexture(slotKey, repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    map,
    color: map ? 0xffffff : BASE_COLORS[slotKey],
    roughness: 0.9,
    metalness: 0.02,
  });
}

/* Affiches uniques (ClampToEdge) */
const envTextureCache = new Map();
function envTexture(url) {
  if (envTextureCache.has(url)) return envTextureCache.get(url);
  const t = textureLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  envTextureCache.set(url, t);
  return t;
}

/* =========================================================================
   3. COLLIDERS
   ========================================================================= */
function addCollider(colliders, mesh) {
  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(mesh);
  colliders.push({
    minX: box.min.x,
    maxX: box.max.x,
    minZ: box.min.z,
    maxZ: box.max.z,
    label: mesh.name || 'obstacle',
  });
}

/* =========================================================================
   4. CONSTRUCTION DU MONDE
   ========================================================================= */
export function createWorld(scene) {
  const colliders = [];

  const width = BUILDING.maxX - BUILDING.minX;
  const depth = BUILDING.maxZ - BUILDING.minZ;
  const centerX = (BUILDING.minX + BUILDING.maxX) / 2;
  const centerZ = (BUILDING.minZ + BUILDING.maxZ) / 2;

  /* ---------- Sol & plafond ---------- */
  const floorMat = slotMaterial('floor', width / 4, depth / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centerX, 0, centerZ);
  floor.receiveShadow = true;
  floor.name = 'sol';
  scene.add(floor);

  const ceilingMat = slotMaterial('ceiling', width / 4, depth / 4);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(centerX, BUILDING.height, centerZ);
  ceiling.name = 'plafond';
  scene.add(ceiling);

  /* ---------- Utilitaire murs ---------- */
  const wallMatCache = new Map();
  function addBox(x, z, w, d, opts = {}) {
    const y = opts.y ?? 0;
    const h = opts.height ?? BUILDING.height;
    const slot = opts.slot ?? 'wall';
    const repeatX = Math.max(1, Math.round(Math.max(w, d) / 2));
    const repeatY = Math.max(1, Math.round(h / 2));
    const key = `${slot}|${repeatX}|${repeatY}`;
    if (!wallMatCache.has(key)) wallMatCache.set(key, slotMaterial(slot, repeatX, repeatY));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMatCache.get(key));
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = opts.name || 'mur';
    scene.add(mesh);
    if (opts.collide !== false) addCollider(colliders, mesh);
    return mesh;
  }

  const T = BUILDING.thickness;
  const H = BUILDING.height;
  const { minX, maxX, minZ, maxZ, corridorMinZ, corridorMaxZ } = BUILDING;

  /* ---------- Murs extérieurs ---------- */
  addBox(minX - T / 2, (minZ + maxZ) / 2, T, maxZ - minZ + T, { name: 'mur ouest' });
  addBox(maxX + T / 2, (minZ + maxZ) / 2, T, maxZ - minZ + T, { name: 'mur est' });
  addBox((minX + maxX) / 2, maxZ + T / 2, maxX - minX + T * 2, T, { name: 'mur nord' });
  addBox((minX + maxX) / 2, corridorMinZ - T / 2, maxX - minX + T * 2, T, { name: 'mur sud (couloir)' });

  /* ---------- Murs du couloir (portes) ---------- */
  const doorWidth = 1.0;
  const doorHeight = 2.2;
  const doorGaps = [[-8, -7], [-0.5, 0.5], [7.5, 8.5]];
  let cursor = minX;
  const corridorSegments = [];
  for (const [gapStart, gapEnd] of doorGaps) {
    corridorSegments.push([cursor, gapStart]);
    cursor = gapEnd;
  }
  corridorSegments.push([cursor, maxX]);
  for (const [x1, x2] of corridorSegments) {
    if (x2 - x1 <= 0.001) continue;
    addBox((x1 + x2) / 2, corridorMaxZ + T / 2, x2 - x1, T, { name: 'mur de couloir' });
  }
  for (const [x1, x2] of doorGaps) {
    addBox((x1 + x2) / 2, corridorMaxZ + T / 2, x2 - x1, T, {
      y: doorHeight, height: H - doorHeight, slot: 'door', collide: false, name: 'linteau de porte',
    });
  }

  /* ---------- Séparations entre pièces ---------- */
  addBox(-3.5, (corridorMaxZ + maxZ) / 2, T, maxZ - corridorMaxZ, { name: 'séparation A/B' });
  addBox(4.5, (corridorMaxZ + maxZ) / 2, T, maxZ - corridorMaxZ, { name: 'séparation B/C' });

  /* ---------- Plafond : moulures (corniches) ---------- */
  const corniceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  function addCornice(x, z, w, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), corniceMat);
    m.position.set(x, H - 0.06, z);
    m.name = 'corniche';
    scene.add(m);
  }
  // corniche le long des murs nord et séparations
  addCornice(centerX, maxZ - T / 2, width, 0.18);
  addCornice(centerX, corridorMaxZ + T / 2, width, 0.18);

  /* ---------- Spots encastrés au plafond ---------- */
  const spotPositions = [
    [-8, 0], [0, 0], [8, 0],
    [-7.5, 5], [0.5, 5], [8.5, 5],
  ];
  for (const [x, z] of spotPositions) {
    // disque lumineux
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.set(x, H - 0.02, z);
    scene.add(disc);
    // lumière
    const light = new THREE.PointLight(0xfff2dc, 22, 12, 2);
    light.position.set(x, H - 0.3, z);
    scene.add(light);
  }

  /* ---------- Ventilateur de plafond (Salle de réunion) ---------- */
  const fanGroup = new THREE.Group();
  const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.6, roughness: 0.3 }));
  fanHub.rotation.x = Math.PI / 2;
  fanGroup.add(fanHub);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 0.18), bladeMat);
    blade.position.set(0, 0, 0);
    blade.rotation.y = (i * Math.PI) / 2;
    blade.position.x = 0.55 * Math.cos((i * Math.PI) / 2);
    blade.position.z = 0.55 * Math.sin((i * Math.PI) / 2);
    fanGroup.add(blade);
  }
  fanGroup.position.set(0.5, H - 0.35, 5.5);
  scene.add(fanGroup);

  /* ---------- Climatisations (splits) ---------- */
  function addAC(x, z, rotY = 0) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    ac.position.set(x, H - 0.25, z);
    ac.rotation.y = rotY;
    ac.name = 'clim';
    scene.add(ac);
  }
  addAC(-7.5, 7.85, 0);   // Bureau A
  addAC(0.5, 7.85, 0);    // Salle de réunion
  addAC(8.5, 7.85, 0);    // Réserve

  /* ---------- Éclairage ambiant ---------- */
  const ambient = new THREE.AmbientLight(0x6a7b9c, 0.5);
  scene.add(ambient);
  const hemisphere = new THREE.HemisphereLight(0x9fb6d8, 0x2a2d36, 0.4);
  scene.add(hemisphere);

  const fog = new THREE.Fog(0x0b1018, 18, 46);
  scene.fog = fog;
  scene.background = new THREE.Color(0x0b1018);

  /* ---------- Mobilier ---------- */
  const deskMat = slotMaterial('desk', 1, 1);
  function addDesk(x, z, w = 2, d = 1) {
    const group = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), deskMat);
    top.position.y = 0.76;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.6, metalness: 0.4 });
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, d - 0.1), legMat);
      leg.position.set((sx * w) / 2 - sx * 0.06, 0.36, 0);
      leg.castShadow = true;
      group.add(leg);
    }
    group.position.set(x, 0, z);
    group.name = 'bureau';
    scene.add(group);
    addCollider(colliders, group);
    return group;
  }

  function addShelf(x, z, w, d, h, slot = 'desk') {
    return addBox(x, z, w, d, { height: h, slot, name: 'étagère' });
  }

  /* Fauteuil noir (mesh) */
  function addChairBlack(x, z, rotY = 0) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 }));
    seat.position.y = 0.45;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.08), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 }));
    back.position.set(0, 0.85, -0.22);
    g.add(back);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.25, 0.45, 8), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.3 }));
    base.position.y = 0.22;
    g.add(base);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.name = 'fauteuil noir';
    scene.add(g);
    // collision approximative
    const fake = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
    fake.position.set(x, 0.45, z);
    fake.name = 'fauteuil noir';
    // collider via manual
    colliders.push({ minX: x - 0.28, maxX: x + 0.28, minZ: z - 0.25, maxZ: z + 0.25, label: 'fauteuil noir' });
    return g;
  }

  /* Fauteuil vert (plastique) */
  function addChairGreen(x, z, rotY = 0) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.48), new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.6 }));
    seat.position.y = 0.42;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.06), new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.6 }));
    back.position.set(0, 0.72, -0.22);
    g.add(back);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.4 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), legMat);
      leg.position.set(sx * 0.2, 0.2, sz * 0.18);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.name = 'fauteuil vert';
    scene.add(g);
    colliders.push({ minX: x - 0.26, maxX: x + 0.26, minZ: z - 0.25, maxZ: z + 0.25, label: 'fauteuil vert' });
    return g;
  }

  /* Table basse (plateau marbre blanc) */
  function addCoffeeTable(x, z) {
    const g = new THREE.Group();
    const topMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3, metalness: 0.05 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.6), topMat);
    top.position.y = 0.42;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 });
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.55), legMat);
      leg.position.set(sx * 0.48, 0.2, 0);
      g.add(leg);
    }
    // rangement bois
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.55), new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.7 }));
    shelf.position.set(0, 0.12, 0);
    g.add(shelf);
    g.position.set(x, 0, z);
    g.name = 'table basse';
    scene.add(g);
    colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.3, maxZ: z + 0.3, label: 'table basse' });

    // objets sur la table
    const plant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    plant.position.set(x - 0.35, 0.48 + 0.09, z + 0.1);
    scene.add(plant);
    const plantTop = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 }));
    plantTop.position.set(x - 0.35, 0.72, z + 0.1);
    scene.add(plantTop);

    const book = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.18), new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.6 }));
    book.position.set(x + 0.2, 0.46, z - 0.1);
    book.rotation.y = 0.3;
    scene.add(book);

    return g;
  }

  /* Étagère métallique */
  function addMetalShelf(x, z, w, d, h) {
    const g = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 });
    // poteaux
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.04), frameMat);
      pole.position.set(sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02));
      g.add(pole);
    }
    // tablettes
    const shelves = Math.max(2, Math.round(h / 0.5));
    for (let i = 0; i < shelves; i++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), frameMat);
      sh.position.y = (i / (shelves - 1)) * (h - 0.1) + 0.05;
      g.add(sh);
    }
    g.position.set(x, 0, z);
    g.name = 'étagère métal';
    scene.add(g);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, label: 'étagère métal' });
    return g;
  }

  /* Panneau roll-up vertical */
  function addRollup(x, z, w, h, titleColor, rotY = 0) {
    const g = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color: titleColor, roughness: 0.5 }));
    panel.position.y = h / 2 + 0.05;
    g.add(panel);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.06, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 }));
    base.position.y = 0.03;
    g.add(base);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.name = 'rollup';
    scene.add(g);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - 0.05, maxZ: z + 0.05, label: 'rollup' });
    return g;
  }

  /* Interrupteur / boîtier */
  function addSwitch(x, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
    m.position.set(x, 1.3, z);
    m.name = 'interrupteur';
    scene.add(m);
  }

  /* Fenêtre avec store */
  function addWindow(x, z, w, h, rotY = 0) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.35 }));
    frame.position.set(x, 1.5, z);
    frame.rotation.y = rotY;
    scene.add(frame);
    // store
    const blind = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.6, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.8 }));
    blind.position.set(x, 1.5 + h * 0.2, z + (rotY === 0 ? 0.03 : 0));
    blind.rotation.y = rotY;
    scene.add(blind);
  }

  /* Affiche */
  function addAffiche(x, z, w, h, url, rotY = 0, y = 1.5) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: envTexture(url), side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.name = 'affiche';
    scene.add(mesh);
    return mesh;
  }

  /* ---------- Layout Bureau A (ouest) ---------- */
  addDesk(-9.5, 6.4, 2.2, 1.1);
  addDesk(-5.5, 6.4, 2.2, 1.1);
  addMetalShelf(-11.4, 4.0, 1.0, 1.6, 2.0);
  addShelf(-4.2, 3.0, 0.8, 1.2, 1.1);
  addChairBlack(-9.5, 5.0);
  addChairBlack(-5.5, 5.0);
  addChairGreen(-8.0, 4.5);
  addCoffeeTable(-7.5, 5.2);
  addRollup(-3.6, 5.0, 1.2, 2.0, 0x1565c0, Math.PI / 2);
  addSwitch(-3.6, 4.0);
  addWindow(-7.5, 7.9, 1.6, 1.2, 0);
  addAffiche(-9.5, 7.95, 1.8, 1.4, ENV_PHOTOS.interior, 0);

  /* ---------- Salle de réunion (centre) ---------- */
  addDesk(0.5, 5.5, 3.2, 1.6);
  addDesk(-1.6, 3.4, 0.7, 0.7);
  addDesk(2.6, 3.4, 0.7, 0.7);
  addShelf(3.9, 7.2, 1.6, 0.8, 1.6);
  addChairBlack(0.5, 4.0);
  addChairBlack(-1.0, 4.0);
  addChairBlack(2.0, 4.0);
  addCoffeeTable(0.5, 3.8);
  addRollup(-3.4, 5.0, 1.4, 2.0, 0xef6c00, Math.PI / 2);
  addAffiche(0.5, 7.95, 1.8, 1.4, ENV_PHOTOS.banner, 0);

  /* ---------- Réserve (est) ---------- */
  addShelf(11.3, 6.2, 1.2, 2.4, 2.0);
  addShelf(11.3, 3.4, 1.2, 1.6, 2.0);
  addShelf(7.0, 7.2, 2.0, 0.8, 1.2);
  addBox(6.2, 3.2, 0.9, 0.9, { height: 0.9, slot: 'desk', name: 'carton' });
  addMetalShelf(9.0, 4.0, 1.6, 0.6, 1.8);

  /* ---------- Couloir : caisses ---------- */
  addBox(4.6, -1.4, 0.8, 0.8, { height: 0.8, slot: 'desk', name: 'caisse 1' });
  addBox(5.5, -1.4, 0.8, 0.8, { height: 0.8, slot: 'desk', name: 'caisse 2' });

  /* ---------- Affiches façades sur mur sud du couloir ---------- */
  addAffiche(-9, corridorMaxZ - 0.05, 1.8, 1.2, ENV_PHOTOS.facade1, 0, 1.6);
  addAffiche(0, corridorMaxZ - 0.05, 1.8, 1.2, ENV_PHOTOS.facade2, 0, 1.6);

  /* ---------- Néons (couloir + pièces) ---------- */
  const neonPositions = [[-8, 0], [0, 0], [8, 0], [-7.5, 5], [0.5, 5], [8.5, 5]];
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xdff6ff });
  const neonGeo = new THREE.BoxGeometry(1.6, 0.08, 0.35);
  for (const [x, z] of neonPositions) {
    const neon = new THREE.Mesh(neonGeo, neonMat);
    neon.position.set(x, H - 0.06, z);
    scene.add(neon);
    const light = new THREE.PointLight(0xbfe9ff, 26, 14, 2);
    light.position.set(x, H - 0.3, z);
    scene.add(light);
  }

  return { colliders, objectiveSpots: OBJECTIVE_SPOTS, neonLights: [], startPoint: START_POINT };
}
