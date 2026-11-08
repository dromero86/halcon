/**
 * Tests de la capa de paginas (`sdk/src/app/index.js`).
 *
 * La capa dejo de ser un registro por nombre: cada pagina es un modulo ESM con
 * `mount` y `PAGE_ID`, y `findPage` es el router que usa el shell. Estos tests
 * cubren las tres piezas que no dependen del DOM y el guard que impide volver
 * a introducir `app.define` / `app.require` en la ruta moderna.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAGES, findPage } from '../sdk/src/app/index.js';
import { ESTADOS, estadoPorId, paginaEstado } from '../sdk/compat/pages/estados.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Archivos .js y .mjs de un directorio, recursivo. */
function archivos(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir).sort()) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(js|mjs)$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

test('cada pagina expone mount y un PAGE_ID unico', () => {
  assert.ok(PAGES.length >= 4, `PAGES tiene ${PAGES.length} paginas`);
  const ids = PAGES.map((pagina) => pagina.PAGE_ID);
  for (const [indice, pagina] of PAGES.entries()) {
    assert.equal(typeof pagina.mount, 'function', `${ids[indice]} no expone mount`);
    assert.equal(typeof pagina.PAGE_ID, 'string', `${ids[indice]} no declara PAGE_ID`);
    assert.ok(pagina.PAGE_ID.trim() !== '', `${ids[indice]} tiene PAGE_ID vacio`);
  }
  assert.equal(new Set(ids).size, ids.length, `PAGE_ID repetidos: ${ids.join(', ')}`);
});

test('findPage resuelve una pagina por id y devuelve null si no existe', () => {
  const inicio = findPage('app.inicio');
  assert.ok(inicio, 'findPage no resolvio app.inicio');
  assert.equal(typeof inicio.mount, 'function', 'app.inicio no expone mount');
  assert.equal(findPage('app.inexistente'), null, 'findPage invento una pagina');
});

test('estadoPorId resuelve los cuatro estados de soporte', () => {
  const ids = ESTADOS.map((estado) => estado.id);
  assert.deepEqual(ids, [
    'app.estado.403',
    'app.estado.404',
    'app.estado.error',
    'app.estado.cargando',
  ]);
  for (const id of ids) {
    const estado = estadoPorId(id);
    assert.ok(estado, `estadoPorId no resolvio ${id}`);
    assert.equal(estado.id, id);
  }
  assert.equal(estadoPorId('app.estado.500'), null, 'estadoPorId invento un estado');
});

test('paginaEstado envuelve el estado con mount', () => {
  const pagina = paginaEstado('app.estado.404');
  assert.ok(pagina, 'paginaEstado no resolvio app.estado.404');
  assert.equal(pagina.estado.codigo, '404');
  assert.equal(typeof pagina.mount, 'function', 'paginaEstado no expone mount');
  assert.equal(paginaEstado('app.estado.500'), null, 'paginaEstado invento una pagina');
});

test('la ruta moderna no vuelve a usar app.define, app.require ni app.isDefined', () => {
  const patrones = [/app\.define\s*\(/, /app\.require\s*\(/, /app\.isDefined\s*\(/];
  const hallazgos = [];

  for (const dir of ['sdk/src', 'sdk/compat']) {
    for (const ruta of archivos(join(ROOT, dir))) {
      const relativa = relative(ROOT, ruta).split('\\').join('/');
      const texto = readFileSync(ruta, 'utf8');
      for (const patron of patrones) {
        if (patron.test(texto)) hallazgos.push(`${relativa}: ${patron}`);
      }
    }
  }

  assert.deepEqual(hallazgos, [], `usos de app.define/app.require/app.isDefined: ${hallazgos.join(', ')}`);
});

test('ningun modulo de la ruta moderna importa app-shim', () => {
  const hallazgos = [];
  for (const dir of ['sdk/src', 'sdk/compat']) {
    for (const ruta of archivos(join(ROOT, dir))) {
      const relativa = relative(ROOT, ruta).split('\\').join('/');
      if (relativa === 'sdk/compat/app-shim.js') continue;
      if (/from\s+['"][^'"]*app-shim\.js['"]/.test(readFileSync(ruta, 'utf8'))) {
        hallazgos.push(relativa);
      }
    }
  }
  assert.deepEqual(hallazgos, [], `importan app-shim: ${hallazgos.join(', ')}`);
});
