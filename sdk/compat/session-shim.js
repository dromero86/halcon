/**
 * Shim de sesion para el piloto de Halcon.
 *
 * Origen: `usr` y `__` los arma el backend PHP (config del tenant) y
 * `sdk/sys/core/session.js` los usa para validar la sesion contra el servidor.
 * Nada de eso existe en el piloto: no hay backend, no hay PHP y no hay
 * `sys.core.session`.
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
 *  - `__.isNumber(n)`: misma semantica que `sdk/sys/core/helper.js`.
 *  - `__.session`: stub del modulo de sesion; no valida nada contra el
 *    servidor.
 *
 * La sesion se lee de `localStorage` en la clave `usr.session.key`
 * (`halcon.app.session`), con la forma `{ name, menu, session }`. Si no hay
 * datos, o el JSON es invalido, se usa el usuario demo. No se escribe en
 * `localStorage`: en la aplicacion real la sesion la crea el backend.
 *
 * IMPORTANTE: el backend real no esta conectado. `usr.session.enable` queda en
 * `false` y `__.session.check()` solo avisa; el login, el chequeo periodico y
 * el logout son los de `sdk/sys/core/session.js`, que quedan fuera de este
 * shim (ver `sdk/compat/README.md`).
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

export default { usr, __, session, installSession, readStoredSession, applySession, STORAGE_KEY };
