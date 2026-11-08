/**
 * Iconos de Halcon resueltos con el servicio `icons` de Zorzal.
 *
 * No hay fuente de iconos ni tabla de equivalencias con Font Awesome: el
 * nombre se resuelve contra el set de Zorzal
 * (`sdk/vendor/zorzal/zorzal-0.1.0.min.js`), que dibuja trazos SVG sobre una
 * grilla de 24x24 con `stroke: currentColor`. Los alias del set (`bars` ->
 * `menu`) y el icono por defecto (`dot`) son los de Zorzal.
 *
 * Superficie:
 *
 *  - `resolveIconName(name)`: nombre del set que corresponde al pedido.
 *  - `renderIcon(name, options)`: nodo `svg` 24x24 con los paths del set.
 *  - `paintIcon(host, name, options)`: reemplaza el contenido de un nodo por el
 *    `svg` y deja el nombre original en `data-hc-icon`.
 *  - `paintIconSpans(root)`: pinta los spans de icono que generan las toolbars
 *    y el sidebar de Zorzal, que solo aceptan texto en sus items.
 *
 * El modulo no toca el DOM al importarse: se puede cargar desde Node para
 * verificar la resolucion de nombres sin navegador. `renderIcon` recibe el
 * documento en `options.doc` (o usa `globalThis.document`).
 */

import { icons } from '../vendor/zorzal/zorzal-0.1.0.min.js';

/** Grilla y grosor del set, publicados por el namespace `icons`. */
const { STROKE_WIDTH, VIEW_BOX } = icons;

/** Namespace de los nodos SVG. */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Grilla y grosor del set de Zorzal. */
export { VIEW_BOX, STROKE_WIDTH };

/** Spans de texto que los widgets de Zorzal usan para el icono. */
export const ICON_SPAN_SELECTOR = '.z-toolbar__icon, .z-sidebar__icon';

/**
 * Nombre del set de Zorzal que corresponde al nombre pedido. Un nombre que no
 * existe resuelve al icono por defecto del set.
 *
 * @param {unknown} name
 * @returns {string}
 */
export function resolveIconName(name) {
  return icons.resolveIcon(name);
}

/**
 * Indica si el nombre existe en el set (incluidos sus alias).
 *
 * @param {unknown} name
 * @returns {boolean}
 */
export function hasIconName(name) {
  return icons.hasIcon(name);
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
 * Dibuja el icono como `svg` de 24x24 con los paths del set de Zorzal. La
 * forma coincide con el widget `icon` de Zorzal: `fill: none`,
 * `stroke: currentColor`, `stroke-width` 2 y extremos redondeados.
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

  for (const shape of icons.getIcon(resolved)) {
    const path = svgNode(doc, 'path');
    path.setAttribute('d', shape.d);
    svg.appendChild(path);
  }
  return svg;
}

/**
 * Reemplaza el contenido de un nodo por el `svg` del icono. El nombre original
 * queda en `data-hc-icon` del contenedor.
 *
 * @param {Element} host
 * @param {unknown} name
 * @param {{ className?: string, title?: string, label?: string }} [options]
 * @returns {Element|null} el `svg` creado, o null si no habia icono
 */
export function paintIcon(host, name, options = {}) {
  if (!host || typeof host.appendChild !== 'function') return null;
  if (name === undefined || name === null || String(name).trim() === '') return null;
  const doc = host.ownerDocument || resolveDocument(options);
  if (!doc) return null;
  host.textContent = '';
  host.setAttribute('data-hc-icon', String(name));
  const svg = renderIcon(name, { ...options, doc, label: options.label });
  host.appendChild(svg);
  return svg;
}

/**
 * Pinta los spans de icono de las toolbars y del sidebar. Los widgets de
 * Zorzal los generan con el nombre del icono como texto, porque sus items solo
 * aceptan texto.
 *
 * @param {Element|null} root
 * @param {string} [selector]
 */
export function paintIconSpans(root, selector = ICON_SPAN_SELECTOR) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  for (const span of root.querySelectorAll(selector)) {
    if (span.querySelector('svg')) continue;
    const name = span.getAttribute('data-hc-icon') || span.textContent.trim();
    if (name === '') continue;
    paintIcon(span, name);
  }
}

export default { resolveIconName, hasIconName, renderIcon, paintIcon, paintIconSpans };
