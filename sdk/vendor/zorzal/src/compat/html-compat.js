/**
 * Fachada de helpers de marcado sobre el servicio `html` de Zorzal.
 *
 * Agrega los nombres historicos (`addCss`, `removeCss`, `pos`) como alias de
 * las mismas funciones, sin reimplementar nada.
 */

import { html } from '../services/html.js';

/**
 * @param {Node} node
 * @param {Node} reference
 * @returns {Node}
 */
function insertBefore(node, reference) {
  if (!node) throw new TypeError('compat.html.insertBefore: falta el nodo');
  if (reference && reference.parentNode) reference.parentNode.insertBefore(node, reference);
  return node;
}

/**
 * @param {Node} node
 * @returns {Node}
 */
function remove(node) {
  if (node && node.parentNode) node.parentNode.removeChild(node);
  return node;
}

export const compatHtml = {
  ...html,
  addCss: html.addClass,
  removeCss: html.removeClass,
  toggleCss: html.toggleClass,
  pos: html.offset,
  insertBefore,
  remove,
};

export default compatHtml;
