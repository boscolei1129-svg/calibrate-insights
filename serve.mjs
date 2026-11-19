import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4187);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(root) || requested.startsWith('/tests/') || requested.startsWith('/.')) { res.writeHead(404).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Calibrate: http://127.0.0.1:${port}`));
