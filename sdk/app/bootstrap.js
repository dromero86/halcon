/**
 * Puesta en marcha compartida de Halcon sobre Zorzal.
 *
 * Es la misma secuencia que arma el piloto del dashboard, extraida a un modulo
 * para que el arranque de `sdk/index.html` no repita logica:
 *
 *  1. instala el shim de sesion (`compat/session-shim.js`) como `usr` y `__`;
 *  2. importa las pantallas de `sdk/src/app/index.js` (`app.login`,
 *     `app.inicio`, estados y el ABM de clientes);
 *  3. observa la sesion del piloto y monta `app.login` mientras es anonima, o
 *     el shell del dashboard cuando esta autenticada.
 *
 * No crea sesiones ni guarda tokens: la sesion sale de `sesionDelPiloto()`, que
 * es la unica via por la que el login, el shell y el listado comparten estado.
 *
 * Uso:
 *
 *   import { start } from './bootstrap.js';
 *   start({ root: '#app' });
 *
 * `start()` es idempotente: la segunda llamada devuelve el mismo controlador.
 */

import { usr, installSession, applySessionUser } from '../compat/session-shim.js';
import { mount as montarDashboard } from '../compat/pages/dashboard.js';
import { mount as montarLoginPage, sesionDelPiloto } from '../compat/pages/login.js';
import { EVENTO_SESION_VENCIDA, reiniciarCarga } from '../compat/pages/clientes_view.js';
import { findPage } from '../src/app/index.js';

/** Id del contenedor de la aplicacion. */
export const ROOT_ID = 'app';

/** Selector del contenedor de la aplicacion. */
export const ROOT_SELECTOR = '#app';

/** Item de inicio que encabeza el menu del shell. */
export const ITEM_INICIO = { id: 'app.inicio', name: 'Inicio', icon: 'dashboard' };

/** Aviso que se muestra en el login cuando la sesion se vence. */
export const AVISO_SESION_VENCIDA = 'La sesion vencio. Volve a entrar.';

/** Controlador del arranque en curso, o `null`. */
let control = null;

/**
 * Crea el contenedor `#app` si la pagina no lo trae.
 *
 * `sdk/index.html` solo declara el script del loader, asi que el contenedor lo
 * agrega el arranque; si la pagina ya tiene `#app`, se respeta.
 *
 * @param {Document} doc
 * @returns {Element}
 */
export function crearRaiz(doc) {
  const existente = doc.getElementById(ROOT_ID);
  if (existente) return existente;

  const raiz = doc.createElement('div');
  raiz.id = ROOT_ID;
  doc.body.appendChild(raiz);
  return raiz;
}

/**
 * Resuelve el contenedor: elemento, selector o id.
 * @param {unknown} root
 * @param {Document} doc
 * @returns {Element}
 */
function resolverRaiz(root, doc) {
  if (root && typeof root.appendChild === 'function') return root;
  if (typeof root === 'string' && root.trim() !== '') {
    const encontrado = doc.querySelector(root);
    if (encontrado) return encontrado;
    if (root === ROOT_SELECTOR || root === ROOT_ID) return crearRaiz(doc);
    throw new Error(`bootstrap: no se encontro "${root}"`);
  }
  return crearRaiz(doc);
}

/**
 * Menu del shell: el del session shim con Inicio adelante, igual que el
 * piloto. No duplica items ni toca el global.
 * @returns {any[]}
 */
export function menuConInicio() {
  const items = usr && Array.isArray(usr.menu) ? usr.menu : [];
  return [ITEM_INICIO, ...items.filter((item) => item && item.id !== ITEM_INICIO.id)];
}

/**
 * Arranca la aplicacion sobre Zorzal.
 *
 * @param {{ root?: Element|string, document?: Document, session?: any, menu?: any[] }} [options]
 * @returns {{
 *   root: Element,
 *   session: any,
 *   menu: any[],
 *   vista: () => string,
 *   dashboard: () => any,
 *   login: () => any,
 *   shell: (estado?: any) => any,
 *   destroy: () => void,
 * }}
 */
export function start(options = {}) {
  if (control) return control;

  const doc = options.document || document;
  installSession(globalThis);

  const raiz = resolverRaiz(options.root, doc);
  const sesion = options.session || sesionDelPiloto();
  const menu = Array.isArray(options.menu) ? options.menu : menuConInicio();

  /** @type {string} vista montada: '' mientras no se monto nada */
  let vista = '';
  /** @type {any} controlador del shell, o `null` cuando hay login */
  let dashboard = null;
  let avisoLogin = '';

  /** Vacia el contenedor antes de montar la vista que sigue. */
  function vaciar() {
    while (raiz.firstChild) raiz.removeChild(raiz.firstChild);
  }

  /** Monta `app.login` en el contenedor. */
  function montarLogin() {
    vaciar();
    vista = 'login';
    dashboard = null;
    return montarLoginPage(raiz, { session: sesion, aviso: avisoLogin });
  }

  /**
   * Monta el shell del dashboard con la sesion activa.
   * @param {{ user?: string }|null} [estado]
   */
  function montarShell(estado) {
    const usuario = estado && typeof estado.user === 'string' ? estado.user : '';
    vaciar();
    vista = 'shell';
    dashboard = montarDashboard(raiz, { menu, navigate: findPage, session: sesion, user: usuario });
    if (dashboard) dashboard.select(ITEM_INICIO.id);
    return dashboard;
  }

  /** El listado avisa que el emulador respondio 401: el login lo muestra. */
  function alVencerSesion() {
    avisoLogin = AVISO_SESION_VENCIDA;
  }
  doc.addEventListener(EVENTO_SESION_VENCIDA, alVencerSesion);

  // `subscribe` notifica en el acto con el estado actual: la primera vez monta
  // el login y, al autenticar, el shell.
  const desuscribir = sesion.subscribe((estado) => {
    applySessionUser(estado);
    if (estado && estado.status === 'authenticated') {
      if (vista !== 'shell') montarShell(estado);
      return;
    }
    if (vista !== 'login') {
      reiniciarCarga();
      avisoLogin = '';
      montarLogin();
    }
  });

  control = {
    root: raiz,
    session: sesion,
    menu,
    vista: () => vista,
    dashboard: () => dashboard,
    login: montarLogin,
    shell: montarShell,
    destroy() {
      doc.removeEventListener(EVENTO_SESION_VENCIDA, alVencerSesion);
      desuscribir();
      if (dashboard && typeof dashboard.destroy === 'function') dashboard.destroy();
      dashboard = null;
      vista = '';
      vaciar();
      control = null;
    },
  };

  return control;
}

export default { start };
