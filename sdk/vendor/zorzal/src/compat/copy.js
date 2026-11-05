/**
 * copy: copia profunda de datos planos.
 *
 * Clona arreglos, objetos planos y fechas, y conserva las referencias
 * repetidas dentro del mismo grafo. Las instancias de clases que no sean
 * `Date` se devuelven tal cual: no se inventan prototipos.
 */

/**
 * @template T
 * @param {T} value
 * @param {WeakMap<object, unknown>} [seen]
 * @returns {T}
 */
export function copy(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    for (const item of value) out.push(copy(item, seen));
    return out;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out = {};
  seen.set(value, out);
  for (const [key, item] of Object.entries(value)) out[key] = copy(item, seen);
  return out;
}

export default copy;
