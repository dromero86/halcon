/**
 * busy: overlay de bloqueo con contador de operaciones en curso.
 *
 * `start()` y `stop()` se pueden anidar; el overlay desaparece cuando el
 * contador vuelve a cero.
 */

import { getDocument, h } from '../core/dom.js';

let depth = 0;
let overlay = null;
let labelEl = null;

/** @param {string} label */
function show(label) {
  if (overlay) {
    if (labelEl) labelEl.textContent = label;
    return;
  }
  const doc = getDocument();
  if (!doc.body) return;
  labelEl = h('span', { class: 'z-busy__label', text: label });
  overlay = h('div', { class: 'z-busy', role: 'status', 'aria-live': 'polite' }, [
    h('div', { class: 'z-busy__box' }, [h('span', { class: 'z-busy__spinner', 'aria-hidden': 'true' }), labelEl]),
  ]);
  doc.body.appendChild(overlay);
}

function hide() {
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  overlay = null;
  labelEl = null;
}

export const busy = {
  /**
   * @param {string} [label]
   * @returns {typeof busy}
   */
  start(label = 'Cargando') {
    depth += 1;
    show(String(label));
    return busy;
  },

  /** @returns {typeof busy} */
  stop() {
    depth = Math.max(0, depth - 1);
    if (depth === 0) hide();
    return busy;
  },

  /** Fuerza el cierre y reinicia el contador. */
  clear() {
    depth = 0;
    hide();
  },

  /** @returns {boolean} */
  get active() {
    return depth > 0;
  },

  /** @returns {number} */
  get depth() {
    return depth;
  },

  /**
   * Envuelve una promesa (o el resultado de una funcion) mostrando el overlay.
   * @template T
   * @param {Promise<T>|(() => Promise<T>)} work
   * @param {string} [label]
   * @returns {Promise<T>}
   */
  async wrap(work, label = 'Cargando') {
    busy.start(label);
    try {
      return await (typeof work === 'function' ? work() : work);
    } finally {
      busy.stop();
    }
  },
};

export default busy;
