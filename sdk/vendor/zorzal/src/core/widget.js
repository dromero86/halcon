/**
 * Widget: instancia viva de un tipo registrado.
 *
 * Responsabilidades del core:
 *  - construir el arbol desde una factory,
 *  - mantener `props` y propagar `set()`,
 *  - registrar y quitar listeners (de elementos y de documento),
 *  - emitir y escuchar eventos propios,
 *  - destruir hijos y nodos.
 */

import { getDocument, h, isNode } from './dom.js';
import { getFactory, kinds } from './registry.js';

const PROP_HANDLER = /^on[A-Z]/;

export class Widget {
  /**
   * @param {string} kind
   * @param {(ctx: any) => any} factory
   * @param {Record<string, unknown>} [spec]
   */
  constructor(kind, factory, spec = {}) {
    this.kind = kind;
    this.props = {};
    for (const [key, value] of Object.entries(spec)) {
      if (key !== 'kind') this.props[key] = value;
    }

    this._children = [];
    this._listeners = [];
    this._handlers = new Map();
    this._propHandlers = [];
    this._rendered = new WeakMap();
    this._destroyed = false;

    const instance = this;
    const ctx = {
      instance,
      h: (tag, attrs, children) => h(tag, attrs, children),
      get props() {
        return instance.props;
      },
      on: (target, type, fn, options) => instance._listen(target, type, fn, options),
      release: (target, type, fn) => instance._release(target, type, fn),
      content: (host, value) => instance._content(host, value),
      emit: (type, data) => instance.emit(type, data),
      doc: () => getDocument(),
    };

    const view = factory(ctx) || {};
    this._view = view;
    this.el = view.el;
    if (!this.el) {
      throw new Error(`zorzal: la factory de "${kind}" no devolvio un elemento en "el"`);
    }
    this.el.zorzal = this;

    if (view.api) {
      Object.defineProperties(this, Object.getOwnPropertyDescriptors(view.api));
    }

    this._wireProps();
  }

  /**
   * Mezcla props, vuelve a enlazar handlers declarativos y actualiza la vista.
   * @param {Record<string, unknown>} [props]
   * @returns {this}
   */
  set(props = {}) {
    if (this._destroyed) return this;
    this._removePropHandlers();
    Object.assign(this.props, props);
    this._wireProps();
    if (this._view && typeof this._view.update === 'function') {
      this._view.update(this.props, this);
    }
    return this;
  }

  /**
   * Escucha un evento del widget.
   * @param {string} type
   * @param {(data?: any, instance?: Widget) => void} fn
   * @returns {this}
   */
  on(type, fn) {
    if (typeof type !== 'string' || type === '') {
      throw new TypeError('zorzal: on() espera un nombre de evento');
    }
    if (typeof fn !== 'function') {
      throw new TypeError(`zorzal: on("${type}") espera una funcion`);
    }
    const list = this._handlers.get(type) || [];
    list.push(fn);
    this._handlers.set(type, list);
    return this;
  }

  /**
   * Quita un handler, o todos los de un evento si no se pasa `fn`.
   * @param {string} type
   * @param {Function} [fn]
   * @returns {this}
   */
  off(type, fn) {
    if (!fn) {
      this._handlers.delete(type);
      return this;
    }
    const list = this._handlers.get(type) || [];
    const next = list.filter((handler) => handler !== fn);
    if (next.length) this._handlers.set(type, next);
    else this._handlers.delete(type);
    return this;
  }

  /**
   * Emite un evento propio. `*` recibe todos los eventos.
   * @param {string} type
   * @param {unknown} [data]
   * @returns {this}
   */
  emit(type, data) {
    if (this._destroyed && type !== 'destroy') return this;
    const handlers = [...(this._handlers.get(type) || []), ...(this._handlers.get('*') || [])];
    for (const handler of handlers) handler.call(this, data, this);
    return this;
  }

  /**
   * Destruye el widget: vista, listeners, hijos y nodo.
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this._view && typeof this._view.destroy === 'function') {
      this._view.destroy();
    }
    for (const record of this._listeners) {
      record.target.removeEventListener(record.type, record.fn, record.options);
    }
    this._listeners.length = 0;

    for (const child of this._children.slice()) child.destroy();
    this._children.length = 0;
    this._rendered = new WeakMap();

    this.emit('destroy');
    this._handlers.clear();
    this._propHandlers.length = 0;

    const el = this.el;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    else if (el && typeof el.remove === 'function') el.remove();
  }

  /** @returns {boolean} */
  get destroyed() {
    return this._destroyed;
  }

  // --- internos -------------------------------------------------------

  _listen(target, type, fn, options) {
    if (!target || typeof target.addEventListener !== 'function') {
      throw new TypeError('zorzal: ctx.on() espera un EventTarget valido');
    }
    target.addEventListener(type, fn, options);
    this._listeners.push({ target, type, fn, options });
    return fn;
  }

  _release(target, type, fn) {
    const kept = [];
    for (const record of this._listeners) {
      const match = record.target === target && record.type === type && (!fn || record.fn === fn);
      if (match) target.removeEventListener(record.type, record.fn, record.options);
      else kept.push(record);
    }
    this._listeners = kept;
  }

  _wireProps() {
    const declared = this.props.on;
    if (declared && typeof declared === 'object') {
      for (const [type, fn] of Object.entries(declared)) {
        if (typeof fn === 'function') this._addPropHandler(type, fn);
      }
    }
    for (const [key, value] of Object.entries(this.props)) {
      if (PROP_HANDLER.test(key) && typeof value === 'function') {
        this._addPropHandler(key.slice(2).toLowerCase(), value);
      }
    }
  }

  _addPropHandler(type, fn) {
    this._propHandlers.push({ type, fn });
    this.on(type, fn);
  }

  _removePropHandlers() {
    for (const { type, fn } of this._propHandlers) this.off(type, fn);
    this._propHandlers.length = 0;
  }

  /**
   * Reemplaza el contenido de un contenedor declarativo.
   *
   * Los specs se crean con `create()` y quedan como hijos del widget, de modo
   * que `destroy()` los alcanza. Si el valor es el mismo objeto que la ultima
   * vez, no se reconstruye: asi un `set({ title })` no pierde el estado de los
   * campos del slot.
   */
  _content(host, value) {
    if (!host) return;
    const previous = this._rendered.get(host);
    if (previous && Object.is(previous.value, value)) return;

    if (previous) {
      for (const child of previous.children) {
        const index = this._children.indexOf(child);
        if (index >= 0) this._children.splice(index, 1);
        child.destroy();
      }
    }
    while (host.firstChild) host.removeChild(host.firstChild);

    const created = [];
    const place = (item) => {
      if (item === undefined || item === null || item === false) return;
      if (Array.isArray(item)) {
        for (const entry of item) place(entry);
        return;
      }
      if (typeof item === 'string' || typeof item === 'number') {
        host.appendChild(getDocument().createTextNode(String(item)));
        return;
      }
      if (item instanceof Widget) {
        host.appendChild(item.el);
        this._children.push(item);
        created.push(item);
        return;
      }
      if (isNode(item)) {
        host.appendChild(item);
        return;
      }
      if (typeof item === 'object' && typeof item.kind === 'string') {
        const child = create(item);
        host.appendChild(child.el);
        this._children.push(child);
        created.push(child);
        return;
      }
      throw new TypeError('zorzal: contenido no soportado en un slot (spec, instancia, string o nodo)');
    };
    place(value);
    this._rendered.set(host, { value, children: created });
  }
}

/**
 * Crea un widget a partir de un spec `{ kind, ...props }`.
 * @param {{ kind: string } & Record<string, unknown>} spec
 * @returns {Widget}
 */
export function create(spec) {
  if (spec instanceof Widget) return spec;
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new TypeError('zorzal.create: el spec debe ser un objeto con "kind"');
  }
  const kind = spec.kind;
  if (typeof kind !== 'string' || kind === '') {
    throw new TypeError('zorzal.create: falta "kind" en el spec');
  }
  const factory = getFactory(kind);
  if (!factory) {
    throw new Error(`zorzal.create: tipo desconocido "${kind}" (registrados: ${kinds().join(', ')})`);
  }
  return new Widget(kind, factory, spec);
}

/**
 * Crea un widget y lo agrega al target.
 * @param {Element|Widget|string} target elemento, instancia o selector
 * @param {{ kind: string } & Record<string, unknown>} spec
 * @returns {Widget}
 */
export function mount(target, spec) {
  const host = resolveTarget(target);
  const instance = create(spec);
  host.appendChild(instance.el);
  return instance;
}

/**
 * @param {Element|Widget|string} target
 * @returns {Element}
 */
export function resolveTarget(target) {
  if (target instanceof Widget) return target.el;
  if (typeof target === 'string') {
    const el = getDocument().querySelector(target);
    if (!el) throw new Error(`zorzal.mount: no se encontro el selector "${target}"`);
    return el;
  }
  if (target && typeof target.appendChild === 'function') return target;
  throw new TypeError('zorzal.mount: target invalido (elemento, instancia o selector)');
}
