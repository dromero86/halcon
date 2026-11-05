/**
 * message: avisos efimeros sobre el servicio `toast`.
 *
 * Acepta un texto o un objeto `{ text, type, expire }`. Devuelve el handle
 * del aviso (`{ el, close }`) y lleva un registro para `hideAll()`.
 */

import { toast } from '../services/toast.js';

const open = new Set();

const KINDS = {
  error: 'error',
  warning: 'warn',
  warn: 'warn',
  success: 'ok',
  ok: 'ok',
  info: 'info',
  debug: 'info',
};

/**
 * @param {unknown} input
 * @param {Record<string, unknown>} [options]
 * @returns {{ el: Element, close: () => void }}
 */
export function message(input, options = {}) {
  const config =
    typeof input === 'string' || typeof input === 'number'
      ? { text: String(input), ...(options || {}) }
      : { ...(input || {}) };

  let duration;
  if (config.expire !== undefined) {
    const value = Number(config.expire);
    duration = Number.isFinite(value) ? Math.max(0, value) : 0;
  } else if (config.duration !== undefined) {
    const value = Number(config.duration);
    duration = Number.isFinite(value) ? Math.max(0, value) : undefined;
  }

  const handle = toast(config.text !== undefined ? config.text : config.message || '', {
    duration,
    kind: KINDS[config.type] || 'info',
    mount: config.mount,
  });

  const close = handle.close;
  open.add(handle);
  handle.close = () => {
    open.delete(handle);
    close();
  };
  return handle;
}

/** Cierra todos los avisos abiertos. */
message.hideAll = () => {
  for (const handle of [...open]) handle.close();
};

export default message;
