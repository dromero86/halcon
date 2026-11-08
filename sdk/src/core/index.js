/**
 * Capa core de `@halcon/sdk`.
 *
 * Reexporta la API publica de Zorzal (vendorizado en `sdk/vendor/zorzal`) y
 * agrega las dos primitivas de Halcon que no dependen de ninguna pantalla:
 *
 *  - `register(kind, factory)`: valida y registra un kind propio;
 *  - `init(config)`: monta un widget en un contenedor.
 *
 * Importar este modulo no toca el DOM: no lee ni escribe globals, no requiere
 * `window` ni `document`, y se puede cargar en Node para tests.
 *
 * Uso:
 *
 *   import { init, ui, kinds } from '@halcon/sdk';
 *   init({ el: '#app', spec: { kind: 'label', text: 'Hola' } });
 */

import { ui, create, define, kinds, icons } from '../../vendor/zorzal/zorzal-0.1.0.min.js';

export { ui, create, define, kinds, icons };
export { VERSION } from '../version.js';

/**
 * Registra un kind propio delegando en `define` de Zorzal.
 *
 * @param {string} kind nombre del tipo; string no vacio
 * @param {(ctx: any) => { el: Element, update?: Function, destroy?: Function }} factory
 * @returns {Function} la factory registrada
 * @throws {Error} si `kind` no es un string no vacio o `factory` no es funcion
 */
export function register(kind, factory) {
  if (typeof kind !== 'string' || kind.trim() === '') {
    throw new Error('register: el kind debe ser un string no vacio');
  }
  if (typeof factory !== 'function') {
    throw new Error('register: el factory debe ser una funcion');
  }
  return define(kind, factory);
}

/**
 * Monta un widget de Halcon en un contenedor.
 *
 * Acepta dos formas:
 *
 *  - `{ el, spec }`: se monta `spec` tal cual.
 *  - `{ el, kind, ...props }`: se arma el spec con `kind` y el resto de props.
 *
 * @param {{ el: Element|string, spec?: object, kind?: string } & Record<string, unknown>} config
 * @returns {import('../../vendor/zorzal/zorzal-0.1.0.min.js').Widget} instancia montada
 * @throws {Error} si falta `el`, o si no hay `spec` ni `kind`
 */
export function init(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('init: falta el contenedor (el)');
  }

  const { el, spec, kind, ...props } = config;
  if (!el) {
    throw new Error('init: falta el contenedor (el)');
  }

  let resolved;
  if (spec !== undefined && spec !== null) {
    resolved = spec;
  } else if (typeof kind === 'string' && kind !== '') {
    resolved = { kind, ...props };
  } else {
    throw new Error('init: falta spec o kind');
  }

  return ui.mount(el, resolved);
}
