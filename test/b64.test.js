/**
 * Tests de `sdk/sys/core/b64.js`.
 *
 * Verifica el contrato historico (`B64.encode`/`decode`) y los casos que la
 * version 1 rompia: acentos, emoji (pares surrogados), padding invalido y
 * alfabeto invalido. No usa `navigator` ni `atob`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../sdk/sys/core/b64.js', import.meta.url), 'utf8');

function load() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(SOURCE, sandbox, { filename: 'b64.js' });
  return sandbox.B64;
}

test('b64 no depende de navigator ni de atob', () => {
  assert.doesNotMatch(SOURCE, /navigator\./);
  assert.doesNotMatch(SOURCE, /\batob\s*\(/);
  assert.doesNotMatch(SOURCE, /\bbtoa\s*\(/);
});

test('encode/decode ASCII y UTF-8', () => {
  const B64 = load();
  assert.equal(B64.encode('hola'), 'aG9sYQ==');
  assert.equal(B64.encode('á'), 'w6E=');
  assert.equal(B64.encode('ñ'), 'w7E=');
  assert.equal(B64.encode('日本'), '5pel5pys');
  assert.equal(B64.encode('😀'), '8J+YgA==');
  assert.equal(B64.encode(''), '');

  assert.equal(B64.decode('aG9sYQ=='), 'hola');
  assert.equal(B64.decode('w6E='), 'á');
  assert.equal(B64.decode('5pel5pys'), '日本');
  assert.equal(B64.decode('8J+YgA=='), '😀');
  assert.equal(B64.decode(''), '');
});

test('roundtrip con texto Unicode y emoji', () => {
  const B64 = load();
  const texto = 'Halcón ñandú 日本 😀🚀';
  assert.equal(B64.decode(B64.encode(texto)), texto);
});

test('toUtf8/fromUtf8 mantienen el contrato de bytes', () => {
  const B64 = load();
  assert.deepEqual(Array.from(B64.toUtf8('á')), [195, 161]);
  assert.deepEqual(Array.from(B64.toUtf8('😀')), [240, 159, 152, 128]);
  assert.deepEqual(Array.from(B64.fromUtf8('w6E=')), [195, 161]);
  assert.deepEqual(Array.from(B64.fromUtf8('8J+YgA==')), [240, 159, 152, 128]);
});

test('un surrogate suelto se reemplaza por U+FFFD', () => {
  const B64 = load();
  const encoded = B64.encode('\uD800');
  assert.equal(B64.decode(encoded), '\uFFFD');
});

test('rechaza longitud, alfabeto y padding invalidos', () => {
  const B64 = load();
  assert.throws(() => B64.decode('a'), /InvalidCharacterError/);
  assert.throws(() => B64.decode('aG9sYQ='), /InvalidCharacterError/);
  assert.throws(() => B64.decode('!!!!'), /InvalidCharacterError/);
  assert.throws(() => B64.decode('aG9sYQ==Z'), /InvalidCharacterError/);
  assert.throws(() => B64.decode('A==='), /InvalidCharacterError/);
  assert.throws(() => B64.decode('AA=A'), /InvalidCharacterError/);
});

test('lookup se construye de forma perezosa y ie/ieo quedan en false', () => {
  const B64 = load();
  assert.equal(B64.ie, false);
  assert.equal(B64.ieo, false);
  assert.equal(B64.lookup, null);
  B64.decode('aG9sYQ==');
  assert.equal(B64.lookup.A, 0);
  assert.equal(B64.lookup['/'], 63);
});
