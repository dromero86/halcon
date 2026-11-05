/**
 * Capa minima de DOM.
 *
 * El core no toca `document` de forma directa: pide el documento activo a este
 * modulo. En el navegador se usa `globalThis.document`; en otros entornos
 * (tests con `node:test`, render fuera del navegador) se inyecta un documento
 * compatible con `setDocument()`.
 */

let injected = null;

/**
 * Inyecta el documento que usara el core.
 * @param {Document|null} doc
 */
export function setDocument(doc) {
  injected = doc || null;
}

/**
 * Devuelve el documento activo.
 * @returns {Document}
 */
export function getDocument() {
  const doc = injected || globalThis.document;
  if (!doc || typeof doc.createElement !== 'function') {
    throw new Error(
      'zorzal: no hay documento disponible. En un entorno sin DOM llamar a setDocument(documento).'
    );
  }
  return doc;
}

/** @returns {boolean} */
export function hasDocument() {
  return Boolean(injected || globalThis.document);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNode(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.nodeType === 'number';
}

/**
 * Crea un elemento con atributos e hijos.
 * Los atributos `on*` no se aceptan: los listeners se registran con `ctx.on`
 * para que el widget pueda quitarlos en `destroy()`.
 *
 * @param {string} tag
 * @param {Record<string, unknown>} [attrs]
 * @param {unknown} [children]
 * @returns {Element}
 */
export function h(tag, attrs = {}, children = []) {
  const doc = getDocument();
  const el = doc.createElement(tag);
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

/**
 * @param {Element} el
 * @param {Record<string, unknown>} attrs
 */
function applyAttrs(el, attrs) {
  if (!attrs) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class' || key === 'className') {
      const list = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
      el.setAttribute('class', list);
      continue;
    }
    if (key === 'text') {
      el.textContent = String(value);
      continue;
    }
    if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
      continue;
    }
    if (key === 'dataset' && typeof value === 'object') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        el.setAttribute(`data-${dataKey}`, String(dataValue));
      }
      continue;
    }
    if (key === 'value') {
      el.value = value;
      el.setAttribute('value', String(value));
      continue;
    }
    if (key === 'checked' || key === 'selected') {
      el[key] = Boolean(value);
      if (value) el.setAttribute(key, '');
      continue;
    }
    if (key.startsWith('on') && typeof value === 'function') {
      throw new Error(
        `zorzal: h() no acepta el handler "${key}"; registrar el listener con ctx.on()`
      );
    }
    if (value === true) {
      el.setAttribute(key, '');
      continue;
    }
    el.setAttribute(key, String(value));
  }
}

/**
 * Agrega un nodo, un string o una lista de nodos a un contenedor.
 * @param {Node} host
 * @param {unknown} children
 * @returns {Node}
 */
export function append(host, children) {
  if (children === undefined || children === null || children === false) return host;
  if (Array.isArray(children)) {
    for (const child of children) append(host, child);
    return host;
  }
  if (isNode(children)) {
    host.appendChild(children);
    return host;
  }
  host.appendChild(getDocument().createTextNode(String(children)));
  return host;
}

/**
 * Vacía un contenedor.
 * @param {Node} host
 */
export function clear(host) {
  while (host.firstChild) host.removeChild(host.firstChild);
}

/**
 * Une clases ignorando valores falsos.
 * @param {...unknown} names
 * @returns {string}
 */
export function cls(...names) {
  return names.filter(Boolean).join(' ');
}
