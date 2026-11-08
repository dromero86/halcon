/**
 * Pantalla de login del piloto contra el emulador de la API.
 *
 * El piloto no tiene el login del backend PHP: la autenticacion es OAuth con
 * PKCE contra `mock/server.mjs`, a traves de `sdk/src/auth/session.js`. Este
 * modulo es el unico lugar donde se crea la sesion del piloto
 * (`sesionDelPiloto()`): la registra en `compat/session-shim.js` y el shell y
 * el listado de clientes la leen de ahi.
 *
 * Formulario: usuario, password y el boton `Entrar`. Mientras autentica el
 * boton pasa a `Entrando...` y queda deshabilitado. Los errores se muestran en
 * la propia pantalla:
 *
 *  - `401` (usuario o password incorrectos): mensaje de error visible;
 *  - el emulador no responde (fetch rechazado, sin `status`): aviso aparte,
 *    con la URL base que se esta usando.
 *
 * La URL base sale de `resolveApiBase()`: `?api=` de la query gana sobre
 * `window.HALCON_API` y, sin ninguno, se usa `http://127.0.0.1:7071`.
 *
 * Al autenticar, el login llama a `options.onAuthenticated(estado)`; sin ese
 * handler emite `halcon:login` en el documento con el estado en `detail`. El
 * piloto monta el shell y abre `app.inicio`.
 *
 * Uso:
 *
 *   import { mount, sesionDelPiloto } from './pages/login.js';
 *   const sesion = sesionDelPiloto();
 *   mount(document.querySelector('#app'), { session: sesion });
 *
 * El modulo registra la pantalla como `app.login` al importarse.
 */

import { applySessionUser, getSession, resolveApiBase, setSession } from '../session-shim.js';
import { createSession } from '../../src/auth/session.js';

/** Id de la pantalla en el registro de `app`. */
export const PAGE_ID = 'app.login';

/** Id del formulario. */
export const FORM_ID = 'login_form';

/** Nombre del campo de usuario (tambien su `name`). */
export const USER_NAME = 'usuario';

/** Nombre del campo de password (tambien su `name`). */
export const PASSWORD_NAME = 'password';

/** Id y nombre del boton de entrada. */
export const SUBMIT_ID = 'login_entrar';

/** Id del mensaje de error. */
export const ERROR_ID = 'login_error';

/** Id del aviso cuando el emulador no responde. */
export const AVISO_ID = 'login_aviso';

/** Texto del boton en reposo. */
export const TEXTO_ENTRAR = 'Entrar';

/** Texto del boton mientras autentica. */
export const TEXTO_ENTRANDO = 'Entrando...';

/** Error de credenciales (401 del emulador). */
export const MENSAJE_CREDENCIALES = 'Usuario o password incorrectos.';

/** Error de campos vacios. */
export const MENSAJE_FALTAN = 'Completá usuario y password.';

/** Error generico del resto de las respuestas fallidas. */
export const MENSAJE_GENERICO = 'No se pudo iniciar la sesión.';

/** Evento que emite el login autenticado cuando no hay handler. */
export const EVENTO_LOGIN = 'halcon:login';

/**
 * Crea la sesion del piloto contra el emulador y la registra en el shim.
 *
 * @param {string} [baseUrl]
 * @returns {ReturnType<typeof createSession>}
 */
export function crearSesion(baseUrl) {
  const sesion = createSession({ baseUrl: baseUrl || resolveApiBase() });
  setSession(sesion);
  return sesion;
}

/**
 * Sesion del piloto: la registrada o una nueva. Es la unica via por la que el
 * piloto obtiene la sesion, para que el login, el shell y el listado
 * compartan tokens y estado.
 *
 * @returns {ReturnType<typeof createSession>}
 */
export function sesionDelPiloto() {
  const existente = getSession();
  return existente || crearSesion();
}

/**
 * Crea un elemento con clase y texto opcionales.
 * @param {Document} doc
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function nodo(doc, tag, className, text) {
  const el = doc.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * Arma un campo del formulario con su etiqueta y su ayuda de autocompletado.
 *
 * @param {Document} doc
 * @param {{ name: string, label: string, type: string, autocomplete: string }} spec
 * @returns {{ campo: HTMLElement, input: HTMLInputElement }}
 */
function campo(doc, spec) {
  const contenedor = nodo(doc, 'div', 'hc-login__campo');
  const id = `login_${spec.name}`;

  const etiqueta = nodo(doc, 'label', 'hc-login__etiqueta', spec.label);
  etiqueta.setAttribute('for', id);

  const input = nodo(doc, 'input', 'hc-login__input');
  input.type = spec.type;
  input.id = id;
  input.name = spec.name;
  input.autocomplete = spec.autocomplete;
  input.required = true;

  contenedor.append(etiqueta, input);
  return { campo: contenedor, input };
}

/**
 * Monta el formulario de login dentro de `host`.
 *
 * @param {Element|string} host contenedor o selector
 * @param {{
 *   session?: any,
 *   baseUrl?: string,
 *   aviso?: string,
 *   onAuthenticated?: (estado: any) => void,
 * }} [options]
 * @returns {{
 *   root: Element,
 *   form: HTMLFormElement,
 *   usuario: HTMLInputElement,
 *   password: HTMLInputElement,
 *   entrar: HTMLButtonElement,
 *   error: Element,
 *   aviso: Element,
 *   destroy: () => void,
 * }}
 */
export function mount(host, options = {}) {
  const target = typeof host === 'string' ? document.querySelector(host) : host;
  if (!target || typeof target.appendChild !== 'function') {
    throw new Error('login.mount: falta el contenedor');
  }
  const doc = target.ownerDocument || document;
  const sesion = options.session || sesionDelPiloto();
  const base = typeof options.baseUrl === 'string' && options.baseUrl !== '' ? options.baseUrl : resolveApiBase();

  const root = nodo(doc, 'div', 'hc-page hc-page--login');
  root.dataset.page = PAGE_ID;

  const caja = nodo(doc, 'section', 'hc-login');
  caja.setAttribute('aria-labelledby', 'login_titulo');

  const titulo = nodo(doc, 'h1', 'hc-login__titulo', 'Halcón');
  titulo.id = 'login_titulo';
  const subtitulo = nodo(
    doc,
    'p',
    'hc-login__subtitulo',
    'Entrá con un usuario del emulador para abrir el dashboard.',
  );

  const form = nodo(doc, 'form', 'hc-login__form');
  form.id = FORM_ID;
  form.noValidate = true;
  form.setAttribute('method', 'post');

  const usuario = campo(doc, {
    name: USER_NAME,
    label: 'Usuario',
    type: 'text',
    autocomplete: 'username',
  });
  const password = campo(doc, {
    name: PASSWORD_NAME,
    label: 'Password',
    type: 'password',
    autocomplete: 'current-password',
  });

  const entrar = nodo(doc, 'button', 'hc-login__entrar z-button z-button--primary', TEXTO_ENTRAR);
  entrar.type = 'submit';
  entrar.id = SUBMIT_ID;
  entrar.name = SUBMIT_ID;

  const error = nodo(doc, 'p', 'hc-login__error');
  error.id = ERROR_ID;
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const aviso = nodo(doc, 'p', 'hc-login__aviso');
  aviso.id = AVISO_ID;
  aviso.setAttribute('role', 'status');
  aviso.setAttribute('aria-live', 'polite');
  aviso.hidden = true;

  form.append(usuario.campo, password.campo, entrar);
  caja.append(titulo, subtitulo, aviso, error, form);

  const pie = nodo(
    doc,
    'p',
    'hc-login__pie',
    `Emulador en ${base}. Credenciales de ejemplo: admin / admin123.`,
  );
  caja.appendChild(pie);
  root.appendChild(caja);
  target.appendChild(root);

  /** Evita dos envios en paralelo por doble clic o Enter repetido. */
  let enviando = false;

  /** @param {string} texto */
  function mostrarError(texto) {
    error.textContent = texto;
    error.hidden = texto === '';
  }

  /** @param {string} texto */
  function mostrarAviso(texto) {
    aviso.textContent = texto;
    aviso.hidden = texto === '';
  }

  if (typeof options.aviso === 'string' && options.aviso.trim() !== '') mostrarAviso(options.aviso.trim());

  /**
   * Envia las credenciales y decide el mensaje segun la respuesta.
   * @param {Event} [evento]
   * @returns {Promise<void>}
   */
  async function onSubmit(evento) {
    if (evento && typeof evento.preventDefault === 'function') evento.preventDefault();
    if (enviando) return;

    const nombre = usuario.input.value.trim();
    const clave = password.input.value;
    mostrarError('');
    mostrarAviso('');

    if (nombre === '' || clave === '') {
      mostrarError(MENSAJE_FALTAN);
      usuario.input.focus();
      return;
    }

    enviando = true;
    entrar.disabled = true;
    entrar.textContent = TEXTO_ENTRANDO;

    try {
      const estado = await sesion.login({ user: nombre, password: clave });
      applySessionUser(estado);
      if (typeof options.onAuthenticated === 'function') options.onAuthenticated(estado);
      else if (typeof root.dispatchEvent === 'function') {
        root.dispatchEvent(new CustomEvent(EVENTO_LOGIN, { bubbles: true, detail: estado }));
      }
    } catch (fallo) {
      const status = fallo && typeof fallo.status === 'number' ? fallo.status : 0;
      if (status === 401) {
        mostrarError(MENSAJE_CREDENCIALES);
      } else if (status === 0) {
        mostrarAviso(`El emulador no responde en ${base}. Revisá que esté levantado (make demo).`);
      } else {
        mostrarError(fallo && fallo.message ? String(fallo.message) : MENSAJE_GENERICO);
      }
    } finally {
      enviando = false;
      entrar.disabled = false;
      entrar.textContent = TEXTO_ENTRAR;
    }
  }

  form.addEventListener('submit', onSubmit);

  return {
    root,
    form,
    usuario: usuario.input,
    password: password.input,
    entrar,
    error,
    aviso,
    destroy() {
      form.removeEventListener('submit', onSubmit);
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

export default { mount, crearSesion, sesionDelPiloto };
