/**
 * ajax: fachada de `http` con callbacks opcionales.
 *
 * No agrega transporte: cada metodo delega en `http` y devuelve su promesa.
 * `onSuccess` recibe el dato resuelto. Si se pasa `onError`, la falla se
 * entrega al handler y la promesa se resuelve con `undefined` (el error queda
 * tratado); sin `onError` la promesa rechaza como en `http`.
 */

import { http } from './http.js';

/**
 * @param {Promise<any>} pending
 * @param {{ onSuccess?: (data: any) => void, onError?: (error: Error) => void }} [handlers]
 * @returns {Promise<any>}
 */
function withHandlers(pending, handlers = {}) {
  const { onSuccess, onError } = handlers || {};
  return pending.then(
    (data) => {
      if (typeof onSuccess === 'function') onSuccess(data);
      return data;
    },
    (error) => {
      if (typeof onError === 'function') {
        onError(error);
        return undefined;
      }
      throw error;
    }
  );
}

/**
 * @param {object} [options]
 * @returns {{ onSuccess?: Function, onError?: Function, rest: object }}
 */
function split(options = {}) {
  const { onSuccess, onError, ...rest } = options || {};
  return { onSuccess, onError, rest };
}

export const ajax = {
  /**
   * @param {string} url
   * @param {Record<string, string>} [params]
   * @param {{ onSuccess?: Function, onError?: Function, timeout?: number, headers?: Record<string, string> }} [options]
   * @returns {Promise<any>}
   */
  get(url, params, options = {}) {
    const { onSuccess, onError, rest } = split(options);
    return withHandlers(http.get(url, params, rest), { onSuccess, onError });
  },

  /**
   * @param {string} url
   * @param {unknown} [body]
   * @param {{ onSuccess?: Function, onError?: Function, timeout?: number, headers?: Record<string, string> }} [options]
   * @returns {Promise<any>}
   */
  post(url, body, options = {}) {
    const { onSuccess, onError, rest } = split(options);
    return withHandlers(http.post(url, body, rest), { onSuccess, onError });
  },

  /**
   * @param {string} url
   * @param {unknown} [body]
   * @param {{ onSuccess?: Function, onError?: Function, timeout?: number, headers?: Record<string, string> }} [options]
   * @returns {Promise<any>}
   */
  put(url, body, options = {}) {
    const { onSuccess, onError, rest } = split(options);
    return withHandlers(http.put(url, body, rest), { onSuccess, onError });
  },

  /**
   * @param {string} url
   * @param {{ onSuccess?: Function, onError?: Function, timeout?: number, headers?: Record<string, string> }} [options]
   * @returns {Promise<any>}
   */
  del(url, options = {}) {
    const { onSuccess, onError, rest } = split(options);
    return withHandlers(http.del(url, rest), { onSuccess, onError });
  },
};

export default ajax;
