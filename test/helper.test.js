/**
 * Tests de `sdk/sys/core/helper.js`.
 *
 * El helper es un script clasico que publica `window.__`. La suite lo ejecuta
 * en `node:vm` con un Webix falso (ajax, storage, message, Date, $$) y un DOM
 * minimo (cookie, title, history) para verificar el contrato heredado sin
 * navegador ni dependencias.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HELPER = readFileSync(new URL('../sdk/sys/core/helper.js', import.meta.url), 'utf8');

function memoryStorage() {
  const map = new Map();
  return {
    map,
    put(key, value) {
      map.set(key, value);
    },
    get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    remove(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, value);
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function createHarness(options = {}) {
  const responses = options.responses || {};
  const messages = [];
  const required = [];
  const calls = [];
  const events = [];
  const cookies = [];
  const pushed = [];
  const warnings = [];
  const errors = [];
  const local = memoryStorage();
  const session = memoryStorage();
  const views = options.views || {};

  function lookup(url) {
    const keys = Object.keys(responses).sort((a, b) => b.length - a.length);
    const key = keys.find((candidate) => url.indexOf(candidate) === 0);
    return key ? responses[key] : '{}';
  }

  const ajax = {
    headers() {
      return ajax;
    },
    get(url, params, callback) {
      calls.push({ method: 'GET', url, params });
      let fail = null;
      setTimeout(() => {
        const body = lookup(url);
        if (body === 'fail') {
          if (fail) fail();
        } else {
          callback(body);
        }
      }, 0);
      return {
        fail(fn) {
          fail = fn;
        },
      };
    },
    post(url, data, handlers) {
      calls.push({ method: 'POST', url, data });
      setTimeout(() => {
        const body = lookup(url);
        if (body === 'fail') {
          if (handlers && handlers.error) handlers.error();
        } else if (handlers && handlers.success) {
          handlers.success(body);
        }
      }, 0);
      return { fail() {} };
    },
    put(url, data, handlers) {
      calls.push({ method: 'PUT', url, data });
      setTimeout(() => {
        const body = lookup(url);
        if (body === 'fail') {
          if (handlers && handlers.error) handlers.error();
        } else if (handlers && handlers.success) {
          handlers.success(body);
        }
      }, 0);
      return { fail() {} };
    },
  };

  const webix =
    options.webix === false
      ? undefined
      : {
          ajax() {
            return ajax;
          },
          message(config) {
            messages.push(config);
          },
          storage: { local, session },
          Date: {
            dateToStr() {
              return (date) =>
                `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            },
          },
        };

  const document = {
    title: 'inicial',
    get cookie() {
      return cookies.join('; ');
    },
    set cookie(value) {
      cookies.push(value);
    },
    createEvent() {
      return {
        type: '',
        initCustomEvent(name) {
          this.type = name;
        },
      };
    },
    dispatchEvent(event) {
      events.push(event.type);
      return true;
    },
  };

  const location = { protocol: 'http:', hash: '', href: 'http://localhost/' };
  const history = {
    pushState(state, title, url) {
      pushed.push(url);
    },
  };

  class FakeXHR {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.responseText = '';
      this.timeout = 0;
      this.withCredentials = false;
      this.headers = {};
    }
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(key, value) {
      this.headers[key] = value;
    }
    send() {
      calls.push({ method: this.method, url: this.url, headers: this.headers });
      setTimeout(() => {
        const body = lookup(this.url);
        this.readyState = 4;
        if (body === 'fail') {
          this.status = 500;
          this.responseText = '';
        } else {
          this.status = 200;
          this.responseText = body;
        }
        if (this.onreadystatechange) this.onreadystatechange();
      }, 0);
    }
  }

  const sandbox = {
    window: null,
    document,
    location,
    history,
    XMLHttpRequest: FakeXHR,
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    navigator: { maxTouchPoints: 0, userAgent: 'node-helper-test', onLine: true },
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    console: {
      log() {},
      info() {},
      warn(...args) {
        warnings.push(args.join(' '));
      },
      error(...args) {
        errors.push(args.join(' '));
      },
    },
    setTimeout,
    clearTimeout,
    JSON,
    Promise,
    $$(id) {
      return views[id] || null;
    },
    usr: { name: 'Demo', session: { key: 'sess' }, domain: 'https://api.example' },
    app: {
      require(name) {
        required.push(name);
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  if (webix) sandbox.webix = webix;
  if (options.loader !== false) {
    sandbox.__loader = {
      base_url() {
        return options.base !== undefined ? options.base : '/';
      },
      base: options.base !== undefined ? options.base : '/',
      domain: 'https://cdn.example',
      environment() {
        return { isTouch: true, isMobile: true, breakpoint: 'lg' };
      },
    };
  }

  const context = vm.createContext(sandbox);
  vm.runInContext(HELPER, context, { filename: 'helper.js' });

  const tick = (ms = 15) => new Promise((resolve) => setTimeout(resolve, ms));
  const load = (name) => {
    const file = new URL(`../sdk/sys/integrations/${name}.js`, import.meta.url);
    vm.runInContext(readFileSync(file, 'utf8'), context, { filename: `${name}.js` });
  };

  return {
    __: sandbox.__,
    sandbox,
    document,
    location,
    history,
    messages,
    required,
    calls,
    events,
    cookies,
    pushed,
    warnings,
    errors,
    local,
    session,
    views,
    load,
    tick,
  };
}

test('el helper no usa eval, document.write ni navigator.platform', () => {
  assert.doesNotMatch(HELPER, /\beval\s*\(/);
  assert.doesNotMatch(HELPER, /document\.write\s*\(/);
  assert.doesNotMatch(HELPER, /navigator\.platform/);
});

test('req codifica query, respeta el rid y maneja base con o sin query', () => {
  const h = createHarness();
  assert.equal(h.__.req({ action: 'a b', id: 1 }, { rid: false }), '/?action=a%20b&id=1');
  assert.match(h.__.req({ action: 'a' }), /^\/\?action=a&rid=\d+$/);

  const conQuery = createHarness({ base: '/api?x=1' });
  assert.equal(conQuery.__.req({ a: 1 }, { rid: false }), '/api?x=1&a=1');

  const sinBase = createHarness({ base: '' });
  assert.equal(sinBase.__.req({ a: 1 }, { rid: false }), '?a=1');

  assert.equal(h.__.cacheBust, undefined);
  h.__.cacheBust = false;
  assert.equal(h.__.req({ a: 1 }), '/?a=1');
});

test('GET parsea JSON y devuelve un objeto error si no es JSON', async () => {
  const h = createHarness({ responses: { '/?action=ping': '{"status":true}' } });
  let data = null;
  h.__.GET({ action: 'ping' }, (value) => {
    data = value;
  });
  await h.tick();
  assert.deepEqual(data, { status: true });

  const roto = createHarness({ responses: { '/?action=roto': '<html>' } });
  let response = null;
  roto.__.GET({ action: 'roto' }, (value) => {
    response = value;
  });
  await roto.tick();
  assert.equal(response.error, 'Content non json format');

  let fallo = null;
  roto.__.GET({ action: 'roto' }, () => {}, (err) => {
    fallo = err;
  });
  await roto.tick();
  assert.equal(fallo && fallo.message, 'respuesta no JSON');
});

test('POST envia form y parsea; PAYLOAD envia JSON y entrega texto crudo', async () => {
  const h = createHarness({
    responses: {
      '/?action=save': '{"ok":true}',
      '/?action=databot': '{"data":[{"id":1}]}',
    },
  });

  let saved = null;
  h.__.POST({ action: 'save' }, { nombre: 'Ana' }, (value) => {
    saved = value;
  });
  await h.tick();
  assert.deepEqual(saved, { ok: true });
  assert.equal(h.calls[0].method, 'POST');
  assert.deepEqual(h.calls[0].data, { nombre: 'Ana' });

  let raw = null;
  h.__.PAYLOAD({ action: 'databot' }, { select: 'x' }, (value) => {
    raw = value;
  });
  await h.tick();
  assert.equal(typeof raw, 'string');
  assert.equal(raw, '{"data":[{"id":1}]}');
  assert.equal(JSON.parse(h.calls[1].data).select, 'x');
});

test('sendPost: navega solo en exito y no inventa un mensaje de error', async () => {
  const ok = createHarness({ responses: { '/?action=update': '{"ok":true}' } });
  ok.__.sendPost({ action: 'update' }, { id: 1 }, 'app.dashboard');
  await ok.tick();
  assert.deepEqual(ok.required, ['app.dashboard']);
  assert.equal(ok.messages[0].type, 'success');

  const fail = createHarness({ responses: { '/?action=update': '{"error":"boom"}' } });
  fail.__.sendPost({ action: 'update' }, { id: 1 }, 'app.dashboard');
  await fail.tick();
  assert.deepEqual(fail.required, []);
  assert.equal(fail.messages[0].type, 'error');

  const http = createHarness({ responses: { '/?action=update': 'fail' } });
  http.__.sendPost({ action: 'update' }, { id: 1 }, 'app.dashboard');
  await http.tick();
  assert.deepEqual(http.required, []);
  assert.equal(http.messages[0].type, 'error');
});

test('getFormPost convierte fechas y tolera una vista ausente', () => {
  const fecha = new Date(2026, 10, 7);
  const h = createHarness({
    views: {
      form1: {
        getValues() {
          return { nombre: 'Ana', fecha };
        },
      },
    },
  });

  assert.deepEqual(h.__.getFormPost('form1'), { nombre: 'Ana', fecha: '2026-11-07' });
  assert.equal(Object.keys(h.__.getFormPost('no-existe')).length, 0);
  assert.match(h.warnings.at(-1), /no tiene getValues|no existe/);
});

test('storage: Webix, fallback a localStorage y memoria', () => {
  const h = createHarness();
  h.__.storage.set('k', { a: 1 });
  assert.deepEqual(h.__.storage.get('k'), { a: 1 });
  h.__.storage.remove('k');
  assert.equal(h.__.storage.get('k'), null);

  const sinWebix = createHarness({ webix: false });
  sinWebix.__.storage.set('k', { b: 2 });
  assert.deepEqual(sinWebix.__.storage.get('k'), { b: 2 });
  sinWebix.__.storage.remove('k');
  assert.equal(sinWebix.__.storage.get('k'), null);
});

test('get_user lee la sesion y no rompe si falta la clave', () => {
  const h = createHarness();
  h.session.put('sess', { user: 'ana' });
  assert.deepEqual(h.__.get_user(), { user: 'ana' });

  const sinSesion = createHarness();
  sinSesion.sandbox.usr.session = {};
  assert.equal(sinSesion.__.get_user(), false);
});

test('defKey / defAttr / isNumber / IsJsonString / addslashes', () => {
  const h = createHarness();
  h.__.current.clientes = { id: 5, nombre: 'Ana' };

  assert.equal(h.__.defAttr('clientes', 0, 'id'), 5);
  assert.equal(h.__.defAttr('clientes', 0, 'falta'), 0);
  assert.equal(h.__.defAttr('otro', 9, 'id'), 9);
  assert.equal(h.__.defKey('clientes', null), h.__.current.clientes);
  assert.equal(h.__.defKey('otro', 7), 7);

  assert.equal(h.__.isNumber(5), true);
  assert.equal(h.__.isNumber('5'), true);
  assert.equal(h.__.isNumber('5px'), false);
  assert.equal(h.__.IsJsonString('{"a":1}'), true);
  assert.equal(h.__.IsJsonString('{a:1}'), false);
  assert.equal(h.__.addslashes("a'b"), "a\\'b");
});

test('mobileAndTabletcheck usa el entorno, no un regex de user-agent', () => {
  const h = createHarness();
  assert.equal(h.__.mobileAndTabletcheck(), true);

  const sinLoader = createHarness({ loader: false });
  sinLoader.sandbox.navigator.maxTouchPoints = 5;
  assert.equal(sinLoader.__.mobileAndTabletcheck(), true);

  const escritorio = createHarness({ loader: false });
  escritorio.sandbox.navigator.maxTouchPoints = 0;
  escritorio.sandbox.innerWidth = 1280;
  assert.equal(escritorio.__.mobileAndTabletcheck(), false);
});

test('setTitle no deja "undefined" y changeUri emite route', () => {
  const h = createHarness();
  h.__.setTitle('Hola');
  assert.equal(h.document.title, 'Hola - Demo');

  let routed = null;
  h.__.on('route', (detail) => {
    routed = detail;
  });
  h.__.changeUri('app.clientes');
  assert.deepEqual(h.pushed, ['#!app.clientes']);
  assert.equal(routed.module, 'app.clientes');
  assert.equal(routed.uri, '#!app.clientes');
  assert.equal(h.__.getRoute(), '');
});

test('setView lanza Error (no string) ante doble invocacion', () => {
  const h = createHarness();
  h.__.setView('app.uno');
  assert.throws(() => h.__.setView('app.uno'), /2 veces/);
});

test('setCookie codifica el valor y agrega SameSite', () => {
  const h = createHarness();
  h.__.setCookie('token', 'a b', 1);
  assert.match(h.cookies[0], /^token=a%20b;/);
  assert.match(h.cookies[0], /path=\//);
  assert.match(h.cookies[0], /SameSite=Lax/);
  assert.doesNotMatch(h.cookies[0], /Secure/);

  h.location.protocol = 'https:';
  h.__.setCookie('token', 'x', 0);
  assert.match(h.cookies.at(-1), /Secure/);
});

test('el helper no incluye integraciones de terceros', () => {
  const h = createHarness();
  assert.equal(h.__.firebase, undefined);
  assert.equal(h.__.SQLCombo, undefined);
  assert.equal(h.__.SQLTable, undefined);
  assert.equal(h.__.query, undefined);
  assert.equal(Object.keys(h.__.integrations).length, 0);
  assert.equal(typeof h.__.registerIntegration, 'function');
  assert.equal(typeof h.__.getIntegration, 'function');
});

test('registerIntegration valida y publica la integracion', () => {
  const h = createHarness();
  assert.throws(() => h.__.registerIntegration('', {}), /string no vacio/);
  assert.throws(() => h.__.registerIntegration('demo', null), /implementacion/);

  const impl = { ping() { return 'pong'; } };
  h.__.registerIntegration('demo', impl);
  assert.equal(h.__.integrations.demo, impl);
  assert.equal(h.__.getIntegration('demo'), impl);
  assert.equal(h.__.demo, impl);
  assert.equal(h.__.getIntegration('no-existe'), null);
});

test('firebase.js se carga aparte y conserva el contrato', () => {
  const h = createHarness();
  h.load('firebase');

  assert.equal(typeof h.__.firebase.add, 'function');
  assert.equal(typeof h.__.firebase.on_write, 'function');
  assert.equal(h.__.integrations.firebase, h.__.firebase);

  // Sin configuracion no rompe.
  assert.doesNotThrow(() => h.__.firebase.add('k', { a: 1 }));
  assert.ok(h.warnings.some((line) => line.includes('FIREBASE')));

  const pushed = [];
  let handler = null;
  let removed = 0;
  h.__.current.FIREBASE = {
    ref() {
      return {
        push(item) {
          pushed.push(item);
        },
        on(event, callback) {
          handler = callback;
        },
        remove() {
          removed++;
        },
      };
    },
  };

  h.__.firebase.add('k', { a: 1 });
  assert.equal(pushed.length, 1);

  let recibido = null;
  h.__.firebase.on_write('k', (value) => {
    recibido = value;
  });
  handler({ val: () => ({ z: 1 }) });
  assert.equal(recibido.z, 1);
  assert.equal(removed, 1);
});

test('databot.js se carga aparte y mantiene los alias historicos', async () => {
  const view = {
    options: null,
    define(key, value) {
      this.options = value;
    },
    refresh() {},
  };
  const h = createHarness({
    views: { combo1: view },
    responses: { '/?action=databot': '{"data":[{"id":1}]}' },
  });

  assert.equal(h.__.SQLCombo, undefined);
  h.load('databot');

  assert.equal(typeof h.__.SQLCombo, 'function');
  assert.equal(typeof h.__.SQLTable, 'function');
  assert.equal(typeof h.__.query, 'function');
  assert.equal(typeof h.__.query_combo, 'function');
  assert.equal(typeof h.__.query_list, 'function');
  assert.equal(h.__.integrations.databot, h.__.databot);

  h.__.SQLCombo('combo1', { select: 'x' });
  await h.tick();
  assert.equal(view.options.length, 1);
  assert.equal(view.options[0].id, 1);

  h.__.SQLCombo('no-existe', { select: 'x' });
  await h.tick();
  assert.ok(h.warnings.some((line) => line.includes('no se pudo actualizar')));
});

test('source-legacy incluye databot y source.json no carga integraciones', () => {
  const legacy = JSON.parse(
    readFileSync(new URL('../sdk/config/source-legacy.json', import.meta.url), 'utf8'),
  );
  assert.ok(legacy.some((item) => item.url === 'sys/integrations/databot.js'));

  const nuevo = readFileSync(new URL('../sdk/config/source.json', import.meta.url), 'utf8');
  assert.doesNotMatch(nuevo, /integrations\//);
});

test('sin Webix, GET usa XHR nativo y parsea igual', async () => {
  const h = createHarness({
    webix: false,
    responses: { '/?action=ping': '{"ok":1}' },
  });
  let data = null;
  h.__.GET({ action: 'ping' }, (value) => {
    data = value;
  });
  await h.tick();
  assert.deepEqual(data, { ok: 1 });
  assert.equal(h.calls[0].method, 'GET');
});
