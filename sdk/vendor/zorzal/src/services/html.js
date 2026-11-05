/**
 * html: helpers de marcado sobre el documento inyectable.
 *
 * `create` delega en `h()` (misma semantica de atributos e hijos) y agrega los
 * listeners `on*` que `h()` rechaza por diseno. Los helpers de clases ignoran
 * elementos nulos y aceptan varios nombres separados por espacios.
 */

import { h } from '../core/dom.js';
import { escapeHtml } from './tpl.js';

/**
 * @param {Element|null|undefined} el
 * @param {string} name
 * @returns {string[]}
 */
function names(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escape(value) {
  return escapeHtml(value);
}

/**
 * Crea un elemento. Los atributos `on*` se registran como listeners.
 *
 * @param {string} tag
 * @param {Record<string, unknown>} [attrs]
 * @param {unknown} [children]
 * @returns {Element}
 */
export function create(tag, attrs = {}, children = []) {
  const plain = {};
  const listeners = [];
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key.startsWith('on') && typeof value === 'function') {
      listeners.push([key.slice(2).toLowerCase(), value]);
      continue;
    }
    plain[key] = value;
  }
  const el = h(tag, plain, children);
  for (const [type, handler] of listeners) el.addEventListener(type, handler);
  return el;
}

/**
 * @param {Element|null|undefined} el
 * @param {...string} classNames
 * @returns {Element|null|undefined}
 */
export function addClass(el, ...classNames) {
  if (!el || !el.classList) return el;
  for (const name of classNames) {
    for (const token of names(name)) el.classList.add(token);
  }
  return el;
}

/**
 * @param {Element|null|undefined} el
 * @param {...string} classNames
 * @returns {Element|null|undefined}
 */
export function removeClass(el, ...classNames) {
  if (!el || !el.classList) return el;
  for (const name of classNames) {
    for (const token of names(name)) el.classList.remove(token);
  }
  return el;
}

/**
 * @param {Element|null|undefined} el
 * @param {string} name
 * @param {boolean} [force]
 * @returns {boolean}
 */
export function toggleClass(el, name, force) {
  const token = names(name)[0];
  if (!el || !el.classList || !token) return false;
  return el.classList.toggle(token, force);
}

/**
 * Posicion del elemento respecto del documento.
 *
 * Usa `getBoundingClientRect()` sumando el scroll cuando existe; si no,
 * acumula `offsetTop`/`offsetLeft` por la cadena de `offsetParent`.
 *
 * @param {Element|null|undefined} el
 * @returns {{ top: number, left: number, width: number, height: number }}
 */
export function offset(el) {
  if (!el) return { top: 0, left: 0, width: 0, height: 0 };
  if (typeof el.getBoundingClientRect === 'function') {
    const rect = el.getBoundingClientRect();
    const win = globalThis.window;
    const scrollTop = Number(win?.pageYOffset ?? win?.scrollY) || 0;
    const scrollLeft = Number(win?.pageXOffset ?? win?.scrollX) || 0;
    return {
      top: rect.top + scrollTop,
      left: rect.left + scrollLeft,
      width: rect.width,
      height: rect.height,
    };
  }
  let top = 0;
  let left = 0;
  let node = el;
  while (node) {
    top += Number(node.offsetTop) || 0;
    left += Number(node.offsetLeft) || 0;
    node = node.offsetParent || null;
  }
  return { top, left, width: Number(el.offsetWidth) || 0, height: Number(el.offsetHeight) || 0 };
}

export const html = { escape, create, addClass, removeClass, toggleClass, offset };

export default html;
