import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const MIME: Record<string, string> = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

export default async function globalSetup() {
  const root = join(process.cwd(), 'dist');
  const server = createServer(async (request, response) => {
    try {
      const requested = decodeURIComponent((request.url ?? '/').split('?')[0]);
      const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
      const safePath = normalize(join(root, relative));
      let path = safePath.startsWith(root) ? safePath : join(root, 'index.html');
      let body: Buffer;
      try { body = await readFile(path); } catch { path = join(root, 'index.html'); body = await readFile(path); }
      response.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(500).end();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(5173, '127.0.0.1', resolve);
  });
  return async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
