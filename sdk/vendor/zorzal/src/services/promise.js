/**
 * promise: utilidades minimas sobre Promise.
 *
 * `defer()` expone resolve/reject sin envolver la promesa en otra capa;
 * `delay(ms, valor)` espera y resuelve con el valor; `all(lista)` delega en
 * `Promise.all` conservando el orden.
 */

/**
 * @template T
 * @returns {{ promise: Promise<T>, resolve: (value?: T) => void, reject: (reason?: unknown) => void }}
 */
export function defer() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * @param {number} ms
 * @param {unknown} [value]
 * @returns {Promise<any>}
 */
export function delay(ms, value) {
  const wait = Number(ms);
  const timeout = Number.isFinite(wait) && wait > 0 ? wait : 0;
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), timeout);
  });
}

/**
 * @param {Iterable<unknown>} list
 * @returns {Promise<any[]>}
 */
export function all(list) {
  return Promise.all(list);
}

export const promise = { defer, delay, all };

export default promise;
