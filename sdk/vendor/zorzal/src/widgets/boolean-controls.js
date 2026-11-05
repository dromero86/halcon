/**
 * Controles booleanos y de opcion: checkbox, toggle, switch, radio y segmented.
 *
 * `checkbox` sin `options` vale un booleano y con `options` vale el array de
 * valores seleccionados. `radio` y `segmented` son grupos excluyentes: el
 * grupo, no el boton suelto, es la unidad de valor y de evento. `switch` y
 * `toggle` son el mismo modelo booleano con distinta presentacion.
 *
 * Todos exponen `getValue()` y `setValue()` y emiten `change` con el valor
 * vigente. `set()` no emite: solo el usuario dispara `change`.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';

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
 * @returns {{ value: string, text: string, disabled: boolean }[]}
 */
function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((option) => {
    if (option === null || option === undefined) return { value: '', text: '', disabled: false };
    if (typeof option === 'object') {
      const value = option.value !== undefined ? option.value : option.id;
      return {
        value: asText(value),
        text: asText(option.text !== undefined ? option.text : option.label !== undefined ? option.label : value),
        disabled: Boolean(option.disabled),
      };
    }
    return { value: asText(option), text: asText(option), disabled: false };
  });
}

/**
 * Normaliza un valor multiple a una lista de strings.
 * @param {unknown} value
 * @returns {string[]}
 */
function valuesOf(value) {
  if (Array.isArray(value)) return value.map(asText);
  if (value === undefined || value === null || value === '') return [];
  return [asText(value)];
}

/**
 * Busca el elemento de la lista que contiene al nodo del evento.
 * @param {{ el: Element }[]} items
 * @param {Node|null} node
 * @returns {{ el: Element, [key: string]: any }|null}
 */
function itemOf(items, node) {
  let current = node;
  while (current) {
    const found = items.find((item) => item.el === current);
    if (found) return found;
    current = current.parentNode;
  }
  return null;
}

// --- radio ------------------------------------------------------------

let radioSeq = 0;

define('radio', (ctx) => {
  const label = ctx.h('span', { class: 'z-radio-group__label' });
  const body = ctx.h('div', { class: 'z-radio-group__options' });
  const el = ctx.h('div', { class: 'z-radio-group', role: 'radiogroup' }, [label, body]);
  const fallbackName = `z-radio-${++radioSeq}`;
  let items = [];
  let signature = null;

  const groupName = () => asText(ctx.props.name) || fallbackName;

  const getValue = () => asText(ctx.props.value);

  const paint = () => {
    const wanted = getValue();
    const text = asText(ctx.props.label);
    el.setAttribute(
      'class',
      cls('z-radio-group', ctx.props.disabled && 'z-radio-group--disabled', ctx.props.vertical && 'z-radio-group--vertical')
    );
    el.setAttribute('aria-label', text !== '' ? text : groupName());
    label.textContent = text;
    label.setAttribute('class', cls('z-radio-group__label', text === '' && 'z-hidden'));
    for (const item of items) {
      const on = item.value === wanted;
      item.input.checked = on;
      item.input.disabled = Boolean(ctx.props.disabled || item.disabled);
      item.el.setAttribute(
        'class',
        cls('z-radio', on && 'z-radio--checked', (ctx.props.disabled || item.disabled) && 'z-radio--disabled')
      );
    }
  };

  const rebuild = () => {
    items = [];
    while (body.firstChild) body.removeChild(body.firstChild);
    for (const option of normalizeOptions(ctx.props.options)) {
      const input = ctx.h('input', { class: 'z-radio__input', type: 'radio', name: groupName(), value: option.value });
      const itemEl = ctx.h('label', { class: 'z-radio' }, [
        input,
        ctx.h('span', { class: 'z-radio__text' }, [option.text]),
      ]);
      body.appendChild(itemEl);
      items.push({ el: itemEl, input, value: option.value, disabled: option.disabled });
    }
  };

  /**
   * Fija el valor solo si existe entre las opciones; si no, deja el grupo sin
   * seleccion y `getValue()` devuelve la cadena vacia.
   * @param {unknown} value
   * @returns {string}
   */
  const select = (value) => {
    const next = asText(value);
    const match = items.find((item) => item.value === next);
    ctx.props.value = match ? match.value : '';
    paint();
    return getValue();
  };

  const update = (props) => {
    const sig = `${groupName()}|${JSON.stringify(normalizeOptions(props.options))}`;
    if (sig !== signature) {
      signature = sig;
      rebuild();
    }
    paint();
  };
  update(ctx.props);

  ctx.on(el, 'change', (event) => {
    const target = event ? event.target : null;
    const item = items.find((entry) => entry.input === target);
    if (!item) return;
    if (ctx.props.disabled || item.disabled) {
      paint();
      return;
    }
    select(item.value);
    ctx.emit('change', { value: item.value, event });
  });

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      getValue,
      /**
       * @param {unknown} value
       * @returns {string}
       */
      setValue(value) {
        return select(value);
      },
      /** @returns {string} */
      get name() {
        return groupName();
      },
      /** @returns {number} */
      get count() {
        return items.length;
      },
    },
  };
});

// --- switch -----------------------------------------------------------

define('switch', (ctx) => {
  const track = ctx.h('span', { class: 'z-switch__track' }, [ctx.h('span', { class: 'z-switch__thumb' })]);
  const label = ctx.h('span', { class: 'z-switch__label' });
  const el = ctx.h('button', { class: 'z-switch', type: 'button', role: 'switch' }, [track, label]);

  const getValue = () => Boolean(ctx.props.checked);

  const paint = () => {
    const on = getValue();
    const text = asText(ctx.props.label);
    el.setAttribute('class', cls('z-switch', on && 'z-switch--on', ctx.props.disabled && 'z-switch--disabled'));
    el.setAttribute('aria-checked', on ? 'true' : 'false');
    el.disabled = Boolean(ctx.props.disabled);
    label.textContent = text;
    label.setAttribute('class', cls('z-switch__label', text === '' && 'z-hidden'));
  };

  const setValue = (value) => {
    ctx.props.checked = Boolean(value);
    paint();
    return getValue();
  };

  /**
   * @param {unknown} [event]
   * @returns {boolean}
   */
  const toggle = (event) => {
    if (ctx.props.disabled) return getValue();
    const next = setValue(!getValue());
    ctx.emit('change', { checked: next, value: next, event });
    return next;
  };

  const update = () => paint();
  update();

  ctx.on(el, 'click', (event) => {
    prevent(event);
    if (ctx.props.disabled) return;
    toggle(event);
  });

  return {
    el,
    update,
    api: {
      /** @returns {boolean} */
      getValue,
      /**
       * @param {unknown} value
       * @returns {boolean}
       */
      setValue(value) {
        return setValue(value);
      },
      /** @returns {boolean} */
      toggle() {
        return toggle();
      },
      /** @returns {boolean} */
      get checked() {
        return getValue();
      },
    },
  };
});

// --- segmented --------------------------------------------------------

define('segmented', (ctx) => {
  const el = ctx.h('div', { class: 'z-segmented', role: 'group' });
  let items = [];
  let signature = null;

  const getValue = () => asText(ctx.props.value);

  const paint = () => {
    const wanted = getValue();
    el.setAttribute(
      'class',
      cls('z-segmented', ctx.props.disabled && 'z-segmented--disabled', ctx.props.block && 'z-segmented--block')
    );
    if (ctx.props.label) el.setAttribute('aria-label', asText(ctx.props.label));
    else el.removeAttribute('aria-label');
    for (const item of items) {
      const on = item.value === wanted;
      item.el.setAttribute(
        'class',
        cls(
          'z-segmented__button',
          on && 'z-segmented__button--active',
          (ctx.props.disabled || item.disabled) && 'z-segmented__button--disabled'
        )
      );
      item.el.setAttribute('aria-pressed', on ? 'true' : 'false');
      item.el.disabled = Boolean(ctx.props.disabled || item.disabled);
    }
  };

  const rebuild = () => {
    items = [];
    while (el.firstChild) el.removeChild(el.firstChild);
    for (const option of normalizeOptions(ctx.props.options)) {
      const button = ctx.h('button', {
        class: 'z-segmented__button',
        type: 'button',
        'data-value': option.value,
      }, [option.text]);
      el.appendChild(button);
      items.push({ el: button, value: option.value, disabled: option.disabled });
    }
  };

  /**
   * @param {unknown} value
   * @returns {string}
   */
  const select = (value) => {
    const next = asText(value);
    const match = items.find((item) => item.value === next);
    ctx.props.value = match ? match.value : '';
    paint();
    return getValue();
  };

  const update = (props) => {
    const sig = JSON.stringify(normalizeOptions(props.options));
    if (sig !== signature) {
      signature = sig;
      rebuild();
    }
    paint();
  };
  update(ctx.props);

  ctx.on(el, 'click', (event) => {
    const item = itemOf(items, event ? event.target : null);
    if (!item) return;
    if (ctx.props.disabled || item.disabled) return;
    prevent(event);
    select(item.value);
    ctx.emit('change', { value: item.value, event });
  });

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      getValue,
      /**
       * @param {unknown} value
       * @returns {string}
       */
      setValue(value) {
        return select(value);
      },
      /** @returns {number} */
      get count() {
        return items.length;
      },
    },
  };
});

// --- checkbox ---------------------------------------------------------

define('checkbox', (ctx) => {
  const input = ctx.h('input', { class: 'z-checkbox__input', type: 'checkbox' });
  const text = ctx.h('span', { class: 'z-checkbox__label' });
  const single = ctx.h('label', { class: 'z-checkbox__control' }, [input, text]);
  const groupLabel = ctx.h('span', { class: 'z-checkbox-group__label' });
  const groupBody = ctx.h('div', { class: 'z-checkbox-group__options' });
  const el = ctx.h('div', { class: 'z-checkbox' }, [single]);

  let items = [];
  let signature = null;
  let grouped = false;

  const isGroup = () => Array.isArray(ctx.props.options);

  const selectedValues = () => valuesOf(ctx.props.value);

  const getValue = () => {
    if (!isGroup()) return Boolean(ctx.props.checked);
    const chosen = new Set(selectedValues());
    return items.filter((item) => chosen.has(item.value)).map((item) => item.value);
  };

  const paintSingle = () => {
    input.checked = Boolean(ctx.props.checked);
    input.disabled = Boolean(ctx.props.disabled);
    text.textContent = asText(ctx.props.label);
    single.setAttribute('class', cls('z-checkbox__control', ctx.props.disabled && 'z-checkbox__control--disabled'));
  };

  const paintGroup = () => {
    const chosen = new Set(selectedValues());
    const groupText = asText(ctx.props.label);
    groupLabel.textContent = groupText;
    groupLabel.setAttribute('class', cls('z-checkbox-group__label', groupText === '' && 'z-hidden'));
    for (const item of items) {
      const on = chosen.has(item.value);
      item.input.checked = on;
      item.input.disabled = Boolean(ctx.props.disabled || item.disabled);
      item.el.setAttribute(
        'class',
        cls(
          'z-checkbox z-checkbox--option',
          on && 'z-checkbox--checked',
          (ctx.props.disabled || item.disabled) && 'z-checkbox--disabled'
        )
      );
    }
  };

  const rebuildGroup = () => {
    items = [];
    while (groupBody.firstChild) groupBody.removeChild(groupBody.firstChild);
    for (const option of normalizeOptions(ctx.props.options)) {
      const optionInput = ctx.h('input', { class: 'z-checkbox__input', type: 'checkbox', value: option.value });
      const optionEl = ctx.h('label', { class: 'z-checkbox z-checkbox--option' }, [
        optionInput,
        ctx.h('span', { class: 'z-checkbox__label' }, [option.text]),
      ]);
      groupBody.appendChild(optionEl);
      items.push({ el: optionEl, input: optionInput, value: option.value, disabled: option.disabled });
    }
  };

  const mountMode = () => {
    if (grouped) {
      if (el.childNodes.length === 2 && el.firstChild === groupLabel && el.lastChild === groupBody) return;
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(groupLabel);
      el.appendChild(groupBody);
      return;
    }
    if (el.childNodes.length === 1 && el.firstChild === single) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(single);
  };

  /**
   * Fija el array seleccionado y mantiene `props.checked` como espejo.
   * @param {string[]} values
   */
  const applyGroupValue = (values) => {
    ctx.props.value = values;
    ctx.props.checked = values.length > 0;
    paintGroup();
  };

  /**
   * @param {unknown} value
   * @returns {boolean|string[]}
   */
  const setValue = (value) => {
    if (!isGroup()) {
      ctx.props.checked = Boolean(value);
      paintSingle();
      return getValue();
    }
    const wanted = new Set(valuesOf(value));
    applyGroupValue(items.filter((item) => wanted.has(item.value)).map((item) => item.value));
    return getValue();
  };

  /**
   * Sin `options` alterna el booleano. Con `options`, `toggle(valor)` agrega o
   * quita ese valor del array.
   * @param {unknown} [value]
   * @returns {boolean|string[]}
   */
  const toggle = (value) => {
    if (ctx.props.disabled) return getValue();
    if (!isGroup()) {
      const next = setValue(!Boolean(ctx.props.checked));
      ctx.emit('change', { checked: next, value: next });
      return next;
    }
    if (value === undefined || value === null) return getValue();
    const key = asText(value);
    const chosen = new Set(selectedValues());
    if (chosen.has(key)) chosen.delete(key);
    else chosen.add(key);
    applyGroupValue(items.filter((item) => chosen.has(item.value)).map((item) => item.value));
    const result = getValue();
    ctx.emit('change', { value: [...result], checked: result.length > 0 });
    return result;
  };

  const update = (props) => {
    const nextGrouped = Array.isArray(props.options);
    if (nextGrouped !== grouped) {
      grouped = nextGrouped;
      signature = null;
    }
    el.setAttribute(
      'class',
      cls(
        grouped ? 'z-checkbox-group' : 'z-checkbox',
        props.disabled && 'z-checkbox--disabled',
        props.inline && 'z-checkbox--inline'
      )
    );
    if (grouped) {
      const sig = JSON.stringify(normalizeOptions(props.options));
      if (sig !== signature) {
        signature = sig;
        rebuildGroup();
      }
    }
    mountMode();
    if (grouped) paintGroup();
    else paintSingle();
  };
  update(ctx.props);

  ctx.on(el, 'change', (event) => {
    const target = event ? event.target : null;
    if (!grouped) {
      if (target !== input) return;
      if (ctx.props.disabled) {
        input.checked = Boolean(ctx.props.checked);
        return;
      }
      ctx.props.checked = Boolean(input.checked);
      paintSingle();
      ctx.emit('change', { checked: ctx.props.checked, value: ctx.props.checked, event });
      return;
    }
    const item = items.find((entry) => entry.input === target);
    if (!item) return;
    if (ctx.props.disabled || item.disabled) {
      item.input.checked = selectedValues().includes(item.value);
      return;
    }
    const chosen = items.filter((entry) => entry.input.checked).map((entry) => entry.value);
    applyGroupValue(chosen);
    ctx.emit('change', { value: [...chosen], checked: chosen.length > 0, event });
  });

  return {
    el,
    update,
    api: {
      /** @returns {HTMLInputElement} */
      get input() {
        return input;
      },
      /** @returns {boolean|string[]} */
      getValue,
      /**
       * @param {unknown} value
       * @returns {boolean|string[]}
       */
      setValue(value) {
        return setValue(value);
      },
      /**
       * @param {unknown} [value]
       * @returns {boolean|string[]}
       */
      toggle(value) {
        return toggle(value);
      },
      /** @returns {boolean} */
      get checked() {
        return Boolean(ctx.props.checked);
      },
      /** @returns {string[]} */
      get selected() {
        return isGroup() ? getValue() : [];
      },
    },
  };
});

// --- toggle -----------------------------------------------------------

define('toggle', (ctx) => {
  const track = ctx.h('span', { class: 'z-toggle__track' }, [ctx.h('span', { class: 'z-toggle__thumb' })]);
  const label = ctx.h('span', { class: 'z-toggle__label' });
  const el = ctx.h('button', { class: 'z-toggle', type: 'button', role: 'switch' }, [track, label]);

  const getValue = () => Boolean(ctx.props.checked);

  const paint = () => {
    const on = getValue();
    const text = asText(ctx.props.label);
    el.setAttribute('class', cls('z-toggle', on && 'z-toggle--on', ctx.props.disabled && 'z-toggle--disabled'));
    el.setAttribute('aria-checked', on ? 'true' : 'false');
    el.disabled = Boolean(ctx.props.disabled);
    label.textContent = text;
    label.setAttribute('class', cls('z-toggle__label', text === '' && 'z-hidden'));
  };

  const setValue = (value) => {
    ctx.props.checked = Boolean(value);
    paint();
    return getValue();
  };

  /**
   * @param {unknown} [event]
   * @returns {boolean}
   */
  const toggle = (event) => {
    if (ctx.props.disabled) return getValue();
    const next = setValue(!getValue());
    ctx.emit('change', { checked: next, value: next, event });
    return next;
  };

  const update = () => paint();
  update();

  ctx.on(el, 'click', (event) => {
    prevent(event);
    if (ctx.props.disabled) return;
    toggle(event);
  });

  return {
    el,
    update,
    api: {
      /** @returns {boolean} */
      getValue,
      /**
       * @param {unknown} value
       * @returns {boolean}
       */
      setValue(value) {
        return setValue(value);
      },
      /** @returns {boolean} */
      toggle() {
        return toggle();
      },
      /** @returns {boolean} */
      get checked() {
        return getValue();
      },
    },
  };
});
