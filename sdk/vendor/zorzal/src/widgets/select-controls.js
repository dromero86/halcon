/**
 * Controles de seleccion: suggest, checksuggest, select, richselect y combo.
 *
 * Los cinco comparten una base: un campo, una lista flotante de opciones, el
 * filtro por texto, el recorrido con flechas, Enter y Escape, y el cierre por
 * clic fuera. Cada tipo solo cambia el modelo de valor y el modo del campo:
 *
 * - `suggest`: campo editable que filtra la lista; el valor es la opcion
 *   elegida y un texto suelto no se conserva al cerrar.
 * - `checksuggest`: igual que `suggest` pero el valor es un array de opciones
 *   seleccionadas y la lista queda abierta para seguir marcando.
 * - `select`: campo cerrado y de solo lectura que abre la lista completa; el
 *   valor es el de la opcion elegida.
 * - `richselect`: `select` con plantilla por opcion (`template(text, item)`),
 *   pensada para dos lineas, iconos o marcado propio, sin edicion de texto.
 * - `combo`: campo editable que filtra y ademas acepta texto libre.
 *
 * Los estilos viven en `src/zorzal.css` con prefijo `z-`; la unica escritura
 * inline es la variable `--z-suggest-width` cuando se pasa `width`.
 *
 * La factory `buildControl` y los helpers de opciones se exportan para que
 * `multi-controls.js` arme los controles de seleccion multiple sobre esta
 * misma base, sin repetir el filtro ni el manejo de teclado.
 */

import { define } from '../core/registry.js';
import { cls, isNode } from '../core/dom.js';
import { create, Widget } from '../core/widget.js';

/** @param {unknown} value */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/** @param {unknown} event */
function prevent(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
}

/**
 * @param {unknown} options
 * @returns {{ value: string, text: string, disabled: boolean, source: unknown }[]}
 */
export function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((option) => {
    if (option === null || option === undefined) {
      return { value: '', text: '', disabled: false, source: option };
    }
    if (typeof option === 'object') {
      const value = option.value !== undefined ? option.value : option.id;
      const label = option.text !== undefined ? option.text : option.label;
      return {
        value: asText(value),
        text: asText(label !== undefined ? label : value),
        disabled: Boolean(option.disabled),
        source: option,
      };
    }
    return { value: asText(option), text: asText(option), disabled: false, source: option };
  });
}

/**
 * Valor multiple como lista de strings.
 * @param {unknown} value
 * @returns {string[]}
 */
export function valuesOf(value) {
  if (Array.isArray(value)) return value.map(asText);
  if (value === undefined || value === null || value === '') return [];
  return [asText(value)];
}

/**
 * Escribe una variable CSS en el nodo. En el navegador usa `setProperty`
 * (unica via valida para custom properties); en el DOM minimo de los tests,
 * donde `style` es un objeto plano, asigna la propiedad.
 *
 * @param {Element} el
 * @param {string} name
 * @param {string} value
 */
export function setVar(el, name, value) {
  const style = el && el.style;
  if (!style) return;
  if (typeof style.setProperty === 'function') style.setProperty(name, value);
  else style[name] = value;
}

/**
 * @param {Element} el
 * @param {string} name
 */
export function removeVar(el, name) {
  const style = el && el.style;
  if (!style) return;
  if (typeof style.removeProperty === 'function') style.removeProperty(name);
  else delete style[name];
}

/**
 * @param {unknown} value
 * @returns {boolean} true si es un numero o una medida CSS usable
 */
export function isMeasure(value) {
  if (value === undefined || value === null || value === '') return false;
  return typeof value === 'string' || Number.isFinite(Number(value));
}

/** @param {unknown} value @returns {string} */
export function measureOf(value) {
  return typeof value === 'number' ? `${value}px` : asText(value);
}

/**
 * Coloca el resultado de una plantilla: texto, nodo, instancia o spec. Los
 * widgets creados se guardan para destruirlos al rearmar la lista.
 *
 * @param {any} ctx
 * @param {Element} host
 * @param {unknown} value
 * @param {any[]} created
 */
function placeContent(ctx, host, value, created) {
  if (value === undefined || value === null || value === false) return;
  if (Array.isArray(value)) {
    for (const entry of value) placeContent(ctx, host, entry, created);
    return;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    host.appendChild(ctx.doc().createTextNode(String(value)));
    return;
  }
  if (isNode(value)) {
    host.appendChild(value);
    return;
  }
  if (value instanceof Widget) {
    host.appendChild(value.el);
    created.push(value);
    return;
  }
  if (typeof value === 'object' && typeof value.kind === 'string') {
    const child = create(value);
    host.appendChild(child.el);
    created.push(child);
    return;
  }
  host.appendChild(ctx.doc().createTextNode(String(value)));
}

/**
 * Factory compartida por los cinco controles y por los de seleccion multiple.
 *
 * @param {any} ctx
 * @param {{ kind: string, editable?: boolean, multiple?: boolean, freeText?: boolean, template?: boolean, tags?: boolean }} config
 */
export function buildControl(ctx, config) {
  const kind = config.kind;
  const multiple = Boolean(config.multiple);
  const editable = Boolean(config.editable);
  const freeText = Boolean(config.freeText);
  const useTemplate = Boolean(config.template);
  const tags = Boolean(config.tags);

  const label = ctx.h('span', { class: 'z-select-control__label z-hidden' });
  const input = ctx.h('input', {
    class: 'z-select-control__input',
    type: 'text',
    role: 'combobox',
    autocomplete: 'off',
    'aria-autocomplete': 'list',
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
  });
  const arrow = ctx.h('span', { class: 'z-select-control__arrow', 'aria-hidden': 'true' });
  const chipList = tags ? ctx.h('div', { class: 'z-suggest-tags' }) : null;
  const field = ctx.h('div', { class: 'z-select-control__field' }, [input, arrow]);
  const list = ctx.h('div', { class: cls('z-suggest__list', 'z-hidden'), role: 'listbox' });
  const empty = ctx.h('div', { class: cls('z-suggest__empty', 'z-hidden') });
  const el = ctx.h(
    'div',
    { class: cls('z-select-control', `z-${kind}`) },
    chipList ? [label, chipList, field, list] : [label, field, list]
  );

  let items = [];
  let visible = [];
  let active = -1;
  let opened = false;
  let query = '';
  let signature = null;
  let templateSource;
  let created = [];
  let outsideHandler = null;
  let escapeHandler = null;

  const clearCreated = () => {
    for (const instance of created) instance.destroy();
    created = [];
  };

  /** @param {unknown} value */
  const itemFor = (value) => items.find((item) => item.value === asText(value)) || null;

  /** Sube por el arbol de la etiqueta hasta el valor marcado con `data-value`. */
  const chipValueOf = (node) => {
    let current = node;
    while (current && current !== chipList) {
      const value = current.getAttribute ? current.getAttribute('data-value') : null;
      if (value !== null) return value;
      current = current.parentNode;
    }
    return null;
  };

  /** Redibuja las etiquetas visibles del valor multiple. */
  const paintTags = () => {
    if (!chipList) return;
    while (chipList.firstChild) chipList.removeChild(chipList.firstChild);
    for (const value of valuesOf(ctx.props.value)) {
      const found = itemFor(value);
      const text = found ? found.text : value;
      const chip = ctx.h('span', { class: 'z-suggest-tag', 'data-value': value });
      const body = ctx.h('span', { class: 'z-suggest-tag__text' });
      body.appendChild(ctx.doc().createTextNode(text));
      const remove = ctx.h('button', {
        class: 'z-suggest-tag__remove',
        type: 'button',
        'aria-label': `Quitar ${text}`,
        title: `Quitar ${text}`,
      });
      remove.appendChild(ctx.doc().createTextNode('\u00d7'));
      chip.appendChild(body);
      chip.appendChild(remove);
      chipList.appendChild(chip);
    }
  };

  const display = () => {
    if (multiple) {
      const texts = valuesOf(ctx.props.value).map((value) => {
        const found = itemFor(value);
        return found ? found.text : value;
      });
      return texts.join(asText(ctx.props.separator) || ', ');
    }
    const raw = asText(ctx.props.value);
    if (raw === '') return '';
    const found = itemFor(raw);
    if (found) return found.text;
    return freeText ? raw : '';
  };

  const paintInput = () => {
    let next = opened && editable ? query : tags ? '' : display();
    // Los controles derivados (por ejemplo mentionsuggest) pueden conservar un
    // texto propio en el campo sin cambiar el filtro de la lista.
    if (typeof config.fieldText === 'function') {
      next = asText(config.fieldText({ opened, query, value: ctx.props.value, text: next, input }));
    }
    if (input.value !== next) input.value = next;
    input.setAttribute('aria-expanded', opened ? 'true' : 'false');
    paintTags();
  };

  const paintRows = () => {
    const selected = new Set(valuesOf(ctx.props.value));
    const activeItem = active >= 0 ? visible[active] : null;
    for (const item of items) {
      const isSelected = selected.has(item.value);
      const shown = visible.includes(item);
      item.el.setAttribute(
        'class',
        cls(
          'z-suggest__item',
          multiple && 'z-checksuggest__item',
          isSelected && 'z-suggest__item--selected',
          item === activeItem && 'z-suggest__item--active',
          item.disabled && 'z-suggest__item--disabled',
          !shown && 'z-hidden'
        )
      );
      item.el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      item.el.setAttribute('aria-disabled', item.disabled ? 'true' : 'false');
      if (item.check) item.check.checked = isSelected;
    }
    const none = visible.length === 0;
    empty.setAttribute('class', cls('z-suggest__empty', !none && 'z-hidden'));
    if (none) empty.textContent = asText(ctx.props.emptyText) || 'Sin opciones';
  };

  const listClass = (isOpen) => {
    list.setAttribute('class', cls('z-suggest__list', isOpen && 'z-suggest__list--open', !isOpen && 'z-hidden'));
  };

  /** @param {unknown} needle */
  const applyFilter = (needle) => {
    const target = asText(needle).trim().toLowerCase();
    visible = target === ''
      ? items.slice()
      : items.filter(
        (item) => item.text.toLowerCase().includes(target) || item.value.toLowerCase().includes(target)
      );
    if (config.autoActive) {
      const first = visible.findIndex((item) => !item.disabled);
      if (active < 0 || active >= visible.length || visible[active] === undefined) active = first;
    } else if (active >= visible.length) {
      active = visible.length ? 0 : -1;
    }
    paintRows();
    return visible;
  };

  const rebuild = () => {
    clearCreated();
    while (list.firstChild) list.removeChild(list.firstChild);
    items = normalizeOptions(ctx.props.options).map((option) => {
      const row = ctx.h('div', {
        class: cls('z-suggest__item', multiple && 'z-checksuggest__item'),
        role: 'option',
        'data-value': option.value,
        'aria-selected': 'false',
      });
      const check = multiple
        ? ctx.h('input', { class: 'z-checksuggest__check', type: 'checkbox', tabindex: '-1' })
        : null;
      if (check) row.appendChild(check);
      const content = ctx.h('span', { class: 'z-suggest__text' });
      if (useTemplate && typeof ctx.props.template === 'function') {
        placeContent(ctx, content, ctx.props.template(option.text, option.source), created);
      } else {
        content.appendChild(ctx.doc().createTextNode(option.text));
      }
      row.appendChild(content);
      list.appendChild(row);
      return { ...option, el: row, check };
    });
    list.appendChild(empty);
    visible = items.slice();
    active = -1;
    return items;
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
    query = '';
    active = -1;
    releaseDoc();
    listClass(false);
    paintRows();
    paintInput();
    return true;
  };

  const reveal = () => {
    if (ctx.props.disabled) return false;
    if (!opened) {
      opened = true;
      active = -1;
      listClass(true);
      listenDoc();
    }
    applyFilter(query);
    paintInput();
    return true;
  };

  const show = () => {
    query = '';
    return reveal();
  };

  /**
   * Agrega un valor al array y emite `change`. Sin duplicados.
   * @param {unknown} value
   * @returns {string[]} el valor vigente
   */
  const addValue = (value) => {
    const current = valuesOf(ctx.props.value);
    const text = asText(value);
    if (!multiple || text === '' || current.includes(text)) return current.slice();
    const found = itemFor(text);
    const next = [...current, text];
    ctx.props.value = next;
    paintRows();
    paintInput();
    ctx.emit('change', { value: next.slice(), item: found ? found.source : undefined });
    return next.slice();
  };

  /**
   * Quita un valor del array y emite `change` si estaba presente.
   * @param {unknown} value
   * @returns {string[]} el valor vigente
   */
  const removeValue = (value) => {
    const current = valuesOf(ctx.props.value);
    const text = asText(value);
    if (!multiple || !current.includes(text)) return current.slice();
    const next = current.filter((entry) => entry !== text);
    const found = itemFor(text);
    ctx.props.value = next;
    paintRows();
    paintInput();
    ctx.emit('change', { value: next.slice(), item: found ? found.source : undefined });
    return next.slice();
  };

  /**
   * @param {{ value: string, text: string, source: unknown }} item
   * @returns {boolean}
   */
  const choose = (item) => {
    if (!item || item.disabled) return false;
    const data = { value: item.value, text: item.text, item: item.source };
    if (multiple) {
      const current = valuesOf(ctx.props.value);
      const next = current.includes(item.value)
        ? current.filter((value) => value !== item.value)
        : [...current, item.value];
      ctx.props.value = next;
      paintRows();
      ctx.emit('select', { ...data, value: item.value });
      ctx.emit('change', { value: next.slice(), item: item.source });
      if (ctx.props.closeOnSelect) hide('select');
      else paintInput();
      return true;
    }
    if (typeof config.selection === 'function') {
      const result = config.selection(item, { text: input.value, value: ctx.props.value });
      if (result) {
        ctx.props.value = result.value;
        if (result.text !== undefined && result.text !== null) input.value = asText(result.text);
        const label = result.label !== undefined ? result.label : data.text;
        hide('select');
        paintRows();
        ctx.emit('select', { ...data, text: label });
        ctx.emit('change', { value: result.value, item: item.source, text: label });
        return true;
      }
    }
    ctx.props.value = item.value;
    hide('select');
    paintRows();
    ctx.emit('select', data);
    ctx.emit('change', { value: item.value, item: item.source });
    return true;
  };

  const commitQuery = () => {
    if (!freeText || !opened) return false;
    const typed = query.trim();
    if (typed === '') return false;
    const match = items.find((item) => !item.disabled && (item.text === typed || item.value === typed));
    if (multiple) {
      if (match && valuesOf(ctx.props.value).includes(match.value)) {
        query = '';
        reveal();
        return false;
      }
      if (match) return choose(match);
      addValue(typed);
      query = '';
      reveal();
      return true;
    }
    if (match) return choose(match);
    if (typed === asText(ctx.props.value)) {
      hide('commit');
      return false;
    }
    ctx.props.value = typed;
    hide('commit');
    paintRows();
    ctx.emit('change', { value: typed });
    return true;
  };

  /** @param {Node|null} node */
  const itemOfNode = (node) => {
    let current = node;
    while (current) {
      const found = items.find((item) => item.el === current);
      if (found) return found;
      current = current.parentNode;
    }
    return null;
  };

  const move = (delta) => {
    if (visible.length === 0) {
      active = -1;
      paintRows();
      return;
    }
    let index = active;
    for (let step = 0; step < visible.length; step += 1) {
      index = (index + delta + visible.length) % visible.length;
      if (!visible[index].disabled) break;
    }
    active = index;
    paintRows();
  };

  ctx.on(field, 'click', () => {
    if (ctx.props.disabled) return;
    if (opened) return;
    show();
    if (editable && typeof input.focus === 'function') input.focus();
  });

  ctx.on(list, 'mousedown', (event) => prevent(event));
  ctx.on(list, 'click', (event) => {
    if (ctx.props.disabled) return;
    const item = itemOfNode(event ? event.target : null);
    if (!item) return;
    choose(item);
  });

  if (chipList) {
    ctx.on(chipList, 'mousedown', (event) => prevent(event));
    ctx.on(chipList, 'click', (event) => {
      const value = chipValueOf(event ? event.target : null);
      if (value === null) return;
      prevent(event);
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      if (ctx.props.disabled) return;
      removeValue(value);
      if (editable && typeof input.focus === 'function') input.focus();
    });
  }

  ctx.on(input, 'input', () => {
    if (ctx.props.disabled || !editable) return;
    let next = input.value;
    // Un control derivado puede filtrar por una parte del texto (mentionsuggest)
    // o pedir que se cierre la lista devolviendo `false`.
    if (typeof config.queryText === 'function') {
      const out = config.queryText(input.value, input);
      if (out === false || out === null || out === undefined) {
        hide('filter');
        return;
      }
      next = asText(out);
    }
    query = next;
    reveal();
    ctx.emit('input', { value: input.value, text: query });
  });

  ctx.on(input, 'keydown', (event) => {
    if (ctx.props.disabled) return;
    const key = event ? event.key : '';
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      prevent(event);
      if (!opened) show();
      move(key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (key === 'Enter') {
      if (!opened) return;
      prevent(event);
      if (active >= 0 && visible[active]) choose(visible[active]);
      else if (freeText) commitQuery();
      return;
    }
    if (key === 'Escape') {
      prevent(event);
      hide('escape');
    }
  });

  ctx.on(input, 'blur', () => {
    if (!opened) return;
    if (freeText) commitQuery();
    else hide('blur');
  });

  const select = (value) => {
    if (multiple) {
      const next = valuesOf(value);
      ctx.props.value = next;
      paintRows();
      paintInput();
      return next.slice();
    }
    const next = asText(value);
    ctx.props.value = next;
    paintRows();
    paintInput();
    return next;
  };

  const update = (props) => {
    const text = asText(props.label);
    label.textContent = text;
    label.setAttribute('class', cls('z-select-control__label', text === '' && 'z-hidden'));
    el.setAttribute(
      'class',
      cls(
        'z-select-control',
        `z-${kind}`,
        props.disabled && `z-${kind}--disabled`,
        props.plain && `z-${kind}--plain`,
        multiple && `z-${kind}--multiple`,
        tags && `z-${kind}--tags`
      )
    );
    if (text !== '') input.setAttribute('aria-label', text);
    else input.removeAttribute('aria-label');
    input.setAttribute('placeholder', asText(props.placeholder));
    if (props.name) input.setAttribute('name', asText(props.name));
    else input.removeAttribute('name');
    if (props.disabled) input.setAttribute('disabled', '');
    else input.removeAttribute('disabled');
    list.setAttribute('aria-multiselectable', multiple ? 'true' : 'false');
    if (props.disabled && opened) hide('disabled');
    if (editable) input.removeAttribute('readonly');
    else input.setAttribute('readonly', '');
    if (isMeasure(props.width)) setVar(el, '--z-suggest-width', measureOf(props.width));
    else removeVar(el, '--z-suggest-width');

    const options = normalizeOptions(props.options);
    const sig = `${JSON.stringify(options)}|${typeof props.template}`;
    if (sig !== signature || props.template !== templateSource) {
      signature = sig;
      templateSource = props.template;
      rebuild();
    }
    applyFilter(query);
    paintInput();
  };

  update(ctx.props);

  return {
    el,
    update,
    destroy: () => {
      releaseDoc();
      clearCreated();
    },
    api: {
      /** @returns {HTMLInputElement} */
      get input() {
        return input;
      },
      /** @returns {Element} */
      get list() {
        return list;
      },
      /** @returns {boolean} */
      get open() {
        return opened;
      },
      /** @returns {boolean} */
      get isOpen() {
        return opened;
      },
      /** Abre la lista con todas las opciones. @returns {boolean} */
      show,
      /**
       * Cierra la lista. El texto sin confirmar de `combo` se descarta.
       * @param {string} [reason]
       * @returns {boolean}
       */
      hide(reason = 'api') {
        return hide(reason);
      },
      /**
       * Filtra por texto y abre la lista.
       * @param {unknown} text
       * @returns {unknown[]}
       */
      filter(text) {
        query = asText(text);
        reveal();
        return visible;
      },
      /**
       * @returns {string|string[]} el valor vigente
       */
      getValue() {
        return multiple ? valuesOf(ctx.props.value).slice() : asText(ctx.props.value);
      },
      /**
       * Fija el valor sin emitir eventos.
       * @param {unknown} value
       * @returns {string|string[]}
       */
      setValue(value) {
        return select(value);
      },
      /**
       * Agrega un valor al array y emite `change`.
       * @param {unknown} value
       * @returns {string[]}
       */
      add(value) {
        return addValue(value);
      },
      /**
       * Quita un valor del array y emite `change`.
       * @param {unknown} value
       * @returns {string[]}
       */
      remove(value) {
        return removeValue(value);
      },
      /** @returns {Element|null} contenedor de etiquetas (solo con `tags`) */
      get tags() {
        return chipList;
      },
      /** @returns {number} cantidad de opciones armadas */
      get count() {
        return items.length;
      },
      /** @returns {string[]} valores seleccionados (siempre array) */
      get selected() {
        return valuesOf(ctx.props.value);
      },
    },
  };
}

define('suggest', (ctx) => buildControl(ctx, { kind: 'suggest', editable: true }));

define('checksuggest', (ctx) =>
  buildControl(ctx, { kind: 'checksuggest', editable: true, multiple: true }));

define('select', (ctx) => buildControl(ctx, { kind: 'select' }));

define('richselect', (ctx) => buildControl(ctx, { kind: 'richselect', template: true }));

define('combo', (ctx) => buildControl(ctx, { kind: 'combo', editable: true, freeText: true }));
