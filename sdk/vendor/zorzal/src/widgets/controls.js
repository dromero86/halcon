/**
 * Widgets de entrada y accion: action, field, textarea y picker.
 *
 * Los controles booleanos y de opcion (checkbox, toggle, switch, radio y
 * segmented) viven en `boolean-controls.js`.
 *
 * Todos emiten eventos propios y reflejan su estado en `props`, de modo que
 * `set()` y la lectura de `props` alcanzan sin tocar el DOM.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';

/** @param {unknown} value */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

define('action', (ctx) => {
  const label = ctx.h('span', { class: 'z-action__label' });
  const el = ctx.h('button', { class: 'z-action', type: 'button' }, [label]);

  const update = (props) => {
    const variant = asText(props.variant || 'default');
    el.setAttribute('class', cls('z-action', `z-action--${variant}`, props.block && 'z-action--block'));
    label.textContent = asText(props.text !== undefined ? props.text : props.label);
    if (props.title) el.setAttribute('title', asText(props.title));
    else el.removeAttribute('title');
    if (props.name) el.setAttribute('name', asText(props.name));
    if (props.disabled) el.setAttribute('disabled', '');
    else el.removeAttribute('disabled');
    el.setAttribute('aria-disabled', props.disabled ? 'true' : 'false');
  };
  update(ctx.props);

  ctx.on(el, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (ctx.props.disabled) return;
    ctx.emit('click', event);
  });

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      get text() {
        return label.textContent;
      },
    },
  };
});

define('field', (ctx) => {
  const label = ctx.h('span', { class: 'z-field__label' });
  const input = ctx.h('input', { class: 'z-field__input', type: 'text' });
  const hint = ctx.h('span', { class: 'z-field__hint' });
  const error = ctx.h('span', { class: 'z-field__error', role: 'alert' });
  const el = ctx.h('label', { class: 'z-field' }, [label, input, hint, error]);

  const update = (props) => {
    el.setAttribute('class', cls('z-field', props.invalid && 'z-field--invalid', props.disabled && 'z-field--disabled'));
    label.textContent = asText(props.label);
    hint.textContent = asText(props.hint);
    error.textContent = asText(props.error);
    input.setAttribute('type', asText(props.type || 'text'));
    input.setAttribute('placeholder', asText(props.placeholder));
    if (props.name) input.setAttribute('name', asText(props.name));
    else input.removeAttribute('name');
    if (props.autocomplete) input.setAttribute('autocomplete', asText(props.autocomplete));
    if (props.required) input.setAttribute('required', '');
    else input.removeAttribute('required');
    if (props.disabled) input.setAttribute('disabled', '');
    else input.removeAttribute('disabled');
    input.setAttribute('aria-invalid', props.invalid ? 'true' : 'false');
    const value = asText(props.value);
    if (input.value !== value) input.value = value;
  };
  update(ctx.props);

  ctx.on(input, 'input', (event) => {
    ctx.props.value = input.value;
    ctx.emit('input', { value: input.value, event });
  });
  ctx.on(input, 'change', (event) => {
    ctx.props.value = input.value;
    ctx.emit('change', { value: input.value, event });
  });

  return {
    el,
    update,
    api: {
      /** @returns {HTMLInputElement} */
      get input() {
        return input;
      },
      /** @returns {string} */
      get value() {
        return input.value;
      },
    },
  };
});

define('textarea', (ctx) => {
  const label = ctx.h('span', { class: 'z-field__label' });
  const input = ctx.h('textarea', { class: 'z-field__input z-textarea', rows: 4 });
  const hint = ctx.h('span', { class: 'z-field__hint' });
  const el = ctx.h('label', { class: 'z-field z-field--textarea' }, [label, input, hint]);

  const update = (props) => {
    label.textContent = asText(props.label);
    hint.textContent = asText(props.hint);
    input.setAttribute('placeholder', asText(props.placeholder));
    input.setAttribute('rows', asText(props.rows || 4));
    if (props.maxLength) input.setAttribute('maxlength', asText(props.maxLength));
    else input.removeAttribute('maxlength');
    if (props.disabled) input.setAttribute('disabled', '');
    else input.removeAttribute('disabled');
    const value = asText(props.value);
    if (input.value !== value) input.value = value;
  };
  update(ctx.props);

  ctx.on(input, 'input', (event) => {
    ctx.props.value = input.value;
    ctx.emit('input', { value: input.value, event });
  });

  return {
    el,
    update,
    api: {
      /** @returns {HTMLTextAreaElement} */
      get input() {
        return input;
      },
      /** @returns {string} */
      get value() {
        return input.value;
      },
    },
  };
});

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

define('picker', (ctx) => {
  const label = ctx.h('span', { class: 'z-field__label' });
  const select = ctx.h('select', { class: 'z-field__input z-picker' });
  const el = ctx.h('label', { class: 'z-field z-field--picker' }, [label, select]);
  let lastOptions = null;

  const update = (props) => {
    label.textContent = asText(props.label);
    if (props.name) select.setAttribute('name', asText(props.name));
    else select.removeAttribute('name');
    if (props.disabled) select.setAttribute('disabled', '');
    else select.removeAttribute('disabled');
    if (props.multiple) select.setAttribute('multiple', '');
    else select.removeAttribute('multiple');

    const options = normalizeOptions(props.options);
    const signature = JSON.stringify(options);
    if (signature !== lastOptions) {
      lastOptions = signature;
      while (select.firstChild) select.removeChild(select.firstChild);
      for (const option of options) {
        select.appendChild(ctx.h('option', { value: option.value, text: option.text, disabled: option.disabled }));
      }
    }
    const current = props.value;
    if (props.multiple) {
      const wanted = new Set((Array.isArray(current) ? current : [current]).map(asText));
      for (const child of select.children) {
        child.selected = wanted.has(child.getAttribute('value'));
      }
    } else {
      const single = asText(current);
      for (const child of select.children) {
        child.selected = child.getAttribute('value') === single;
      }
    }
  };
  update(ctx.props);

  ctx.on(select, 'change', (event) => {
    if (ctx.props.multiple) {
      const values = [...select.children].filter((child) => child.selected).map((child) => child.value);
      ctx.props.value = values;
      ctx.emit('change', { value: values, event });
      return;
    }
    ctx.props.value = select.value;
    ctx.emit('change', { value: select.value, event });
  });

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      get value() {
        return select.value;
      },
    },
  };
});
