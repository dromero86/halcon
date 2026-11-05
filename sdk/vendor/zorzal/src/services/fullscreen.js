/**
 * fullscreen: pantalla completa sobre la API del navegador.
 *
 * Prueba la API estandar y las variantes con prefijo. Si ninguna existe, el
 * fallback agrega la clase `z-fullscreen` al elemento y lleva el estado en
 * memoria, de modo que `isActive()`/`exit()` siguen siendo coherentes sin
 * lanzar excepciones. Un rechazo del navegador (permiso denegado) devuelve
 * `false`.
 */

import { getDocument } from '../core/dom.js';

let fallbackEl = null;

/** @returns {Document|null} */
function currentDoc() {
  try {
    return getDocument();
  } catch {
    return null;
  }
}

/** @param {Document|null} doc */
function nativeActive(doc) {
  if (!doc) return false;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
}

/** @param {Element} el */
function requestFn(el) {
  return el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen || null;
}

/** @param {Document|null} doc */
function exitFn(doc) {
  if (!doc) return null;
  return doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen || null;
}

export const fullscreen = {
  /**
   * @param {Element} [el]
   * @returns {Promise<boolean>}
   */
  request(el) {
    if (!el) return Promise.resolve(false);
    const fn = requestFn(el);
    if (!fn) {
      fallbackEl = el;
      if (el.classList) el.classList.add('z-fullscreen');
      return Promise.resolve(true);
    }
    return Promise.resolve()
      .then(() => fn.call(el))
      .then(() => true)
      .catch(() => false);
  },

  /**
   * @returns {Promise<boolean>}
   */
  exit() {
    if (fallbackEl) {
      if (fallbackEl.classList) fallbackEl.classList.remove('z-fullscreen');
      fallbackEl = null;
      return Promise.resolve(true);
    }
    const doc = currentDoc();
    const fn = exitFn(doc);
    if (!fn) return Promise.resolve(false);
    return Promise.resolve()
      .then(() => fn.call(doc))
      .then(() => true)
      .catch(() => false);
  },

  /** @returns {boolean} */
  isActive() {
    return nativeActive(currentDoc()) || Boolean(fallbackEl);
  },
};

export default fullscreen;
