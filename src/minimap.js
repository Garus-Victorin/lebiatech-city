/* =========================================================================
   minimap.js — Carte de navigation (style GTA) en bas à gauche
   --------------------------------------------------------------------------
   Dessine une vue de dessus du bâtiment : murs, séparations, point de départ,
   objectif (blip) et position/orientation du joueur.
   ========================================================================= */

export function createMinimap(player, world) {
  const canvas = document.getElementById('minimap');
  if (!canvas) return { draw() {} };
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const bounds = { minX: -12, maxX: 12, minZ: -2, maxZ: 8 };
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midZ = (bounds.minZ + bounds.maxZ) / 2;
  const scale = Math.min(W / (bounds.maxX - bounds.minX), H / (bounds.maxZ - bounds.minZ)) * 0.88;
  const cx = W / 2;
  const cy = H / 2;

  const toX = (x) => cx + (x - midX) * scale;
  const toY = (z) => cy + (z - midZ) * scale;

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Fond
    ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
    ctx.fillRect(0, 0, W, H);

    // Clip circulaire
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, W / 2 - 1, 0, Math.PI * 2);
    ctx.clip();

    // Sol du bâtiment
    ctx.fillStyle = 'rgba(40, 50, 70, 0.5)';
    ctx.fillRect(toX(bounds.minX), toY(bounds.minZ), (bounds.maxX - bounds.minX) * scale, (bounds.maxZ - bounds.minZ) * scale);

    // Contour extérieur
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(toX(bounds.minX), toY(bounds.minZ), (bounds.maxX - bounds.minX) * scale, (bounds.maxZ - bounds.minZ) * scale);

    // Mur du couloir (z=2) avec portes
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(toX(bounds.minX), toY(2));
    ctx.lineTo(toX(-8), toY(2));
    ctx.moveTo(toX(-7), toY(2));
    ctx.lineTo(toX(-0.5), toY(2));
    ctx.moveTo(toX(0.5), toY(2));
    ctx.lineTo(toX(7.5), toY(2));
    ctx.moveTo(toX(8.5), toY(2));
    ctx.lineTo(toX(bounds.maxX), toY(2));
    ctx.stroke();

    // Séparations verticales entre pièces
    ctx.beginPath();
    ctx.moveTo(toX(-3.5), toY(2));
    ctx.lineTo(toX(-3.5), toY(bounds.maxZ));
    ctx.moveTo(toX(4.5), toY(2));
    ctx.lineTo(toX(4.5), toY(bounds.maxZ));
    ctx.stroke();

    // Point de départ (cyan)
    const sp = world.startPoint;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(toX(sp.x), toY(sp.z), 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Joueur (triangle orienté)
    const p = player.position;
    const px = toX(p.x);
    const py = toY(p.z);
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    const fx = -sin;
    const fz = -cos;
    const ang = Math.atan2(fx, fz);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(-5, 5);
    ctx.lineTo(5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  return { draw };
}
