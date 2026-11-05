/**
 * extend: mezcla superficial de configuracion.
 *
 * No muta `source`: solo lee sus claves propias enumerables. Con
 * `overwrite` en false (default) las claves ya presentes en `target` se
 * conservan; con true se reemplazan.
 */

/**
 * @template T
 * @param {T} target
 * @param {Record<string, unknown>} source
 * @param {boolean} [overwrite]
 * @returns {T}
 */
export function extend(target, source, overwrite = false) {
  if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
    throw new TypeError('compat.extend: el target debe ser un objeto');
  }
  if (!source || typeof source !== 'object') return target;
  for (const [key, value] of Object.entries(source)) {
    if (overwrite || !(key in target)) target[key] = value;
  }
  return target;
}

export default extend;
