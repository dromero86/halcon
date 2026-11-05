/**
 * i18n: diccionarios por locale e interpolacion simple.
 *
 * `t(clave, params)` busca la clave en el locale activo, luego en el locale de
 * respaldo y, si no aparece, devuelve la clave tal como se pidio. Los
 * marcadores `{nombre}` se reemplazan con `params.nombre`; si falta el dato se
 * conserva el marcador.
 */

const dicts = new Map();

let current = 'es';
let fallback = 'es';

/** @param {string} locale */
function normalize(locale) {
  return String(locale || '').trim();
}

/**
 * Agrega o mezcla un diccionario para un locale.
 *
 * @param {string} locale
 * @param {Record<string, unknown>} dict
 * @returns {Record<string, unknown>} diccionario resultante
 */
export function add(locale, dict) {
  const name = normalize(locale);
  if (!name) throw new Error('zorzal.i18n: locale vacio');
  if (!dict || typeof dict !== 'object') throw new Error('zorzal.i18n: diccionario invalido');
  const target = dicts.get(name) || {};
  for (const [key, value] of Object.entries(dict)) target[key] = value;
  dicts.set(name, target);
  return target;
}

/**
 * Activa un locale. No exige que el diccionario exista: las claves caen al
 * respaldo y luego a la propia clave.
 *
 * @param {string} locale
 * @returns {string} locale activo
 */
export function setLocale(locale) {
  const name = normalize(locale);
  if (!name) throw new Error('zorzal.i18n: locale vacio');
  current = name;
  return current;
}

/** @returns {string} */
export function getLocale() {
  return current;
}

/**
 * @param {string} [locale]
 * @returns {string} locale de respaldo
 */
export function setFallback(locale) {
  const name = normalize(locale);
  if (!name) throw new Error('zorzal.i18n: locale vacio');
  fallback = name;
  return fallback;
}

/** @returns {string} */
export function getFallback() {
  return fallback;
}

/** @param {string} key */
function lookup(locale, key) {
  const dict = dicts.get(locale);
  if (!dict) return undefined;
  if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  if (!key.includes('.')) return undefined;
  let node = dict;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, part)) {
      return undefined;
    }
    node = node[part];
  }
  return node;
}

/**
 * @param {unknown} value
 * @param {Record<string, unknown>} [params]
 */
function interpolate(value, params) {
  return String(value).replace(/\{(\w+)\}/g, (match, name) => {
    if (!params || !Object.prototype.hasOwnProperty.call(params, name)) return match;
    return String(params[name]);
  });
}

/**
 * Traduce una clave con interpolacion `{nombre}`.
 *
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function t(key, params) {
  const name = String(key);
  const value = lookup(current, name);
  if (value !== undefined && value !== null) return interpolate(value, params);
  if (fallback !== current) {
    const backed = lookup(fallback, name);
    if (backed !== undefined && backed !== null) return interpolate(backed, params);
  }
  return name;
}

/**
 * @param {string} key
 * @param {string} [locale]
 * @returns {boolean}
 */
export function has(key, locale = current) {
  return lookup(locale, String(key)) !== undefined;
}

/** @returns {string[]} locales registrados */
export function locales() {
  return [...dicts.keys()];
}

/**
 * Vuelve al estado inicial: sin diccionarios, locale `es`.
 */
export function reset() {
  dicts.clear();
  current = 'es';
  fallback = 'es';
}

export const i18n = {
  add,
  setLocale,
  getLocale,
  setFallback,
  getFallback,
  t,
  has,
  locales,
  reset,
};

export default i18n;
