/**
 * mixins: comportamiento transversal para instancias de widget.
 *
 * Cada mixin recibe una instancia y le agrega metodos; los widgets del core
 * son factories, no clases, asi que la composicion es por mezcla. Los
 * listeners que instala un mixin se pueden liberar con `release(instancia)`.
 *
 * Eventos:
 *  - selection: `select` (configurable con `event`)
 *  - editable: `edit:start`, `edit:end`, `edit:cancel`
 *  - validatable: `valid`, `invalid`
 *  - draggable: `drag:start`, `drag:move`, `drag:end`
 *  - keynav: `keynav:move`, `activate`, `escape`
 */

import { getDocument } from '../core/dom.js';
import { rules as ruleSet } from './rules.js';

/** @type {WeakMap<object, Map<string, () => void>>} */
const attached = new WeakMap();

/**
 * Registra los metodos y los listeners de un mixin. Reaplicarlo reemplaza la
 * version anterior.
 * @param {object} instance
 * @param {string} name
 * @param {Record<string, unknown>} methods
 * @param {Array<() => void>} [cleanups]
 * @returns {object} la instancia
 */
function attach(instance, name, methods, cleanups = []) {
  if (!instance || typeof instance.emit !== 'function') {
    throw new TypeError('zorzal.mixins: se espera una instancia de widget');
  }
  Object.assign(instance, methods);
  const map = attached.get(instance) || new Map();
  const previous = map.get(name);
  if (previous) previous();
  map.set(name, () => {
    for (const cleanup of cleanups) cleanup();
  });
  attached.set(instance, map);
  return instance;
}

/**
 * Quita los listeners de un mixin (o de todos) sin tocar los metodos.
 * @param {object} instance
 * @param {string} [name]
 */
export function release(instance, name) {
  const map = attached.get(instance);
  if (!map) return;
  if (name) {
    const cleanup = map.get(name);
    if (cleanup) cleanup();
    map.delete(name);
  } else {
    for (const cleanup of map.values()) cleanup();
    map.clear();
  }
}

/**
 * Id activo sobre `props[prop]`, con evento al seleccionar.
 * @param {object} instance
 * @param {{ prop?: string, event?: string }} [options]
 * @returns {object}
 */
function selection(instance, options = {}) {
  const prop = options.prop || 'selected';
  const event = options.event || 'select';

  const current = () => {
    const value = instance.props ? instance.props[prop] : undefined;
    return value === undefined || value === null ? null : String(value);
  };

  return attach(instance, 'selection', {
    /**
     * @param {string|number|null} id
     * @returns {object}
     */
    select(id) {
      const next = id === undefined || id === null ? null : String(id);
      instance.props[prop] = next;
      instance.emit(event, { id: next });
      return instance;
    },
    /** @returns {object} */
    clearSelection() {
      return instance.select(null);
    },
    /** @param {string|number} id @returns {boolean} */
    isSelected(id) {
      return current() !== null && current() === String(id);
    },
    /** @returns {string|null} */
    getSelected() {
      return current();
    },
  });
}

/**
 * Entrada y salida de edicion sobre un id.
 * @param {object} instance
 * @param {{ prop?: string, onStart?: Function, onEnd?: Function }} [options]
 * @returns {object}
 */
function editable(instance, options = {}) {
  const prop = options.prop || 'editing';
  let editing = null;

  const state = () => (editing === null ? null : editing);

  return attach(instance, 'editable', {
    /**
     * @param {string|number|null} id
     * @returns {object}
     */
    startEdit(id) {
      editing = id === undefined || id === null ? null : String(id);
      instance.props[prop] = editing;
      const data = { id: state() };
      if (typeof options.onStart === 'function') options.onStart(data);
      instance.emit('edit:start', data);
      return instance;
    },
    /**
     * Confirma la edicion en curso.
     * @param {unknown} [value]
     * @returns {boolean} `false` si no habia edicion activa
     */
    endEdit(value) {
      if (editing === null) return false;
      const id = editing;
      editing = null;
      instance.props[prop] = null;
      const data = { id, value };
      if (typeof options.onEnd === 'function') options.onEnd(data);
      instance.emit('edit:end', data);
      return true;
    },
    /**
     * Cancela la edicion en curso.
     * @returns {boolean} `false` si no habia edicion activa
     */
    cancelEdit() {
      if (editing === null) return false;
      const id = editing;
      editing = null;
      instance.props[prop] = null;
      instance.emit('edit:cancel', { id });
      return true;
    },
    /** @returns {boolean} */
    isEditing() {
      return editing !== null;
    },
    /** @returns {string|null} */
    getEditing() {
      return state();
    },
  });
}

/**
 * Validacion contra un mapa de reglas `{ campo: [validadores] }`.
 * @param {object} instance
 * @param {{ rules?: Record<string, Array<(value: unknown) => string|null>> }} [options]
 * @returns {object}
 */
function validatable(instance, options = {}) {
  let schema = options.rules || {};

  const valuesOf = (values) => {
    if (values && typeof values === 'object') return values;
    if (typeof instance.getValues === 'function') return instance.getValues();
    return instance.props || {};
  };

  return attach(instance, 'validatable', {
    /**
     * @param {unknown} [values]
     * @returns {{ valid: boolean, errors: Record<string, string>, checks: Record<string, object> }}
     */
    validate(values) {
      const result = ruleSet.form(valuesOf(values), schema);
      instance.emit(result.valid ? 'valid' : 'invalid', result);
      return result;
    },
    /**
     * @param {string} name
     * @param {unknown} [value]
     * @returns {{ valid: boolean, errors: string[], error: string|null }}
     */
    validateField(name, value) {
      const values = valuesOf();
      const current = value === undefined ? values[String(name)] : value;
      return ruleSet.check(current, schema[String(name)] || []);
    },
    /**
     * @param {Record<string, Array<(value: unknown) => string|null>>} next
     * @returns {object}
     */
    setRules(next) {
      schema = next || {};
      return instance;
    },
    /** @returns {Record<string, Array<Function>>} */
    getRules() {
      return { ...schema };
    },
  });
}

/** @param {unknown} value @returns {number} */
function coordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Arrastre con pointer events sobre `instance.el`.
 * @param {object} instance
 * @param {{ disabled?: boolean, data?: unknown }} [options]
 * @returns {object}
 */
function draggable(instance, options = {}) {
  const el = instance.el;
  if (!el || typeof el.addEventListener !== 'function') {
    throw new TypeError('zorzal.mixins.draggable: la instancia no tiene elemento');
  }
  const doc = options.document || el.ownerDocument || getDocument();
  let active = false;
  let startX = 0;
  let startY = 0;
  let last = { x: 0, y: 0, dx: 0, dy: 0 };

  const stop = (event, cancelled) => {
    if (!active) return;
    active = false;
    doc.removeEventListener('pointermove', onMove);
    doc.removeEventListener('pointerup', onUp);
    doc.removeEventListener('pointercancel', onUp);
    if (el.removeAttribute) el.removeAttribute('data-dragging');
    if (el.classList && typeof el.classList.remove === 'function') {
      el.classList.remove('z-draggable--active');
    }
    instance.emit('drag:end', { ...last, cancelled: Boolean(cancelled), event });
  };

  const onMove = (event) => {
    if (!active) return;
    const x = coordinate(event.clientX);
    const y = coordinate(event.clientY);
    last = { x, y, dx: x - startX, dy: y - startY };
    instance.emit('drag:move', { ...last, event });
  };

  const onUp = (event) => stop(event, event && event.type === 'pointercancel');

  const onDown = (event) => {
    if (options.disabled) return;
    if (event && event.button !== undefined && event.button !== 0) return;
    active = true;
    startX = coordinate(event ? event.clientX : 0);
    startY = coordinate(event ? event.clientY : 0);
    last = { x: startX, y: startY, dx: 0, dy: 0 };
    if (el.setAttribute) el.setAttribute('data-dragging', 'true');
    if (el.classList && typeof el.classList.add === 'function') el.classList.add('z-draggable--active');
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onUp);
    doc.addEventListener('pointercancel', onUp);
    instance.emit('drag:start', { ...last, data: options.data, event });
  };

  el.addEventListener('pointerdown', onDown);

  return attach(
    instance,
    'draggable',
    {
      /** @returns {boolean} */
      isDragging() {
        return active;
      },
      /** @returns {object} ultimo desplazamiento */
      getDragState() {
        return { ...last, active };
      },
    },
    [
      () => {
        el.removeEventListener('pointerdown', onDown);
        stop(null, true);
      },
    ]
  );
}

/**
 * Navegacion con flechas, Enter y Escape.
 *
 * `items` puede ser un array o una funcion que devuelve los ids; si falta, se
 * usan los elementos `[data-id]` dentro de `instance.el`.
 * @param {object} instance
 * @param {{ items?: unknown[]|(() => unknown[]), idOf?: (item: unknown) => unknown,
 *   orientation?: 'vertical'|'horizontal', wrap?: boolean, active?: unknown }} [options]
 * @returns {object}
 */
function keynav(instance, options = {}) {
  const el = instance.el;
  if (!el || typeof el.addEventListener !== 'function') {
    throw new TypeError('zorzal.mixins.keynav: la instancia no tiene elemento');
  }
  const idOf =
    typeof options.idOf === 'function'
      ? options.idOf
      : (item) =>
          item && typeof item === 'object'
            ? item.id !== undefined
              ? item.id
              : item
            : item;
  const wrap = options.wrap !== false;
  let active = options.active === undefined || options.active === null ? null : String(options.active);

  const ids = () => {
    let list;
    if (typeof options.items === 'function') list = options.items();
    else if (Array.isArray(options.items)) list = options.items;
    else if (typeof el.querySelectorAll === 'function') {
      list = el.querySelectorAll('[data-id]').map((node) => node.getAttribute('data-id'));
    } else list = [];
    return (Array.isArray(list) ? list : [])
      .map(idOf)
      .filter((id) => id !== undefined && id !== null)
      .map(String);
  };

  const setActive = (id, event) => {
    active = id === undefined || id === null ? null : String(id);
    instance.emit('keynav:move', { id: active, event });
    return active;
  };

  const move = (delta, event) => {
    const list = ids();
    if (list.length === 0) return null;
    let index = active === null ? -1 : list.indexOf(active);
    if (index < 0) index = delta > 0 ? -1 : 0;
    let next = index + delta;
    if (next < 0) next = wrap ? list.length - 1 : 0;
    if (next >= list.length) next = wrap ? 0 : list.length - 1;
    return setActive(list[next], event);
  };

  const onKey = (event) => {
    const key = event ? event.key : '';
    let handled = true;
    if (key === 'ArrowDown' || key === 'ArrowRight') move(1, event);
    else if (key === 'ArrowUp' || key === 'ArrowLeft') move(-1, event);
    else if (key === 'Home') setActive(ids()[0] ?? null, event);
    else if (key === 'End') {
      const list = ids();
      setActive(list[list.length - 1] ?? null, event);
    } else if (key === 'Enter') instance.emit('activate', { id: active, event });
    else if (key === 'Escape') {
      const id = active;
      active = null;
      instance.emit('escape', { id, event });
    } else handled = false;
    if (handled && event && typeof event.preventDefault === 'function') event.preventDefault();
  };

  if (!el.hasAttribute || !el.hasAttribute('tabindex')) {
    if (el.setAttribute) el.setAttribute('tabindex', '0');
  }
  el.addEventListener('keydown', onKey);

  return attach(
    instance,
    'keynav',
    {
      /** @returns {string|null} */
      getActive() {
        return active;
      },
      /**
       * @param {string|number|null} id
       * @returns {string|null}
       */
      setActive(id) {
        return setActive(id, null);
      },
      /** @returns {string|null} */
      nextItem() {
        return move(1, null);
      },
      /** @returns {string|null} */
      prevItem() {
        return move(-1, null);
      },
      /** @returns {string[]} */
      getItems() {
        return ids();
      },
    },
    [() => el.removeEventListener('keydown', onKey)]
  );
}

export const mixins = {
  selection,
  editable,
  validatable,
  draggable,
  keynav,
  release,
};

export default mixins;
