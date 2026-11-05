/**
 * Fachada de fechas sobre el servicio `date` de Zorzal.
 *
 * El formateo y el parseo son los del servicio; las operaciones de calendario
 * (`add`, `equal`, `datePart`, `timePart`, inicio y fin de mes/anio) se
 * resuelven con `Date` nativo y devuelven siempre una fecha nueva.
 */

import { date as dateService } from '../services/date.js';

/** @param {unknown} value */
function asDate(value) {
  return dateService.toDate(value);
}

/**
 * @param {Date} date
 * @param {number} amount
 * @param {string} unit
 * @returns {Date}
 */
function shift(date, amount, unit) {
  const next = new Date(date.getTime());
  switch (unit) {
    case 'year':
      next.setFullYear(next.getFullYear() + amount);
      break;
    case 'month':
      next.setMonth(next.getMonth() + amount);
      break;
    case 'week':
      next.setDate(next.getDate() + amount * 7);
      break;
    case 'day':
      next.setDate(next.getDate() + amount);
      break;
    case 'hour':
      next.setHours(next.getHours() + amount);
      break;
    case 'minute':
      next.setMinutes(next.getMinutes() + amount);
      break;
    case 'second':
      next.setSeconds(next.getSeconds() + amount);
      break;
    case 'millisecond':
      next.setMilliseconds(next.getMilliseconds() + amount);
      break;
    default:
      throw new Error(`compat.Date.add: unidad desconocida "${unit}"`);
  }
  return next;
}

/**
 * @param {unknown} value
 * @returns {Date|null}
 */
function datePart(value) {
  const date = asDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * @param {unknown} value
 * @returns {Date|null}
 */
function timePart(value) {
  const date = asDate(value);
  if (!date) return null;
  return new Date(1970, 0, 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

export const compatDate = {
  format: dateService.format,
  parse: dateService.parse,
  toDate: dateService.toDate,
  now: dateService.now,
  isValid: dateService.isValid,

  /**
   * @param {unknown} value
   * @param {number} amount
   * @param {string} [unit]
   * @returns {Date|null}
   */
  add(value, amount, unit = 'day') {
    const date = asDate(value);
    if (!date) return null;
    const numeric = Number(amount);
    return shift(date, Number.isFinite(numeric) ? numeric : 0, unit);
  },

  /**
   * Compara dos fechas. Sin unidad compara el instante; con unidad compara
   * solo esa parte.
   * @param {unknown} left
   * @param {unknown} right
   * @param {'year'|'month'|'day'|'hour'|'minute'|'second'} [unit]
   * @returns {boolean}
   */
  equal(left, right, unit) {
    const a = asDate(left);
    const b = asDate(right);
    if (!a || !b) return false;
    if (!unit) return a.getTime() === b.getTime();
    if (unit === 'year') return a.getFullYear() === b.getFullYear();
    if (unit === 'month') {
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
    }
    if (unit === 'day') {
      return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
      );
    }
    if (unit === 'hour') {
      return datePart(a).getTime() === datePart(b).getTime() && a.getHours() === b.getHours();
    }
    if (unit === 'minute') {
      return (
        datePart(a).getTime() === datePart(b).getTime() &&
        a.getHours() === b.getHours() &&
        a.getMinutes() === b.getMinutes()
      );
    }
    if (unit === 'second') {
      return (
        datePart(a).getTime() === datePart(b).getTime() &&
        a.getHours() === b.getHours() &&
        a.getMinutes() === b.getMinutes() &&
        a.getSeconds() === b.getSeconds()
      );
    }
    return false;
  },

  datePart,
  timePart,

  /** @param {unknown} value @returns {Date|null} */
  copy(value) {
    const date = asDate(value);
    return date ? new Date(date.getTime()) : null;
  },

  /** @param {unknown} value @returns {Date|null} */
  dayStart(value) {
    return datePart(value);
  },

  /** @param {unknown} value @returns {Date|null} */
  monthStart(value) {
    const date = asDate(value);
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), 1);
  },

  /** @param {unknown} value @returns {Date|null} */
  monthEnd(value) {
    const date = asDate(value);
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  },

  /** @param {unknown} value @returns {Date|null} */
  yearStart(value) {
    const date = asDate(value);
    if (!date) return null;
    return new Date(date.getFullYear(), 0, 1);
  },

  /** @param {unknown} value @returns {Date|null} */
  yearEnd(value) {
    const date = asDate(value);
    if (!date) return null;
    return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
  },

  /**
   * @param {string} pattern
   * @returns {(value: unknown) => string}
   */
  dateToStr(pattern) {
    return (value) => dateService.format(value, pattern);
  },

  /**
   * @param {string} pattern
   * @returns {(text: string) => Date|null}
   */
  strToDate(pattern) {
    return (text) => dateService.parse(text, pattern);
  },
};

export default compatDate;
