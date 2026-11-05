/**
 * Widgets contenedores: scrollview, form, htmlform y datalayout.
 *
 * - `scrollview`: area con scroll vertical y horizontal y `scrollTo(x, y)`.
 * - `form`: agrupa campos hijos, lee y escribe sus valores y valida con el
 *   servicio `rules`.
 * - `htmlform`: envuelve un `<form>` nativo y delega el submit al evento del
 *   navegador.
 * - `datalayout`: repite una plantilla de layout por cada elemento de `data`.
 *
 * Los hijos se crean con `create()` y se destruyen junto con el contenedor.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { create, Widget } from '../core/widget.js';
import { tpl } from '../services/tpl.js';
import { rules as rulesService } from '../services/rules.js';

/** @param {unknown} value */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/** @param {unknown} value */
function asList(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === false) return [];
  return [value];
}

/**
 * Numero o medida CSS. Los numeros son pixeles.
 * @param {unknown} value
 * @returns {string|null}
 */
function lengthValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? `${value}px` : null;
  const text = String(value).trim();
  if (text === '') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return `${text}px`;
  return text;
}

/** @param {unknown} value @returns {number} */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Escribe una variable CSS en el elemento. La geometria vive en `zorzal.css`.
 * @param {Element} el
 * @param {string} name
 * @param {string} value
 */
function setVar(el, name, value) {
  const style = el && el.style;
  if (!style) return;
  if (typeof style.setProperty === 'function') style.setProperty(name, String(value));
  else style[name] = String(value);
}

/**
 * @param {Element} el
 * @param {string} name
 */
function removeVar(el, name) {
  const style = el && el.style;
  if (!style) return;
  if (typeof style.removeProperty === 'function') style.removeProperty(name);
  else delete style[name];
}

/**
 * Agrega un hijo a un host y devuelve la instancia creada, si la hubo.
 * @param {any} ctx
 * @param {Element} host
 * @param {unknown} child
 * @returns {any[]} instancias creadas
 */
function place(ctx, host, child) {
  if (child === undefined || child === null || child === false) return [];
  if (Array.isArray(child)) {
    const out = [];
    for (const entry of child) out.push(...place(ctx, host, entry));
    return out;
  }
  if (typeof child === 'string' || typeof child === 'number') {
    host.appendChild(ctx.doc().createTextNode(String(child)));
    return [];
  }
  if (child instanceof Widget) {
    host.appendChild(child.el);
    return [child];
  }
  if (typeof child === 'object' && typeof child.nodeType === 'number') {
    host.appendChild(child);
    return [];
  }
  if (child && typeof child === 'object' && typeof child.kind === 'string') {
    const instance = create(child);
    host.appendChild(instance.el);
    return [instance];
  }
  throw new TypeError('zorzal: contenido no soportado en un contenedor (spec, instancia, string o nodo)');
}

// --- valores de campos ------------------------------------------------

const TEXT_KINDS = new Set(['field', 'textarea']);
const BOOL_KINDS = new Set(['checkbox', 'toggle']);

/**
 * Lectura base por tipo de campo, sin pasar por `getValue()`.
 * @param {any} widget
 * @returns {unknown}
 */
function readValueBase(widget) {
  if (!widget) return undefined;
  if (BOOL_KINDS.has(widget.kind)) return Boolean(widget.props.checked);
  if (TEXT_KINDS.has(widget.kind)) {
    if (widget.input && widget.input.value !== undefined) return widget.input.value;
    return asText(widget.props.value);
  }
  if (widget.kind === 'picker') return widget.props.value;
  if (widget.props.value !== undefined) return widget.props.value;
  if (widget.el && widget.el.value !== undefined) return widget.el.value;
  return undefined;
}

/**
 * Escritura base por tipo de campo, sin pasar por `setValue()`.
 * @param {any} widget
 * @param {unknown} value
 */
function writeValueBase(widget, value) {
  if (!widget) return;
  if (BOOL_KINDS.has(widget.kind)) {
    widget.set({ checked: Boolean(value) });
    return;
  }
  widget.set({ value });
}

/**
 * Copia el valor vigente a `props` antes de reaplicar la vista, para que un
 * `set()` de estado (por ejemplo `invalid`) no pise lo que el usuario escribio.
 * @param {any} widget
 */
function syncValueProps(widget) {
  if (!widget) return;
  if (BOOL_KINDS.has(widget.kind)) widget.props.checked = readValueBase(widget);
  else if (TEXT_KINDS.has(widget.kind) || widget.kind === 'picker') {
    widget.props.value = readValueBase(widget);
  }
}

/**
 * @param {any} widget
 * @returns {unknown}
 */
function readValue(widget) {
  if (!widget) return undefined;
  if (typeof widget.getValue === 'function') return widget.getValue();
  return readValueBase(widget);
}

/**
 * @param {any} widget
 * @param {unknown} value
 */
function writeValue(widget, value) {
  if (!widget) return;
  if (typeof widget.setValue === 'function') {
    widget.setValue(value);
    return;
  }
  writeValueBase(widget, value);
}

/**
 * Da a un campo hijo la interfaz `getValue()`/`setValue()` si no la trae.
 * @param {any} widget
 */
function ensureFieldAccessors(widget) {
  if (typeof widget.getValue !== 'function') {
    Object.defineProperty(widget, 'getValue', {
      configurable: true,
      writable: true,
      value: () => readValueBase(widget),
    });
  }
  if (typeof widget.setValue !== 'function') {
    Object.defineProperty(widget, 'setValue', {
      configurable: true,
      writable: true,
      value: (value) => writeValueBase(widget, value),
    });
  }
}

/**
 * Nombre de un campo: `name` del spec o de las props, y si no `id`.
 * @param {any} widget
 * @param {unknown} spec
 * @returns {string}
 */
function fieldName(widget, spec) {
  const source = widget && widget.props ? widget.props : spec;
  if (!source || typeof source !== 'object') return '';
  if (source.name !== undefined && source.name !== null && source.name !== '') return asText(source.name);
  if (source.id !== undefined && source.id !== null && source.id !== '') return asText(source.id);
  return '';
}

/**
 * @param {unknown} value
 * @returns {Array<(value: unknown) => string|null>}
 */
function normalizeValidators(value) {
  if (!value) return [];
  if (typeof value === 'function') return [value];
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'function');
  return [];
}

// --- scrollview -------------------------------------------------------

define('scrollview', (ctx) => {
  const body = ctx.h('div', { class: 'z-scrollview__body' });
  const el = ctx.h('div', { class: 'z-scrollview', tabindex: '0' }, [body]);

  const scrollTo = (x, y) => {
    const left = Math.max(0, toNumber(x));
    const top = Math.max(0, toNumber(y));
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left, top, behavior: ctx.props.behavior === 'smooth' ? 'smooth' : 'auto' });
    }
    el.scrollLeft = left;
    el.scrollTop = top;
    return { x: left, y: top };
  };

  const update = (props) => {
    const horizontal = props.horizontal !== false;
    const vertical = props.vertical !== false;
    el.setAttribute(
      'class',
      cls(
        'z-scrollview',
        !horizontal && 'z-scrollview--no-x',
        !vertical && 'z-scrollview--no-y',
        props.plain && 'z-scrollview--plain'
      )
    );
    const height = lengthValue(props.height);
    if (height === null) removeVar(el, '--z-scrollview-height');
    else setVar(el, '--z-scrollview-height', height);
    const width = lengthValue(props.width);
    if (width === null) removeVar(el, '--z-scrollview-width');
    else setVar(el, '--z-scrollview-width', width);
    ctx.content(body, props.body !== undefined ? props.body : props.children);
  };
  update(ctx.props);

  ctx.on(el, 'scroll', (event) => {
    ctx.emit('scroll', {
      x: toNumber(el.scrollLeft),
      y: toNumber(el.scrollTop),
      event,
    });
  });

  return {
    el,
    update,
    api: {
      /**
       * Desplaza el contenido a las coordenadas indicadas.
       * @param {number} x
       * @param {number} y
       * @returns {{ x: number, y: number }}
       */
      scrollTo(x, y) {
        return scrollTo(x, y);
      },
      /** @returns {number} */
      get scrollLeft() {
        return toNumber(el.scrollLeft);
      },
      /** @returns {number} */
      get scrollTop() {
        return toNumber(el.scrollTop);
      },
      /** @returns {boolean} */
      get horizontal() {
        return ctx.props.horizontal !== false;
      },
      /** @returns {boolean} */
      get vertical() {
        return ctx.props.vertical !== false;
      },
    },
  };
});

// --- form -------------------------------------------------------------

define('form', (ctx) => {
  const el = ctx.h('div', { class: 'z-form', role: 'form' });
  let entries = [];
  let fieldsSource;

  const destroyEntries = () => {
    for (const entry of entries) entry.instance.destroy();
    entries = [];
  };

  const build = (list) => {
    destroyEntries();
    while (el.firstChild) el.removeChild(el.firstChild);
    entries = [];
    for (const child of asList(list)) {
      const created = place(ctx, el, child);
      for (const instance of created) {
        if (instance.kind === undefined) continue;
        ensureFieldAccessors(instance);
        const name = fieldName(instance, child);
        entries.push({ name, instance, spec: child });
      }
    }
  };

  const find = (name) => entries.find((entry) => entry.name !== '' && entry.name === asText(name)) || null;

  const getValues = () => {
    const out = {};
    for (const entry of entries) {
      if (entry.name === '') continue;
      out[entry.name] = readValue(entry.instance);
    }
    return out;
  };

  const setValues = (values = {}) => {
    if (!values || typeof values !== 'object') return getValues();
    for (const [name, value] of Object.entries(values)) {
      const entry = find(name);
      if (entry) writeValue(entry.instance, value);
    }
    return getValues();
  };

  const schemaFor = () => {
    const schema = {};
    for (const entry of entries) {
      if (entry.name === '') continue;
      const list = [];
      if (entry.instance.props.required === true) list.push(rulesService.required());
      list.push(...normalizeValidators(entry.instance.props.rules));
      schema[entry.name] = list;
    }
    const declared = ctx.props.rules;
    if (declared && typeof declared === 'object' && !Array.isArray(declared)) {
      for (const [name, value] of Object.entries(declared)) {
        schema[name] = [...(schema[name] || []), ...normalizeValidators(value)];
      }
    }
    return schema;
  };

  const paintErrors = (result) => {
    for (const entry of entries) {
      if (entry.name === '') continue;
      const check = result.checks[entry.name];
      const message = check && !check.valid ? check.errors[0] || null : null;
      syncValueProps(entry.instance);
      entry.instance.set({ invalid: Boolean(message), error: message || '' });
    }
    el.setAttribute(
      'class',
      cls(
        'z-form',
        !result.valid && 'z-form--invalid',
        ctx.props.plain && 'z-form--plain',
        ctx.props.disabled && 'z-form--disabled'
      )
    );
  };

  const validate = () => {
    const schema = schemaFor();
    const result = rulesService.form(getValues(), schema);
    paintErrors(result);
    if (result.valid) return true;
    ctx.emit('invalid', { errors: { ...result.errors }, values: getValues() });
    return { ...result.errors };
  };

  const submit = () => {
    const result = validate();
    if (result !== true) return false;
    const values = getValues();
    ctx.emit('submit', { values });
    return values;
  };

  const update = (props) => {
    const list = props.fields !== undefined ? props.fields : props.children;
    if (list !== fieldsSource) {
      fieldsSource = list;
      build(list);
    }
    el.setAttribute('class', cls('z-form', props.plain && 'z-form--plain', props.disabled && 'z-form--disabled', props.invalid && 'z-form--invalid'));
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: destroyEntries,
    api: {
      /** @returns {Record<string, unknown>} valores de los campos con nombre */
      getValues,
      /**
       * Aplica valores por nombre de campo.
       * @param {Record<string, unknown>} values
       * @returns {Record<string, unknown>} valores resultantes
       */
      setValues,
      /**
       * Valida con el servicio `rules`.
       * @returns {true|Record<string, string>} `true` o el mapa de errores
       */
      validate,
      /**
       * Valida y, solo si no hay errores, emite `submit` con `{ values }`.
       * @returns {Record<string, unknown>|false}
       */
      submit,
      /**
       * Instancia registrada para ese nombre.
       * @param {string} name
       * @returns {any|null}
       */
      field(name) {
        const entry = find(name);
        return entry ? entry.instance : null;
      },
      /** @returns {string[]} nombres registrados */
      get fieldNames() {
        return entries.filter((entry) => entry.name !== '').map((entry) => entry.name);
      },
    },
  };
});

// --- htmlform ---------------------------------------------------------

/**
 * Valores de los controles nativos con `name` dentro del formulario.
 * @param {Element} form
 * @returns {Record<string, unknown>}
 */
function nativeValues(form) {
  const out = {};
  for (const tag of ['input', 'textarea', 'select']) {
    for (const node of form.querySelectorAll(tag)) {
      const name = node.getAttribute('name');
      if (!name) continue;
      const type = node.getAttribute('type');
      if (type === 'checkbox' || type === 'radio') {
        if (type === 'radio' && !node.checked) continue;
        out[name] = type === 'radio' ? node.value : Boolean(node.checked);
      } else {
        out[name] = node.value;
      }
    }
  }
  return out;
}

/** @param {any} ctx @returns {any} */
function submitEvent(ctx) {
  const doc = ctx.doc();
  if (typeof doc.createEvent === 'function') {
    const event = doc.createEvent('Event');
    event.initEvent('submit', true, true);
    return event;
  }
  return { type: 'submit', bubbles: true, cancelable: true };
}

define('htmlform', (ctx) => {
  const el = ctx.h('form', { class: 'z-htmlform', novalidate: true });
  let handled = false;

  const getValues = () => nativeValues(el);

  const update = (props) => {
    el.setAttribute('class', cls('z-htmlform', props.plain && 'z-htmlform--plain'));
    for (const [key, attr] of [
      ['action', 'action'],
      ['method', 'method'],
      ['enctype', 'enctype'],
      ['target', 'target'],
      ['name', 'name'],
      ['autocomplete', 'autocomplete'],
    ]) {
      if (props[key] !== undefined && props[key] !== null && props[key] !== '') el.setAttribute(attr, asText(props[key]));
      else el.removeAttribute(attr);
    }
    ctx.content(el, props.children !== undefined ? props.children : props.body);
  };
  update(ctx.props);

  ctx.on(el, 'submit', (event) => {
    if (ctx.props.preventDefault !== false) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
    }
    handled = true;
    ctx.emit('submit', { values: getValues(), event, native: true });
  });

  return {
    el,
    update,
    api: {
      /** @returns {any} el `<form>` nativo */
      get form() {
        return el;
      },
      /** @returns {Record<string, unknown>} */
      getValues,
      /**
       * Despacha un `submit` nativo sobre el formulario.
       * @returns {boolean} `true` si el widget lo proceso
       */
      submit() {
        handled = false;
        el.dispatchEvent(submitEvent(ctx));
        return handled;
      },
      /** Limpia los controles nativos del formulario. */
      reset() {
        if (typeof el.reset === 'function') el.reset();
      },
    },
  };
});

// --- datalayout -------------------------------------------------------

/**
 * Copia profunda de una plantilla interpolando `{{ clave }}` con el elemento.
 * Las funciones, nodos e instancias se conservan tal cual.
 * @param {unknown} value
 * @param {Record<string, unknown>} scope
 * @returns {unknown}
 */
function interpolate(value, scope) {
  if (typeof value === 'string') return tpl(value, scope);
  if (Array.isArray(value)) return value.map((item) => interpolate(item, scope));
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Widget || typeof value.nodeType === 'number') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = interpolate(item, scope);
  return out;
}

/**
 * @param {unknown} item
 * @param {number} index
 * @returns {Record<string, unknown>}
 */
function itemScope(item, index) {
  const scope =
    item && typeof item === 'object' && !Array.isArray(item)
      ? { ...item }
      : { value: item, text: item };
  scope.index = index;
  return scope;
}

define('datalayout', (ctx) => {
  const el = ctx.h('ul', { class: 'z-datalayout' });
  const empty = [];
  let items = [];
  let dataSource;
  let templateSource;

  const destroyItems = () => {
    for (const item of items) {
      for (const instance of item.created) instance.destroy();
    }
    items = [];
  };

  const specFor = (item, index) => {
    const template = ctx.props.template;
    if (typeof template === 'function') {
      const out = template(item, index);
      return out === undefined ? null : out;
    }
    if (template === undefined || template === null) {
      return asText(item && typeof item === 'object' ? item.text : item);
    }
    return interpolate(template, itemScope(item, index));
  };

  const build = (data) => {
    destroyItems();
    while (el.firstChild) el.removeChild(el.firstChild);
    items = data.map((item, index) => {
      const row = ctx.h('li', { class: 'z-datalayout__item', 'data-index': String(index) });
      const created = place(ctx, row, specFor(item, index));
      el.appendChild(row);
      return { row, created };
    });
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-datalayout', props.plain && 'z-datalayout--plain', props.compact && 'z-datalayout--compact'));
    const data = Array.isArray(props.data) ? props.data : empty;
    if (data !== dataSource || props.template !== templateSource) {
      dataSource = data;
      templateSource = props.template;
      build(data);
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: destroyItems,
    api: {
      /**
       * Reemplaza los elementos y rearma la lista.
       * @param {unknown[]} data
       * @returns {number} cantidad de elementos
       */
      setData(data) {
        const list = Array.isArray(data) ? data : [];
        ctx.props.data = list;
        dataSource = list;
        build(list);
        ctx.emit('change', { data: list, count: list.length });
        return list.length;
      },
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : [];
      },
      /** @returns {number} */
      get count() {
        return items.length;
      },
    },
  };
});
