/**
 * protoUI: define un kind nuevo a partir de otro.
 *
 * El kind resultante queda registrado en el registro del core, de modo que se
 * puede crear con `create()` como cualquier widget. `config.defaults` se
 * aplica solo a las props ausentes del spec (el spec siempre gana);
 * `config.methods` y las funciones sueltas de `config` se exponen como
 * metodos de la instancia. El tercer argumento, opcional, recibe
 * `(ctx, vistaBase)` y puede devolver `{ el?, update?, destroy?, api? }` para
 * completar o reemplazar partes de la vista base.
 */

import { define, getFactory } from '../core/registry.js';

/**
 * @param {{ name: string, defaults?: Record<string, unknown>, methods?: Record<string, Function> } & Record<string, unknown>} config
 * @param {string} baseKind
 * @param {((ctx: any, view: any) => Record<string, any>)|null} [factory]
 * @returns {Function} la factory registrada
 */
export function protoUI(config = {}, baseKind, factory) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('compat.protoUI: la config debe ser un objeto');
  }
  const { name, defaults = {}, methods = {}, ...rest } = config;
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('compat.protoUI: falta "name" en la config');
  }
  if (typeof baseKind !== 'string' || baseKind === '') {
    throw new TypeError(`compat.protoUI("${name}"): falta el kind base`);
  }
  const baseFactory = getFactory(baseKind);
  if (!baseFactory) {
    throw new Error(`compat.protoUI("${name}"): kind base desconocido "${baseKind}"`);
  }
  if (defaults !== null && typeof defaults !== 'object') {
    throw new TypeError(`compat.protoUI("${name}"): "defaults" debe ser un objeto`);
  }
  if (factory !== undefined && factory !== null && typeof factory !== 'function') {
    throw new TypeError(`compat.protoUI("${name}"): la factory debe ser una funcion`);
  }

  const added = {};
  if (methods && typeof methods === 'object') Object.assign(added, methods);
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value === 'function') added[key] = value;
  }

  return define(name, (ctx) => {
    for (const [key, value] of Object.entries(defaults || {})) {
      if (ctx.props[key] === undefined) ctx.props[key] = value;
    }
    const baseView = baseFactory(ctx) || {};
    const extra = typeof factory === 'function' ? factory(ctx, baseView) || {} : {};
    const descriptors = {
      ...(baseView.api ? Object.getOwnPropertyDescriptors(baseView.api) : {}),
      ...(extra.api ? Object.getOwnPropertyDescriptors(extra.api) : {}),
    };
    const instance = ctx.instance;
    for (const [key, method] of Object.entries(added)) {
      if (typeof method !== 'function') continue;
      descriptors[key] = {
        configurable: true,
        writable: true,
        value: function (...args) {
          return method.apply(instance, args);
        },
      };
    }
    return { ...baseView, ...extra, api: Object.defineProperties({}, descriptors) };
  });
}

export default protoUI;
