# Inside Job

Jeu 3D en vue première personne inspiré de GTA mais **à l'intérieur d'un bâtiment de bureaux**.
Retrouve un dossier caché dans l'une des trois pièces et reviens au point de départ **avant la fin des 90 secondes**.

- **Stack** : Three.js (npm) · JavaScript ES6+ · Vite — *aucune autre librairie externe*.
- **Géométrie** : 100 % procédurale (`BoxGeometry` pour murs/meubles, `PlaneGeometry` pour sol/plafond).
- **Commentaires** : en français dans tous les fichiers.

## 📁 Arborescence

```
inside-job/
├── index.html          # Page unique : canvas + overlay HTML (HUD, écrans)
├── package.json        # Dépendances : three (prod), vite (dev)
├── vite.config.js      # Configuration Vite
├── public/
│   └── textures/       # ← DÉPOSEZ VOS IMAGES ICI (voir plus bas)
├── src/
│   ├── main.js         # Point d'entrée : scène, renderer, boucle de jeu
│   ├── world.js        # Intérieur (murs, pièces, couloir, lumières) + SLOTS de textures
│   ├── player.js       # Contrôles FPS : pointer lock, ZQSD/WASD, collisions AABB
│   ├── mission.js      # Logique de la mission : objet + timer 90 s + états
│   ├── ui.js           # Overlay HTML : timer, messages, écrans start/pause/fin
│   └── style.css       # Styles de l'overlay
└── README.md
```

## 🚀 Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # build de production dans dist/
npm run preview    # sert le build
```

## 🎮 Contrôles

| Action | Touche |
| --- | --- |
| Se déplacer | `Z Q S D` (AZERTY) ou `W A S D` (QWERTY) / flèches |
| Courir | `Maj` (maintenu) |
| Regarder | souris (pointer lock — clique sur l'écran pour capturer) |
| Pause | `Échap` (puis clic sur *Reprendre*) |

## 🧭 Règle du jeu

1. Un **dossier** (cube orange lumineux) est placé **au hasard** dans l'une des 3 pièces : *Bureau A*, *Salle de réunion*, *Réserve*.
2. Trouve-le (ramassage automatique à moins de 1,5 m).
3. **Reviens au point de départ** (marqueur cyan dans le couloir ouest) avant que le chrono n'atteigne 0.
4. Succès → *Mission accomplie !* — Échec → *Game Over* avec un bouton **Rejouer**.

---

## 🖼️ Comment remplacer les textures (murs, sol, etc.)

Le jeu fonctionne **sans aucun asset** : chaque surface a une couleur de repli.
Pour appliquer vos images, il suffit de renseigner les **slots de textures**.

### Étape 1 — Déposez vos images

Copiez vos fichiers dans le dossier **`public/textures/`**, par exemple :

```
public/textures/
├── sol-carrelage.png
├── mur-brique.png
├── plafond-beton.jpg
└── bureau-bois.png
```

> Conseil : utilisez des images **tileables** (qui se répètent sans raccord visible).
> Le jeu répète automatiquement les textures (`RepeatWrapping`) selon la taille de
> chaque mur / du sol, donc évitez les captures d'écran rectangulaires si possible.

### Étape 2 — Renseignez les slots dans `src/world.js`

En haut de `src/world.js`, remplacez les chaînes vides par vos chemins :

```js
export const TEXTURE_SLOTS = {
  floor:   '/textures/sol-carrelage.png',   // sol
  wall:    '/textures/mur-brique.png',      // murs (couloir + pièces)
  ceiling: '/textures/plafond-beton.jpg',   // plafond
  door:    '/textures/linteau-porte.png',   // blocs au-dessus des portes
  desk:    '/textures/bureau-bois.png',     // bureaux, étagères, caisses
};
```

Règles :

- Chemin **absolu** (`/textures/...`) = fichier dans `public/` → recommandé.
- Chemin **relatif** (`./textures/...` ou `../assets/...`) = fichier dans `src/` (Vite le traitera et l'hashera au build).
- Chaîne **vide** (`''`) = slot désactivé → couleur unie procédurale.
- Si l'image est introuvable, un avertissement s'affiche dans la console et le jeu garde la couleur de repli (il ne plante pas).

### Étape 3 — (Optionnel) Adapter les couleurs de repli

Toujours dans `src/world.js`, l'objet `BASE_COLORS` donne la teinte utilisée
quand un slot est vide. Vous pouvez aussi modifier les couleurs/matériaux des
lumières néon (`neonPositions`, `PointLight`) pour l'ambiance désirée.

### Étape 4 — Ajouter une nouvelle surface (slot) si besoin

1. Ajoutez votre clé dans `TEXTURE_SLOTS` : `window: ''`.
2. Ajoutez sa couleur dans `BASE_COLORS` : `window: 0x88aaff`.
3. Dans la construction, passez le slot au bloc correspondant :
   `addBox(x, z, w, d, { slot: 'window' })` ou
   `slotMaterial('window', repeatX, repeatY)`.

---

## ⚙️ Architecture (comment les modules s'emboîtent)

```
main.js ── crée renderer/scène/caméra
   │
   ├── world.js     → monde + colliders (AABB) + spots d'objet + lumières
   ├── player.js    → déplacement FPS + collisions (reçoit les colliders)
   ├── mission.js   → timer, ramassage, retour au départ (reçoit player + ui)
   └── ui.js        → DOM du HUD et des écrans (aucun lien avec Three.js)
```

- **Collisions** : chaque mur/meuble est une AABB en plan XZ ; le joueur est un
  cercle de rayon 0,35 m, résolu **axe par axe** (glisse le long des murs).
- **États** : `menu → playing → paused → ended`, gérés dans `main.js`.
