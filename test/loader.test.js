/**
 * Tests del loader clasico (`sdk/sys/core/loader.js`).
 *
 * El loader corre en el navegador, asi que la suite lo ejecuta en un contexto
 * `node:vm` con un DOM falso minimo: elementos, head/body, XHR e Image. No hay
 * dependencias ni navegador real; se verifica el contrato (manifiestos v1 y v2,
 * cache, viewport, orden de carga y app.define / app.require).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const LOADER = readFileSync(new URL('../sdk/sys/core/loader.js', import.meta.url), 'utf8');
const MANIFEST_URL = 'http://localhost/sdk/config/loader.json?v=1';
const PROJECT = 'http://localhost/sdk/';

/** Espera a que se resuelva una promesa o falla por timeout. */
function withTimeout(promise, ms = 1000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout del test')), ms)),
  ]);
}

function textNode(text) {
  return { nodeType: 3, textContent: String(text) };
}

function createElement(tag, doc) {
  const attributes = {};
  const children = [];
  const el = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    attributes,
    children,
    parentNode: null,
    className: '',
    style: {},
    id: '',
    readyState: undefined,
    async: undefined,
    onload: null,
    onerror: null,
    onreadystatechange: null,
    onclick: null,
    get firstChild() {
      return children[0] || null;
    },
    appendChild(child) {
      if (child && child.parentNode) child.parentNode.removeChild(child);
      if (child) {
        child.parentNode = el;
        if (el.tagName === 'HEAD' || el.tagName === 'HTML') doc._attached(child);
      }
      children.push(child);
      doc._all.push(child);
      return child;
    },
    removeChild(child) {
      const at = children.indexOf(child);
      if (at > -1) children.splice(at, 1);
      if (child) child.parentNode = null;
      return child;
    },
    setAttribute(key, value) {
      attributes[key] = String(value);
      if (key === 'id') el.id = String(value);
    },
    getAttribute(key) {
      return Object.prototype.hasOwnProperty.call(attributes, key) ? attributes[key] : null;
    },
    removeAttribute(key) {
      delete attributes[key];
    },
    set innerHTML(value) {
      children.length = 0;
      el._html = String(value);
    },
    get innerHTML() {
      return el._html || '';
    },
    appendChildText(text) {
      const node = textNode(text);
      children.push(node);
      return node;
    },
  };
  if (el.tagName === 'SCRIPT') el.noModule = true;
  return el;
}

/**
 * Crea el sandbox con el loader cargado.
 * @param {{manifest?: object|Array, resources?: Record<string,string>, version?: string}} options
 */
function createHarness(options = {}) {
  const responses = { ...(options.responses || {}), ...(options.resources || {}) };
  if (options.manifest !== undefined) {
    responses[MANIFEST_URL] = JSON.stringify(options.manifest);
  }
  if (options.manifestUrl) {
    responses[options.manifestUrl] = JSON.stringify(options.manifest);
  }

  const listeners = new Map();
  const loads = [];
  const all = [];
  let doc;

  const shared = {
    _all: all,
    _attached(el) {
      if (doc && doc._attached) doc._attached(el);
    },
  };
  const html = createElement('html', shared);
  const head = createElement('head', shared);
  const body = createElement('body', shared);

  doc = {
    readyState: 'loading',
    currentScript: null,
    head,
    body,
    documentElement: html,
    _all: all,
    _attached(el) {
      const url = el.src || el.href || '';
      if (!url) return;
      loads.push({ tag: el.tagName.toLowerCase(), url, type: el.type || '' });
      if (el.tagName === 'SCRIPT' && /\/app\/demo\.js$/.test(url.split('?')[0])) {
        sandbox.app.define('app.demo', () => ({ demo: true }));
      }
      const key = url;
      const outcome = responses[key] === 'fail' ? 'fail' : 'ok';
      setTimeout(() => {
        if (outcome === 'fail') {
          if (el.onerror) el.onerror();
        } else if (el.onload) {
          el.onload();
        }
      }, 0);
    },
    createElement(tag) {
      return createElement(tag, doc);
    },
    createTextNode(text) {
      return textNode(text);
    },
    getElementsByTagName(tag) {
      if (tag === 'head') return [head];
      if (tag === 'body') return [body];
      if (tag === 'html') return [html];
      const upper = String(tag).toUpperCase();
      if (upper === '*') return [html, head, body, ...doc._all];
      const all = [html, head, body, ...doc._all];
      return all.filter((el) => el.tagName === upper);
    },
    getElementById(id) {
      return [html, head, body, ...doc._all].find((el) => el.id === id) || null;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || [];
      const at = list.indexOf(fn);
      if (at > -1) list.splice(at, 1);
    },
    dispatchEvent(event) {
      const list = listeners.get(event.type) || [];
      for (const fn of list.slice()) fn(event);
      return true;
    },
  };

  const script = createElement('script', doc);
  script.setAttribute('bootin', MANIFEST_URL);
  script.setAttribute('project-path', PROJECT);
  script.setAttribute('base-url', '/');
  if (options.version) script.setAttribute('data-version', options.version);
  if (options.autoload === false) script.setAttribute('data-autoload', 'false');
  doc.currentScript = script;

  const xhrLog = [];
  class FakeXHR {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.responseText = '';
      this.timeout = 0;
      this.onreadystatechange = null;
      this.onerror = null;
      this.ontimeout = null;
    }
    open(method, url) {
      this.url = url;
      xhrLog.push(url);
    }
    send() {
      setTimeout(() => {
        const body = responses[this.url];
        this.readyState = 4;
        if (body === undefined || body === 'fail') {
          this.status = 404;
          this.responseText = '';
        } else {
          this.status = 200;
          this.responseText = body;
        }
        if (this.onreadystatechange) this.onreadystatechange();
      }, 0);
    }
    abort() {}
  }

  function FakeImage() {
    this.onload = null;
    this.onerror = null;
    this._src = '';
    Object.defineProperty(this, 'src', {
      get: () => this._src,
      set: (value) => {
        this._src = value;
        setTimeout(() => {
          if (responses[value] === 'fail') {
            if (this.onerror) this.onerror();
          } else if (this.onload) {
            this.onload();
          }
        }, 0);
      },
    });
  }

  const warnings = [];
  const errors = [];
  const sandbox = {
    document: doc,
    console: {
      log() {},
      warn(...args) {
        warnings.push(args.join(' '));
      },
      error(...args) {
        errors.push(args.map(String).join(' '));
      },
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    XMLHttpRequest: FakeXHR,
    Image: FakeImage,
    matchMedia(query) {
      return {
        query,
        matches: false,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      };
    },
    navigator: {
      onLine: true,
      maxTouchPoints: 0,
      userAgent: 'node-halcon-test',
      language: 'es-AR',
    },
    location: { href: 'http://localhost/' },
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    HTMLScriptElement: function HTMLScriptElement() {},
    Promise,
    JSON,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.runInNewContext(LOADER, sandbox, { filename: 'loader.js' });

  return {
    sandbox,
    doc,
    loads,
    warnings,
    errors,
    responses,
    xhrLog,
    ready() {
      doc.readyState = 'complete';
      doc.dispatchEvent({ type: 'DOMContentLoaded' });
    },
    /** Espera el evento `ready` del loader. */
    readyEvent() {
      return withTimeout(
        new Promise((resolve) => {
          sandbox.__loader.on('ready', resolve);
        }),
      );
    },
  };
}

/** Arranca el loader y devuelve el evento `ready`. */
function boot(harness) {
  const event = harness.readyEvent();
  harness.ready();
  return event;
}

test('el loader no usa eval, document.write ni navigator.platform', () => {
  assert.doesNotMatch(LOADER, /\beval\s*\(/);
  assert.doesNotMatch(LOADER, /document\.write\s*\(/);
  assert.doesNotMatch(LOADER, /navigator\.platform/);
  assert.doesNotMatch(LOADER, /new\s+Function\s*\(/);
});

test('manifiesto v2: carga en orden, aplica cache y viewport', async () => {
  const harness = createHarness({
    version: '2026.11.06',
    manifest: {
      version: '2',
      cache: { policy: 'versioned', version: 'auto' },
      viewport: { width: 'device-width', initialScale: 1 },
      resources: [
        { id: 'a', type: 'css', url: 'a.css' },
        { id: 'b', type: 'css', url: 'b.css', deps: ['a'] },
        { id: 'c', type: 'script', url: 'c.js', deps: ['b'] },
      ],
    },
  });

  const result = await boot(harness);
  assert.equal(result.ok, true);
  assert.equal(typeof harness.sandbox.__loader.version, 'string');

  const urls = harness.loads.map((item) => item.url);
  assert.deepEqual(urls, [
    `${PROJECT}a.css?v=2026.11.06`,
    `${PROJECT}b.css?v=2026.11.06`,
    `${PROJECT}c.js?v=2026.11.06`,
  ]);

  const meta = harness.doc.getElementsByTagName('meta').find((el) => el.getAttribute('name') === 'viewport');
  assert.ok(meta);
  assert.equal(meta.getAttribute('content'), 'width=device-width, initial-scale=1');
  assert.doesNotMatch(meta.getAttribute('content'), /user-scalable=no/);
  assert.equal(harness.doc.getElementsByTagName('html')[0].className.includes('halcon-booting'), false);
});

test('manifiesto v1: se acepta y cache:false agrega un sello por arranque', async () => {
  const harness = createHarness({
    manifest: [
      { tag: 'json', cache: true, url: 'config/app.json' },
      { tag: 'link', cache: true, url: 'theme.css' },
      { tag: 'script', cache: false, url: 'main.js' },
    ],
    resources: {
      [`${PROJECT}config/app.json`]: '{"name":"HALCON"}',
    },
  });

  const result = await boot(harness);
  assert.equal(result.ok, true, JSON.stringify(harness.errors) + ' XHR=' + JSON.stringify(harness.xhrLog));
  assert.equal(harness.sandbox.usr.name, 'HALCON');

  const script = harness.loads.find((item) => item.url.includes('main.js'));
  assert.ok(script);
  assert.match(script.url, /[?&]_h=\d+/);
});

test('parallel con deps: respeta dependencias y no duplica recursos', async () => {
  const harness = createHarness({
    manifest: {
      version: '2',
      parallel: true,
      concurrency: 4,
      resources: [
        { id: 'a', type: 'css', url: 'a.css' },
        { id: 'b', type: 'css', url: 'b.css' },
        { id: 'c', type: 'script', url: 'c.js', deps: ['a', 'b'] },
      ],
    },
  });

  const result = await boot(harness);
  assert.equal(result.ok, true);
  const urls = harness.loads.map((item) => item.url);
  assert.deepEqual(urls, [`${PROJECT}a.css`, `${PROJECT}b.css`, `${PROJECT}c.js`]);
});

test('app.define / app.require: sincrono, memoizado por llamada y con callback async', async () => {
  const harness = createHarness({
    manifest: { version: '2', resources: [] },
  });
  await boot(harness);

  const app = harness.sandbox.app;
  app.define('demo.uno', () => ({ n: 1 }));

  assert.equal(app.isDefined('demo.uno'), true);
  assert.deepEqual(app.require('demo.uno'), { n: 1 });
  assert.deepEqual(harness.sandbox.__loader.modulos['demo.uno'](), { n: 1 });

  const value = await new Promise((resolve) => app.require('demo.uno', resolve));
  assert.deepEqual(value, { n: 1 });

  const imported = await app.import('demo.uno');
  assert.deepEqual(imported, { n: 1 });

  assert.throws(() => app.define('', () => ({})), /string no vacio/);
  assert.throws(() => app.define('x', null), /funcion de definicion/);
});

test('app.require dinámico: un solo script en vuelo y reintento sin red', async () => {
  const harness = createHarness({
    manifest: { version: '2', resources: [] },
  });
  await boot(harness);

  const app = harness.sandbox.app;
  const cargas = [];
  const uno = new Promise((resolve) => app.require('app.demo', (value) => {
    cargas.push(value);
    resolve(value);
  }));
  const dos = new Promise((resolve) => app.require('app.demo', (value) => {
    cargas.push(value);
    resolve(value);
  }));

  await withTimeout(Promise.all([uno, dos]));
  assert.equal(cargas.length, 2);
  assert.deepEqual(cargas[0], { demo: true });
  assert.equal(
    harness.loads.filter((item) => item.url.split('?')[0].endsWith('/app/demo.js')).length,
    1,
  );

  // Ya definido: no se vuelve a pedir por red.
  const tres = await new Promise((resolve) => app.require('app.demo', resolve));
  assert.deepEqual(tres, { demo: true });
  assert.equal(
    harness.loads.filter((item) => item.url.split('?')[0].endsWith('/app/demo.js')).length,
    1,
  );
});

test('carga dinamica en runtime: loadStyle / loadScript / unload', async () => {
  const harness = createHarness({
    manifest: { version: '2', resources: [] },
  });
  await boot(harness);

  const loader = harness.sandbox.__loader;
  const link = await loader.loadStyle('extra.css');
  assert.ok(link);
  assert.equal(link.getAttribute('data-halcon-id'), 'extra');

  const before = harness.loads.length;
  await loader.loadStyle('extra.css');
  assert.equal(harness.loads.length, before, 'deduplica por URL');

  assert.equal(loader.unload('extra'), true);
  assert.equal(link.parentNode, null);
});

test('environment: no depende de navigator.platform y expone breakpoint', async () => {
  const harness = createHarness({
    manifest: { version: '2', resources: [] },
  });
  await boot(harness);

  const env = harness.sandbox.__loader.environment();
  assert.equal(env.width, 1280);
  assert.equal(env.isMobile, false);
  assert.equal(env.isTouch, false);
  assert.equal(env.breakpoint, 'lg');
  assert.equal(env.colorScheme, 'light');
});

test('manifiesto inaccesible: finaliza con error y muestra aviso sin document.write', async () => {
  const harness = createHarness({
    resources: { [MANIFEST_URL]: 'fail' },
  });

  const result = await boot(harness);
  assert.equal(result.ok, false);
  assert.match(result.error, /manifiesto/);
  assert.ok(harness.doc.getElementById('halcon-loader-notice'));
});

test('strict corta al primer fallo; optional lo deja pasar', async () => {
  const estricto = createHarness({
    manifest: {
      version: '2',
      strict: true,
      resources: [
        { id: 'roto', type: 'css', url: 'roto.css' },
        { id: 'siguiente', type: 'css', url: 'siguiente.css' },
      ],
    },
    resources: { [`${PROJECT}roto.css`]: 'fail' },
  });
  const r1 = await boot(estricto);
  assert.equal(r1.ok, false);
  assert.equal(estricto.loads.some((item) => item.url.includes('siguiente.css')), false);

  const opcional = createHarness({
    manifest: {
      version: '2',
      resources: [
        { id: 'roto', type: 'css', url: 'roto.css', optional: true },
        { id: 'siguiente', type: 'css', url: 'siguiente.css' },
      ],
    },
    resources: { [`${PROJECT}roto.css`]: 'fail' },
  });
  const r2 = await boot(opcional);
  assert.equal(r2.ok, true);
  assert.ok(opcional.loads.some((item) => item.url.includes('siguiente.css')));
});

test('data-autoload="false" deja el loader como API sin arrancar', async () => {
  const harness = createHarness({
    manifest: { version: '2', resources: [] },
    autoload: false,
  });
  harness.ready();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(harness.sandbox.__loader.state.booted, false);
  assert.equal(harness.loads.length, 0);
});

test('app.run: corre despues del arranque y tambien si se registra tarde', async () => {
  const harness = createHarness({
    manifest: { version: '2', resources: [] },
  });
  await boot(harness);

  let temprano = 0;
  harness.sandbox.app.run(() => {
    temprano++;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(temprano, 1);

  let tarde = 0;
  harness.sandbox.app.run(() => {
    tarde++;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(tarde, 1);
});
