/**
 * Stubs de los globales que usan los plugins heredados de Halcon.
 *
 * Los plugins portados a modulos ES esperan dos globales: `usr` (sesion del
 * usuario) y `__` (utilidades de la app). No hay aplicacion detras, asi que este
 * modulo publica la superficie minima que los plugins tocan.
 *
 * Reglas de este modulo:
 *  - no hay logica de negocio: nada de red, nada de estado de la app;
 *  - lo que no se puede resolver avisa por consola con el prefijo
 *    `[compat/globals]` y sigue;
 *  - los valores son de ejemplo y estan marcados como tales.
 *
 * `installGlobals(target)` copia los dos objetos al objeto indicado
 * (`globalThis` por omision) y lo usa el piloto, para que el codigo que aun
 * dependa de `window.usr` o `window.__` no falle. Los plugins portados
 * importan los objetos, no leen los globales.
 */

/** Prefijo unico de los avisos de los stubs. */
const WARN = '[compat/globals]';

/**
 * Sesion de ejemplo. El original trae el usuario autenticado; aca es un valor
 * fijo para que `usr.name.toUpperCase()` y similares no rompan.
 */
export const usr = {
  /** Nombre visible del usuario de ejemplo. */
  name: 'demo',
};

/**
 * Utilidades de aplicacion que usan los plugins.
 *
 * - `current`: cache de seleccion por store que llenan los plugins.
 * - `setTitle`: el original cambia el titulo de la pagina.
 * - `get_user`: el original devuelve la sesion o `false`.
 * - `getFormPost`: el original arma el payload del formulario.
 * - `sendPost`: el original publica al backend.
 * - `GET`: el original pide datos y llama al callback con la respuesta.
 * - `PAYLOAD`: el original pide datos con un payload y llama al callback.
 * - `mobileAndTabletcheck`: deteccion de dispositivo del original.
 */
export const __ = {
  current: {},

  /** @param {unknown} title */
  setTitle(title) {
    console.warn(`${WARN} __.setTitle(${JSON.stringify(title)}): sin titulo de aplicacion`);
  },

  /** @returns {false} */
  get_user() {
    return false;
  },

  /**
   * Payload del formulario. Sin aplicacion no hay formulario que serializar.
   * @param {unknown} formId
   * @returns {Record<string, never>}
   */
  getFormPost(formId) {
    console.warn(`${WARN} __.getFormPost(${JSON.stringify(formId)}): devuelve un payload vacio`);
    return {};
  },

  /**
   * Envio al backend. No hace red.
   * @param {unknown} action
   * @param {unknown} values
   * @param {unknown} [after]
   */
  sendPost(action, values, after) {
    console.warn(`${WARN} __.sendPost(${JSON.stringify(action)}): sin backend, no se envia nada`);
    return false;
  },

  /**
   * Lectura de datos. No hace red: avisa y llama al callback con un objeto
   * vacio para que el flujo del plugin termine (habilitar botones, pintar
   * valores, emitir su evento de listo).
   * @param {unknown} url
   * @param {(data: Record<string, never>) => void} [callback]
   */
  GET(url, callback) {
    console.warn(`${WARN} __.GET(${JSON.stringify(url)}): sin backend, callback vacio`);
    if (typeof callback === 'function') callback({});
    return false;
  },

  /**
   * Lectura con payload. No hace red: avisa y llama al callback con una
   * respuesta vacia en formato JSON.
   * @param {unknown} action
   * @param {unknown} payload
   * @param {(response: string) => void} [callback]
   */
  PAYLOAD(action, payload, callback) {
    console.warn(`${WARN} __.PAYLOAD(${JSON.stringify(action)}): sin backend, respuesta vacia`);
    if (typeof callback === 'function') callback('{"data":[]}');
    return false;
  },

  /** @returns {boolean} */
  mobileAndTabletcheck() {
    return false;
  },
};

/**
 * Publica los stubs como globales, para el codigo que no los importa.
 * @param {Record<string, unknown>} [target]
 * @returns {Record<string, unknown>} el objeto intervenido
 */
export function installGlobals(target = typeof globalThis === 'undefined' ? {} : globalThis) {
  if (!target || (typeof target !== 'object' && typeof target !== 'function')) return target;
  target.usr = usr;
  target.__ = __;
  return target;
}

export default { usr, __, installGlobals };
