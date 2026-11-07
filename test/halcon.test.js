/**
 * Tests del paquete `@halcon/sdk`.
 *
 * Se ejecutan con el runner nativo de Node (`node --test test/`), sin
 * dependencias. No hay DOM: el paquete debe importarse y validar argumentos
 * en un proceso Node comun; el montaje real se verifica con un mock de
 * `ui.mount`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ui,
  create,
  define,
  kinds,
  getIcon,
  hasIcon,
  addIcon,
  iconNames,
  register,
  init,
  VERSION,
} from '../sdk/src/halcon.js';

test('el paquete se importa sin DOM', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof ui, 'object');
  assert.equal(typeof ui.mount, 'function');
});

test('VERSION es semver y coincide con package.json', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  assert.equal(VERSION, pkg.version);
});

test('los exports publicos existen', () => {
  const esperados = {
    ui: 'object',
    create: 'function',
    define: 'function',
    kinds: 'function',
    getIcon: 'function',
    hasIcon: 'function',
    addIcon: 'function',
    iconNames: 'function',
    register: 'function',
    init: 'function',
    VERSION: 'string',
  };
  for (const [nombre, tipo] of Object.entries(esperados)) {
    assert.equal(typeof { ui, create, define, kinds, getIcon, hasIcon, addIcon, iconNames, register, init, VERSION }[nombre], tipo, nombre);
  }
});

test('los servicios de iconos resuelven contra el set de Zorzal', () => {
  assert.ok(iconNames().includes('check'));
  assert.equal(hasIcon('check'), true);
  assert.equal(hasIcon('no-existe-jamas'), false);
  assert.ok(Array.isArray(getIcon('check')));
});

test('los plugins mainbar, formview y datalist quedan registrados', () => {
  const registrados = new Set(kinds());
  for (const nombre of ['mainbar', 'formview', 'datalist']) {
    assert.ok(registrados.has(nombre), `falta el kind ${nombre}`);
  }
});

test('register valida kind y factory', () => {
  assert.throws(() => register('', () => ({ el: null })), /kind debe ser un string no vacio/);
  assert.throws(() => register('   ', () => ({ el: null })), /kind debe ser un string no vacio/);
  assert.throws(() => register(42, () => ({ el: null })), /kind debe ser un string no vacio/);
  assert.throws(() => register('test-044', null), /factory debe ser una funcion/);
  assert.throws(() => register('test-044', {}), /factory debe ser una funcion/);
});

test('register delega en define y el kind queda disponible', () => {
  const factory = () => ({ el: null });
  const devuelto = register('test-044-kind', factory);
  assert.equal(devuelto, factory);
  assert.ok(kinds().includes('test-044-kind'));
});

test('init exige el contenedor', () => {
  const mensaje = /init: falta el contenedor \(el\)/;
  assert.throws(() => init(), mensaje);
  assert.throws(() => init({}), mensaje);
  assert.throws(() => init({ el: null }), mensaje);
  assert.throws(() => init({ el: '' }), mensaje);
});

test('init exige spec o kind', () => {
  const el = { appendChild() {} };
  const mensaje = /init: falta spec o kind/;
  assert.throws(() => init({ el }), mensaje);
  assert.throws(() => init({ el, kind: '' }), mensaje);
  assert.throws(() => init({ el, spec: null }), mensaje);
});

test('init delega en ui.mount con { el, kind, ...props }', () => {
  const original = ui.mount;
  const llamadas = [];
  const instancia = { mock: true };
  ui.mount = (el, spec) => {
    llamadas.push({ el, spec });
    return instancia;
  };

  try {
    const el = { appendChild() {} };
    const devuelto = init({ el, kind: 'action', text: 'Hola' });

    assert.equal(devuelto, instancia);
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].el, el);
    assert.deepEqual(llamadas[0].spec, { kind: 'action', text: 'Hola' });
  } finally {
    ui.mount = original;
  }
});

test('init delega en ui.mount con { el, spec } y prioriza spec', () => {
  const original = ui.mount;
  const llamadas = [];
  ui.mount = (el, spec) => {
    llamadas.push({ el, spec });
    return { mock: true };
  };

  try {
    const el = { appendChild() {} };
    const spec = { kind: 'action', text: 'Adios' };
    init({ el, spec, kind: 'ignorado', text: 'ignorado' });

    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].spec, spec);
    assert.equal(llamadas[0].spec.kind, 'action');
  } finally {
    ui.mount = original;
  }
});

test('init no monta cuando los argumentos son invalidos', () => {
  const original = ui.mount;
  let montado = false;
  ui.mount = () => {
    montado = true;
    return null;
  };

  try {
    assert.throws(() => init({ el: null, kind: 'action' }));
    assert.throws(() => init({ el: {}, kind: '' }));
    assert.equal(montado, false);
  } finally {
    ui.mount = original;
  }
});
