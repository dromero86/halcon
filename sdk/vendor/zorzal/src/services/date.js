/**
 * date: formateo y parseo con patrones, sin dependencias.
 *
 * Tokens: YYYY, MM, DD, HH, mm, ss, SSS. El parseo devuelve `null` cuando el
 * texto no corresponde al patron o la fecha no existe (por ejemplo 31/02).
 */

const TOKENS = ['YYYY', 'SSS', 'MM', 'DD', 'HH', 'mm', 'ss'];

/** @param {number} value @param {number} [size] */
function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}

/**
 * @param {Date|number|string|null|undefined} value
 * @returns {Date|null}
 */
export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {Date|number|string|null|undefined} value
 * @param {string} [pattern]
 * @returns {string} cadena vacia si la fecha es invalida
 */
export function format(value, pattern = 'YYYY-MM-DD') {
  const date = toDate(value);
  if (!date) return '';
  const parts = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    SSS: pad(date.getMilliseconds(), 3),
  };
  return String(pattern).replace(/YYYY|SSS|MM|DD|HH|mm|ss/g, (token) => parts[token]);
}

/** @param {string} char */
function escapeRegExp(char) {
  return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parsea un texto.
 *
 * - Sin patron delega en `new Date(value)` (ISO y formatos nativos).
 * - Con patron arma la expresion a partir de los tokens y valida que la fecha
 *   exista (rechaza dias fuera de mes).
 *
 * @param {string} value
 * @param {string} [pattern]
 * @returns {Date|null}
 */
export function parse(value, pattern) {
  if (value === null || value === undefined || value === '') return null;
  if (!pattern) return toDate(value);

  const order = [];
  let source = '^';
  let index = 0;
  while (index < pattern.length) {
    const token = TOKENS.find((candidate) => pattern.startsWith(candidate, index));
    if (token) {
      order.push(token);
      source += token === 'YYYY' ? '(\\d{4})' : token === 'SSS' ? '(\\d{3})' : '(\\d{1,2})';
      index += token.length;
    } else {
      source += escapeRegExp(pattern[index]);
      index += 1;
    }
  }
  source += '$';

  const match = String(value).match(new RegExp(source));
  if (!match) return null;

  const parts = {};
  order.forEach((token, position) => {
    parts[token] = Number(match[position + 1]);
  });

  const date = new Date(
    parts.YYYY === undefined ? 1970 : parts.YYYY,
    (parts.MM === undefined ? 1 : parts.MM) - 1,
    parts.DD === undefined ? 1 : parts.DD,
    parts.HH === undefined ? 0 : parts.HH,
    parts.mm === undefined ? 0 : parts.mm,
    parts.ss === undefined ? 0 : parts.ss,
    parts.SSS === undefined ? 0 : parts.SSS
  );

  if (parts.MM !== undefined && date.getMonth() !== parts.MM - 1) return null;
  if (parts.DD !== undefined && date.getDate() !== parts.DD) return null;
  if (parts.HH !== undefined && date.getHours() !== parts.HH) return null;
  if (parts.mm !== undefined && date.getMinutes() !== parts.mm) return null;
  if (parts.ss !== undefined && date.getSeconds() !== parts.ss) return null;
  return date;
}

/** @returns {Date} */
export function now() {
  return new Date();
}

/**
 * @param {Date|number|string} value
 * @param {string} [pattern]
 * @returns {boolean}
 */
export function isValid(value, pattern) {
  if (pattern) return parse(bodyOf(value), pattern) !== null;
  return toDate(value) !== null;
}

/** @param {unknown} value */
function bodyOf(value) {
  return typeof value === 'string' ? value : format(toDate(value), 'YYYY-MM-DD');
}

export const date = { format, parse, toDate, now, isValid };

export default date;
