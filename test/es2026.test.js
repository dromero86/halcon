/**
 * Tests del baseline ES2026 de `@halcon/sdk`.
 *
 * Tres contratos:
 *
 *  - la matriz de `scripts/es2026.mjs` declara siete features y seis
 *    obligatorias, y las seis obligatorias existen en el runtime que corre la
 *    suite (Node >= 26);
 *  - `Uint8Array.prototype.toBase64` con `alphabet: 'base64url'` y
 *    `omitPadding: true` produce los vectores conocidos de RFC 4648 seccion 10;
 *  - el challenge S256 del verificador de RFC 7636 apendice B sigue dando el
 *    valor esperado, que es la razon por la que `pkce.js` usa la API nativa.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { FEATURES, estado } from '../scripts/es2026.mjs';
import { challengeS256 } from '../sdk/src/auth/pkce.js';

/** Verificador del apendice B de RFC 7636. */
const VERIFICADOR_RFC = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

/** Challenge S256 que el RFC espera para ese verificador. */
const CHALLENGE_RFC = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

/** Vectores de RFC 4648 seccion 10, sin relleno. */
const VECTORES_RFC4648 = [
  ['', ''],
  ['f', 'Zg'],
  ['fo', 'Zm8'],
  ['foo', 'Zm9v'],
  ['foob', 'Zm9vYg'],
  ['fooba', 'Zm9vYmE'],
  ['foobar', 'Zm9vYmFy'],
];

test('el baseline son siete features y seis obligatorias', () => {
  assert.equal(FEATURES.length, 7);
  const obligatorias = FEATURES.filter((feature) => feature.obligatoria);
  assert.equal(obligatorias.length, 6);
});

test('las seis features obligatorias existen en el runtime', () => {
  for (const feature of FEATURES.filter((entrada) => entrada.obligatoria)) {
    assert.equal(feature.detectar(), true, `${feature.nombre} falta en node ${process.versions.node}`);
    assert.equal(estado(feature), 'soportada');
  }
});

test('el runtime es ES2026: node >= 26', () => {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 26, `node ${process.versions.node}`);
});

test('Math.sumPrecise se reporta como no soportada por Node y no es obligatoria', () => {
  const sumPrecise = FEATURES.find((feature) => feature.nombre === 'Math.sumPrecise');
  assert.ok(sumPrecise);
  assert.equal(sumPrecise.obligatoria, false);
  if (typeof Math.sumPrecise !== 'function') {
    assert.equal(estado(sumPrecise), 'no soportada por Node');
  }
});

test('toBase64 base64url sin relleno produce los vectores de RFC 4648', () => {
  const codificador = new TextEncoder();
  for (const [texto, esperado] of VECTORES_RFC4648) {
    const bytes = codificador.encode(texto);
    assert.equal(bytes.toBase64({ alphabet: 'base64url', omitPadding: true }), esperado);
  }
});

test('toBase64 base64url usa los dos caracteres no alfanumericos del alfabeto', () => {
  // 0xfb 0xff -> segun RFC 4648, base64 "-_8"; con padding "-_8=".
  const bytes = new Uint8Array([0xfb, 0xff]);
  assert.equal(bytes.toBase64({ alphabet: 'base64url', omitPadding: true }), '-_8');
  assert.equal(bytes.toBase64({ alphabet: 'base64url' }), '-_8=');
  assert.equal(bytes.toBase64(), '+/8=');
});

test('fromBase64 vuelve al byte original con alphabet base64url', () => {
  const bytes = new Uint8Array([0xfb, 0xff, 0x00, 0x41]);
  const codificado = bytes.toBase64({ alphabet: 'base64url', omitPadding: true });
  assert.deepEqual(Array.from(Uint8Array.fromBase64(codificado, { alphabet: 'base64url' })), [
    0xfb, 0xff, 0x00, 0x41,
  ]);
});

test('el challenge S256 del RFC 7636 se mantiene con la API nativa', async () => {
  assert.equal(await challengeS256(VERIFICADOR_RFC), CHALLENGE_RFC);
});

test('el challenge S256 no lleva relleno ni caracteres del alfabeto base64 estandar', async () => {
  const challenge = await challengeS256(VERIFICADOR_RFC);
  assert.doesNotMatch(challenge, /[=+/]/);
  assert.equal(challenge.length, 43);
});
