/**
 * ready: ejecuta una funcion cuando el DOM esta listo.
 *
 * Si ya esta listo (o no hay documento, como en tests o en el servidor) la
 * llamada es inmediata; si el documento sigue cargando se espera
 * `DOMContentLoaded` una sola vez.
 */

import { getDocument } from '../core/dom.js';

/**
 * @param {() => void} fn
 * @returns {() => void} la misma funcion, para poder encadenar o cancelar
 */
export function ready(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('compat.ready: se espera una funcion');
  }
  let doc = null;
  try {
    doc = getDocument();
  } catch {
    doc = null;
  }
  if (!doc || doc.readyState !== 'loading') {
    fn();
    return fn;
  }
  doc.addEventListener('DOMContentLoaded', fn, { once: true });
  return fn;
}

export default ready;
