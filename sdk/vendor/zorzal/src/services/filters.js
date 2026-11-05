/**
 * filters: predicados de filtrado y combinacion con AND.
 *
 * Un predicado recibe el valor de la celda (y la fila completa como segundo
 * argumento) y devuelve `true` si la fila pasa. `apply()` combina un criterio
 * por columna y devuelve las filas que cumplen todos.
 *
 * Las fabricas con criterio vacio devuelven un predicado que acepta todo, de
 * modo que un filtro sin valores no altera la vista.
 */

import { date as dateService } from './date.js';

const EMPTY = [];

/** @param {unknown} value @returns {boolean} */
function isBlank(value) {
  return value === undefined || value === null || value === '';
}

/**
 * Texto normalizado para comparar: minusculas, sin acentos y sin espacios en
 * los extremos.
 * @param {unknown} value
 * @returns {string}
 */
function fold(value) {
  let text;
  if (value instanceof Date) text = dateService.format(value, 'YYYY-MM-DD');
  else if (value === undefined || value === null) text = '';
  else text = String(value);
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Valores de comparacion como cadenas. Un `Date` se compara por dia.
 * @param {unknown} value
 * @returns {string}
 */
function keyOf(value) {
  if (value instanceof Date) return dateService.format(value, 'YYYY-MM-DD');
  return String(value ?? '');
}

/**
 * Predicado de texto: contiene el valor, sin distinguir mayusculas ni
 * acentos.
 * @param {unknown} value
 * @returns {(cell: unknown, row?: unknown) => boolean}
 */
function text(value) {
  const needle = fold(value);
  if (needle === '') return () => true;
  return (cell) => fold(cell).includes(needle);
}

/**
 * Predicado numerico con extremos inclusivos. Un extremo `null`, `undefined`
 * o vacio queda abierto. Las celdas vacias o no numericas no pasan cuando hay
 * algun extremo declarado.
 * @param {unknown} [min]
 * @param {unknown} [max]
 * @returns {(cell: unknown, row?: unknown) => boolean}
 */
function number(min, max) {
  const hasMin = !isBlank(min);
  const hasMax = !isBlank(max);
  if (!hasMin && !hasMax) return () => true;
  const low = hasMin ? Number(min) : -Infinity;
  const high = hasMax ? Number(max) : Infinity;
  return (cell) => {
    if (isBlank(cell)) return false;
    const numeric = Number(cell);
    if (!Number.isFinite(numeric)) return false;
    return numeric >= low && numeric <= high;
  };
}

/**
 * Dia `YYYY-MM-DD` de un valor. Los textos con fecha inicial conservan su
 * dia tal cual (evita el corrimiento de zona horaria de `new Date`).
 * @param {unknown} value
 * @returns {string}
 */
function dayValue(value) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return dateService.format(dateService.toDate(value), 'YYYY-MM-DD');
}

/**
 * Predicado de fecha por dia, con extremos inclusivos. Acepta `Date`, texto
 * ISO o epoch; la comparacion usa `YYYY-MM-DD`.
 * @param {unknown} [from]
 * @param {unknown} [to]
 * @returns {(cell: unknown, row?: unknown) => boolean}
 */
function date(from, to) {
  const start = isBlank(from) ? null : dayValue(from) || null;
  const end = isBlank(to) ? null : dayValue(to) || null;
  if (!start && !end) return () => true;
  return (cell) => {
    const day = dayValue(cell);
    if (!day) return false;
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  };
}

/**
 * Predicado de igualdad contra uno o varios valores.
 * @param {unknown} value
 * @returns {(cell: unknown, row?: unknown) => boolean}
 */
function select(value) {
  const list =
    Array.isArray(value) ? value : isBlank(value) ? EMPTY : [value];
  const allowed = new Set(list.map((item) => keyOf(item)));
  if (allowed.size === 0) return () => true;
  return (cell) => allowed.has(keyOf(cell));
}

/**
 * Columnas permitidas de un criterio.
 * @param {unknown} columns
 * @returns {Set<string>|null}
 */
function columnSet(columns) {
  if (!Array.isArray(columns) || columns.length === 0) return null;
  const out = new Set();
  for (const column of columns) {
    if (column === null || column === undefined) continue;
    const id = typeof column === 'object' ? column.id : column;
    if (id !== undefined && id !== null) out.add(String(id));
  }
  return out.size ? out : null;
}

/**
 * Criterio normalizado: solo columnas con predicado.
 * @param {unknown} criteria
 * @returns {Record<string, (cell: unknown, row?: unknown) => boolean>}
 */
function normalizeCriteria(criteria) {
  const out = {};
  if (!criteria || typeof criteria !== 'object') return out;
  for (const [column, predicate] of Object.entries(criteria)) {
    if (typeof predicate === 'function') out[column] = predicate;
  }
  return out;
}

/**
 * Crea un filtro con criterios mutables y suscripcion a cambios.
 *
 * `onChange()` devuelve la funcion para desuscribirse.
 * @param {Record<string, (cell: unknown, row?: unknown) => boolean>} [initial]
 */
function create(initial = {}) {
  let criteria = normalizeCriteria(initial);
  const listeners = new Set();

  const notify = () => {
    for (const listener of [...listeners]) listener(api);
  };

  const api = {
    /** @returns {Record<string, Function>} copia de los criterios */
    get criteria() {
      return { ...criteria };
    },
    /** @returns {number} */
    get count() {
      return Object.keys(criteria).length;
    },
    /**
     * @param {string} column
     * @returns {boolean}
     */
    has(column) {
      return Object.prototype.hasOwnProperty.call(criteria, String(column));
    },
    /**
     * @param {string} column
     * @returns {Function|null}
     */
    get(column) {
      return criteria[String(column)] || null;
    },
    /**
     * Agrega o reemplaza el criterio de una columna.
     * @param {string} column
     * @param {(cell: unknown, row?: unknown) => boolean} predicate
     * @returns {object}
     */
    set(column, predicate) {
      const id = String(column);
      if (typeof predicate !== 'function') delete criteria[id];
      else criteria[id] = predicate;
      notify();
      return api;
    },
    /**
     * Reemplaza todos los criterios.
     * @param {unknown} next
     * @returns {object}
     */
    setCriteria(next) {
      criteria = normalizeCriteria(next);
      notify();
      return api;
    },
    /**
     * Quita el criterio de una columna.
     * @param {string} column
     * @returns {object}
     */
    remove(column) {
      return api.set(column, null);
    },
    /** @returns {object} */
    clear() {
      return api.setCriteria({});
    },
    /**
     * Evalua la fila contra todos los criterios.
     * @param {unknown} row
     * @param {unknown} [columns] columnas a considerar
     * @returns {boolean}
     */
    matches(row, columns) {
      const keys = Object.keys(criteria);
      if (keys.length === 0) return true;
      const allowed = columnSet(columns);
      for (const key of keys) {
        if (allowed && !allowed.has(key)) continue;
        const cell =
          row && typeof row === 'object' && !Array.isArray(row) ? row[key] : row;
        if (!criteria[key](cell, row)) return false;
      }
      return true;
    },
    /**
     * Filtra una lista de filas.
     * @param {unknown[]} rows
     * @param {unknown} [columns]
     * @returns {unknown[]}
     */
    apply(rows, columns) {
      const list = Array.isArray(rows) ? rows : EMPTY;
      return list.filter((row) => api.matches(row, columns));
    },
    /**
     * Se suscribe a los cambios de criterio.
     * @param {(filter: object) => void} listener
     * @returns {() => void} desuscripcion
     */
    onChange(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /**
     * @param {Function} listener
     * @returns {object}
     */
    offChange(listener) {
      listeners.delete(listener);
      return api;
    },
  };
  return api;
}

/**
 * Adapta el valor recibido por un widget a la interfaz de filtro.
 *
 * Acepta una instancia de `create()`, un objeto de criterios o una funcion
 * `(row) => boolean`. `null`/`undefined` devuelve `null` (sin filtro).
 * @param {unknown} value
 * @returns {{ criteria: object, matches: Function, apply: Function, onChange?: Function }|null}
 */
function resolve(value) {
  if (value === null || value === undefined || value === false) return null;
  if (typeof value === 'object' && typeof value.matches === 'function') return value;
  if (typeof value === 'function') {
    return {
      criteria: {},
      matches: (row) => Boolean(value(row)),
      apply: (rows) => (Array.isArray(rows) ? rows : EMPTY).filter((row) => Boolean(value(row))),
      onChange: () => () => {},
      offChange: () => {},
    };
  }
  if (typeof value === 'object') return create(value);
  return null;
}

/**
 * Filtra filas con un criterio por columna (AND).
 * @param {unknown[]} rows
 * @param {unknown} criteria
 * @param {unknown} [columns] columnas a considerar
 * @returns {unknown[]}
 */
function apply(rows, criteria, columns) {
  const list = Array.isArray(rows) ? rows : EMPTY;
  const filter = resolve(criteria);
  if (!filter) return list.slice();
  return list.filter((row) => filter.matches(row, columns));
}

export const filters = {
  text,
  number,
  date,
  select,
  create,
  resolve,
  apply,
};

export default filters;
