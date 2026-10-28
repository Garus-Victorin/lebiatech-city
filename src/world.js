/* =========================================================================
   world.js — Construction de l'intérieur (bureaux, couloirs, salles)
   --------------------------------------------------------------------------
   - Géométrie 100 % procédurale : BoxGeometry (murs/meubles) + PlaneGeometry
     (sol, plafond).
   - Système de "slots" de textures : voir TEXTURE_SLOTS plus bas. Chaque slot
     correspond à une surface du monde et attend l'URL d'une image. Laisser la
     chaîne vide = couleur unie procédurale (le jeu fonctionne sans aucun asset).
   - Chaque mur/meuble est poussé dans un tableau de "colliders" (AABB en XZ)
     utilisé par player.js pour les collisions.
   ========================================================================= */

import * as THREE from 'three';

/* =========================================================================
   1. SLOTS DE TEXTURES — À REMPLACER AVEC VOS IMAGES
   --------------------------------------------------------------------------
   Déposez vos images dans  public/textures/  puis renseignez l'URL ici.
   Exemple :  wall: '/textures/mur-bureau.png'

   URLs acceptées :
     - chemins absolus servis par Vite : '/textures/mur.png'  (fichier dans public/)
     - chemins relatifs au fichier JS : './textures/mur.png'  (fichier dans src/)

   Slots disponibles :
     - floor   : sol (répété automatiquement selon la taille du bâtiment)
     - wall    : murs (répété selon la longueur/hauteur de chaque mur)
     - ceiling : plafond
     - door    : dessus des portes (linteaux)
     - desk    : meubles / bureaux / étagères

   Astuce : une image "tileable" (qui se répète sans raccord) donne le meilleur
   rendu, car les textures sont répétées (wrapS / wrapT = RepeatWrapping).
   ========================================================================= */
export const TEXTURE_SLOTS = {
  floor: '',
  wall: '',
  ceiling: '',
  door: '',
  desk: '',
};

/* Couleurs de repli (utilisées tant qu'aucune texture n'est assignée) */
const BASE_COLORS = {
  floor: 0x2f3646,
  wall: 0x6d7789,
  ceiling: 0x1e2330,
  door: 0xb98a4e,
  desk: 0x8a6b4a,
};

/* Constantes du bâtiment */
const BUILDING = {
  minX: -12,
  maxX: 12,
  minZ: -2, // bord sud du couloir
  maxZ: 8, // mur nord des bureaux
  corridorMinZ: -2,
  corridorMaxZ: 2, // couloir principal : z entre -2 et +2
  height: 3, // hauteur sous plafond
  thickness: 0.2, // épaisseur des murs
};

/* Point de départ du joueur (dans le couloir, extrémité ouest) */
export const START_POINT = new THREE.Vector3(-10, 0, 0);

/* Positions candidates pour l'objet de la mission (une par bureau, au hasard) */
export const OBJECTIVE_SPOTS = [
  { room: 'Bureau A', pos: new THREE.Vector3(-9.5, 1.0, 6.4) }, // sur un bureau
  { room: 'Bureau A', pos: new THREE.Vector3(-5.0, 0.35, 4.0) }, // au sol, derrière l'étagère
  { room: 'Salle de réunion', pos: new THREE.Vector3(0.5, 1.0, 5.5) }, // au centre de la table
  { room: 'Salle de réunion', pos: new THREE.Vector3(2.8, 0.35, 3.0) }, // au sol, coin sud-est
  { room: 'Réserve', pos: new THREE.Vector3(10.6, 1.0, 6.2) }, // sur une étagère
  { room: 'Réserve', pos: new THREE.Vector3(7.0, 0.35, 3.2) }, // au sol, coin ouest
];

/* =========================================================================
   2. OUTILS TEXTURE / MATÉRIAUX
   ========================================================================= */

const textureLoader = new THREE.TextureLoader();

/**
 * Crée une texture à partir d'un slot. Si l'URL est vide ou introuvable,
 * retourne null (le matériau restera en couleur unie).
 */
function loadSlotTexture(slotKey, repeatX, repeatY) {
  const url = TEXTURE_SLOTS[slotKey];
  if (!url) return null; // aucun asset : on garde la couleur de repli

  const texture = textureLoader.load(
    url,
    undefined,
    undefined,
    // En cas d'erreur de chargement : on n'écrase pas le matériau, le jeu
    // continue simplement avec la couleur de repli.
    () => console.warn(`[world] Texture introuvable pour le slot "${slotKey}" : ${url}`)
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return texture;
}

/**
 * Matériau "slot" : texture si le slot est rempli, sinon couleur unie.
 * @param {string} slotKey clé dans TEXTURE_SLOTS
 * @param {number} repeatX répétition horizontale
 * @param {number} repeatY répétition verticale
 */
function slotMaterial(slotKey, repeatX = 1, repeatY = 1) {
  const map = loadSlotTexture(slotKey, repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    map,
    color: map ? 0xffffff : BASE_COLORS[slotKey], // teinte blanche si texture
    roughness: 0.9,
    metalness: 0.02,
  });
}

/* =========================================================================
   3. FABRIQUE DE COLLIDERS (AABB en XZ)
   ========================================================================= */

/**
 * Boîte englobante en XZ pour un objet donné (murs, meubles...).
 * On ignore volontairement Y : le joueur est un cylindre vertical qui ne
 * saute pas, une AABB 2D suffit pour des collisions robustes et simples.
 */
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

/**
 * Construit tout l'intérieur dans la scène Three.js.
 * @param {THREE.Scene} scene
 * @returns {{ colliders: Array, objectiveSpots: Array, neonLights: Array }}
 */
export function createWorld(scene) {
  const colliders = [];

  /* ---------- 4.1 Sol et plafond (PlaneGeometry) ---------- */
  const width = BUILDING.maxX - BUILDING.minX; // 24 m
  const depth = BUILDING.maxZ - BUILDING.minZ; // 10 m
  const centerX = (BUILDING.minX + BUILDING.maxX) / 2;
  const centerZ = (BUILDING.minZ + BUILDING.maxZ) / 2;

  const floorMat = slotMaterial('floor', width / 4, depth / 4); // une tuile ≈ 4 m
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
  floor.rotation.x = -Math.PI / 2; // à plat, normale vers le haut
  floor.position.set(centerX, 0, centerZ);
  floor.receiveShadow = true;
  floor.name = 'sol';
  scene.add(floor);

  const ceilingMat = slotMaterial('ceiling', width / 4, depth / 4);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilingMat);
  ceiling.rotation.x = Math.PI / 2; // normale vers le bas
  ceiling.position.set(centerX, BUILDING.height, centerZ);
  ceiling.name = 'plafond';
  scene.add(ceiling);

  /* ---------- 4.2 Fonction utilitaire : un mur (BoxGeometry + AABB) ---------- */
  const wallMatCache = new Map(); // cache de matériaux par longueur de mur

  /**
   * Ajoute un mur horizontal ou vertical.
   * @param {number} x  centre X
   * @param {number} z  centre Z
   * @param {number} w  largeur (axe X)
   * @param {number} d  profondeur (axe Z)
   * @param {object} opts { y, height, slot, collide, name }
   */
  function addBox(x, z, w, d, opts = {}) {
    const y = opts.y ?? 0;
    const h = opts.height ?? BUILDING.height;
    const slot = opts.slot ?? 'wall';

    // Répétition de texture proportionnelle aux dimensions du bloc
    const repeatX = Math.max(1, Math.round(Math.max(w, d) / 2));
    const repeatY = Math.max(1, Math.round(h / 2));

    // Cache : un même couple (slot, repeat) partage le même matériau
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

  /* ---------- 4.3 Murs extérieurs ---------- */
  addBox(minX - T / 2, (minZ + maxZ) / 2, T, maxZ - minZ + T, { name: 'mur ouest' });
  addBox(maxX + T / 2, (minZ + maxZ) / 2, T, maxZ - minZ + T, { name: 'mur est' });
  addBox((minX + maxX) / 2, maxZ + T / 2, maxX - minX + T * 2, T, { name: 'mur nord' });
  addBox((minX + maxX) / 2, corridorMinZ - T / 2, maxX - minX + T * 2, T, { name: 'mur sud (couloir)' });

  /* ---------- 4.4 Murs du couloir (avec 3 ouvertures de portes) ----------
     Le mur longitudinal du couloir est à z = +2. Trois portes sont laissées
     ouvertes : [-8..-7], [-0.5..+0.5], [7.5..8.5]                         */
  const doorWidth = 1.0;
  const doorHeight = 2.2;
  const doorGaps = [
    [-8, -7],
    [-0.5, 0.5],
    [7.5, 8.5],
  ];

  // Segments pleins du mur du couloir (entre les portes)
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

  // Linteaux au-dessus des portes (blocs décoratifs, au-dessus de la tête du joueur)
  for (const [x1, x2] of doorGaps) {
    addBox((x1 + x2) / 2, corridorMaxZ + T / 2, x2 - x1, T, {
      y: doorHeight,
      height: H - doorHeight,
      slot: 'door',
      collide: false, // au-dessus de 2,2 m : pas de collision
      name: 'linteau de porte',
    });
  }

  /* ---------- 4.5 Murs de séparation entre les 3 pièces ---------- */
  // Pièce A : x [-12, -3.5]  |  Pièce B : x [-3.5, 4.5]  |  Pièce C : x [4.5, 12]
  addBox(-3.5, (corridorMaxZ + maxZ) / 2, T, maxZ - corridorMaxZ, { name: 'séparation A/B' });
  addBox(4.5, (corridorMaxZ + maxZ) / 2, T, maxZ - corridorMaxZ, { name: 'séparation B/C' });

  /* ---------- 4.6 Plafonniers néon (source lumineuse + boîte émissive) ---------- */
  const neonPositions = [
    [-8, 0],
    [0, 0],
    [8, 0], // couloir
    [-7.5, 5],
    [0.5, 5], // bureau A + réunion
    [8.5, 5], // réserve
  ];

  const neonMat = new THREE.MeshBasicMaterial({ color: 0xdff6ff });
  const neonGeo = new THREE.BoxGeometry(1.6, 0.08, 0.35);
  const neonLights = [];

  for (const [x, z] of neonPositions) {
    // Boîte émissive : donne l'impression d'un tube néon au plafond
    const neon = new THREE.Mesh(neonGeo, neonMat);
    neon.position.set(x, H - 0.06, z);
    scene.add(neon);

    // PointLight simule la lumière du néon
    const light = new THREE.PointLight(0xbfe9ff, 26, 14, 2); // (couleur, intensité, distance, decay)
    light.position.set(x, H - 0.3, z);
    scene.add(light);
    neonLights.push(light);
  }

  /* ---------- 4.7 Meubles (BoxGeometry + colliders) ---------- */

  // Un bureau = plateau + deux pieds stylisés (boîtes fusionnées en une AABB)
  function addDesk(x, z, w = 2, d = 1) {
    const group = new THREE.Group();
    const mat = slotMaterial('desk', Math.max(1, Math.round(w)), 1);

    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat);
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

  // Étagère / meuble bas (boîte pleine)
  function addShelf(x, z, w, d, h, slot = 'desk') {
    return addBox(x, z, w, d, { height: h, slot, name: 'étagère' });
  }

  // --- Bureau A (ouest) ---
  addDesk(-9.5, 6.4, 2.2, 1.1);
  addDesk(-5.5, 6.4, 2.2, 1.1);
  addShelf(-11.4, 4.0, 1.0, 1.6, 2.0); // arrière-boutique le long du mur ouest
  addShelf(-4.2, 3.0, 0.8, 1.2, 1.1);

  // --- Salle de réunion (centre) ---
  addDesk(0.5, 5.5, 3.2, 1.6); // grande table de réunion
  addDesk(-1.6, 3.4, 0.7, 0.7); // chaises / tables d'appoint
  addDesk(2.6, 3.4, 0.7, 0.7);
  addShelf(3.9, 7.2, 1.6, 0.8, 1.6);

  // --- Réserve (est) ---
  addShelf(11.3, 6.2, 1.2, 2.4, 2.0); // grande étagère contre le mur est
  addShelf(11.3, 3.4, 1.2, 1.6, 2.0);
  addShelf(7.0, 7.2, 2.0, 0.8, 1.2);
  addBox(6.2, 3.2, 0.9, 0.9, { height: 0.9, slot: 'desk', name: 'carton' });

  // --- Couloir : deux caisses (attention à laisser le passage libre) ---
  addBox(4.6, -1.4, 0.8, 0.8, { height: 0.8, slot: 'desk', name: 'caisse 1' });
  addBox(5.5, -1.4, 0.8, 0.8, { height: 0.8, slot: 'desk', name: 'caisse 2' });

  /* ---------- 4.8 Lumière ambiante faible + légère hémisphérique ---------- */
  const ambient = new THREE.AmbientLight(0x5a6b8c, 0.45); // faible, froide
  scene.add(ambient);
  const hemisphere = new THREE.HemisphereLight(0x8fb6d8, 0x1a1d26, 0.35);
  scene.add(hemisphere);

  /* ---------- 4.9 Brouillard (profondeur du couloir) ---------- */
  scene.fog = new THREE.Fog(0x0b1018, 18, 46);
  scene.background = new THREE.Color(0x0b1018);

  return { colliders, objectiveSpots: OBJECTIVE_SPOTS, neonLights, startPoint: START_POINT };
}
