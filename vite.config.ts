import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const routeName = req.url.replace('/api/', '').split('?')[0];
        const modulePath = path.resolve(__dirname, 'api', `${routeName}.ts`);

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          const bodyText = Buffer.concat(chunks).toString();
          const body = bodyText ? JSON.parse(bodyText) : {};

          const mod = await server.ssrLoadModule(modulePath);
          const fakeReq = { method: req.method, body };
          const fakeRes = {
            statusCode: 200,
            headers: {} as Record<string, string>,
            status(code: number) { this.statusCode = code; return this; },
            json(data: unknown) {
              res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this.headers });
              res.end(JSON.stringify(data));
            },
            setHeader(key: string, value: string) { this.headers[key] = value; return this; },
          };

          await mod.default(fakeReq, fakeRes);
        } catch (err) {
          console.error(`API dev proxy error for ${routeName}:`, err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
