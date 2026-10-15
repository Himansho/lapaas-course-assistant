// Zero-dependency local server: serves public/ and the two API functions,
// the same way Vercel does. Run: npm run dev  (reads .env if it exists)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chat from './api/chat.js';
import event from './api/event.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/chat') return chat(req, res);
  if (url.pathname === '/api/event') return event(req, res);

  let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const data = await readFile(file);
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    if (url.pathname === '/widget.js') res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(port, () => {
  console.log(`Course assistant running at http://localhost:${port}`);
  console.log(process.env.GEMINI_API_KEY ? 'Gemini key found: AI answers on.' : 'No Gemini key: answering from the verified FAQ only (fallback mode).');
});
