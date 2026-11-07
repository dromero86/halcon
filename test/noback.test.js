/**
 * Tests de `sdk/sys/core/noback.js`.
 *
 * Verifica que no pise handlers, que normalice el hash con History API, que
 * bloquee Backspace solo fuera de campos editables y que `uninstall()` retire
 * todo.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../sdk/sys/core/noback.js', import.meta.url), 'utf8');

function createHarness(options = {}) {
  const docListeners = {};
  const winListeners = {};
  const calls = [];
  let routeHandler = null;
  let unsubscribed = 0;

  const location = {
    href: options.href || 'http://localhost/#!app.inicio',
    hash: options.href ? options.href.slice(options.href.indexOf('#!')) : '#!app.inicio',
  };

  function setUrl(url) {
    location.href = 'http://localhost/' + url;
    location.hash = url;
  }

  const history = {
    replaceState(state, title, url) {
      calls.push({ type: 'replace', url });
      setUrl(url);
    },
    pushState(state, title, url) {
      calls.push({ type: 'push', url });
      setUrl(url);
    },
  };

  const document = {
    readyState: options.readyState || 'complete',
    addEventListener(type, fn) {
      docListeners[type] = fn;
    },
    removeEventListener(type, fn) {
      if (docListeners[type] === fn) delete docListeners[type];
    },
  };

  const sandbox = {
    document,
    location,
    history,
    console,
    addEventListener(type, fn) {
      winListeners[type] = fn;
    },
    removeEventListener(type, fn) {
      if (winListeners[type] === fn) delete winListeners[type];
    },
    __: {
      on(name, fn) {
        if (name === 'route') routeHandler = fn;
        return () => {
          unsubscribed++;
          routeHandler = null;
        };
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.runInNewContext(SOURCE, sandbox, { filename: 'noback.js' });

  return {
    noBack: sandbox.HalconNoBack,
    sandbox,
    location,
    history,
    calls,
    docListeners,
    winListeners,
    fireDoc(type, event) {
      if (docListeners[type]) docListeners[type](event);
    },
    fireWin(type, event) {
      if (winListeners[type]) winListeners[type](event);
    },
    route(detail) {
      if (routeHandler) routeHandler(detail);
    },
    unsubscribed: () => unsubscribed,
    lastCall() {
      return calls[calls.length - 1] || null;
    },
  };
}

test('auto-instala: normaliza a #!ruta y agrega un centinela', () => {
  const h = createHarness();
  assert.equal(h.noBack.isInstalled(), true);
  assert.equal(h.noBack.getRoute(), 'app.inicio');
  assert.equal(h.noBack.route(), 'app.inicio');
  assert.deepEqual(h.calls, [
    { type: 'replace', url: '#!app.inicio' },
    { type: 'push', url: '#!app.inicio' },
  ]);
  assert.equal(typeof h.docListeners.keydown, 'function');
  assert.equal(typeof h.winListeners.popstate, 'function');
  assert.equal(typeof h.winListeners.hashchange, 'function');
});

test('Backspace solo se bloquea fuera de campos editables y no corta el evento', () => {
  const h = createHarness();
  let prevented = 0;
  let stopped = 0;
  const event = {
    key: 'Backspace',
    target: { nodeName: 'DIV' },
    preventDefault() {
      prevented++;
    },
    stopPropagation() {
      stopped++;
    },
  };
  h.fireDoc('keydown', event);
  assert.equal(prevented, 1);
  assert.equal(stopped, 0);

  const input = { key: 'Backspace', target: { nodeName: 'INPUT' }, preventDefault: () => prevented++ };
  h.fireDoc('keydown', input);
  assert.equal(prevented, 1);

  const contentEditable = { keyCode: 8, target: { nodeName: 'DIV', isContentEditable: true }, preventDefault: () => prevented++ };
  h.fireDoc('keydown', contentEditable);
  assert.equal(prevented, 1);

  const tecla = { key: 'a', target: { nodeName: 'DIV' }, preventDefault: () => prevented++ };
  h.fireDoc('keydown', tecla);
  assert.equal(prevented, 1);
});

test('popstate y hashchange restauran la ruta actual', () => {
  const h = createHarness();
  const antes = h.calls.length;

  h.location.href = 'http://localhost/#!otra';
  h.location.hash = '#!otra';
  h.fireWin('popstate');
  assert.deepEqual(h.lastCall(), { type: 'push', url: '#!app.inicio' });

  h.location.href = 'http://localhost/#!otra';
  h.location.hash = '#!otra';
  h.fireWin('hashchange');
  assert.deepEqual(h.lastCall(), { type: 'replace', url: '#!app.inicio' });
  assert.ok(h.calls.length > antes);
});

test('la navegacion interna actualiza la ruta que se restaura', () => {
  const h = createHarness();
  h.route({ module: 'app.clientes', uri: '#!app.clientes' });
  assert.equal(h.noBack.route(), 'app.clientes');

  h.location.href = 'http://localhost/#!otra';
  h.location.hash = '#!otra';
  h.fireWin('popstate');
  assert.deepEqual(h.lastCall(), { type: 'push', url: '#!app.clientes' });
});

test('uninstall retira listeners y suscripcion; reinstall configura opciones', () => {
  const h = createHarness();
  const unsubsAntes = h.unsubscribed();

  h.noBack.uninstall();
  assert.equal(h.noBack.isInstalled(), false);
  assert.equal(h.docListeners.keydown, undefined);
  assert.equal(h.winListeners.popstate, undefined);
  assert.equal(h.unsubscribed(), unsubsAntes + 1);

  h.calls.length = 0;
  h.noBack.install({ blockBack: false, blockBackspace: false });
  assert.equal(h.noBack.isInstalled(), true);
  assert.deepEqual(h.calls, [{ type: 'replace', url: '#!app.inicio' }]);

  h.location.href = 'http://localhost/#!otra';
  h.location.hash = '#!otra';
  h.fireWin('popstate');
  assert.equal(h.calls.length, 1);

  let prevented = 0;
  h.fireDoc('keydown', { key: 'Backspace', target: { nodeName: 'DIV' }, preventDefault: () => prevented++ });
  assert.equal(prevented, 0);
});

test('si el documento esta cargando espera DOMContentLoaded', () => {
  const h = createHarness({ readyState: 'loading' });
  assert.equal(h.noBack.isInstalled(), false);
  assert.equal(typeof h.docListeners.DOMContentLoaded, 'function');

  h.fireDoc('DOMContentLoaded', {});
  assert.equal(h.noBack.isInstalled(), true);
  assert.deepEqual(h.calls, [
    { type: 'replace', url: '#!app.inicio' },
    { type: 'push', url: '#!app.inicio' },
  ]);
});

test('uninstall cancela la instalacion pendiente', () => {
  const h = createHarness({ readyState: 'loading' });
  assert.equal(typeof h.docListeners.DOMContentLoaded, 'function');

  h.noBack.uninstall();
  assert.equal(h.docListeners.DOMContentLoaded, undefined);
  assert.equal(h.noBack.isInstalled(), false);
});
