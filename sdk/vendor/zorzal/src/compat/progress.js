/**
 * ProgressBar: overlay con barra de progreso.
 *
 * Es un objeto de metodos, no una clase, para que tambien se pueda mezclar
 * sobre un widget con `extend(instancia, ProgressBar)`: el host sale de
 * `this` (una instancia con `el`, un elemento o el body) y el estado queda
 * asociado a ese host.
 *
 * `show()` muestra el overlay, `hide()` lo oculta y `setValue(v)` fija el
 * avance entre 0 y 100.
 */

import { getDocument, h } from '../core/dom.js';

const states = new WeakMap();

/**
 * @param {any} owner
 * @returns {Node|null}
 */
function hostOf(owner) {
  if (owner && owner.el && typeof owner.el.appendChild === 'function') return owner.el;
  if (owner && typeof owner.appendChild === 'function') return owner;
  if (typeof owner === 'string') {
    const found = getDocument().querySelector(owner);
    if (found) return found;
  }
  return getDocument().body || null;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function clamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

/**
 * Crea el overlay la primera vez que se usa.
 * @param {any} owner
 */
function ensure(owner) {
  let state = states.get(owner);
  if (state) return state;

  const host = hostOf(owner);
  if (!host) throw new Error('compat.ProgressBar: no hay contenedor disponible');
  if (host.style && !host.style.position) host.style.position = 'relative';

  const bar = h('div', { class: 'z-progress__bar' });
  const track = h('div', { class: 'z-progress__track' }, [bar]);
  const overlay = h('div', { class: 'z-progress__overlay' }, [track]);

  Object.assign(overlay.style, {
    position: 'absolute',
    inset: '0',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.35)',
    zIndex: '10',
  });
  Object.assign(track.style, {
    width: '60%',
    height: '8px',
    background: 'rgba(255, 255, 255, 0.4)',
    borderRadius: '999px',
    overflow: 'hidden',
  });
  Object.assign(bar.style, {
    width: '0%',
    height: '100%',
    background: '#2563eb',
    transition: 'width 120ms linear',
  });

  overlay.setAttribute('role', 'progressbar');
  overlay.setAttribute('aria-valuemin', '0');
  overlay.setAttribute('aria-valuemax', '100');
  overlay.setAttribute('aria-valuenow', '0');
  host.appendChild(overlay);

  state = { host, overlay, bar, value: 0 };
  states.set(owner, state);
  return state;
}

export const ProgressBar = {
  /** Muestra el overlay. */
  show() {
    const state = ensure(this);
    state.overlay.style.display = 'flex';
    return this;
  },

  /** Oculta el overlay sin destruirlo. */
  hide() {
    const state = states.get(this);
    if (state) state.overlay.style.display = 'none';
    return this;
  },

  /**
   * Fija el avance. Valores fuera de rango se recortan a 0..100.
   * @param {number} value
   * @returns {number} el valor aplicado
   */
  setValue(value) {
    const state = ensure(this);
    const next = clamp(value);
    state.value = next;
    state.bar.style.width = `${next}%`;
    state.overlay.setAttribute('aria-valuenow', String(next));
    return next;
  },

  /** @returns {number} avance actual */
  getValue() {
    const state = states.get(this);
    return state ? state.value : 0;
  },

  /** Quita el overlay del documento. */
  destroy() {
    const state = states.get(this);
    if (!state) return false;
    if (state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    states.delete(this);
    return true;
  },
};

export default ProgressBar;
