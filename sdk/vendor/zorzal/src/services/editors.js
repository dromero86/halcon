/**
 * editors: controles de edicion por tipo.
 *
 * Cada fabrica devuelve un control con `el` (el nodo para montar), `input`
 * (el campo nativo), `getValue()`, `setValue(valor)` y `validate()`.
 * `validate()` devuelve `{ valid, errors, error }`, igual que `rules.check()`.
 *
 * Los valores vacios se leen como `''` en texto, `null` en numero, fecha y
 * select, y `false` en checkbox.
 */

import { h } from '../core/dom.js';
import { date as dateService } from './date.js';
import { rules as ruleSet } from './rules.js';

/**
 * @typedef {Object} EditorOptions
 * @property {unknown} [value] valor inicial
 * @property {string} [name] atributo `name`
 * @property {string} [placeholder]
 * @property {boolean|string} [required] exige valor; un string es el mensaje
 * @property {Array<(value: unknown) => string|null>} [rules]
 * @property {boolean} [disabled]
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {string} [label] etiqueta accesible
 */

/** @param {unknown} value */
function isBlank(value) {
  return value === undefined || value === null || value === '';
}

/**
 * Dia `YYYY-MM-DD` de un valor, sin corrimiento de zona horaria para los
 * textos que ya traen la fecha.
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
 * Opciones de un select normalizadas a `{ value, text, disabled }`.
 * @param {unknown} options
 * @returns {{ value: string, text: string, disabled: boolean }[]}
 */
function normalizeOptions(options) {
  const list = Array.isArray(options) ? options : [];
  const out = [];
  for (const item of list) {
    if (item === null || item === undefined) continue;
    if (typeof item === 'object') {
      const raw = item.value !== undefined ? item.value : item.id !== undefined ? item.id : item.text;
      if (raw === undefined || raw === null) continue;
      const text = item.text !== undefined ? item.text : item.label !== undefined ? item.label : raw;
      out.push({ value: String(raw), text: String(text), disabled: Boolean(item.disabled) });
    } else {
      out.push({ value: String(item), text: String(item), disabled: false });
    }
  }
  return out;
}

const EMPTY_RULES = [];

/**
 * Reglas efectivas del control, incluyendo `required` y la coherencia del
 * tipo.
 * @param {string} type
 * @param {EditorOptions} options
 * @returns {Array<(value: unknown) => string|null>}
 */
function checksFor(type, options) {
  const checks = [];
  if (options.required) {
    const message = typeof options.required === 'string' ? options.required : 'Campo obligatorio';
    if (type === 'checkbox') checks.push((value) => (value === true ? null : message));
    else checks.push(ruleSet.required(message));
  }
  for (const rule of Array.isArray(options.rules) ? options.rules : EMPTY_RULES) {
    if (typeof rule === 'function') checks.push(rule);
  }
  if (type === 'number') {
    checks.push(ruleSet.number());
    if (!isBlank(options.min) || !isBlank(options.max)) {
      checks.push(
        ruleSet.range(
          isBlank(options.min) ? -Infinity : Number(options.min),
          isBlank(options.max) ? Infinity : Number(options.max)
        )
      );
    }
  }
  if (type === 'date') {
    checks.push((value) => (isBlank(value) || dateService.isValid(value) ? null : 'Fecha invalida'));
  }
  return checks;
}

/**
 * Arma el control comun: contenedor, etiqueta, error y API.
 * @param {string} type
 * @param {Element} input
 * @param {EditorOptions} options
 * @param {{ getValue: Function, setValue: Function, extras?: Record<string, unknown> }} behavior
 * @returns {Record<string, unknown>}
 */
function finish(type, input, options, behavior) {
  const el = h('div', { class: `z-editor z-editor--${type}` });
  const errorEl = h('span', { class: 'z-editor__error', role: 'alert' });

  if (options.label) {
    el.appendChild(h('span', { class: 'z-editor__label', text: String(options.label) }));
  }
  el.appendChild(input);
  el.appendChild(errorEl);

  const checks = checksFor(type, options);

  const control = {
    type,
    el,
    input,
    errorEl,
    /** @returns {unknown} */
    getValue: behavior.getValue,
    /**
     * @param {unknown} value
     * @returns {object}
     */
    setValue(value) {
      behavior.setValue(value);
      if (typeof input.setAttribute === 'function') input.setAttribute('aria-invalid', 'false');
      errorEl.textContent = '';
      return control;
    },
    /**
     * Corre las reglas sobre el valor actual.
     * @returns {{ valid: boolean, errors: string[], error: string|null }}
     */
    validate() {
      const result = ruleSet.check(behavior.getValue(), checks);
      if (typeof input.setAttribute === 'function') {
        input.setAttribute('aria-invalid', result.valid ? 'false' : 'true');
      }
      errorEl.textContent = result.error || '';
      return result;
    },
    /**
     * Muestra un error externo y devuelve el control.
     * @param {string|null} message
     * @returns {object}
     */
    setError(message) {
      errorEl.textContent = message ? String(message) : '';
      if (typeof input.setAttribute === 'function') {
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
      }
      return control;
    },
    /**
     * Escucha el evento nativo `change`.
     * @param {(value: unknown, event?: unknown) => void} listener
     * @returns {() => void}
     */
    onChange(listener) {
      if (typeof listener !== 'function') return () => {};
      const handler = (event) => listener(behavior.getValue(), event);
      input.addEventListener('change', handler);
      return () => input.removeEventListener('change', handler);
    },
  };

  return Object.assign(control, behavior.extras || {});
}

/**
 * Campo de texto de una linea.
 * @param {EditorOptions} [options]
 * @returns {Record<string, unknown>}
 */
function text(options = {}) {
  const input = h('input', {
    class: 'z-editor__input',
    type: 'text',
    name: options.name,
    placeholder: options.placeholder,
    maxlength: options.maxLength,
    disabled: options.disabled,
  });
  input.value = isBlank(options.value) ? '' : String(options.value);
  return finish('text', input, options, {
    getValue: () => input.value,
    setValue: (value) => {
      input.value = isBlank(value) ? '' : String(value);
    },
  });
}

/**
 * Campo numerico. `getValue()` devuelve `null` si esta vacio y `NaN` si el
 * texto no es numerico (la validacion lo reporta).
 * @param {EditorOptions} [options]
 * @returns {Record<string, unknown>}
 */
function number(options = {}) {
  const input = h('input', {
    class: 'z-editor__input',
    type: 'number',
    name: options.name,
    placeholder: options.placeholder,
    min: options.min,
    max: options.max,
    step: options.step,
    disabled: options.disabled,
  });
  if (!isBlank(options.value)) input.value = String(options.value);
  return finish('number', input, options, {
    getValue: () => (isBlank(input.value) ? null : Number(input.value)),
    setValue: (value) => {
      input.value = isBlank(value) ? '' : String(value);
    },
  });
}

/**
 * Campo de fecha nativo. `getValue()` devuelve `YYYY-MM-DD` o `null`;
 * `setValue()` acepta `Date`, epoch o texto.
 * @param {EditorOptions} [options]
 * @returns {Record<string, unknown>}
 */
function date(options = {}) {
  const input = h('input', {
    class: 'z-editor__input',
    type: 'date',
    name: options.name,
    placeholder: options.placeholder,
    min: isBlank(options.min) ? undefined : dayValue(options.min),
    max: isBlank(options.max) ? undefined : dayValue(options.max),
    disabled: options.disabled,
  });
  if (!isBlank(options.value)) {
    const day = dayValue(options.value);
    if (day) input.value = day;
  }
  return finish('date', input, options, {
    getValue: () => (isBlank(input.value) ? null : String(input.value)),
    setValue: (value) => {
      if (isBlank(value)) {
        input.value = '';
        return;
      }
      input.value = dayValue(value);
    },
  });
}

/**
 * Lista desplegable. `options.items` acepta `string[]` o
 * `{ value|id, text|label, disabled }[]`.
 * @param {EditorOptions & { items?: unknown }} [options]
 * @returns {Record<string, unknown>}
 */
function select(options = {}) {
  const el = h('select', {
    class: 'z-editor__input',
    name: options.name,
    disabled: options.disabled,
  });
  const items = normalizeOptions(options.items || options.options);

  const rebuild = (list) => {
    while (el.firstChild) el.removeChild(el.firstChild);
    for (const item of list) {
      const option = h('option', { value: item.value, text: item.text });
      if (item.disabled) option.setAttribute('disabled', '');
      el.appendChild(option);
    }
  };

  rebuild(items);
  if (!isBlank(options.value)) el.value = String(options.value);

  return finish('select', el, options, {
    getValue: () => (isBlank(el.value) ? null : String(el.value)),
    setValue: (value) => {
      el.value = isBlank(value) ? '' : String(value);
    },
    extras: {
      /**
       * Reemplaza las opciones.
       * @param {unknown} list
       * @returns {object}
       */
      setOptions(list) {
        const normalized = normalizeOptions(list);
        items.length = 0;
        items.push(...normalized);
        rebuild(items);
        return this;
      },
      /** @returns {{ value: string, text: string, disabled: boolean }[]} */
      get options() {
        return items.map((item) => ({ ...item }));
      },
    },
  });
}

/**
 * Casilla de verificacion. `getValue()` devuelve un booleano.
 * @param {EditorOptions & { text?: string }} [options]
 * @returns {Record<string, unknown>}
 */
function checkbox(options = {}) {
  const input = h('input', {
    class: 'z-editor__input',
    type: 'checkbox',
    name: options.name,
    disabled: options.disabled,
  });
  input.checked = Boolean(options.value);
  if (options.text) input.setAttribute('aria-label', String(options.text));

  return finish('checkbox', input, options, {
    getValue: () => Boolean(input.checked),
    setValue: (value) => {
      input.checked = Boolean(value);
    },
  });
}

const TYPES = { text, number, date, select, checkbox };

/**
 * Crea un control segun `spec.type`.
 * @param {{ type: string } & EditorOptions & Record<string, unknown>} spec
 * @returns {Record<string, unknown>}
 */
function create(spec = {}) {
  const type = spec.type || 'text';
  const factory = TYPES[type];
  if (!factory) throw new Error(`zorzal.editors: tipo desconocido "${type}"`);
  return factory(spec);
}

export const editors = { text, number, date, select, checkbox, create, types: Object.keys(TYPES) };

export default editors;
