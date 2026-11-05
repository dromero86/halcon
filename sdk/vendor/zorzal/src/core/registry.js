/**
 * Registro de tipos de widget.
 *
 * Un tipo es un nombre (`kind`) y una factory que recibe el contexto del
 * widget y devuelve `{ el, update?, destroy? }`. El registro no conoce al
 * widget: solo guarda y valida factories.
 */

/** @type {Map<string, (ctx: any) => any>} */
const factories = new Map();

/**
 * Registra un tipo de widget.
 *
 * @param {string} kind
 * @param {(ctx: any) => { el: Element, update?: Function, destroy?: Function }} factory
 * @returns {Function} la factory registrada
 */
export function define(kind, factory) {
  if (typeof kind !== 'string' || kind.trim() === '') {
    throw new TypeError('zorzal.define: el nombre del tipo debe ser un string no vacio');
  }
  if (typeof factory !== 'function') {
    throw new TypeError(`zorzal.define("${kind}"): la factory debe ser una funcion`);
  }
  if (factories.has(kind)) {
    throw new Error(`zorzal.define: el tipo "${kind}" ya esta registrado`);
  }
  factories.set(kind, factory);
  return factory;
}

/**
 * @param {string} kind
 * @returns {boolean}
 */
export function has(kind) {
  return factories.has(kind);
}

/**
 * @param {string} kind
 * @returns {((ctx: any) => any)|null}
 */
export function getFactory(kind) {
  return factories.get(kind) || null;
}

/**
 * Nombres registrados, ordenados.
 * @returns {string[]}
 */
export function kinds() {
  return [...factories.keys()].sort();
}

/**
 * Quita un tipo del registro. Pensado para tests y para extensiones que
 * reemplazan un tipo propio; los tipos del core no se desregistran solos.
 * @param {string} kind
 * @returns {boolean}
 */
export function undefine(kind) {
  return factories.delete(kind);
}
