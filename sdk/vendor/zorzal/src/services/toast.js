/**
 * toast: aviso efimero montado sobre el documento.
 */

import { getDocument, h } from '../core/dom.js';

/**
 * @typedef {Object} ToastOptions
 * @property {number} [duration] milisegundos; 0 lo deja fijo
 * @property {'info'|'ok'|'warn'|'error'} [kind]
 * @property {Element} [mount] contenedor; por defecto `document.body`
 */

/**
 * Muestra un aviso y devuelve un handle para cerrarlo.
 *
 * @param {unknown} message
 * @param {ToastOptions} [options]
 * @returns {{ el: Element, close: () => void }}
 */
export function toast(message, options = {}) {
  const doc = getDocument();
  const duration = options.duration === undefined ? 3000 : Number(options.duration);
  const kind = options.kind || 'info';
  const host = options.mount || doc.body;
  if (!host) throw new Error('zorzal.toast: no hay contenedor disponible');

  const text = h('span', { class: 'z-toast__text', text: String(message ?? '') });
  const closeBtn = h('button', { class: 'z-toast__close', type: 'button', 'aria-label': 'Cerrar' }, 'x');
  const el = h('div', { class: `z-toast z-toast--${kind}`, role: 'status' }, [text, closeBtn]);

  let timer = null;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    closeBtn.removeEventListener('click', close);
    if (el.parentNode) el.parentNode.removeChild(el);
  };

  closeBtn.addEventListener('click', close);
  host.appendChild(el);
  if (duration > 0) timer = setTimeout(close, duration);

  return { el, close };
}

export default toast;
