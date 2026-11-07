/**
 * Sesion del SDK: OAuth con PKCE contra la API JSON de Halcon.
 *
 * `createSession({ baseUrl, fetchImpl })` devuelve una sesion con estado
 * observable y tokens guardados en memoria del modulo (variables del cierre,
 * una copia por sesion). Nada se escribe en `localStorage`: recargar la pagina
 * deja la sesion en `anonymous`.
 *
 * Estado publico: `{ status, user, roles, expiresAt }`.
 *
 *  - `status`: `anonymous` | `authenticating` | `authenticated`;
 *  - `user`: nombre del usuario autenticado, o `null`;
 *  - `roles`: lista de roles, vacia sin sesion;
 *  - `expiresAt`: epoch en milisegundos en que vence el access token, `0` sin
 *    sesion.
 *
 * Refresco: antes de cada pedido, si el access token ya vencio, se refresca en
 * silencio. Si el servidor responde 401 igual, se refresca una vez y se
 * reintenta una sola vez. Si el refresh falla (revocado, vencido o red caida),
 * la sesion pasa a `anonymous`, se emite el cambio y no se reintenta mas. Los
 * refresh concurrentes se unifican en una sola peticion porque el emulador
 * rota el par en cada uso.
 *
 * Uso:
 *
 *   const sesion = createSession({ baseUrl: 'http://127.0.0.1:7071' });
 *   sesion.subscribe((estado) => pinta(estado.status));
 *   await sesion.login({ user: 'admin', password: 'admin123' });
 *   const respuesta = await sesion.fetch('/api/clientes');
 *
 * `createSession` se importa desde `sdk/src/auth/session.js`; el modulo no
 * depende de otros modulos del SDK salvo `pkce.js`.
 */

import { createVerifier, challengeS256 } from './pkce.js';

/** Rutas del contrato OAuth. */
const RUTA_AUTORIZAR = '/oauth/authorize';
const RUTA_TOKEN = '/oauth/token';
const RUTA_REVOCAR = '/oauth/revoke';
const RUTA_PERFIL = '/api/me';

/** Estado de una sesion sin autenticar. */
function estadoInicial() {
  return { status: 'anonymous', user: null, roles: [], expiresAt: 0 };
}

/**
 * Crea una sesion.
 *
 * @param {{ baseUrl?: string, fetchImpl?: typeof fetch }} [config]
 * @returns {{
 *   state: () => { status: string, user: string|null, roles: string[], expiresAt: number },
 *   subscribe: (fn: (estado: any) => void) => () => boolean,
 *   login: (credenciales: { user: string, password: string }) => Promise<any>,
 *   refresh: () => Promise<boolean>,
 *   logout: () => Promise<void>,
 *   fetch: (ruta: string, opciones?: RequestInit) => Promise<Response>,
 *   dispose: () => void,
 * }}
 */
export function createSession(config = {}) {
  const ajustes = config || {};
  const base = typeof ajustes.baseUrl === 'string' ? ajustes.baseUrl.replace(/\/+$/, '') : '';
  if (ajustes.fetchImpl !== undefined && typeof ajustes.fetchImpl !== 'function') {
    throw new TypeError('createSession: fetchImpl debe ser una funcion');
  }
  const enviar = ajustes.fetchImpl || ((...args) => globalThis.fetch(...args));

  let estado = estadoInicial();
  let tokens = { access: '', refresh: '', expiresAt: 0 };
  let enCurso = null;
  let cerrada = false;
  const suscriptores = new Set();

  /** Vista inmutable del estado actual. */
  function copia() {
    return {
      status: estado.status,
      user: estado.user,
      roles: [...estado.roles],
      expiresAt: estado.expiresAt,
    };
  }

  /** Notifica a los suscriptores con una copia del estado. */
  function emitir() {
    const vista = copia();
    for (const suscriptor of suscriptores) {
      try {
        suscriptor(vista);
      } catch {
        // Un suscriptor roto no corta la notificacion ni el pedido en curso.
      }
    }
  }

  /** Borra tokens y vuelve a `anonymous`, sin emitir. */
  function limpiar() {
    tokens = { access: '', refresh: '', expiresAt: 0 };
    estado = estadoInicial();
  }

  /**
   * Guarda el par de tokens de una respuesta de `/oauth/token`.
   * @param {{ access_token?: string, refresh_token?: string, expires_in?: number }} datos
   */
  function guardar(datos) {
    const segundos = Number(datos && datos.expires_in);
    tokens = {
      access: String((datos && datos.access_token) || ''),
      refresh: String((datos && datos.refresh_token) || ''),
      expiresAt: Date.now() + (Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : 0),
    };
  }

  /**
   * URL final de una ruta relativa al `baseUrl`.
   * @param {string} ruta
   * @returns {string}
   */
  function destino(ruta) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(ruta)) return ruta;
    if (!ruta.startsWith('/')) return `${base}/${ruta}`;
    return `${base}${ruta}`;
  }

  /**
   * Peticion HTTP con el access token indicado.
   * @param {string} ruta
   * @param {RequestInit} [opciones]
   * @param {string} [accessToken]
   * @returns {Promise<Response>}
   */
  function pedir(ruta, opciones = {}, accessToken = tokens.access) {
    const cabeceras = new Headers(opciones.headers || {});
    if (accessToken && !cabeceras.has('Authorization')) {
      cabeceras.set('Authorization', `Bearer ${accessToken}`);
    }
    return enviar(destino(ruta), { ...opciones, headers: cabeceras });
  }

  /**
   * Peticion JSON.
   * @param {string} ruta
   * @param {unknown} datos
   * @param {string} accessToken
   * @returns {Promise<Response>}
   */
  function enviarJson(ruta, datos, accessToken = '') {
    return pedir(
      ruta,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      },
      accessToken,
    );
  }

  /**
   * Error a partir de una respuesta con la forma `{ error: { code, message } }`.
   * @param {Response} respuesta
   * @param {string} porDefecto
   * @returns {Promise<Error & { status: number, code: string }>}
   */
  async function errorDe(respuesta, porDefecto) {
    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch {
      cuerpo = null;
    }
    const detalle = (cuerpo && cuerpo.error) || {};
    const error = new Error(detalle.message || porDefecto);
    error.status = respuesta.status;
    error.code = detalle.code || 'error';
    return error;
  }

  /**
   * Rota el par de tokens con el refresh guardado.
   * @returns {Promise<boolean>}
   */
  async function ejecutarRefresh() {
    if (tokens.refresh === '') {
      limpiar();
      emitir();
      return false;
    }
    let respuesta;
    try {
      respuesta = await enviarJson(RUTA_TOKEN, {
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh,
      });
    } catch {
      limpiar();
      emitir();
      return false;
    }
    if (!respuesta.ok) {
      limpiar();
      emitir();
      return false;
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch {
      datos = null;
    }
    if (!datos || typeof datos.access_token !== 'string' || datos.access_token === '') {
      limpiar();
      emitir();
      return false;
    }
    guardar(datos);
    estado.expiresAt = tokens.expiresAt;
    emitir();
    return true;
  }

  /**
   * Refresh con una sola peticion en vuelo.
   * @returns {Promise<boolean>}
   */
  function refrescar() {
    if (enCurso) return enCurso;
    const promesa = ejecutarRefresh();
    enCurso = promesa;
    promesa
      .catch(() => false)
      .then(() => {
        if (enCurso === promesa) enCurso = null;
      });
    return promesa;
  }

  /** Suscribe una funcion a los cambios de estado; devuelve la baja. */
  function subscribe(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('subscribe: la funcion de escucha es obligatoria');
    }
    suscriptores.add(fn);
    fn(copia());
    return () => suscriptores.delete(fn);
  }

  /** Estado actual, copia. */
  function state() {
    return copia();
  }

  /**
   * Login con usuario y password: code con PKCE, canje y lectura del perfil.
   * @param {{ user: string, password: string }} credenciales
   * @returns {Promise<any>} estado autenticado
   */
  async function login(credenciales = {}) {
    const usuario = typeof credenciales.user === 'string' ? credenciales.user.trim() : '';
    const password = typeof credenciales.password === 'string' ? credenciales.password : '';
    if (usuario === '' || password === '') {
      throw new TypeError('login: faltan user y password');
    }
    estado.status = 'authenticating';
    emitir();

    try {
      const verifier = createVerifier();
      const challenge = await challengeS256(verifier);

      const autorizacion = await enviarJson(RUTA_AUTORIZAR, {
        usuario,
        password,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });
      if (!autorizacion.ok) {
        throw await errorDe(autorizacion, 'no se pudo autorizar la sesion');
      }
      const concesion = await autorizacion.json();
      const code = String((concesion && concesion.code) || '');
      if (code === '') {
        const error = new Error('login: el emulador no devolvio un code');
        error.status = 502;
        error.code = 'invalid_response';
        throw error;
      }

      const canje = await enviarJson(RUTA_TOKEN, {
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
      });
      if (!canje.ok) {
        throw await errorDe(canje, 'no se pudo canjear el code');
      }
      guardar(await canje.json());

      const perfil = await pedir(RUTA_PERFIL);
      if (!perfil.ok) {
        throw await errorDe(perfil, 'no se pudo leer el perfil');
      }
      const datos = await perfil.json();
      estado.status = 'authenticated';
      estado.user = String((datos && datos.usuario) || usuario);
      estado.roles = Array.isArray(datos && datos.roles) ? [...datos.roles] : [];
      estado.expiresAt = tokens.expiresAt;
      emitir();
      return copia();
    } catch (fallo) {
      limpiar();
      emitir();
      throw fallo;
    }
  }

  /** Fuerza un refresh; `false` si el refresh no sirve y la sesion quedo anonima. */
  async function refresh() {
    return refrescar();
  }

  /** Cierra la sesion: revoca el refresh en el servidor y limpia el estado. */
  async function logout() {
    const refreshToken = tokens.refresh;
    limpiar();
    emitir();
    if (refreshToken === '') return;
    try {
      await enviarJson(RUTA_REVOCAR, { token: refreshToken, token_type_hint: 'refresh_token' });
    } catch {
      // La sesion local ya esta cerrada: el emulador puede no estar disponible.
    }
  }

  /**
   * Pedido autenticado con refresco silencioso y un unico reintento en 401.
   * @param {string} ruta
   * @param {RequestInit} [opciones]
   * @returns {Promise<Response>} la respuesta final; no lanza por 401
   */
  async function fetchSesion(ruta, opciones = {}) {
    if (tokens.refresh !== '' && tokens.expiresAt <= Date.now()) {
      await refrescar();
    }

    let respuesta = await pedir(ruta, opciones);
    if (respuesta.status !== 401 || tokens.access === '') return respuesta;

    const anterior = tokens.access;
    const renovado = await refrescar();
    if (!renovado || tokens.access === '' || tokens.access === anterior) return respuesta;

    respuesta = await pedir(ruta, opciones);
    return respuesta;
  }

  /** Libera suscriptores y tokens. */
  function dispose() {
    if (cerrada) return;
    cerrada = true;
    suscriptores.clear();
    limpiar();
  }

  return { state, subscribe, login, refresh, logout, fetch: fetchSesion, dispose };
}
