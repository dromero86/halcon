#!/usr/bin/env node
/**
 * Servidor de desarrollo de Halcon.
 *
 * `sdk/index.html` no trae rutas literales: usa `{url}` y `{rand}`, que en
 * produccion reemplaza el backend. `python -m http.server` sirve el archivo tal
 * cual, deja `src="{url}sdk/sys/core/loader.js"` y el loader nunca arranca.
 *
 * Este servidor hace ese reemplazo al vuelo y despues sirve los estaticos desde
 * la raiz del repositorio, sin dependencias.
 *
 * Uso: node scripts/serve.mjs [puerto] [--bind 0.0.0.0]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a))) || Number(process.env.PORT) || 8090;
const bindIndex = args.indexOf('--bind');
const bind = bindIndex >= 0 ? args[bindIndex + 1] : process.env.BIND || '0.0.0.0';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/** Resuelve un pedido a un archivo dentro de ROOT, sin salir del arbol. */
function resolver(urlPath) {
  const limpio = decodeURIComponent(urlPath.split('?')[0]);
  const destino = normalize(join(ROOT, limpio));
  if (!destino.startsWith(ROOT)) return null;
  return destino;
}

const server = createServer(async (req, res) => {
  const pedido = (req.url || '/').split('?')[0];
  let destino = pedido === '/' ? join(ROOT, 'sdk', 'index.html') : resolver(req.url || '/');
  if (!destino) {
    res.writeHead(403).end('fuera del arbol');
    return;
  }

  try {
    const info = await stat(destino);
    if (info.isDirectory()) destino = join(destino, 'index.html');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('no encontrado');
    return;
  }

  try {
    let cuerpo = await readFile(destino);
    const ext = extname(destino).toLowerCase();

    // Placeholders del backend: `{url}` es la base publica y `{rand}` evita cache.
    if (ext === '.html') {
      cuerpo = Buffer.from(
        cuerpo
          .toString('utf8')
          .replaceAll('{url}', '/')
          .replaceAll('{rand}', String(Date.now())),
        'utf8',
      );
    }

    res.writeHead(200, {
      'content-type': TIPOS[ext] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(cuerpo);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('error de lectura');
  }
});

server.listen(port, bind, () => {
  console.log(`Halcon en http://${bind}:${port}/sdk/index.html`);
});
