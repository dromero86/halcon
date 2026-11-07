#!/usr/bin/env node
/**
 * Build de `@halcon/sdk`, sin dependencias y sin bundler.
 *
 * El resultado es una copia ESM: se limpia `dist/`, se copia `sdk/src` en la
 * raiz de `dist/`, `sdk/vendor` en `dist/vendor/` y los modulos de
 * `sdk/compat` que los plugins todavia importan en `dist/compat/`. No concatena,
 * no minifica y no genera UMD.
 *
 * Como `sdk/src` cuelga de `sdk/` y `dist/` es plano, cada import relativo se
 * reescribe para que apunte al mismo archivo dentro de `dist/`. La ruta destino
 * se resuelve de verdad sobre el arbol fuente: si un import sale del paquete,
 * el build falla en vez de dejar un `dist/` roto.
 *
 * `sdk/src/plugins/check.mjs` queda afuera: es un script de verificacion que
 * arrastra las pantallas de demostracion y no forma parte del paquete.
 *
 * Uso: node scripts/build.mjs
 */

import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raiz del repositorio (el directorio que contiene `scripts/`). */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Destino del build. */
const DIST = join(ROOT, 'dist');

/** Extensiones cuyo contenido se reescribe; el resto se copia tal cual. */
const REWRITABLE = new Set(['.js', '.mjs']);

/**
 * Arboles que entran al paquete, con su destino en `dist/`.
 * `compat` solo aporta los shims que los plugins importan.
 * @type {Array<{ base: string, dest: string }>}
 */
const ROOTS = [
  { base: join(ROOT, 'sdk', 'src'), dest: DIST },
  { base: join(ROOT, 'sdk', 'vendor'), dest: join(DIST, 'vendor') },
  { base: join(ROOT, 'sdk', 'compat'), dest: join(DIST, 'compat') },
];

/** Archivos que no se publican. */
const EXCLUDE = new Set([join(ROOT, 'sdk', 'src', 'plugins', 'check.mjs')]);

/** Mismas formas de import que revisa el lint. */
const SPECIFIER_PATTERNS = [
  /\bfrom\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"\n]+)\1/g,
];

/**
 * Lista archivos de un directorio, recursivo y ordenado.
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...collectFiles(full));
    else files.push(full);
  }
  return files;
}

/**
 * Ruta del archivo dentro de `dist/`, o `null` si queda fuera del paquete.
 * @param {string} file
 * @returns {string|null}
 */
function destFor(file) {
  for (const root of ROOTS) {
    const rel = relative(root.base, file);
    if (rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)) return join(root.dest, rel);
  }
  return null;
}

/**
 * Resuelve un import relativo como lo haria ESM.
 * @param {string} fromFile
 * @param {string} spec
 * @returns {string|null}
 */
function resolveSpecifier(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.json`, join(base, 'index.js')];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // el candidato no existe: se prueba el siguiente
    }
  }
  return null;
}

/**
 * Reemplaza comentarios por espacios conservando los saltos de linea, para que
 * los indices sigan coincidiendo con el texto original y un import escrito
 * dentro de un comentario no cuente como import real.
 * @param {string} text
 * @returns {string}
 */
function stripComments(text) {
  let out = '';
  let quote = null;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (quote !== null) {
      out += char;
      if (char === '\\') {
        out += text[i + 1] === undefined ? '' : text[i + 1];
        i += 2;
        continue;
      }
      if (char === quote) quote = null;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      out += char;
      i += 1;
      continue;
    }
    if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }
    if (char === '/' && text[i + 1] === '*') {
      out += '  ';
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < text.length) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
}

/**
 * Specifiers relativos de un archivo, con su posicion en el texto.
 * @param {string} text
 * @returns {Array<{ start: number, end: number, spec: string }>}
 */
function findSpecifiers(text) {
  const code = stripComments(text);
  const found = [];
  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(code);
    while (match !== null) {
      const spec = match[2];
      if (spec.startsWith('.')) {
        const start = match.index + match[0].lastIndexOf(spec);
        found.push({ start, end: start + spec.length, spec });
      }
      match = pattern.exec(code);
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/**
 * Specifier relativo que va de un archivo de `dist/` a otro.
 * @param {string} fromDest
 * @param {string} toDest
 * @returns {string}
 */
function relativeSpecifier(fromDest, toDest) {
  const rel = relative(dirname(fromDest), toDest).split(sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

// --- copia ---------------------------------------------------------------

const seeds = [
  ...collectFiles(join(ROOT, 'sdk', 'src')).filter((file) => !EXCLUDE.has(file)),
  ...collectFiles(join(ROOT, 'sdk', 'vendor')),
];

/** Archivos que entran al paquete, en orden de aparicion. */
const files = new Map();

/** Cola de archivos por procesar. */
const pending = [...seeds];
for (const file of seeds) files.set(file, destFor(file));

while (pending.length > 0) {
  const file = pending.shift();
  if (!REWRITABLE.has(extname(file))) continue;

  const text = readFileSync(file, 'utf8');
  for (const { spec } of findSpecifiers(text)) {
    const target = resolveSpecifier(file, spec);
    if (target === null) {
      process.stderr.write(`build: import inexistente en ${relative(ROOT, file)}: ${spec}\n`);
      process.exit(1);
    }
    const dest = destFor(target);
    if (dest === null) {
      process.stderr.write(
        `build: ${relative(ROOT, file)} importa ${spec}, que queda fuera del paquete\n`,
      );
      process.exit(1);
    }
    if (!files.has(target)) {
      files.set(target, dest);
      pending.push(target);
    }
  }
}

rmSync(DIST, { recursive: true, force: true });

for (const [file, dest] of files) {
  mkdirSync(dirname(dest), { recursive: true });
  if (!REWRITABLE.has(extname(file))) {
    copyFileSync(file, dest);
    continue;
  }

  const text = readFileSync(file, 'utf8');
  let output = text;
  const specifiers = findSpecifiers(text);
  for (let i = specifiers.length - 1; i >= 0; i -= 1) {
    const { start, end, spec } = specifiers[i];
    const target = resolveSpecifier(file, spec);
    const rewritten = relativeSpecifier(dest, destFor(target));
    if (rewritten !== spec) output = output.slice(0, start) + rewritten + output.slice(end);
  }
  writeFileSync(dest, output);
}

// --- metadatos -----------------------------------------------------------

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

writeFileSync(
  join(DIST, 'package.json'),
  `${JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      type: 'module',
      main: './halcon.js',
      exports: { '.': './halcon.js' },
      engines: pkg.engines,
      license: pkg.license,
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  join(DIST, 'README.md'),
  `# ${pkg.name} ${pkg.version}

Copia ESM del paquete, generada con \`node scripts/build.mjs\` desde \`sdk/src\` y
\`sdk/vendor\`. No hay bundler ni dependencias: los archivos son los mismos
modulos, con los imports relativos ajustados a esta estructura.

## Uso

\`\`\`js
import { init, register, ui, kinds } from '@halcon/sdk';

const barra = init({ el: '#app', kind: 'mainbar' });
\`\`\`

En un navegador, sin instalacion, se puede importar el archivo directo:

\`\`\`js
import { init } from './dist/halcon.js';
\`\`\`

## Contenido

    halcon.js           punto de entrada (init, register, ui, create, define, kinds, iconos)
    version.js          VERSION del paquete
    plugins/            kinds mainbar, formview y datalist
    vendor/zorzal/      motor Zorzal vendorizado
    compat/             shims de sesion y navegacion que los plugins todavia usan

Los estilos del motor estan en \`vendor/zorzal/src/zorzal.css\`.

## Alcance

El build es una copia ESM lista para servir o publicar en un registro que
resuelva modulos ES. No genera UMD ni CommonJS porque el paquete no tiene
bundler ni dependencias, y porque Zorzal solo se publica como modulos ES.
`,
);

const total = files.size;
process.stdout.write(`build: ${total} archivo(s) en ${relative(ROOT, DIST)}/\n`);
