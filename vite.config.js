// Configuration Vite du projet.
// Rien de spécial à configurer : le jeu est une SPA statique avec un point d'entrée index.html.
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // expose le serveur de dev sur 0.0.0.0 (utile pour les prévisualisations)
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
