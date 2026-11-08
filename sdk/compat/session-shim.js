/**
 * Shim de sesion para el piloto de Halcon.
 *
 * En la version con backend, `usr` y `__` los arma el servidor y los usa un
 * modulo de sesion que valida contra el servidor. Nada de eso existe en el
 * piloto: no hay backend ni validacion remota.
 *
 * Este modulo completa los stubs de `compat/globals.js` en el mismo objeto
 * (misma identidad), para que el dashboard y los plugins que ya importan
 * `usr`/`__` vean los valores de sesion:
 *
 *  - `usr.name`: nombre visible del usuario.
 *  - `usr.menu`: menu del sidebar. Un usuario demo si no hay datos guardados.
 *  - `usr.session`: `{ enable, login, check, logout, key }`, con la forma de
 *    `sdk/config/app.json`.
 *  - `__.current`: cache de seleccion por store (viene de `globals.js`).
 *  - `__.isNumber(n)`: verdadero solo para numeros finitos.
 *  - `__.session`: stub del modulo de sesion; no valida nada contra el
 *    servidor.
 *
 * La sesion se lee de `localStorage` en la clave `usr.session.key`
 * (`halcon.app.session`), con la forma `{ name, menu, session }`. Si no hay
 * datos, o el JSON es invalido, se usa el usuario demo. No se escribe en
 * `localStorage`: en la aplicacion real la sesion la crea el backend.
 *
 * Sesion contra el emulador: el piloto no usa el login del backend PHP pero si
 * una sesion OAuth real contra `mock/server.mjs`. Este modulo guarda esa
 * sesion (`setSession`/`getSession`) para que el login la cree una sola vez y
 * el shell y el listado la compartan, resuelve la URL base de la API
 * (`resolveApiBase`) y refleja el usuario autenticado en `usr.name` y
 * `usr.session.enable` (`applySessionUser`).
 *
 * `__.session.check()` sigue siendo un stub: el chequeo periodico es del
 * backend y queda fuera de este shim (ver SSOT `projects/halcon/docs/2026-11-07-manual.md`).
 */

import { usr, __ } from './globals.js';

/** Prefijo de los avisos del shim. */
const WARN = '[compat/session-shim]';

/** Clave de `localStorage`, igual que `session.key` de `app.json`. */
export const STORAGE_KEY = 'halcon.app.session';

/**
 * Valores de sesion de `sdk/config/app.json`. `enable: false` porque el
 * piloto no tiene backend de autenticacion.
 */
export const DEMO_SESSION = {
  enable: false,
  login: 'auth-login',
  check: 'auth-online',
  logout: 'auth-logout',
  key: STORAGE_KEY,
};

/**
 * Menu de ejemplo con la misma forma que el de `app.json`
 * (`{ id, name, icon, items }`). Tiene dos secciones con hijos y dos items
 * sin hijos; el dashboard lo normaliza al sidebar nativo.
 */
export const DEMO_MENU = [
  {
    id: 'app.seccion.operaciones',
    name: 'Operaciones',
    icon: 'bars',
    items: [
      { id: 'app.abm.clientes_view', name: 'Clientes', icon: 'address-book' },
      { id: 'app.demo.stock', name: 'Stock', icon: 'truck' },
    ],
  },
  {
    id: 'app.seccion.administracion',
    name: 'Administracion',
    icon: 'cog',
    items: [
      { id: 'app.demo.usuarios', name: 'Usuarios', icon: 'ticket' },
      { id: 'app.demo.roles', name: 'Roles', icon: 'flag' },
    ],
  },
  { id: 'app.demo.tablero', name: 'Tablero', icon: 'dashboard' },
  { id: 'app.demo.ayuda', name: 'Ayuda', icon: 'question' },
];

/**
 * Lee el objeto guardado en `localStorage`. Devuelve `null` si no hay
 * `localStorage` (Node), si la clave esta vacia, si el JSON es invalido o si
 * el valor no es un objeto.
 *
 * @returns {Record<string, unknown>|null}
 */
export function readStoredSession() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch (error) {
    console.warn(`${WARN} localStorage["${STORAGE_KEY}"] invalido: se usa el usuario demo`);
    return null;
  }
}

/**
 * Aplica una sesion sobre los objetos compartidos. Es idempotente.
 *
 * @param {Record<string, unknown>|null} stored
 * @returns {{ name: string, menu: unknown[], session: Record<string, unknown> }}
 */
export function applySession(stored) {
  const data = stored && typeof stored === 'object' ? stored : {};
  const name = typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : 'demo';
  const menu = Array.isArray(data.menu) ? data.menu : DEMO_MENU;
  const session = {
    ...DEMO_SESSION,
    ...(data.session && typeof data.session === 'object' ? data.session : {}),
  };

  usr.name = name;
  usr.menu = menu;
  usr.session = session;

  __.current = __.current && typeof __.current === 'object' ? __.current : {};
  __.isNumber = function isNumber(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  };
  __.session = {
    isOnline: false,
    module: 'sys.widget.login',
    /** Stub: el chequeo real es de `sys.core.session` y necesita backend. */
    check() {
      console.warn(`${WARN} __.session.check(): sin backend de sesion, no se valida nada`);
      return false;
    },
  };

  return { name, menu, session };
}

/** Aplica `localStorage` si hay datos y, si no, el usuario demo. */
export const session = applySession(readStoredSession());

/** URL por defecto del emulador de la API. */
export const API_POR_DEFECTO = 'http://127.0.0.1:7071';

/**
 * Saca las barras finales de una URL base.
 * @param {unknown} base
 * @returns {string}
 */
function sinBarraFinal(base) {
  return String(base).replace(/\/+$/, '');
}

/**
 * URL base de la API del piloto.
 *
 * Orden: el parametro `?api=` de la query gana sobre `window.HALCON_API` y,
 * sin ninguno de los dos, se usa el emulador local. La lectura de `location`
 * esta dentro de la funcion (nunca al importar), para que el modulo cargue en
 * Node y en las pruebas.
 *
 * @param {{ search?: string, env?: Record<string, any> }} [options]
 * @returns {string}
 */
export function resolveApiBase(options = {}) {
  const env = options.env || (typeof globalThis === 'undefined' ? {} : globalThis);
  let search = options.search;
  if (typeof search !== 'string') {
    const location = env && env.location;
    search = location && typeof location.search === 'string' ? location.search : '';
  }

  let base = '';
  if (search !== '') {
    try {
      const pedido = new URLSearchParams(search).get('api');
      if (pedido) base = pedido.trim();
    } catch (error) {
      base = '';
    }
  }
  if (base === '' && env && typeof env.HALCON_API === 'string') base = env.HALCON_API.trim();
  if (base === '') base = API_POR_DEFECTO;
  return sinBarraFinal(base);
}

/** @type {any|null} */
let sesionActual = null;

/**
 * Registra la sesion del piloto. La crea el login y la leen el shell y el
 * listado: una sola sesion por pagina.
 *
 * @param {unknown} sesion
 * @returns {any|null}
 */
export function setSession(sesion) {
  sesionActual = sesion && typeof sesion === 'object' ? sesion : null;
  return sesionActual;
}

/** @returns {any|null} la sesion registrada, o `null` si todavia no hay */
export function getSession() {
  return sesionActual;
}

/**
 * Refleja el estado de la sesion en los globales: `usr.name` pasa a ser el
 * usuario autenticado y `usr.session.enable` queda en `true`. Sin sesion
 * vuelve al usuario demo y apaga la marca.
 *
 * @param {{ status?: string, user?: string|null }|null} [estado]
 * @returns {string} nombre visible
 */
export function applySessionUser(estado) {
  const usuario = estado && typeof estado.user === 'string' ? estado.user.trim() : '';
  const autenticado = Boolean(estado && estado.status === 'authenticated' && usuario !== '');
  usr.name = autenticado ? usuario : 'demo';
  usr.session = {
    ...DEMO_SESSION,
    ...(usr.session && typeof usr.session === 'object' ? usr.session : {}),
    enable: autenticado,
  };
  return usr.name;
}

/**
 * Publica `usr` y `__` en el objeto indicado (`globalThis` por omision).
 * El piloto lo usa para dejar `window.usr` y `window.__` como en la
 * aplicacion real.
 *
 * @param {Record<string, unknown>} [target]
 * @returns {Record<string, unknown>}
 */
export function installSession(target = typeof globalThis === 'undefined' ? {} : globalThis) {
  if (!target || (typeof target !== 'object' && typeof target !== 'function')) return target;
  target.usr = usr;
  target.__ = __;
  return target;
}

export { usr, __ };

export default {
  usr,
  __,
  session,
  installSession,
  readStoredSession,
  applySession,
  resolveApiBase,
  setSession,
  getSession,
  applySessionUser,
  API_POR_DEFECTO,
  STORAGE_KEY,
};
