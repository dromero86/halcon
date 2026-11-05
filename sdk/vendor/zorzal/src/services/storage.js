/**
 * storage: almacenamiento de clave/valor con tres backends.
 *
 * - `storage.local` y `storage.session` delegan en el servicio `store`, que
 *   ya resuelve la serializacion JSON y el fallback en memoria cuando el
 *   storage del navegador no esta disponible.
 * - `storage.cookie` guarda en `document.cookie` codificando el valor con
 *   `encodeURIComponent`, y acepta `path`, `days` y `sameSite`. Sin documento
 *   usa un jar en memoria con la misma interfaz.
 *
 * Todos los backends exponen `get(clave, defecto)`, `set(clave, valor)`,
 * `remove(clave)` y `clear()`.
 */

import { store } from './store.js';
import { getDocument } from '../core/dom.js';

const DEFAULT_COOKIE_OPTIONS = { path: '/', days: null, sameSite: null };

/** Jar usado cuando no hay `document.cookie` disponible. */
const memoryJar = new Map();

/** @returns {any|null} documento con `cookie` o null */
function cookieDocument() {
  try {
    const doc = getDocument();
    if (doc && typeof doc.cookie === 'string') return doc;
  } catch {
    // sin DOM inyectado: se intenta el global
  }
  const doc = globalThis.document;
  if (doc && typeof doc.cookie === 'string') return doc;
  return null;
}

/**
 * @param {string} name
 * @returns {string|null} valor crudo de la cookie
 */
function readRaw(name) {
  const doc = cookieDocument();
  if (!doc) return memoryJar.has(name) ? memoryJar.get(name) : null;
  for (const part of doc.cookie.split(';')) {
    const entry = part.trim();
    const index = entry.indexOf('=');
    if (index < 0) continue;
    if (entry.slice(0, index) === name) return entry.slice(index + 1);
  }
  return null;
}

/**
 * @param {string} name
 * @param {string} raw
 * @param {{ path?: string, days?: number|null, sameSite?: string|null }} options
 */
function writeRaw(name, raw, options) {
  const doc = cookieDocument();
  if (!doc) {
    memoryJar.set(name, raw);
    return;
  }
  const parts = [`${name}=${raw}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (typeof options.days === 'number' && Number.isFinite(options.days)) {
    const expires = new Date(Date.now() + options.days * 86400000).toUTCString();
    parts.push(`Expires=${expires}`);
  }
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  doc.cookie = parts.join('; ');
}

/**
 * @param {string} name
 * @param {{ path?: string, days?: number|null, sameSite?: string|null }} options
 */
function eraseRaw(name, options) {
  const doc = cookieDocument();
  if (!doc) {
    memoryJar.delete(name);
    return;
  }
  const parts = [`${name}=`, 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  doc.cookie = parts.join('; ');
}

/** @param {unknown} value */
function encodeValue(value) {
  return encodeURIComponent(JSON.stringify(value === undefined ? null : value));
}

/**
 * @param {string} raw
 * @param {unknown} fallback
 */
function decodeValue(raw, fallback) {
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    try {
      return decodeURIComponent(raw);
    } catch {
      return fallback;
    }
  }
}

/**
 * Backend de cookie con opciones por defecto.
 *
 * @param {{ path?: string, days?: number|null, sameSite?: string|null }} [defaults]
 */
export function createCookieStore(defaults = {}) {
  const options = { ...DEFAULT_COOKIE_OPTIONS, ...defaults };
  const resolve = (extra = {}) => ({ ...options, ...extra });

  const cookie = {
    get options() {
      return { ...options };
    },
    configure(extra = {}) {
      Object.assign(options, extra);
      return cookie;
    },
    /**
     * @param {string} key
     * @param {unknown} [fallback]
     */
    get(key, fallback = null) {
      const raw = readRaw(String(key));
      if (raw === null || raw === undefined) return fallback;
      return decodeValue(raw, fallback);
    },
    /**
     * @param {string} key
     * @param {unknown} value
     * @param {{ path?: string, days?: number|null, sameSite?: string|null }} [extra]
     */
    set(key, value, extra = {}) {
      writeRaw(String(key), encodeValue(value), resolve(extra));
      return value;
    },
    /**
     * @param {string} key
     * @param {{ path?: string, days?: number|null, sameSite?: string|null }} [extra]
     */
    remove(key, extra = {}) {
      eraseRaw(String(key), resolve(extra));
      return true;
    },
    clear() {
      const doc = cookieDocument();
      if (!doc) {
        memoryJar.clear();
        return;
      }
      const names = doc.cookie
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const index = part.indexOf('=');
          return index < 0 ? part : part.slice(0, index);
        });
      for (const name of new Set(names)) eraseRaw(name, options);
      for (const name of [...memoryJar.keys()]) memoryJar.delete(name);
    },
  };

  return cookie;
}

/** @param {{ get: Function, set: Function, remove: Function, clear: Function, has?: Function, keys?: Function }} backend */
function fromStore(backend) {
  return {
    get: (key, fallback) => backend.get(key, fallback),
    set: (key, value) => {
      backend.set(key, value);
      return value;
    },
    remove: (key) => backend.remove(key),
    clear: () => {
      backend.clear();
    },
    keys: () => backend.keys(),
    has: (key) => backend.has(key),
    get kind() {
      return backend.kind;
    },
    get prefix() {
      return backend.prefix;
    },
  };
}

const cookieStore = createCookieStore();

export const storage = {
  local: fromStore(store.local),
  session: fromStore(store.session),
  cookie: cookieStore,
  createCookie: createCookieStore,
};

export { cookieStore };
export default storage;
