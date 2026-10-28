/* =========================================================================
   ui.js — Overlay HTML : timer, messages, écrans (start / pause / fin)
   --------------------------------------------------------------------------
   Cette couche ne touche jamais à Three.js : elle ne fait que manipuler le
   DOM décrit dans index.html.
   ========================================================================= */

export function createUI() {
  const hud = document.getElementById('hud');
  const timerEl = document.getElementById('timer');
  const hintEl = document.getElementById('hint');
  const toastEl = document.getElementById('toast');
  const screenEl = document.getElementById('screen');

  let toastTimer = null;

  /* ---------------- Timer ---------------- */
  function setTimer(seconds) {
    const s = Math.ceil(seconds);
    timerEl.textContent = String(s);
    timerEl.classList.toggle('urgent', s <= 10);
  }

  /* ---------------- Objectif courant ---------------- */
  function setHint(text) {
    hintEl.textContent = text;
  }

  /* ---------------- Message transitoire ---------------- */
  function toast(message, duration = 2500) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    // Forcer un reflow pour rejouer la transition d'opacité
    void toastEl.offsetWidth;
    toastEl.classList.add('visible');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('visible');
      setTimeout(() => toastEl.classList.add('hidden'), 260);
    }, duration);
  }

  /* ---------------- Écrans ---------------- */
  function hideScreen() {
    screenEl.classList.add('hidden');
    hud.classList.remove('hidden');
  }

  function showScreen(html) {
    screenEl.innerHTML = html;
    screenEl.classList.remove('hidden');
    hud.classList.add('hidden');
  }

  /** Écran d'accueil (bouton = lancer la partie + pointer lock) */
  function showStart(onStart) {
    showScreen(`
      <div class="title">Inside Job</div>
      <div class="subtitle">
        Un dossier sensible a été caché dans l'un des bureaux du plateau.
        Retrouve-le et reviens au point de départ avant la fin des
        <strong>90 secondes</strong>.
      </div>
      <div class="keys">
        <kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> ou <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> se déplacer
        &nbsp;·&nbsp; <kbd>Maj</kbd> courir &nbsp;·&nbsp; souris regarder &nbsp;·&nbsp; <kbd>Échap</kbd> pause
      </div>
      <button id="btn-primary">Jouer</button>
    `);
    screenEl.querySelector('#btn-primary').addEventListener('click', onStart);
  }

  /** Écran de pause (pointer lock perdu en cours de partie) */
  function showPause(onResume) {
    showScreen(`
      <div class="title">Pause</div>
      <div class="subtitle">Le chrono est suspendu. Clique pour reprendre la mission.</div>
      <button id="btn-primary">Reprendre</button>
    `);
    screenEl.querySelector('#btn-primary').addEventListener('click', onResume);
  }

  /** Écran de fin (victoire / défaite) */
  function showEnd(won, timeLeft, onRestart) {
    showScreen(`
      <div class="title ${won ? 'win' : 'lose'}">${won ? 'Mission accomplie !' : 'Game Over'}</div>
      <div class="stats">
        ${
          won
            ? `Temps restant : <strong>${Math.ceil(timeLeft)} s</strong>`
            : 'Le temps est écoulé... le dossier est toujours dans le bureau.'
        }
      </div>
      <div class="subtitle">
        ${
          won
            ? 'Tu as exfiltré le dossier sans te faire remarquer. Beau travail, agent.'
            : 'La sécurité a verrouillé le plateau. Essaie encore, mais sois plus rapide.'
        }
      </div>
      <button id="btn-primary">Rejouer</button>
    `);
    screenEl.querySelector('#btn-primary').addEventListener('click', onRestart);
  }

  return { setTimer, setHint, toast, hideScreen, showStart, showPause, showEnd };
}