/**
 * Shim minimo de `app.define` / `app.require` para el piloto del dashboard.
 *
 * En Halcon la navegacion entre pantallas pasa por `app.require(id)`, que en la
 * aplicacion real resuelve el id contra `source.json`, descarga el archivo y lo
 * evalua. El shim no carga modulos dinamicos: solo registra definiciones en
 * memoria y las evalua una vez, la primera vez que se piden. Alcanza para
 * montar una pantalla y para que el codigo heredado que llama a `app.require`
 * siga funcionando.
 *
 * Contrato:
 *  - `define(name, factory)` registra (o reemplaza) la definicion. No ejecuta
 *    nada. Volver a definir un nombre invalida el resultado ya resuelto.
 *  - `require(name)` ejecuta la definicion la primera vez, guarda el resultado
 *    y lo devuelve en las llamadas siguientes.
 *  - `require(name, callback)` hace lo mismo y ademas llama al callback con el
 *    resultado (no hay carga asincrona: el callback corre en el acto).
 *  - Un nombre sin definicion lanza `Error`: el shim no inventa pantallas.
 *  - Una dependencia circular entre definiciones lanza `Error` en lugar de
 *    colgarse.
 *
 * Uso:
 *
 *   import { app } from './app-shim.js';
 *   app.define('app.dashboard', () => ({ mount }));
 *   app.require('app.dashboard').mount(document.querySelector('#app'));
 *
 * `install(target)` publica el objeto como `target.app` para el codigo que
 * todavia lo lee del global. No se llama solo: el piloto lo decide.
 */

/** Prefijo de los avisos del shim. */
const TAG = '[compat/app-shim]';

/** @type {Map<string, () => unknown>} */
const definitions = new Map();

/** @type {Map<string, unknown>} resultados ya evaluados */
const resolved = new Map();

/** @type {Set<string>} definiciones en curso, para cortar ciclos */
const running = new Set();

/**
 * Valida el nombre de una definicion o de una peticion.
 * @param {unknown} name
 * @returns {string}
 */
function checkName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError(`${TAG} el nombre del modulo debe ser un string no vacio`);
  }
  return name;
}

/**
 * Registra una definicion. No la ejecuta.
 *
 * Si el nombre ya existia, la nueva factory reemplaza a la anterior y se
 * descarta el resultado cacheado: asi recargar un modulo en el piloto no deja
 * una pantalla vieja registrada.
 *
 * @param {string} name
 * @param {() => unknown} factory
 * @returns {() => unknown} la factory registrada
 */
export function define(name, factory) {
  checkName(name);
  if (typeof factory !== 'function') {
    throw new TypeError(`${TAG} app.define("${name}"): falta la funcion de definicion`);
  }
  if (definitions.has(name)) {
    console.warn(`${TAG} app.define("${name}"): reemplaza la definicion anterior`);
  }
  definitions.set(name, factory);
  resolved.delete(name);
  return factory;
}

/**
 * Ejecuta la definicion una sola vez y devuelve su resultado.
 * @param {string} name
 * @returns {unknown}
 */
function resolve(name) {
  checkName(name);
  if (resolved.has(name)) return resolved.get(name);

  const factory = definitions.get(name);
  if (!factory) {
    throw new Error(`${TAG} app.require("${name}"): no hay definicion registrada`);
  }
  if (running.has(name)) {
    throw new Error(`${TAG} app.require("${name}"): dependencia circular entre definiciones`);
  }

  running.add(name);
  let value;
  try {
    value = factory();
  } finally {
    running.delete(name);
  }
  resolved.set(name, value);
  return value;
}

/**
 * Resuelve un modulo registrado.
 *
 * @param {string} name
 * @param {(value: unknown) => void} [callback] se llama con el resultado
 * @returns {unknown} el resultado de la definicion
 */
export function require(name, callback) {
  if (callback !== undefined && typeof callback !== 'function') {
    throw new TypeError(`${TAG} app.require("${name}"): el callback debe ser una funcion`);
  }
  const value = resolve(name);
  if (callback) callback(value);
  return value;
}

/**
 * Indica si hay una definicion registrada (no la ejecuta).
 * @param {unknown} name
 * @returns {boolean}
 */
export function isDefined(name) {
  return typeof name === 'string' && definitions.has(name);
}

/**
 * Nombres registrados, en orden de alta.
 * @returns {string[]}
 */
export function list() {
  return [...definitions.keys()];
}

/**
 * Descarta definiciones y resultados. Pensado para pruebas y para un remontaje
 * limpio del piloto.
 */
export function reset() {
  definitions.clear();
  resolved.clear();
  running.clear();
}

/**
 * Publica la superficie del shim en `target.app`.
 * @param {Record<string, unknown>} [target]
 * @returns {Record<string, any>} el objeto `app`
 */
export function install(target = typeof globalThis === 'undefined' ? {} : globalThis) {
  const api = { define, require, isDefined, list, reset };
  if (target && (typeof target === 'object' || typeof target === 'function')) target.app = api;
  return api;
}

/** Superficie con la forma que espera el codigo heredado. */
export const app = { define, require, isDefined, list, reset };

export default app;
