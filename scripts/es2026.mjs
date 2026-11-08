#!/usr/bin/env node
/**
 * Matriz de features ES2026 de `@halcon/sdk`.
 *
 * El paquete declara ES2026 como baseline (`engines.node` >= 26 y la matriz de
 * navegadores de `browserslist`). Este script es el control automatico de esa
 * declaracion: detecta las siete features que definen el baseline, imprime una
 * linea por feature con su estado en el runtime que lo ejecuta y sale 1 si
 * falta alguna de las obligatorias.
 *
 * Seis features son obligatorias. `Math.sumPrecise` no esta implementada en
 * Node 26 y no se usa en el paquete: se reporta como "no soportada por Node" y
 * no hace fallar el script.
 *
 * Uso: node scripts/es2026.mjs
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Features del baseline. `detectar` devuelve true si el runtime la implementa.
 * @type {Array<{ nombre: string, obligatoria: boolean, detectar: () => boolean }>}
 */
export const FEATURES = [
  {
    nombre: 'Array.fromAsync',
    obligatoria: true,
    detectar: () => typeof Array.fromAsync === 'function',
  },
  {
    nombre: 'Error.isError',
    obligatoria: true,
    detectar: () => typeof Error.isError === 'function',
  },
  {
    nombre: 'Math.sumPrecise',
    obligatoria: false,
    detectar: () => typeof Math.sumPrecise === 'function',
  },
  {
    nombre: 'Uint8Array.fromBase64/toBase64',
    obligatoria: true,
    detectar: () =>
      typeof Uint8Array.fromBase64 === 'function' &&
      typeof Uint8Array.prototype.toBase64 === 'function',
  },
  {
    nombre: 'Iterator.concat',
    obligatoria: true,
    detectar: () => typeof Iterator !== 'undefined' && typeof Iterator.concat === 'function',
  },
  {
    nombre: 'Map.prototype.getOrInsert',
    obligatoria: true,
    detectar: () => typeof Map.prototype.getOrInsert === 'function',
  },
  {
    nombre: 'JSON.rawJSON',
    obligatoria: true,
    detectar: () => typeof JSON.rawJSON === 'function',
  },
];

/**
 * Estado legible de una feature en el runtime actual.
 * @param {{ nombre: string, obligatoria: boolean, detectar: () => boolean }} feature
 * @returns {string}
 */
export function estado(feature) {
  if (feature.detectar()) return 'soportada';
  return feature.obligatoria ? 'falta (obligatoria)' : 'no soportada por Node';
}

/**
 * Evalua la matriz completa e imprime una linea por feature.
 * @param {Array<{ nombre: string, obligatoria: boolean, detectar: () => boolean }>} features
 * @returns {number} cantidad de features obligatorias ausentes
 */
export function evaluar(features) {
  let faltantes = 0;
  const ancho = Math.max(...features.map((feature) => feature.nombre.length));
  for (const feature of features) {
    if (feature.obligatoria && !feature.detectar()) faltantes += 1;
    process.stdout.write(`${feature.nombre.padEnd(ancho)}  ${estado(feature)}\n`);
  }
  return faltantes;
}

const esEntrada =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (esEntrada) {
  const faltantes = evaluar(FEATURES);

  if (faltantes === 0) {
    process.stdout.write(`es2026: baseline completo en node ${process.versions.node}\n`);
    process.exit(0);
  }

  process.stdout.write(`es2026: ${faltantes} feature(s) obligatoria(s) ausente(s) en node ${process.versions.node}\n`);
  process.exit(1);
}
