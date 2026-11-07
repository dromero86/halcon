#!/usr/bin/env node
/**
 * Lint propio de `@halcon/sdk`, sin dependencias.
 *
 * Recorre `sdk/src` (`.js` y `.mjs`) y reporta, con archivo y linea:
 *
 *  - `webix`: el paquete solo usa Zorzal, cualquier referencia a webix sobra;
 *  - `window.` y `document.`: el paquete se importa en Node, sin DOM;
 *  - `console.log`: no se deja registro de depuracion en el paquete;
 *  - imports relativos que no existen en disco (la resolucion es la de ESM:
 *    ruta exacta, o con extension `.js` / `.mjs` / `.json` / `index.js`).
 *
 * Sale 0 si no hay hallazgos y 1 si hay al menos uno.
 *
 * Uso: node scripts/lint.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raiz del repositorio (el directorio que contiene `scripts/`). */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Directorio que se revisa, relativo a la raiz del repositorio. */
const TARGET = join(ROOT, 'sdk', 'src');

/** Extensiones que se revisan. */
const EXTENSIONS = new Set(['.js', '.mjs']);

/**
 * Reglas de texto. `pattern` se evalúa linea por linea.
 * @type {Array<{ id: string, pattern: RegExp, message: string }>}
 */
const RULES = [
  {
    id: 'webix',
    pattern: /webix/i,
    message: 'menciona webix: el paquete solo usa Zorzal',
  },
  {
    id: 'window',
    pattern: /\bwindow\s*\./,
    message: 'usa window.: el paquete se importa en Node, sin DOM',
  },
  {
    id: 'document',
    pattern: /\bdocument\s*\./,
    message: 'usa document.: el paquete se importa en Node, sin DOM',
  },
  {
    id: 'console.log',
    pattern: /console\s*\.\s*log\s*\(/,
    message: 'usa console.log: el paquete no deja registro de depuracion',
  },
];

/**
 * Formas de import que se revisan: `from '<spec>'`, `import '<spec>'` y
 * `import('<spec>')`.
 */
const SPECIFIER_PATTERNS = [
  /\bfrom\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"\n]+)\1/g,
];

/**
 * Lista archivos revisables de un directorio, recursivo y ordenado.
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Resuelve un import relativo como lo haria ESM: ruta exacta o con extension
 * implicita. Devuelve `null` si no existe en disco.
 * @param {string} fromFile
 * @param {string} spec
 * @returns {string|null}
 */
function resolveSpecifier(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.json`, join(base, 'index.js')];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Numero de linea (1-based) de una posicion del texto.
 * @param {string} text
 * @param {number} index
 * @returns {number}
 */
function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

/**
 * Hallazgos de un archivo.
 * @param {string} file
 * @returns {Array<{ file: string, line: number, message: string }>}
 */
function lintFile(file) {
  const text = readFileSync(file, 'utf8');
  const findings = [];

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    for (const rule of RULES) {
      if (rule.pattern.test(lines[i])) {
        findings.push({ file, line: i + 1, message: rule.message });
      }
    }
  }

  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match !== null) {
      const spec = match[2];
      if (spec.startsWith('.')) {
        const target = resolveSpecifier(file, spec);
        if (target === null) {
          findings.push({
            file,
            line: lineOf(text, match.index),
            message: `import relativo inexistente: ${spec}`,
          });
        }
      }
      match = pattern.exec(text);
    }
  }

  return findings;
}

const findings = collectFiles(TARGET).flatMap(lintFile);

if (findings.length === 0) {
  process.stdout.write(`lint: sin hallazgos en ${relative(ROOT, TARGET)}\n`);
  process.exit(0);
}

for (const finding of findings) {
  process.stdout.write(`${relative(ROOT, finding.file)}:${finding.line}: ${finding.message}\n`);
}
process.stdout.write(`lint: ${findings.length} hallazgo(s)\n`);
process.exit(1);
