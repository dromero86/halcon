/**
 * Tests de `sdk/sys/core/session.js`.
 *
 * Usa un `app.define` falso, un `__` minimo (GET/storage/current/emit), Webix
 * opcional y timers falsos. Verifica el contrato historico y los bugs de la
 * version 1: config congelada, intervalos duplicados, storage asumido y
 * logout sin limpieza.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../sdk/sys/core/session.js', import.meta.url), 'utf8');

function memoryStore() {
  const map = new Map();
  return {
    map,
    get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    set(key, value) {
      map.set(key, value);
    },
    remove(key) {
      map.delete(key);
    },
  };
}

function createHarness(options = {}) {
  const defined = {};
  const required = [];
  const calls = [];
  const messages = [];
  const events = [];
  const cleared = [];
  const timers = new Map();
  let nextTimer = 1;
  let reloads = 0;

  const helperStore = memoryStore();
  const webixStore = memoryStore();

  const app = {
    define(name, factory) {
      defined[name] = factory;
    },
    require(name, callback) {
      required.push(name);
      if (typeof callback === 'function') callback();
    },
  };

  const helper = {
    current: {},
    storage: { session: helperStore },
    GET(params, callback, onError) {
      calls.push({ action: params && params.action, params, callback, onError });
    },
    emit(name, detail) {
      events.push({ name, detail });
    },
  };

  const webix =
    options.webix === false
      ? undefined
      : {
          message(config) {
            messages.push(config);
          },
          storage: { session: webixStore },
        };

  const usr = options.usr || {
    session: {
      check: 'auth-online',
      key: 'sess',
    },
  };

  const sandbox = {
    app,
    __: helper,
    usr,
    webix,
    location: {
      reload() {
        reloads++;
      },
    },
    setInterval(fn, ms) {
      const id = nextTimer++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearInterval(id) {
      cleared.push(id);
      timers.delete(id);
    },
    console,
    isFinite,
    setTimeout,
    clearTimeout,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.runInNewContext(SOURCE, sandbox, { filename: 'session.js' });
  const session = defined['sys.core.session']();

  return {
    session,
    defined,
    app,
    helper,
    usr,
    required,
    calls,
    messages,
    events,
    cleared,
    timers,
    webixStore,
    helperStore,
    reloads: () => reloads,
    timerFns() {
      return [...timers.values()].map((timer) => timer.fn);
    },
  };
}

test('se registra como sys.core.session y lee usr.session', () => {
  const h = createHarness();
  assert.ok(h.defined['sys.core.session']);
  assert.equal(h.session.version, '2.0.0');
  assert.equal(h.session.config.url_check, 'auth-online');
  assert.equal(h.session.config.sess_key, 'sess');
});

test('login exitoso guarda, navega y arranca un solo intervalo', () => {
  const h = createHarness();
  h.session.on.login({ status: true, dashboard: 'app.dash', token: 'abc' });

  assert.equal(h.session.isOnline, true);
  assert.equal(h.session.module, 'app.dash');
  assert.deepEqual(h.required, ['app.dash']);
  assert.equal(h.helperStore.get('sess').token, 'abc');
  assert.equal(h.timers.size, 1);
  assert.ok(h.events.some((event) => event.name === 'session:state' && event.detail.online === true));
});

test('login fallido no arranca intervalo y navega al modulo denegado', () => {
  const h = createHarness();
  h.session.on.login({ status: false, message: 'credenciales' });

  assert.equal(h.session.isOnline, false);
  assert.equal(h.session.module, 'sys.widget.login');
  assert.deepEqual(h.required, ['sys.widget.login']);
  assert.equal(h.timers.size, 0);
  assert.equal(h.messages[0].type, 'error');
  assert.equal(h.messages[0].text, 'credenciales');
});

test('login repetido reemplaza el intervalo anterior', () => {
  const h = createHarness();
  h.session.on.login({ status: true, dashboard: 'a' });
  const primero = [...h.timers.keys()][0];
  h.session.on.login({ status: true, dashboard: 'b' });

  assert.equal(h.timers.size, 1);
  assert.ok(h.cleared.includes(primero));
});

test('logout limpia token e intervalo y navega', () => {
  const h = createHarness();
  h.session.on.login({ status: true, dashboard: 'a' });
  h.helperStore.set('sess', { token: 'x' });
  h.session.on.logout();

  assert.equal(h.session.isOnline, false);
  assert.equal(h.timers.size, 0);
  assert.equal(h.helperStore.get('sess'), null);
  assert.equal(h.required.at(-1), 'sys.widget.login');
  assert.ok(h.messages.some((message) => message.type === 'error'));
});

test('afterCheck exitoso guarda, actualiza modulo y arranca intervalo', () => {
  const h = createHarness();
  h.session.on.afterCheck({ status: true, dashboard: 'app.clientes', user: 'ana' });

  assert.equal(h.session.isOnline, true);
  assert.equal(h.session.module, 'app.clientes');
  assert.equal(h.helperStore.get('sess').user, 'ana');
  assert.equal(h.timers.size, 1);
  assert.deepEqual(h.required, ['app.clientes']);
});

test('afterCheck offline corta el intervalo y muestra error', () => {
  const h = createHarness();
  h.session.on.login({ status: true, dashboard: 'a' });
  h.session.on.afterCheck({ status: false });

  assert.equal(h.session.isOnline, false);
  assert.equal(h.timers.size, 0);
  assert.equal(h.session.module, 'sys.widget.login');
  assert.ok(h.messages.some((message) => message.text === 'Desconectado del servidor'));
});

test('check usa la accion configurada y refresca la config', () => {
  const h = createHarness();
  h.session.on.check();
  assert.equal(h.calls[0].action, 'auth-online');

  h.usr.session.check = 'auth-otra';
  h.usr.session.key = 'otra-clave';
  h.session.on.check();
  assert.equal(h.calls[1].action, 'auth-otra');
  h.session.on.login({ status: true, dashboard: 'a' });
  assert.ok(h.helperStore.get('otra-clave'));
});

test('el intervalo consulta y expira con reload', () => {
  const h = createHarness();
  h.session.on.login({ status: true, dashboard: 'a' });

  const tick = h.timerFns()[0];
  tick();
  assert.equal(h.calls.at(-1).action, 'auth-online');

  h.calls.at(-1).callback({ status: false });
  assert.equal(h.reloads(), 1);
  assert.equal(h.timers.size, 0);
  assert.ok(h.messages.some((message) => message.text === 'Desconectado del servidor'));
});

test('afterCheckInterval ignora respuestas con error', () => {
  const h = createHarness();
  h.session.on.afterCheckInterval({ error: 'red' });
  assert.equal(h.reloads(), 0);
});

test('reloadOnExpire=false navega en vez de recargar', () => {
  const h = createHarness({ usr: { session: { check: 'check', key: 'k', reloadOnExpire: false } } });
  h.session.on.login({ status: true, dashboard: 'a' });
  h.timerFns()[0]();
  h.calls.at(-1).callback({ status: false });

  assert.equal(h.reloads(), 0);
  assert.equal(h.required.at(-1), 'sys.widget.login');
});

test('sin usr.session usa defaults y no rompe', () => {
  const h = createHarness({ usr: {} });
  assert.equal(h.session.config.url_check, 'auth-online');
  assert.equal(h.session.config.sess_key, 'halcon.app.session');

  h.session.on.check();
  assert.equal(h.calls[0].action, 'auth-online');

  h.session.on.login({ status: true, dashboard: 'app.x' });
  assert.ok(h.helperStore.get('halcon.app.session'));
});

test('sin Webix usa eventos en lugar de mensajes', () => {
  const h = createHarness({ webix: false });
  h.session.on.login({ status: false, message: 'no' });

  assert.equal(h.messages.length, 0);
  assert.ok(h.events.some((event) => event.name === 'session:message' && event.detail.text === 'no'));
});
