/**
 * Traduccion de specs declarativos a specs de Zorzal.
 *
 * La forma de entrada es `{ view, ... }` con hijos en `rows`, `cols`,
 * `elements`, `items` o `body`. La salida siempre es un spec `{ kind, ... }`
 * que `create()` entiende.
 *
 * Vistas cubiertas: layout, toolbar, button, text, label, list, form,
 * template y window. Una vista desconocida se degrada a un `template` con su
 * texto, de modo que una pantalla incompleta no rompe el montaje.
 */

import { getDocument } from '../core/dom.js';
import { mount } from '../core/widget.js';

const BUTTON_VARIANTS = {
  danger: 'danger',
  form: 'primary',
  primary: 'primary',
  ghost: 'ghost',
};

/** @param {unknown} value @returns {unknown[]} */
function asList(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === false) return [];
  return [value];
}

/** @param {unknown} value @returns {string} */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * Vista implicita cuando el spec no trae `view`.
 * @param {Record<string, any>} spec
 * @returns {string|null}
 */
function inferView(spec) {
  if (Array.isArray(spec.rows) || Array.isArray(spec.cols)) return 'layout';
  if (Array.isArray(spec.elements)) return 'form';
  return null;
}

// --- layouts ----------------------------------------------------------

/**
 * @param {unknown} cell
 * @returns {any}
 */
function translateCell(cell) {
  if (cell === undefined || cell === null || cell === false) return null;
  if (typeof cell === 'string' || typeof cell === 'number') return cell;
  if (typeof cell !== 'object') return null;
  return translate(cell);
}

/**
 * @param {Record<string, any>} spec
 * @returns {Record<string, any>}
 */
function translateLayout(spec) {
  const rows = Array.isArray(spec.rows) ? spec.rows : null;
  const cols = Array.isArray(spec.cols) ? spec.cols : null;
  const source = rows || cols || asList(spec.children);
  return {
    kind: 'layout',
    orientation: cols && !rows ? 'horizontal' : 'vertical',
    children: source.map(translateCell).filter((cell) => cell !== null),
  };
}

// --- toolbar ----------------------------------------------------------

/** @param {any} element @param {number} index */
function toolbarEntryId(element, index) {
  if (element.id !== undefined && element.id !== null && element.id !== '') return String(element.id);
  return `toolbarItem${index}`;
}

/**
 * @param {any} element
 * @param {number} index
 * @returns {any}
 */
function translateToolbarEntry(element, index) {
  if (element === undefined || element === null || element === false) return null;
  if (element === '-' || element === '|') return { separator: true };
  if (typeof element === 'string' || typeof element === 'number') return { text: String(element) };
  if (typeof element !== 'object') return null;
  if (typeof element.kind === 'string') return translate(element);
  if (element.separator === true) return { separator: true };

  const view = typeof element.view === 'string' ? element.view : '';
  if (view === 'button') {
    const entry = {
      text: asText(element.value !== undefined ? element.value : element.label),
      disabled: Boolean(element.disabled),
    };
    if (element.icon) entry.icon = element.icon;
    if (element.title) entry.title = element.title;
    if (element.variant) entry.variant = element.variant;
    if (element.id !== undefined && element.id !== null && element.id !== '') entry.id = element.id;
    else if (typeof element.click === 'function') entry.id = toolbarEntryId(element, index);
    return entry;
  }
  if (view === 'label') {
    return { kind: 'label', text: asText(element.label !== undefined ? element.label : element.value) };
  }
  if (view === 'text') return translateText(element);
  if (view === 'spacer') {
    const spacer = { kind: 'spacer' };
    if (element.width !== undefined) spacer.size = element.width;
    return spacer;
  }
  if (view === 'separator') return { separator: true };

  const nested = element.group !== undefined ? element.group : element.items;
  if (Array.isArray(nested)) {
    return {
      group: nested.map(translateToolbarEntry).filter((entry) => entry !== null),
    };
  }
  if (element.label !== undefined || element.text !== undefined) {
    return { kind: 'label', text: asText(element.label !== undefined ? element.label : element.text) };
  }
  return translate(element);
}

/**
 * @param {Record<string, any>} spec
 * @returns {Record<string, any>}
 */
function translateToolbar(spec) {
  const source = Array.isArray(spec.elements)
    ? spec.elements
    : Array.isArray(spec.items)
      ? spec.items
      : asList(spec.cols);
  const items = source.map(translateToolbarEntry).filter((entry) => entry !== null);
  const result = { kind: 'toolbar', items };
  const handlers = new Map();
  source.forEach((element, index) => {
    if (element && typeof element === 'object' && typeof element.click === 'function') {
      handlers.set(toolbarEntryId(element, index), element.click);
    }
  });
  if (handlers.size) {
    result.on = {
      click: (data) => {
        const handler = handlers.get(asText(data && data.id));
        if (handler) handler.call(spec, data && data.id, data && data.event);
      },
    };
  }
  return result;
}

// --- vistas simples ---------------------------------------------------

/** @param {Record<string, any>} spec */
function translateButton(spec) {
  const result = {
    kind: 'button',
    text: asText(spec.value !== undefined ? spec.value : spec.label !== undefined ? spec.label : spec.text),
    disabled: Boolean(spec.disabled),
  };
  if (spec.icon) result.icon = spec.icon;
  if (spec.name) result.name = spec.name;
  if (spec.title) result.title = spec.title;
  const variant = spec.variant || BUTTON_VARIANTS[spec.type];
  if (variant) result.variant = variant;
  if (typeof spec.click === 'function') result.on = { click: spec.click };
  return result;
}

/** @param {Record<string, any>} spec */
function translateText(spec) {
  const result = {
    kind: 'text',
    label: asText(spec.label),
    value: spec.value === undefined || spec.value === null ? '' : spec.value,
    disabled: Boolean(spec.disabled),
    readonly: Boolean(spec.readonly),
  };
  if (spec.name) result.name = spec.name;
  if (spec.placeholder) result.placeholder = asText(spec.placeholder);
  const maxlength = spec.maxlength !== undefined ? spec.maxlength : spec.maxLength;
  if (maxlength !== undefined && maxlength !== null && maxlength !== '') result.maxlength = maxlength;
  return result;
}

/** @param {Record<string, any>} spec */
function translateLabel(spec) {
  return {
    kind: 'label',
    text: asText(spec.text !== undefined ? spec.text : spec.label !== undefined ? spec.label : spec.value),
  };
}

// --- datos ------------------------------------------------------------

/**
 * Normaliza un item de datos a la forma que consume `list`.
 * @param {any} item
 * @param {number} index
 */
function listItem(item, index) {
  if (item === undefined || item === null || typeof item !== 'object') {
    return { id: String(index), text: asText(item) };
  }
  const id = item.id !== undefined ? item.id : item.value !== undefined ? item.value : index;
  return {
    id,
    text: asText(item.text !== undefined ? item.text : item.label !== undefined ? item.label : item.value),
    detail: asText(item.detail !== undefined ? item.detail : item.description),
    disabled: Boolean(item.disabled),
  };
}

/** @param {Record<string, any>} spec */
function translateList(spec) {
  const source = spec.data !== undefined ? spec.data : spec.options !== undefined ? spec.options : spec.items;
  let items = [];
  if (Array.isArray(source)) {
    items = source.map(listItem);
  } else if (source && typeof source === 'object') {
    items = Object.entries(source).map(([key, value], index) =>
      listItem({ id: key, ...(typeof value === 'object' ? value : { value }) }, index)
    );
  }
  const result = { kind: 'list', items };
  if (spec.select !== undefined) result.selected = spec.select;
  else if (spec.selected !== undefined) result.selected = spec.selected;
  if (spec.compact) result.compact = true;
  return result;
}

// --- formularios ------------------------------------------------------

/** @param {Record<string, any>} spec */
function translateForm(spec) {
  const source = spec.elements !== undefined ? spec.elements : spec.rows !== undefined ? spec.rows : spec.fields;
  const fields = asList(source)
    .map(translateCell)
    .filter((field) => field !== null);
  const result = { kind: 'form', fields };
  if (spec.rules && typeof spec.rules === 'object') result.rules = spec.rules;
  if (spec.disabled) result.disabled = true;
  return result;
}

// --- contenido --------------------------------------------------------

/**
 * Convierte los marcadores `#clave#` al formato de plantilla de Zorzal.
 * @param {string} source
 * @returns {string}
 */
function toZorzalTemplate(source) {
  return String(source).replace(/#([\w.$-]+)#/g, (_, key) => `{{ ${key} }}`);
}

/** @param {Record<string, any>} spec */
function translateTemplate(spec) {
  const result = { kind: 'template' };
  if (typeof spec.template === 'function') result.template = spec.template;
  else if (typeof spec.template === 'string') result.template = toZorzalTemplate(spec.template);
  if (spec.value !== undefined) result.value = spec.value;
  else if (spec.data !== undefined) result.value = spec.data;
  else if (spec.content !== undefined) result.value = spec.content;
  return result;
}

/**
 * @param {unknown} value
 * @returns {any}
 */
function translateContent(value) {
  if (value === undefined || value === null || value === false) return undefined;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (Array.isArray(value)) {
    return value.map(translateCell).filter((item) => item !== null);
  }
  if (typeof value === 'object') return translate(value);
  return undefined;
}

// --- ventanas ---------------------------------------------------------

/** @param {Record<string, any>} spec */
function translateWindow(spec) {
  const source = spec.body !== undefined ? spec.body : spec.rows !== undefined ? spec.rows : spec.elements;
  const result = {
    kind: 'window',
    open: spec.open !== false,
    title: asText(spec.head !== undefined ? spec.head : spec.title !== undefined ? spec.title : spec.label),
    modal: Boolean(spec.modal),
  };
  const body = translateContent(source);
  if (body !== undefined) result.body = body;
  const footer = translateContent(spec.footer);
  if (footer !== undefined) result.footer = footer;
  if (spec.width !== undefined) result.width = spec.width;
  if (spec.height !== undefined) result.height = spec.height;
  if (spec.x !== undefined) result.x = spec.x;
  if (spec.y !== undefined) result.y = spec.y;
  if (spec.movable === false) result.movable = false;
  return result;
}

// --- entrada ----------------------------------------------------------

/** @param {Record<string, any>} spec */
function translateFallback(spec) {
  if (typeof spec.template === 'string' || typeof spec.template === 'function') {
    return translateTemplate(spec);
  }
  return {
    kind: 'template',
    value: asText(
      spec.text !== undefined
        ? spec.text
        : spec.label !== undefined
          ? spec.label
          : spec.value !== undefined
            ? spec.value
            : spec.content
    ),
  };
}

/**
 * Traduce un spec declarativo (o una lista) a specs de Zorzal.
 * @param {any} spec
 * @returns {any}
 */
export function translate(spec) {
  if (Array.isArray(spec)) return spec.map(translate);
  if (!spec || typeof spec !== 'object') {
    throw new TypeError('compat.ui: el spec debe ser un objeto');
  }
  if (typeof spec.kind === 'string') return spec;
  const view = typeof spec.view === 'string' ? spec.view : inferView(spec);
  switch (view) {
    case 'layout':
      return translateLayout(spec);
    case 'toolbar':
      return translateToolbar(spec);
    case 'button':
      return translateButton(spec);
    case 'text':
      return translateText(spec);
    case 'label':
      return translateLabel(spec);
    case 'list':
      return translateList(spec);
    case 'form':
      return translateForm(spec);
    case 'template':
      return translateTemplate(spec);
    case 'window':
      return translateWindow(spec);
    default:
      return translateFallback(spec);
  }
}

/**
 * Crea un widget desde un spec declarativo y lo monta.
 *
 * @param {any} spec
 * @param {Element|import('../core/widget.js').Widget|string} [container]
 * @returns {import('../core/widget.js').Widget}
 */
export function ui(spec, container) {
  if (!spec || typeof spec !== 'object') {
    throw new TypeError('compat.ui: el spec debe ser un objeto');
  }
  const translated = Array.isArray(spec)
    ? { kind: 'layout', orientation: 'vertical', children: spec.map(translate) }
    : translate(spec);
  const declared = !Array.isArray(spec) && spec.container !== undefined ? spec.container : undefined;
  const target = container !== undefined ? container : declared !== undefined ? declared : getDocument().body;
  if (!target) throw new Error('compat.ui: no hay contenedor para montar');
  return mount(target, translated);
}

ui.translate = translate;

export default ui;
