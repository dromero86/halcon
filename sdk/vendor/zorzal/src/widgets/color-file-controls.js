/**
 * Controles de color, archivos y agrupacion.
 *
 * - `colorboard`: paleta fija de 40 colores mas una entrada hexadecimal. El
 *   valor es siempre `#rrggbb` en minusculas y cada eleccion emite `change`.
 * - `colorpicker`: campo con el color elegido y su hex; abre un `colorboard`
 *   en un popup y lo cierra al elegir.
 * - `colorselect`: lista de colores con muestra y nombre. El valor es el hex.
 * - `uploader`: seleccion local de archivos por clic o arrastre. Lista nombre
 *   y tamano, expone `getFiles()` y `clear()`, y emite `select`. No sube nada:
 *   el envio queda a cargo de quien usa el widget.
 * - `fieldset`: contenedor con leyenda, borde y contenido; no tiene estado
 *   propio. La validacion pertenece al `form`.
 *
 * La conversion de color sale del servicio `color`; la geometria y los colores
 * viven en `src/zorzal.css` con prefijo `z-`. Solo se escriben variables CSS
 * documentadas (`--z-swatch-color`, `--z-colorpicker-width` y las de tamano),
 * nunca atributos `style` con valores de diseno.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { create } from '../core/widget.js';
import { color } from '../services/color.js';
import { setVar, removeVar, isMeasure, measureOf } from './select-controls.js';

/** Paleta por omision: ocho grises y ocho familias de cuatro tonos. */
export const PALETTE = Object.freeze([
  '#000000',
  '#3b3f46',
  '#6b7280',
  '#9ca3af',
  '#cbd5e1',
  '#e5e7eb',
  '#f3f4f6',
  '#ffffff',
  '#ef4444',
  '#dc2626',
  '#b91c1c',
  '#7f1d1d',
  '#f97316',
  '#ea580c',
  '#c2410c',
  '#7c2d12',
  '#eab308',
  '#ca8a04',
  '#a16207',
  '#713f12',
  '#22c55e',
  '#16a34a',
  '#15803d',
  '#14532d',
  '#14b8a6',
  '#0d9488',
  '#0f766e',
  '#134e4a',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e3a8a',
  '#8b5cf6',
  '#7c3aed',
  '#6d28d9',
  '#4c1d95',
  '#ec4899',
  '#db2777',
  '#be185d',
  '#9d174d',
]);

/** Colores con nombre para `colorselect`. */
const NAMED_COLORS = Object.freeze([
  { value: '#c0392b', text: 'Rojo' },
  { value: '#e67e22', text: 'Naranja' },
  { value: '#f1c40f', text: 'Amarillo' },
  { value: '#1f9d55', text: 'Verde' },
  { value: '#16a085', text: 'Turquesa' },
  { value: '#2f6fed', text: 'Azul' },
  { value: '#8e44ad', text: 'Violeta' },
  { value: '#d81b60', text: 'Rosa' },
  { value: '#795548', text: 'Marron' },
  { value: '#6b7280', text: 'Gris' },
  { value: '#1d2430', text: 'Negro' },
  { value: '#ffffff', text: 'Blanco' },
]);

/** @param {unknown} value @returns {string} */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/** @param {unknown} event */
function prevent(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
}

/** @param {unknown} event */
function stop(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
}

/**
 * Normaliza a `#rrggbb`; un valor invalido o vacio devuelve cadena vacia.
 * @param {unknown} value
 * @returns {string}
 */
export function hexOf(value) {
  if (value === undefined || value === null || value === '') return '';
  try {
    return color.toHex(/** @type {any} */ (value));
  } catch {
    return '';
  }
}

/**
 * Lista de archivos a partir de un array, una `FileList` o nada.
 * @param {unknown} value
 * @returns {any[]}
 */
function filesOf(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.slice();
  if (typeof value === 'object' && typeof (/** @type {any} */ (value).length) === 'number') {
    return Array.from(/** @type {any} */ (value));
  }
  return [];
}

/**
 * Tamano legible: bytes, KB, MB o GB con un decimal.
 * @param {unknown} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  const total = Number(bytes);
  if (!Number.isFinite(total) || total <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = total;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const rounded = index === 0 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded} ${units[index]}`;
}

/**
 * @param {Element} node
 * @param {string} hex
 */
function paintSwatch(node, hex) {
  setVar(node, '--z-swatch-color', hex);
}

// --- colorboard -------------------------------------------------------

/**
 * @param {any} ctx
 * @returns {{ el: Element, update: Function, api: Record<string, unknown> }}
 */
function buildColorboard(ctx) {
  const label = ctx.h('span', { class: 'z-colorboard__label z-hidden' });
  const palette = ctx.h('div', { class: 'z-colorboard__palette', role: 'listbox' });
  const input = ctx.h('input', {
    class: 'z-colorboard__hex',
    type: 'text',
    spellcheck: 'false',
    autocomplete: 'off',
    'aria-label': 'Color hexadecimal',
    placeholder: '#rrggbb',
  });
  const field = ctx.h('div', { class: 'z-colorboard__field' }, [input]);
  const el = ctx.h('div', { class: 'z-colorboard' }, [label, palette, field]);

  let swatches = [];
  let signature = null;

  const current = () => hexOf(ctx.props.value);

  const paint = () => {
    const value = current();
    const disabled = Boolean(ctx.props.disabled);
    for (const swatch of swatches) {
      const selected = swatch.getAttribute('data-value') === value;
      swatch.setAttribute(
        'class',
        cls('z-colorboard__swatch', selected && 'z-colorboard__swatch--selected')
      );
      swatch.setAttribute('aria-selected', selected ? 'true' : 'false');
      swatch.disabled = disabled;
    }
    input.disabled = disabled;
    const doc = ctx.doc();
    if (!doc || doc.activeElement !== input) input.value = value;
  };

  const build = (values) => {
    while (palette.firstChild) palette.removeChild(palette.firstChild);
    swatches = values.map((value) => {
      const hex = hexOf(value) || asText(value);
      const swatch = ctx.h('button', {
        class: 'z-colorboard__swatch',
        type: 'button',
        role: 'option',
        'data-value': hex,
        'aria-label': hex,
        title: hex,
      });
      paintSwatch(swatch, hex);
      palette.appendChild(swatch);
      return swatch;
    });
  };

  /**
   * Fija el valor. `emit` distingue la eleccion del usuario de `setValue`.
   * @param {unknown} value
   * @param {boolean} emit
   * @returns {string}
   */
  const select = (value, emit) => {
    const previous = current();
    const next = hexOf(value);
    ctx.props.value = next;
    paint();
    if (emit && next !== '' && next !== previous) {
      ctx.emit('change', { value: next, previous, hex: next });
    }
    return next;
  };

  const commit = () => {
    const next = hexOf(input.value);
    if (next === '') {
      paint();
      return false;
    }
    select(next, true);
    return true;
  };

  /** Sube desde el nodo hasta la muestra con `data-value`. */
  const swatchOf = (node) => {
    let walk = node;
    while (walk && walk !== palette) {
      if (walk.getAttribute && walk.getAttribute('data-value') !== null) return walk;
      walk = walk.parentNode;
    }
    return null;
  };

  ctx.on(palette, 'click', (event) => {
    if (ctx.props.disabled) return;
    const swatch = swatchOf(event ? event.target : null);
    if (!swatch) return;
    select(swatch.getAttribute('data-value'), true);
  });

  ctx.on(input, 'change', () => {
    if (ctx.props.disabled) return;
    commit();
  });

  ctx.on(input, 'keydown', (event) => {
    if (ctx.props.disabled) return;
    if (event && event.key === 'Enter') {
      prevent(event);
      commit();
    }
  });

  ctx.on(input, 'blur', () => {
    if (ctx.props.disabled) return;
    commit();
  });

  const update = (props) => {
    const text = asText(props.label);
    label.textContent = text;
    label.setAttribute('class', cls('z-colorboard__label', text === '' && 'z-hidden'));
    el.setAttribute(
      'class',
      cls('z-colorboard', props.plain && 'z-colorboard--plain', props.disabled && 'z-colorboard--disabled')
    );
    if (text !== '') input.setAttribute('aria-label', text);
    else input.setAttribute('aria-label', 'Color hexadecimal');

    const values = Array.isArray(props.colors) && props.colors.length ? props.colors : PALETTE;
    const sig = values.join('|');
    if (sig !== signature) {
      signature = sig;
      build(values);
    }
    paint();
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} hex vigente, o cadena vacia */
      getValue() {
        return current();
      },
      /**
       * Fija el valor sin emitir `change`.
       * @param {unknown} value
       * @returns {string}
       */
      setValue(value) {
        return select(value, false);
      },
      /** @returns {Element} contenedor de muestras */
      get palette() {
        return palette;
      },
      /** @returns {HTMLInputElement} entrada hexadecimal */
      get input() {
        return input;
      },
      /** @returns {Element[]} muestras armadas */
      get swatches() {
        return swatches.slice();
      },
      /** @returns {number} cantidad de muestras */
      get count() {
        return swatches.length;
      },
    },
  };
}

// --- colorpicker ------------------------------------------------------

/**
 * @param {any} ctx
 * @returns {{ el: Element, update: Function, destroy: Function, api: Record<string, unknown> }}
 */
function buildColorpicker(ctx) {
  const label = ctx.h('span', { class: 'z-colorpicker__label z-hidden' });
  const preview = ctx.h('span', { class: 'z-colorpicker__preview', 'aria-hidden': 'true' });
  const value = ctx.h('span', { class: 'z-colorpicker__value' });
  const arrow = ctx.h('span', { class: 'z-colorpicker__arrow', 'aria-hidden': 'true' });
  const field = ctx.h(
    'button',
    {
      class: 'z-colorpicker__field',
      type: 'button',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
    },
    [preview, value, arrow]
  );
  const board = create({ kind: 'colorboard', value: hexOf(ctx.props.value), plain: true });
  const popup = ctx.h('div', { class: 'z-colorpicker__popup z-hidden' }, [board.el]);
  const el = ctx.h('div', { class: 'z-colorpicker' }, [label, field, popup]);

  let opened = false;
  let outsideHandler = null;
  let escapeHandler = null;

  const paint = () => {
    const props = ctx.props;
    const hex = hexOf(props.value);
    paintSwatch(preview, hex === '' ? 'transparent' : hex);
    value.textContent = hex === '' ? asText(props.placeholder) || 'Elegir color' : hex;
    field.setAttribute('aria-expanded', opened ? 'true' : 'false');
  };

  const releaseDoc = () => {
    if (outsideHandler) {
      ctx.release(ctx.doc(), 'click', outsideHandler);
      outsideHandler = null;
    }
    if (escapeHandler) {
      ctx.release(ctx.doc(), 'keydown', escapeHandler);
      escapeHandler = null;
    }
  };

  const listenDoc = () => {
    if (outsideHandler) return;
    outsideHandler = (event) => {
      const target = event ? event.target : null;
      if (target && el.contains && el.contains(target)) return;
      hide('outside');
    };
    ctx.on(ctx.doc(), 'click', outsideHandler);
    escapeHandler = (event) => {
      if (event && event.key === 'Escape') hide('escape');
    };
    ctx.on(ctx.doc(), 'keydown', escapeHandler);
  };

  const hide = (reason = 'api') => {
    if (!opened) return false;
    opened = false;
    releaseDoc();
    popup.setAttribute('class', 'z-colorpicker__popup z-hidden');
    paint();
    return true;
  };

  const show = () => {
    if (ctx.props.disabled) return false;
    if (!opened) {
      opened = true;
      popup.setAttribute('class', 'z-colorpicker__popup');
      listenDoc();
    }
    paint();
    return true;
  };

  /**
   * @param {unknown} raw
   * @param {boolean} emit
   * @returns {string}
   */
  const select = (raw, emit) => {
    const previous = hexOf(ctx.props.value);
    const next = hexOf(raw);
    ctx.props.value = next;
    board.setValue(next);
    paint();
    if (emit && next !== '' && next !== previous) {
      ctx.emit('change', { value: next, previous, hex: next });
    }
    return next;
  };

  board.on('change', (data) => {
    if (!data) return;
    select(data.value, true);
    hide('select');
  });

  ctx.on(field, 'click', () => {
    if (ctx.props.disabled) return;
    if (opened) hide('toggle');
    else show();
  });

  const update = (props) => {
    const text = asText(props.label);
    label.textContent = text;
    label.setAttribute('class', cls('z-colorpicker__label', text === '' && 'z-hidden'));
    el.setAttribute(
      'class',
      cls(
        'z-colorpicker',
        props.plain && 'z-colorpicker--plain',
        props.disabled && 'z-colorpicker--disabled'
      )
    );
    field.disabled = Boolean(props.disabled);
    if (text !== '') field.setAttribute('aria-label', text);
    else field.removeAttribute('aria-label');
    if (isMeasure(props.width)) setVar(el, '--z-colorpicker-width', measureOf(props.width));
    else removeVar(el, '--z-colorpicker-width');
    board.set({
      value: hexOf(props.value),
      disabled: Boolean(props.disabled),
      plain: true,
    });
    if (props.disabled && opened) hide('disabled');
    paint();
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => {
      hide('destroy');
      board.destroy();
    },
    api: {
      /** @returns {string} hex vigente, o cadena vacia */
      getValue() {
        return hexOf(ctx.props.value);
      },
      /**
       * Fija el valor sin emitir `change`.
       * @param {unknown} value
       * @returns {string}
       */
      setValue(raw) {
        return select(raw, false);
      },
      /** Abre el popup. @returns {boolean} */
      show,
      /** Cierra el popup. @returns {boolean} */
      hide(reason) {
        return hide(reason);
      },
      /** @returns {boolean} */
      get open() {
        return opened;
      },
      /** @returns {boolean} */
      get isOpen() {
        return opened;
      },
      /** @returns {Element} boton del campo */
      get field() {
        return field;
      },
      /** @returns {HTMLInputElement} */
      get input() {
        return board.input;
      },
      /** @returns {Element} popup */
      get popup() {
        return popup;
      },
      /** @returns {any} instancia interna de `colorboard` */
      get board() {
        return board;
      },
    },
  };
}

// --- colorselect ------------------------------------------------------

/**
 * @param {unknown} options
 * @returns {{ value: string, text: string, source: unknown }[]}
 */
export function colorOptions(options) {
  const list = Array.isArray(options) && options.length ? options : NAMED_COLORS;
  return list.map((option) => {
    if (option === null || option === undefined) return { value: '', text: '', source: option };
    if (typeof option === 'object') {
      const raw = /** @type {any} */ (option).value !== undefined
        ? /** @type {any} */ (option).value
        : /** @type {any} */ (option).id;
      const hex = hexOf(raw) || asText(raw);
      const text =
        /** @type {any} */ (option).text !== undefined
          ? /** @type {any} */ (option).text
          : /** @type {any} */ (option).label !== undefined
            ? /** @type {any} */ (option).label
            : hex;
      return { value: hex, text: asText(text), source: option };
    }
    const hex = hexOf(option) || asText(option);
    return { value: hex, text: hex, source: option };
  });
}

/**
 * @param {any} ctx
 * @returns {{ el: Element, update: Function, api: Record<string, unknown> }}
 */
function buildColorselect(ctx) {
  const label = ctx.h('span', { class: 'z-colorselect__label z-hidden' });
  const list = ctx.h('div', { class: 'z-colorselect__list', role: 'listbox' });
  const el = ctx.h('div', { class: 'z-colorselect' }, [label, list]);

  let items = [];
  let signature = null;

  const current = () => hexOf(ctx.props.value);

  const paint = () => {
    const value = current();
    const disabled = Boolean(ctx.props.disabled);
    for (const item of items) {
      const selected = item.value === value;
      item.el.setAttribute(
        'class',
        cls('z-colorselect__item', selected && 'z-colorselect__item--selected')
      );
      item.el.setAttribute('aria-selected', selected ? 'true' : 'false');
      item.el.disabled = disabled;
    }
  };

  const build = (options) => {
    while (list.firstChild) list.removeChild(list.firstChild);
    items = colorOptions(options).map((option) => {
      const row = ctx.h('button', {
        class: 'z-colorselect__item',
        type: 'button',
        role: 'option',
        'data-value': option.value,
        'aria-selected': 'false',
      });
      const swatch = ctx.h('span', { class: 'z-colorselect__swatch', 'aria-hidden': 'true' });
      paintSwatch(swatch, option.value === '' ? 'transparent' : option.value);
      const text = ctx.h('span', { class: 'z-colorselect__text' });
      text.appendChild(ctx.doc().createTextNode(option.text));
      row.appendChild(swatch);
      row.appendChild(text);
      list.appendChild(row);
      return { ...option, el: row };
    });
  };

  /**
   * @param {unknown} raw
   * @param {boolean} emit
   * @returns {string}
   */
  const select = (raw, emit) => {
    const previous = current();
    const next = hexOf(raw);
    ctx.props.value = next;
    paint();
    if (emit && next !== '' && next !== previous) {
      const found = items.find((item) => item.value === next);
      ctx.emit('change', {
        value: next,
        previous,
        item: found ? found.source : undefined,
        text: found ? found.text : next,
      });
    }
    return next;
  };

  /** @param {Node|null} node */
  const itemOfNode = (node) => {
    let walk = node;
    while (walk) {
      const found = items.find((item) => item.el === walk);
      if (found) return found;
      walk = walk.parentNode;
    }
    return null;
  };

  ctx.on(list, 'click', (event) => {
    if (ctx.props.disabled) return;
    const item = itemOfNode(event ? event.target : null);
    if (!item) return;
    select(item.value, true);
  });

  const update = (props) => {
    const text = asText(props.label);
    label.textContent = text;
    label.setAttribute('class', cls('z-colorselect__label', text === '' && 'z-hidden'));
    el.setAttribute(
      'class',
      cls(
        'z-colorselect',
        props.plain && 'z-colorselect--plain',
        props.disabled && 'z-colorselect--disabled'
      )
    );
    if (isMeasure(props.width)) setVar(el, '--z-colorselect-width', measureOf(props.width));
    else removeVar(el, '--z-colorselect-width');

    const options = Array.isArray(props.options) && props.options.length ? props.options : NAMED_COLORS;
    const sig = options
      .map((option) => (option && typeof option === 'object' ? `${option.value}|${option.text}` : String(option)))
      .join('|');
    if (sig !== signature) {
      signature = sig;
      build(options);
    }
    paint();
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} hex vigente, o cadena vacia */
      getValue() {
        return current();
      },
      /**
       * Fija el valor sin emitir `change`.
       * @param {unknown} value
       * @returns {string}
       */
      setValue(value) {
        return select(value, false);
      },
      /** @returns {Element} contenedor de la lista */
      get list() {
        return list;
      },
      /** @returns {number} cantidad de opciones armadas */
      get count() {
        return items.length;
      },
      /** @returns {string[]} hex de las opciones */
      get colors() {
        return items.map((item) => item.value);
      },
    },
  };
}

// --- uploader ---------------------------------------------------------

/**
 * @param {any} ctx
 * @returns {{ el: Element, update: Function, api: Record<string, unknown> }}
 */
function buildUploader(ctx) {
  const input = ctx.h('input', {
    class: 'z-uploader__input z-hidden',
    type: 'file',
    tabindex: '-1',
  });
  const hint = ctx.h('span', { class: 'z-uploader__hint' });
  const browse = ctx.h('button', { class: 'z-uploader__browse', type: 'button' });
  const drop = ctx.h('div', { class: 'z-uploader__drop', role: 'button', tabindex: '0' }, [
    hint,
    browse,
  ]);
  const list = ctx.h('ul', { class: 'z-uploader__list' });
  const el = ctx.h('div', { class: 'z-uploader' }, [input, drop, list]);

  let selected = [];

  const paint = () => {
    while (list.firstChild) list.removeChild(list.firstChild);
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      const item = ctx.h('li', { class: 'z-uploader__item', 'data-index': index });
      const name = ctx.h('span', { class: 'z-uploader__name' });
      name.appendChild(ctx.doc().createTextNode(file.name));
      name.setAttribute('title', file.name);
      const size = ctx.h('span', { class: 'z-uploader__size' });
      size.appendChild(ctx.doc().createTextNode(formatSize(file.size)));
      const remove = ctx.h('button', {
        class: 'z-uploader__remove',
        type: 'button',
        'data-index': index,
        'aria-label': `Quitar ${file.name}`,
        title: `Quitar ${file.name}`,
      });
      remove.appendChild(ctx.doc().createTextNode('\u00d7'));
      item.appendChild(name);
      item.appendChild(size);
      item.appendChild(remove);
      list.appendChild(item);
    }
    list.setAttribute('class', cls('z-uploader__list', selected.length === 0 && 'z-hidden'));
  };

  /**
   * @param {unknown} incoming
   * @param {boolean} emit
   * @returns {{ name: string, size: number, type: string }[]}
   */
  const add = (incoming, emit = true) => {
    const files = filesOf(incoming);
    if (files.length === 0) return selected.slice();
    const mapped = files.map((file) => ({
      name: asText(file && file.name) || 'archivo',
      size: Math.max(0, Number(file && file.size) || 0),
      type: asText(file && file.type),
    }));
    selected = ctx.props.multiple === false ? mapped.slice(0, 1) : [...selected, ...mapped];
    paint();
    if (emit) ctx.emit('select', { files: selected.slice() });
    return selected.slice();
  };

  /**
   * @param {boolean} emit
   * @returns {{ name: string, size: number }[]}
   */
  const clear = (emit = true) => {
    selected = [];
    input.value = '';
    paint();
    if (emit) ctx.emit('clear', { files: [] });
    return [];
  };

  const removeAt = (index) => {
    if (index < 0 || index >= selected.length) return selected.slice();
    const [removed] = selected.splice(index, 1);
    paint();
    ctx.emit('remove', { file: removed, files: selected.slice() });
    return selected.slice();
  };

  /** @param {Node|null} node */
  const indexOfNode = (node) => {
    let walk = node;
    while (walk) {
      const raw = walk.getAttribute ? walk.getAttribute('data-index') : null;
      if (raw !== null) return Number(raw);
      walk = walk.parentNode;
    }
    return -1;
  };

  drop.appendChild(input);

  ctx.on(drop, 'click', () => {
    if (ctx.props.disabled) return;
    if (typeof input.click === 'function') input.click();
  });

  ctx.on(browse, 'click', (event) => {
    if (ctx.props.disabled) return;
    prevent(event);
    stop(event);
    if (typeof input.click === 'function') input.click();
  });

  ctx.on(drop, 'keydown', (event) => {
    if (ctx.props.disabled) return;
    if (event && (event.key === 'Enter' || event.key === ' ')) {
      prevent(event);
      if (typeof input.click === 'function') input.click();
    }
  });

  for (const type of ['dragenter', 'dragover']) {
    ctx.on(drop, type, (event) => {
      if (ctx.props.disabled) return;
      prevent(event);
      drop.classList.add('z-uploader__drop--over');
    });
  }

  ctx.on(drop, 'dragleave', () => {
    drop.classList.remove('z-uploader__drop--over');
  });

  ctx.on(drop, 'drop', (event) => {
    if (ctx.props.disabled) return;
    prevent(event);
    stop(event);
    drop.classList.remove('z-uploader__drop--over');
    const transfer = event ? event.dataTransfer : null;
    add(transfer ? transfer.files : null);
  });

  ctx.on(input, 'change', () => {
    if (ctx.props.disabled) return;
    add(input.files);
    input.value = '';
  });

  ctx.on(list, 'click', (event) => {
    if (ctx.props.disabled) return;
    const index = indexOfNode(event ? event.target : null);
    if (index < 0) return;
    prevent(event);
    stop(event);
    removeAt(index);
  });

  const update = (props) => {
    el.setAttribute(
      'class',
      cls(
        'z-uploader',
        props.disabled && 'z-uploader--disabled',
        props.multiple === false && 'z-uploader--single',
        props.plain && 'z-uploader--plain'
      )
    );
    hint.textContent = asText(props.hint) || 'Arrastra archivos aqui o hace clic para elegirlos';
    browse.textContent = asText(props.buttonText) || 'Elegir archivos';
    if (props.accept) input.setAttribute('accept', asText(props.accept));
    else input.removeAttribute('accept');
    if (props.multiple === false) input.removeAttribute('multiple');
    else input.setAttribute('multiple', '');
    input.disabled = Boolean(props.disabled);
    drop.setAttribute('aria-disabled', props.disabled ? 'true' : 'false');
    if (isMeasure(props.width)) setVar(el, '--z-uploader-width', measureOf(props.width));
    else removeVar(el, '--z-uploader-width');
    paint();
  };
  update(ctx.props);
  paint();

  return {
    el,
    update,
    api: {
      /** @returns {{ name: string, size: number, type: string }[]} copia de la lista */
      getFiles() {
        return selected.map((file) => ({ ...file }));
      },
      /**
       * Vacia la seleccion. Emite `clear`.
       * @returns {any[]}
       */
      clear() {
        return clear(true);
      },
      /**
       * Agrega archivos por API y emite `select`.
       * @param {unknown} files
       * @returns {any[]}
       */
      add(files) {
        return add(files, true);
      },
      /** @returns {HTMLInputElement} */
      get input() {
        return input;
      },
      /** @returns {Element} zona de arrastre */
      get drop() {
        return drop;
      },
      /** @returns {Element} lista de archivos */
      get list() {
        return list;
      },
      /** @returns {number} cantidad de archivos */
      get count() {
        return selected.length;
      },
    },
  };
}

// --- fieldset ---------------------------------------------------------

/**
 * @param {any} ctx
 * @returns {{ el: Element, update: Function, api: Record<string, unknown> }}
 */
function buildFieldset(ctx) {
  const legend = ctx.h('legend', { class: 'z-fieldset__legend' });
  const body = ctx.h('div', { class: 'z-fieldset__body' });
  const el = ctx.h('fieldset', { class: 'z-fieldset' }, [legend, body]);

  const setLegend = (text) => {
    ctx.props.legend = asText(text);
    legend.textContent = ctx.props.legend;
    legend.setAttribute('class', cls('z-fieldset__legend', ctx.props.legend === '' && 'z-hidden'));
    return ctx.props.legend;
  };

  const update = (props) => {
    const text = asText(props.legend !== undefined ? props.legend : props.title);
    legend.textContent = text;
    legend.setAttribute('class', cls('z-fieldset__legend', text === '' && 'z-hidden'));
    el.setAttribute(
      'class',
      cls(
        'z-fieldset',
        props.plain && 'z-fieldset--plain',
        props.disabled && 'z-fieldset--disabled'
      )
    );
    if (props.disabled) el.setAttribute('disabled', '');
    else el.removeAttribute('disabled');
    ctx.content(body, props.body !== undefined ? props.body : props.children);
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /**
       * Cambia la leyenda sin rearmar el contenido.
       * @param {unknown} text
       * @returns {string}
       */
      setLegend(text) {
        return setLegend(text);
      },
      /** @returns {string} */
      get legend() {
        return asText(ctx.props.legend);
      },
      /** @returns {Element} */
      get legendEl() {
        return legend;
      },
      /** @returns {Element} */
      get body() {
        return body;
      },
    },
  };
}

define('colorboard', buildColorboard);
define('colorpicker', buildColorpicker);
define('colorselect', buildColorselect);
define('uploader', buildUploader);
define('fieldset', buildFieldset);

/** Nombres registrados por este modulo. */
export const COLOR_FILE_CONTROLS = [
  'colorboard',
  'colorpicker',
  'colorselect',
  'uploader',
  'fieldset',
];
