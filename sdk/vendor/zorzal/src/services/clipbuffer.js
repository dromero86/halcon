/**
 * clipbuffer: copiar y leer texto con respaldo en memoria.
 *
 * `set(text)` guarda el texto y lo escribe en `navigator.clipboard`; si no
 * esta disponible (o falla), usa un textarea oculto con `execCommand('copy')`.
 * `get()` devuelve lo ultimo guardado y, cuando el portapapeles expone
 * `readText`, intenta leerlo primero.
 */

import { getDocument } from '../core/dom.js';

let buffer = '';

/** @returns {any} */
function currentNavigator() {
  return globalThis.navigator || null;
}

/** @returns {Document|null} */
function currentDoc() {
  try {
    return getDocument();
  } catch {
    return null;
  }
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function legacyCopy(text) {
  const doc = currentDoc();
  if (!doc || typeof doc.execCommand !== 'function' || !doc.body) return false;
  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  if (area.style) {
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
  }
  doc.body.appendChild(area);
  try {
    if (typeof area.select === 'function') area.select();
    if (typeof area.focus === 'function') area.focus();
    return Boolean(doc.execCommand('copy'));
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

export const clipbuffer = {
  /**
   * @param {unknown} text
   * @returns {Promise<boolean>}
   */
  async set(text) {
    buffer = text === undefined || text === null ? '' : String(text);
    const nav = currentNavigator();
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      try {
        await nav.clipboard.writeText(buffer);
        return true;
      } catch {
        // sin permiso o fuera de contexto seguro: se intenta el respaldo
      }
    }
    return legacyCopy(buffer);
  },

  /**
   * @returns {Promise<string>}
   */
  async get() {
    const nav = currentNavigator();
    if (nav && nav.clipboard && typeof nav.clipboard.readText === 'function') {
      try {
        const value = await nav.clipboard.readText();
        if (typeof value === 'string' && value !== '') buffer = value;
      } catch {
        // se devuelve el buffer conocido
      }
    }
    return buffer;
  },
};

export default clipbuffer;
