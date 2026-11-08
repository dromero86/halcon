/**
 * Guard del vendor de Zorzal.
 *
 * Halcon no copia el codigo fuente de Zorzal: vendoriza solo el build
 * minificado de la version en uso (`zorzal-<version>.min.js` y
 * `zorzal-<version>.min.css`). Estos tests fallan si aparece otra cosa en
 * `sdk/vendor/zorzal` o si el bundle no exporta lo que importan los modulos.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VENDOR = fileURLToPath(new URL('../sdk/vendor/zorzal/', import.meta.url));

/** API de Zorzal que importa Halcon. */
const EXPORTS = [
  'ui',
  'create',
  'define',
  'kinds',
  'icons',
  'toast',
  'isDefined',
  'setDocument',
  'Widget',
  'version',
];

test('el vendor es solo el dist minificado, sin copia del codigo fuente', () => {
  const archivos = readdirSync(VENDOR).sort();
  assert.deepEqual(archivos, ['zorzal-0.1.0.min.css', 'zorzal-0.1.0.min.js']);
});

test('el bundle exporta la API que usa Halcon y la version del nombre', async () => {
  const zorzal = await import('../sdk/vendor/zorzal/zorzal-0.1.0.min.js');
  const falta = EXPORTS.filter((nombre) => !(nombre in zorzal));
  assert.deepEqual(falta, [], `el bundle no exporta: ${falta.join(', ')}`);
  assert.equal(zorzal.version, '0.1.0', 'la version exportada no coincide con el nombre del archivo');
  assert.equal(typeof zorzal.icons.STROKE_WIDTH, 'number');
  assert.equal(typeof zorzal.icons.VIEW_BOX, 'string');
});
