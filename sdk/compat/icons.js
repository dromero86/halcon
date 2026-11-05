/**
 * Fachada de iconos de Halcon sobre el set SVG de Zorzal.
 *
 * Halcon guarda en su menu y en sus plugins nombres cortos ("bars", "cog",
 * "dashboard") o nombres heredados con prefijo (`fa-`, `wxi-`). Este modulo
 * concentra la traduccion a los nombres del servicio de iconos de Zorzal
 * (`sdk/vendor/zorzal/src/services/icons.js`), que dibuja trazos SVG sobre una
 * grilla de 24x24. No hay fuente de iconos: los iconos son paths y el color
 * sale de `currentColor`, asi que heredan el color del texto.
 *
 * Superficie:
 *
 *  - `resolveIconName(name)`: nombre del set de Zorzal que corresponde al
 *    nombre de Halcon. Un nombre desconocido resuelve al icono por defecto del
 *    set (`dot`), igual que el widget `icon` de Zorzal.
 *  - `renderIcon(name, options)`: elemento `svg` 24x24 con los paths del set.
 *  - `paintIcon(host, name, options)`: reemplaza el contenido de un nodo por el
 *    `svg` y deja el nombre original en `data-hc-icon`.
 *
 * El modulo no toca el DOM al importarse: se puede cargar desde Node para
 * verificar la tabla sin navegador. `renderIcon` recibe el documento en
 * `options.doc` (o usa `globalThis.document`).
 */

import {
  DEFAULT_ICON,
  STROKE_WIDTH,
  VIEW_BOX,
  getIcon,
  hasIcon,
  resolveIcon as resolveZorzalIcon,
} from '../vendor/zorzal/src/services/icons.js';

/** Namespace de los nodos SVG. */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Grilla del set de Zorzal. */
export { VIEW_BOX, STROKE_WIDTH, DEFAULT_ICON };

/**
 * Nombres propios de Halcon y su nombre en el set de Zorzal. La tabla es la
 * fuente de verdad del mapeo documentado en `sdk/compat/README.md` y la que
 * muestra el piloto.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const HALCON_ICON_NAMES = Object.freeze({
  dashboard: 'dashboard',
  bars: 'menu',
  'ellipsis-v': 'ellipsis-v',
  cog: 'cog',
  'power-off': 'power-off',
  ticket: 'ticket',
  'address-book': 'address-book',
  'shopping-bag': 'shopping-bag',
  'shopping-cart': 'shopping-cart',
  truck: 'truck',
  flag: 'flag',
  'chevron-left': 'chevron-left',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  question: 'question',
  'cloud-upload': 'cloud-upload',
  save: 'save',
  plus: 'plus',
  minus: 'minus',
  check: 'check',
  close: 'close',
  search: 'search',
  info: 'info',
  alert: 'alert',
  star: 'star',
  user: 'user',
  home: 'home',
  menu: 'menu',
  trash: 'trash',
  dot: 'dot',
});

/**
 * Nombres heredados que no son de Halcon pero llegan por pantallas viejas
 * (nombres con prefijo `fa-` y claves `wxi-` de Webix). Se traducen al icono
 * del set de Zorzal que dice lo mismo; los que no tienen equivalente caen al
 * icono por defecto.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const LEGACY_ICON_NAMES = Object.freeze({
  bars: 'menu',
  'floppy-o': 'save',
  'floppy-disk': 'save',
  times: 'close',
  remove: 'close',
  'trash-o': 'trash',
  'angle-down': 'chevron-down',
  'angle-up': 'chevron-up',
  'angle-left': 'chevron-left',
  'arrow-left': 'chevron-left',
  'arrow-down': 'chevron-down',
  'arrow-up': 'chevron-up',
  'menu-down': 'chevron-down',
  'menu-up': 'chevron-up',
  'plus-circle': 'plus',
  'minus-circle': 'minus',
  ok: 'check',
  'check-circle': 'check',
  'search-plus': 'search',
  cogs: 'cog',
  'question-circle': 'question',
  'info-circle': 'info',
  'exclamation-triangle': 'alert',
  'exclamation-circle': 'alert',
  'star-o': 'star',
  'user-o': 'user',
  'flag-o': 'flag',
});

/** @type {Set<string>} nombres ya avisados, para no repetir el warning. */
const warned = new Set();

/**
 * Normaliza el nombre recibido: recorta, pasa a minusculas y quita los
 * prefijos heredados de las pantallas viejas (el par `fa` + `fa-`, solo `fa-`
 * o `wxi-`).
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeName(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(?:fa|fas|far|fab)\s+fa-/, '')
    .replace(/^(?:fa-|wxi-)/, '');
}

/**
 * Nombre del set de Zorzal que corresponde al nombre de Halcon.
 *
 * @param {unknown} name
 * @returns {string}
 */
export function resolveIconName(name) {
  const key = normalizeName(name);
  if (key === '') return DEFAULT_ICON;

  const mapped = HALCON_ICON_NAMES[key] || LEGACY_ICON_NAMES[key];
  if (mapped !== undefined && hasIcon(mapped)) return resolveZorzalIcon(mapped);
  if (hasIcon(key)) return resolveZorzalIcon(key);

  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`[compat/icons] icono desconocido "${key}": se usa ${DEFAULT_ICON}`);
  }
  return DEFAULT_ICON;
}

/**
 * Indica si el nombre existe en el set, contando la tabla de Halcon y los
 * nombres heredados.
 *
 * @param {unknown} name
 * @returns {boolean}
 */
export function hasIconName(name) {
  const key = normalizeName(name);
  if (key === '') return false;
  const mapped = HALCON_ICON_NAMES[key] || LEGACY_ICON_NAMES[key];
  return hasIcon(mapped !== undefined ? mapped : key);
}

/**
 * Documento con el que se crean los nodos SVG.
 *
 * @param {{ doc?: Document, document?: Document }} [options]
 * @returns {Document|null}
 */
function resolveDocument(options = {}) {
  if (options.doc) return options.doc;
  if (options.document) return options.document;
  return typeof globalThis === 'undefined' ? null : globalThis.document || null;
}

/**
 * Crea un nodo SVG con el namespace correcto.
 *
 * @param {Document} doc
 * @param {string} name
 * @returns {Element}
 */
function svgNode(doc, name) {
  if (typeof doc.createElementNS === 'function') return doc.createElementNS(SVG_NS, name);
  return doc.createElement(name);
}

/**
 * Dibuja el icono como `svg` de 24x24 con los paths del servicio de Zorzal.
 * La forma coincide con el widget `icon` de Zorzal: `fill: none`,
 * `stroke: currentColor`, `stroke-width: 2` y extremos redondeados.
 *
 * El `svg` sale con `width`/`height` de 1em como tamano por defecto; la clase
 * `hc-icon` permite ajustarlo desde el CSS (por ejemplo dentro del mainbar).
 *
 * @param {unknown} name
 * @param {{ doc?: Document, document?: Document, className?: string, title?: string, label?: string }} [options]
 * @returns {Element}
 */
export function renderIcon(name, options = {}) {
  const doc = resolveDocument(options);
  if (!doc) throw new TypeError('renderIcon: hace falta un documento');

  const resolved = resolveIconName(name);
  const svg = svgNode(doc, 'svg');
  const classes = ['hc-icon', `hc-icon--${resolved}`];
  if (options.className) classes.push(String(options.className));
  svg.setAttribute('class', classes.join(' '));
  svg.setAttribute('viewBox', VIEW_BOX);
  svg.setAttribute('width', '1em');
  svg.setAttribute('height', '1em');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(STROKE_WIDTH));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('data-hc-icon', resolved);
  if (options.label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', String(options.label));
  } else {
    svg.setAttribute('role', 'presentation');
    svg.setAttribute('aria-hidden', 'true');
  }
  if (options.title) svg.setAttribute('title', String(options.title));

  for (const shape of getIcon(resolved)) {
    const path = svgNode(doc, 'path');
    path.setAttribute('d', shape.d);
    svg.appendChild(path);
  }
  return svg;
}

/**
 * Reemplaza el contenido de un nodo por el `svg` del icono. Se usa en el shim
 * para los spans de texto que generan los widgets de Zorzal (toolbar y
 * sidebar). El nombre original queda en `data-hc-icon` del contenedor.
 *
 * @param {Element} host
 * @param {unknown} name
 * @param {{ className?: string, title?: string }} [options]
 * @returns {Element|null} el `svg` creado, o null si no habia icono
 */
export function paintIcon(host, name, options = {}) {
  if (!host || typeof host.appendChild !== 'function') return null;
  if (normalizeName(name) === '') return null;
  const doc = host.ownerDocument || resolveDocument(options);
  if (!doc) return null;
  host.textContent = '';
  host.setAttribute('data-hc-icon', String(name));
  const svg = renderIcon(name, { ...options, doc, label: options.label });
  host.appendChild(svg);
  return svg;
}

export default { resolveIconName, renderIcon, paintIcon, hasIconName, HALCON_ICON_NAMES, LEGACY_ICON_NAMES };
