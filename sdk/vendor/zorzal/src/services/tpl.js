/**
 * tpl: interpolacion de plantillas con escape de HTML.
 *
 * Solo interpola `{{ clave }}`; el valor se escapa siempre. Para contenido que
 * ya es HTML (por ejemplo, un fragmento generado por otro widget) no se usa
 * tpl: se pasa el nodo directamente a un slot.
 */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

/**
 * Escapa los caracteres con significado en HTML.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[&<>"'`]/g, (char) => ESCAPES[char]);
}

/**
 * Busca una clave con notacion de punto (`user.name`).
 * @param {unknown} data
 * @param {string} path
 */
function lookup(data, path) {
  if (data === undefined || data === null) return undefined;
  let current = data;
  for (const part of path.split('.')) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Interpola `{{ clave }}` escapando cada valor.
 *
 * @param {string} template
 * @param {Record<string, unknown>} [data]
 * @returns {string}
 */
export function tpl(template, data = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{\{\s*([\w.$-]+)\s*\}\}/g, (_, key) => escapeHtml(lookup(data, key)));
}

tpl.escape = escapeHtml;
tpl.lookup = lookup;

export default tpl;
