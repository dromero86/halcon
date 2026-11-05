/**
 * EventSystem: suscripciones por nombre con id, mezclables sobre cualquier
 * objeto o instancia.
 *
 * `EventSystem` es un objeto con `attachEvent`, `detachEvent`, `callEvent` y
 * `hasEvent`. Usado directo guarda sus handlers en un estado propio;
 * `EventSystem.mixin(target)` instala los mismos metodos sobre `target` con un
 * estado aislado. Si `target` ya sabe emitir (tiene `on`/`off`, como un
 * widget), la suscripcion se replica ahi para que los eventos propios del
 * widget tambien la alcancen.
 *
 * Los ids de suscripcion son estables y unicos en el proceso.
 */

const EVENT_STATE = Symbol('zorzal.compat.eventSystem');
const states = new WeakMap();
let sequence = 0;

/**
 * Estado de un sistema de eventos. El objeto `EventSystem` en si tambien es
 * una clave valida, de modo que se puede usar sin mezclar.
 * @param {object} system
 */
function stateOf(system) {
  let state = states.get(system);
  if (!state) {
    state = { handlers: new Map(), ids: new Map(), target: null, bridge: null };
    states.set(system, state);
  }
  return state;
}

/**
 * @param {unknown} name
 * @param {string} method
 */
function checkName(name, method) {
  if (typeof name !== 'string' || name === '') {
    throw new TypeError(`compat.events.${method}: el nombre del evento debe ser un string no vacio`);
  }
}

/**
 * Sistema nuevo para un target. Hereda los metodos del objeto publico.
 * @param {object} target
 */
function newSystem(target) {
  const system = Object.create(EventSystem);
  stateOf(system).target = target || null;
  return system;
}

/** @param {unknown} fn @param {string} method */
function checkHandler(fn, method) {
  if (typeof fn !== 'function') {
    throw new TypeError(`compat.events.${method}: el handler debe ser una funcion`);
  }
}

function removeRecord(state, name, record) {
  state.ids.delete(record.id);
  if (state.bridge) state.bridge.detach(name, record.fn);
}

export const EventSystem = {
  /**
   * Suscribe `fn` al evento `name`.
   * @param {string} name
   * @param {(…args: any[]) => void} fn
   * @returns {string} id de la suscripcion
   */
  attachEvent(name, fn) {
    checkName(name, 'attachEvent');
    checkHandler(fn, 'attachEvent');
    const state = stateOf(this);
    const id = `ev${++sequence}`;
    const list = state.handlers.get(name) || [];
    list.push({ id, fn });
    state.handlers.set(name, list);
    state.ids.set(id, { name, fn });
    if (state.bridge) state.bridge.attach(name, fn);
    return id;
  },

  /**
   * Quita una suscripcion. Sin `fn` quita todas las del evento; sin `name`
   * quita todas las del sistema.
   * @param {string} [name]
   * @param {Function} [fn]
   * @returns {number} cantidad de suscripciones quitadas
   */
  detachEvent(name, fn) {
    const state = stateOf(this);
    let removed = 0;
    if (name === undefined) {
      for (const [eventName, list] of state.handlers) {
        for (const record of list) {
          removeRecord(state, eventName, record);
          removed += 1;
        }
      }
      state.handlers.clear();
      return removed;
    }
    checkName(name, 'detachEvent');
    const list = state.handlers.get(name) || [];
    const kept = [];
    for (const record of list) {
      const match = fn === undefined || record.fn === fn;
      if (match) {
        removeRecord(state, name, record);
        removed += 1;
      } else {
        kept.push(record);
      }
    }
    if (kept.length) state.handlers.set(name, kept);
    else state.handlers.delete(name);
    return removed;
  },

  /**
   * Llama a los handlers del evento con los argumentos indicados.
   * @param {string} name
   * @param {unknown[]|unknown} [args]
   * @returns {number} cantidad de handlers llamados
   */
  callEvent(name, args = []) {
    checkName(name, 'callEvent');
    const state = stateOf(this);
    const list = state.handlers.get(name);
    if (!list || list.length === 0) return 0;
    const params = Array.isArray(args) ? args : [args];
    const target = state.target;
    for (const record of list.slice()) record.fn.apply(target || null, params);
    return list.length;
  },

  /**
   * @param {string} name
   * @returns {boolean}
   */
  hasEvent(name) {
    checkName(name, 'hasEvent');
    return (stateOf(this).handlers.get(name) || []).length > 0;
  },

  /**
   * Mezcla los cuatro metodos sobre `target` con un estado propio.
   * @param {object} target
   * @returns {object} el mismo target
   */
  mixin(target) {
    if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
      throw new TypeError('compat.events.mixin: se espera un objeto o una instancia');
    }
    if (target[EVENT_STATE]) return target;
    const system = newSystem(target);
    const state = stateOf(system);
    if (typeof target.on === 'function' && typeof target.off === 'function') {
      state.bridge = {
        attach: (name, fn) => target.on(name, fn),
        detach: (name, fn) => target.off(name, fn),
      };
    }
    for (const method of ['attachEvent', 'detachEvent', 'callEvent', 'hasEvent']) {
      Object.defineProperty(target, method, {
        configurable: true,
        writable: true,
        value: EventSystem[method].bind(system),
      });
    }
    Object.defineProperty(target, EVENT_STATE, { configurable: true, value: system });
    return target;
  },
};

/**
 * Suscripciones creadas con `event()`, para poder quitarlas por id.
 * @type {Map<string, { target: any, name: string, fn: Function, dom: boolean }>}
 */
const subscriptions = new Map();
let subscriptionSequence = 0;

/**
 * Atajo de suscripcion.
 *
 * Sobre un nodo usa `addEventListener`; sobre cualquier otro objeto mezcla
 * `EventSystem` y usa `attachEvent`.
 *
 * @param {any} target
 * @param {string} name
 * @param {Function} fn
 * @returns {string} id de la suscripcion
 */
export function event(target, name, fn) {
  checkName(name, 'event');
  checkHandler(fn, 'event');
  if (!target) throw new TypeError('compat.events.event: falta el target');
  const id = `sub${++subscriptionSequence}`;
  if (typeof target.addEventListener === 'function') {
    target.addEventListener(name, fn);
    subscriptions.set(id, { target, name, fn, dom: true });
    return id;
  }
  EventSystem.mixin(target);
  target.attachEvent(name, fn);
  subscriptions.set(id, { target, name, fn, dom: false });
  return id;
}

/**
 * Quita una suscripcion creada con `event()`. Acepta `(target, id)` o solo
 * `(id)`.
 *
 * @param {any} target
 * @param {string} [id]
 * @returns {boolean}
 */
export function removeEvent(target, id) {
  if (id === undefined && typeof target === 'string') {
    id = target;
    target = undefined;
  }
  const record = subscriptions.get(id);
  if (!record) return false;
  if (target !== undefined && target !== null && target !== record.target) return false;
  if (record.dom) record.target.removeEventListener(record.name, record.fn);
  else record.target.detachEvent(record.name, record.fn);
  subscriptions.delete(id);
  return true;
}

export default EventSystem;
