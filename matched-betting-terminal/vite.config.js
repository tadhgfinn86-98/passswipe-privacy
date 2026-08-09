import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The packaged app loads over file:// and never talks to the network, so lock
 * it down with a strict CSP. It is injected at build time only — Vite's dev
 * server needs an inline module preamble that `script-src 'self'` would block.
 */
function productionCsp() {
  return {
    name: 'production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), productionCsp()],
  // Relative paths so the built bundle loads over file:// inside Electron.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
