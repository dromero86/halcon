/**
 * Tests de `sdk/sys/core/waves.js`.
 *
 * Valida el contrato (`add`, `clear`, `service`, `destroy`, `mouse_event`) y
 * los bugs de la version 1: `event.path`, coordenadas de scroll, `for...in`,
 * `innerHTML` y listener no removible.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../sdk/sys/core/waves.js', import.meta.url), 'utf8');

function createElement(tag) {
  const classes = new Set();
  const children = [];
  const el = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    children,
    parentNode: null,
    className: '',
    style: {},
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = el;
      children.push(child);
      return child;
    },
    removeChild(child) {
      const at = children.indexOf(child);
      if (at > -1) children.splice(at, 1);
      child.parentNode = null;
      return child;
    },
    setAttribute(key, value) {
      el[key] = value;
    },
    getBoundingClientRect() {
      return { left: el.left !== undefined ? el.left : 10, top: el.top !== undefined ? el.top : 20, width: 100, height: 40 };
    },
    classList: {
      add(value) {
        classes.add(value);
      },
      remove(value) {
        classes.delete(value);
      },
      contains(value) {
        return classes.has(value);
      },
    },
  };
  return el;
}

function createHarness() {
  const listeners = {};
  const body = createElement('body');
  body.addEventListener = (type, fn) => {
    listeners[type] = fn;
  };
  body.removeEventListener = (type, fn) => {
    if (listeners[type] === fn) delete listeners[type];
  };

  const document = {
    body,
    documentElement: body,
    createElement(tag) {
      return createElement(tag);
    },
  };

  const sandbox = {
    document,
    console,
    setTimeout,
    clearTimeout,
    pageXOffset: 0,
    pageYOffset: 0,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.runInNewContext(SOURCE, sandbox, { filename: 'waves.js' });

  return {
    waves: sandbox.waves,
    body,
    listeners,
    document,
    dispatch(event) {
      if (listeners.mouseup) listeners.mouseup(event);
    },
    tick(ms = 10) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
  };
}

function button() {
  const el = createElement('button');
  el.classList.add('btn');
  return el;
}

test('waves expone la API y se registra una sola vez', () => {
  const h = createHarness();
  assert.equal(typeof h.waves.add, 'function');
  assert.equal(typeof h.waves.clear, 'function');
  assert.equal(typeof h.waves.service, 'function');
  assert.equal(typeof h.waves.destroy, 'function');
  assert.equal(typeof h.waves.mouse_event, 'function');
  assert.equal(h.waves.duration, 1000);
  assert.equal(typeof h.listeners.mouseup, 'function');
});

test('dispara un ripple con coordenadas de viewport y effect', async () => {
  const h = createHarness();
  const after = [];
  h.waves.duration = 5;
  h.waves.add({ css: 'btn', effect: 'waves-dark', after: () => after.push('ok') });

  const target = button();
  const parent = createElement('div');
  parent.appendChild(target);

  h.dispatch({
    target,
    clientX: 30,
    clientY: 40,
    composedPath: () => [target, parent],
  });

  assert.equal(h.body.children.length, 1);
  const container = h.body.children[0];
  assert.equal(container.className, 'waves-container');
  assert.equal(container.style.top, '20px');
  assert.equal(container.style.left, '10px');
  assert.equal(container.style.width, '100px');
  assert.equal(container.style.height, '40px');

  const wave = container.children[0].children[0];
  assert.equal(wave.className, 'waves waves-dark');
  assert.equal(wave.style.top, '20px');
  assert.equal(wave.style.left, '20px');
  assert.deepEqual(after, ['ok']);

  await h.tick(20);
  assert.equal(h.body.children.length, 0);
});

test('funciona sin event.path ni composedPath (fallback parentNode)', async () => {
  const h = createHarness();
  h.waves.duration = 5;
  h.waves.add({ css: 'btn' });

  const target = button();
  const parent = createElement('div');
  parent.appendChild(target);

  h.dispatch({ target, clientX: 15, clientY: 25 });

  assert.equal(h.body.children.length, 1);
  assert.equal(h.body.children[0].children[0].children[0].className, 'waves');
  await h.tick(20);
});

test('usa pageX/pageY si no hay clientX/clientY y compensa el scroll', () => {
  const h = createHarness();
  h.waves.add({ css: 'btn' });
  h.waves.duration = 1;

  const target = button();
  target.left = 10;
  target.top = 20;
  h.dispatch({ target, pageX: 50, pageY: 70 });

  const wave = h.body.children[0].children[0].children[0];
  // pageX=50 -> viewport 50; left=10 -> 40; pageY=70 -> top 50; top=20 -> 30
  assert.equal(wave.style.left, '40px');
  assert.equal(wave.style.top, '50px');
});

test('clear() deja de disparar ripples y destroy() retira el listener', () => {
  const h = createHarness();
  h.waves.add({ css: 'btn' });
  h.waves.clear();
  assert.equal(h.waves.selectors.length, 0);

  const target = button();
  h.dispatch({ target, clientX: 1, clientY: 1, composedPath: () => [target] });
  assert.equal(h.body.children.length, 0);

  h.waves.destroy();
  assert.equal(h.listeners.mouseup, undefined);
});

test('add ignora entradas sin css y mouse_event devuelve false', () => {
  const h = createHarness();
  assert.equal(h.waves.add(null), null);
  assert.equal(h.waves.add({}), null);
  assert.equal(h.waves.selectors.length, 0);

  h.waves.add({ css: 'btn' });
  const target = button();
  assert.equal(h.waves.mouse_event({ target, clientX: 1, clientY: 1 }, 0), false);
});
