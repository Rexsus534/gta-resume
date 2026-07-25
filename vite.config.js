import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * Dev-only: lets the running game POST a frame grab to disk so screenshots can
 * be inspected outside the browser. Never included in a production build.
 */
function devScreenshot() {
  return {
    name: 'dev-screenshot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'frame')
          .replace(/[^a-z0-9_-]/gi, '');
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const base64 = body.replace(/^data:image\/\w+;base64,/, '');
          const dir = path.resolve('.dev-shots');
          fs.mkdirSync(dir, { recursive: true });
          const file = path.join(dir, `${name}.jpg`);
          fs.writeFileSync(file, Buffer.from(base64, 'base64'));
          res.end(file);
        });
      });
    },
  };
}

export default defineConfig({
  // Relative base so the build works both at the domain root and under a
  // GitHub Pages project path (/<repo>/), and survives renaming the repo.
  // src/entities/player.js resolves the GLBs off import.meta.env.BASE_URL,
  // so the model paths follow this automatically.
  base: './',
  plugins: [devScreenshot()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
