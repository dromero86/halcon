/**
 * Touch: deteccion de pantalla tactil y gestos de deslizamiento.
 *
 * `onSwipe` usa touchstart/touchend, compara el desplazamiento horizontal
 * contra un umbral y avisa solo si el gesto es claramente horizontal.
 */

const DEFAULT_THRESHOLD = 30;

/**
 * Punto del evento: usa el primer toque si existe y cae a clientX/clientY.
 * @param {any} event
 * @returns {{ x: number, y: number }|null}
 */
function pointOf(event) {
  if (!event) return null;
  const list = event.changedTouches || event.touches;
  const touch = list && list[0] ? list[0] : null;
  const source = touch || event;
  const x = Number(source.clientX !== undefined ? source.clientX : source.pageX);
  const y = Number(source.clientY !== undefined ? source.clientY : source.pageY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export const Touch = {
  /**
   * @param {any} [scope] scope con `window`/`navigator`; por defecto el global
   * @returns {boolean}
   */
  hasTouch(scope = globalThis) {
    if (!scope) return false;
    const win = scope.window || scope;
    if (win && typeof win === 'object' && 'ontouchstart' in win) return true;
    const nav = scope.navigator || null;
    return Number(nav && nav.maxTouchPoints) > 0;
  },

  /**
   * Escucha deslizamientos horizontales sobre un elemento.
   *
   * El handler recibe `{ direction, dx, dy, event }`, con `direction`
   * `'left'` o `'right'`. Devuelve una funcion para quitar los listeners.
   *
   * @param {EventTarget} element
   * @param {(detail: { direction: 'left'|'right', dx: number, dy: number, event: any }) => void} handler
   * @param {{ threshold?: number }} [options]
   * @returns {() => void}
   */
  onSwipe(element, handler, options = {}) {
    if (!element || typeof element.addEventListener !== 'function') {
      throw new TypeError('compat.Touch.onSwipe: se espera un EventTarget');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('compat.Touch.onSwipe: el handler debe ser una funcion');
    }
    const threshold = Number.isFinite(Number(options.threshold))
      ? Number(options.threshold)
      : DEFAULT_THRESHOLD;
    let start = null;

    const begin = (event) => {
      const point = pointOf(event);
      if (point) start = point;
    };
    const end = (event) => {
      if (!start) return;
      const point = pointOf(event);
      const origin = start;
      start = null;
      if (!point) return;
      const dx = point.x - origin.x;
      const dy = point.y - origin.y;
      if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return;
      handler({ direction: dx < 0 ? 'left' : 'right', dx, dy, event });
    };

    element.addEventListener('touchstart', begin);
    element.addEventListener('touchend', end);
    return function off() {
      element.removeEventListener('touchstart', begin);
      element.removeEventListener('touchend', end);
    };
  },
};

export default Touch;
