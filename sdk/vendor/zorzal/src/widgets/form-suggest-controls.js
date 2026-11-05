/**
 * Controles de formulario y suggestions especializados: forminput, tabbar,
 * gridsuggest, datasuggest y mentionsuggest.
 *
 * - `forminput` no es un campo nuevo: envuelve un control del core (por
 *   omision `text`) y le agrega etiqueta, texto de ayuda y mensaje de error.
 *   El valor se delega al control envuelto.
 * - `tabbar` es una barra de pestañas sin contenido: el consumidor escucha
 *   `change` y muestra el panel que corresponda. Es independiente de
 *   `tabview`, que trae su propio multiview.
 * - `gridsuggest` y `datasuggest` se arman sobre `buildControl`, la misma base
 *   de `suggest`: heredan el filtro por texto, las flechas, Enter, Escape y el
 *   cierre por clic fuera. Solo cambian las opciones y la plantilla de fila.
 * - `mentionsuggest` tambien usa `buildControl` y agrega tres enganches de la
 *   base: detectar el token `@`, conservar el texto completo en el campo y
 *   reemplazar el token al elegir. El filtro sigue siendo el de la base.
 *
 * Los estilos viven en `src/zorzal.css` con prefijo `z-`.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { create, Widget } from '../core/widget.js';
import { buildControl, normalizeOptions, setVar, removeVar } from './select-controls.js';

/** @param {unknown} value */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * Escucha un evento del widget envuelto. Devuelve la funcion de baja para
 * poder desengancharla cuando se reemplaza el control.
 *
 * @param {Widget} widget
 * @param {string} type
 * @param {(data: any) => void} fn
 * @returns {() => void}
 */
function listen(widget, type, fn) {
  if (!widget || typeof widget.on !== 'function') return () => {};
  widget.on(type, fn);
  return () => {
    if (typeof widget.off === 'function') widget.off(type, fn);
  };
}

/**
 * Arma el `api` de un control derivado conservando los getters de la base
 * (`open`, `count`, `input`, `list`, ...). El spread de un objeto evaluaria
 * esos getters una sola vez.
 *
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} [extra]
 * @returns {Record<string, unknown>}
 */
function apiOf(base, extra = {}) {
  const api = {};
  Object.defineProperties(api, Object.getOwnPropertyDescriptors(base));
  Object.defineProperties(api, Object.getOwnPropertyDescriptors(extra));
  return api;
}

// --- forminput --------------------------------------------------------

define('forminput', (ctx) => {
  const label = ctx.h('span', { class: 'z-forminput__label' });
  const body = ctx.h('div', { class: 'z-forminput__control' });
  const hint = ctx.h('span', { class: 'z-forminput__hint' });
  const error = ctx.h('span', { class: 'z-forminput__error', role: 'alert' });
  const el = ctx.h('div', { class: 'z-forminput' }, [label, body, hint, error]);

  /** @type {Widget|null} */
  let control = null;
  let controlSource;
  let unlisten = [];
  let lastValue;
  const defaultControl = { kind: 'text' };

  const controlSpec = (props) => {
    const source = props.control;
    if (source instanceof Widget || (source && typeof source === 'object' && typeof source.kind === 'string')) {
      return source;
    }
    return defaultControl;
  };

  const readValue = () => {
    if (!control) return asText(ctx.props.value);
    if (typeof control.getValue === 'function') return control.getValue();
    if (control.input) return asText(control.input.value);
    return asText(ctx.props.value);
  };

  const writeValue = (value) => {
    ctx.props.value = value;
    lastValue = value;
    if (!control) return value;
    if (typeof control.setValue === 'function') {
      const applied = control.setValue(value);
      if (applied !== undefined) ctx.props.value = applied;
      return applied === undefined ? value : applied;
    }
    if (control.input) control.input.value = asText(value);
    return value;
  };

  const syncValue = (props) => {
    if (!control || props.value === undefined) return;
    if (lastValue !== undefined && (props.value === lastValue || asText(props.value) === asText(lastValue))) {
      return;
    }
    const current = readValue();
    if (current !== props.value && asText(current) !== asText(props.value)) writeValue(props.value);
    else lastValue = props.value;
  };

  const bind = () => {
    for (const off of unlisten) off();
    unlisten = [];
    if (!control) return;
    const onChange = (data) => {
      ctx.props.value = data && data.value !== undefined ? data.value : readValue();
      ctx.emit('change', data);
    };
    const onInput = (data) => {
      ctx.props.value = data && data.value !== undefined ? data.value : readValue();
      ctx.emit('input', data);
    };
    unlisten.push(listen(control, 'change', onChange));
    unlisten.push(listen(control, 'input', onInput));
  };

  const build = (props) => {
    const source = controlSpec(props);
    if (control && source === controlSource) {
      syncValue(props);
      return;
    }
    for (const off of unlisten) off();
    unlisten = [];
    if (control) control.destroy();
    while (body.firstChild) body.removeChild(body.firstChild);

    controlSource = source;
    if (source instanceof Widget) {
      control = source;
    } else {
      const spec = { ...source };
      if (props.value !== undefined && spec.value === undefined) spec.value = props.value;
      control = create(spec);
    }
    body.appendChild(control.el);
    bind();
  };

  const update = (props) => {
    const labelText = asText(props.label);
    const hintText = asText(props.hint);
    const errorText = asText(props.error);
    const invalid = Boolean(props.invalid || errorText !== '');
    label.textContent = labelText;
    label.setAttribute('class', cls('z-forminput__label', labelText === '' && 'z-hidden'));
    hint.textContent = hintText;
    hint.setAttribute('class', cls('z-forminput__hint', hintText === '' && 'z-hidden'));
    error.textContent = errorText;
    error.setAttribute('class', cls('z-forminput__error', errorText === '' && 'z-hidden'));
    el.setAttribute(
      'class',
      cls('z-forminput', invalid && 'z-forminput--invalid', props.disabled && 'z-forminput--disabled')
    );
    el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    build(props);
    syncValue(props);
  };
  update(ctx.props);

  const setError = (message) => {
    const text = asText(message);
    ctx.props.error = text;
    ctx.props.invalid = text !== '';
    update(ctx.props);
    return ctx.instance;
  };

  return {
    el,
    update,
    destroy: () => {
      for (const off of unlisten) off();
      unlisten = [];
      if (control) control.destroy();
      control = null;
    },
    api: {
      /** @returns {Widget|null} */
      get control() {
        return control;
      },
      /** @returns {HTMLInputElement|null} */
      get input() {
        return control && control.input ? control.input : null;
      },
      /** @returns {unknown} el valor del control envuelto */
      getValue() {
        return readValue();
      },
      /**
       * Fija el valor en el control envuelto, sin emitir eventos.
       * @param {unknown} value
       * @returns {unknown}
       */
      setValue(value) {
        return writeValue(value);
      },
      /**
       * Muestra el mensaje de error y marca el envoltorio como invalido.
       * @param {unknown} message
       * @returns {import('../core/widget.js').Widget}
       */
      setError(message) {
        return setError(message);
      },
      /**
       * Quita el mensaje de error y la marca de invalido.
       * @returns {import('../core/widget.js').Widget}
       */
      clearError() {
        return setError('');
      },
      /** @returns {string} */
      get error() {
        return asText(ctx.props.error);
      },
    },
  };
});

// --- tabbar -----------------------------------------------------------

define('tabbar', (ctx) => {
  const el = ctx.h('div', { class: 'z-tabbar', role: 'tablist' });
  let tabs = [];
  let signature = null;

  const paint = () => {
    const value = asText(ctx.props.value);
    for (const tab of tabs) {
      const on = tab.value === value;
      tab.button.setAttribute(
        'class',
        cls(
          'z-tabbar__tab',
          on && 'z-tabbar__tab--active',
          tab.disabled && 'z-tabbar__tab--disabled'
        )
      );
      tab.button.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.button.setAttribute('tabindex', on ? '0' : '-1');
    }
  };

  const build = () => {
    for (const tab of tabs) ctx.release(tab.button, 'click');
    while (el.firstChild) el.removeChild(el.firstChild);
    tabs = normalizeOptions(ctx.props.options).map((option) => {
      const button = ctx.h(
        'button',
        {
          class: 'z-tabbar__tab',
          type: 'button',
          role: 'tab',
          'data-value': option.value,
          'aria-selected': 'false',
        },
        option.text
      );
      ctx.on(button, 'click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (ctx.props.disabled || option.disabled) return;
        activate(option.value, 'click');
      });
      el.appendChild(button);
      return { ...option, button };
    });
    paint();
  };

  const find = (value) => tabs.find((tab) => tab.value === asText(value)) || null;

  const activate = (value, reason) => {
    const tab = find(value);
    if (!tab || tab.disabled || ctx.props.disabled) return false;
    const previous = asText(ctx.props.value);
    if (previous === tab.value) return false;
    ctx.props.value = tab.value;
    paint();
    ctx.emit('change', { value: tab.value, previous, item: tab.source, reason });
    return true;
  };

  const update = (props) => {
    el.setAttribute(
      'class',
      cls('z-tabbar', props.plain && 'z-tabbar--plain', props.disabled && 'z-tabbar--disabled')
    );
    const options = normalizeOptions(props.options);
    const next = JSON.stringify(options);
    if (next !== signature) {
      signature = next;
      build();
    }
    paint();
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      getValue() {
        return asText(ctx.props.value);
      },
      /**
       * Activa la pestaña con ese valor y emite `change` si cambia.
       * @param {unknown} value
       * @returns {boolean}
       */
      setValue(value) {
        return activate(value, 'api');
      },
      /** @returns {string[]} */
      get values() {
        return tabs.map((tab) => tab.value);
      },
      /** @returns {number} */
      get count() {
        return tabs.length;
      },
    },
  };
});

// --- gridsuggest ------------------------------------------------------

/**
 * Normaliza las columnas de `gridsuggest`: acepta `string[]` o
 * `{ id, header, width }[]`.
 *
 * @param {unknown} source
 * @param {Record<string, unknown>[]} rows
 * @returns {{ id: string, header: string, width: unknown }[]}
 */
function gridColumns(source, rows) {
  const list = Array.isArray(source) ? source : [];
  if (list.length === 0) {
    const first = rows.find((row) => row && typeof row === 'object' && !Array.isArray(row));
    if (!first) return [];
    return Object.keys(first)
      .filter((key) => key !== 'id' && key !== 'value' && key !== 'text' && key !== 'disabled')
      .map((key) => ({ id: key, header: key, width: undefined }));
  }
  return list.map((column, index) => {
    if (column && typeof column === 'object') {
      const id = column.id !== undefined ? column.id : column.field !== undefined ? column.field : index;
      const header = column.header !== undefined ? column.header : column.title !== undefined ? column.title : id;
      return { id: asText(id), header: asText(header), width: column.width };
    }
    return { id: asText(column), header: asText(column), width: undefined };
  });
}

/**
 * Convierte las filas de `data` en opciones de la base suggest. El texto que
 * filtra la base es la union de las celdas, asi el filtro alcanza cualquier
 * columna sin reimplementarlo.
 *
 * @param {unknown} data
 * @param {{ id: string }[]} columns
 * @returns {Record<string, unknown>[]}
 */
function gridOptions(data, columns) {
  if (!Array.isArray(data)) return [];
  return data.map((row, index) => {
    if (row === null || row === undefined) return { value: String(index), text: '' };
    if (typeof row !== 'object' || Array.isArray(row)) {
      return { value: asText(row), text: asText(row) };
    }
    const raw = row.id !== undefined ? row.id : row.value !== undefined ? row.value : index;
    const text = row.text !== undefined
      ? asText(row.text)
      : columns.map((column) => asText(row[column.id])).join(' ');
    return { ...row, value: asText(raw), text };
  });
}

define('gridsuggest', (ctx) => {
  let columns = gridColumns(ctx.props.columns, Array.isArray(ctx.props.data) ? ctx.props.data : []);
  let signature = null;

  const cellText = (row, column) => asText(row ? row[column.id] : '');
  const rowTemplate = (text, item) => {
    const row = item && typeof item === 'object' ? item : {};
    const cells = columns.map((column) =>
      ctx.h(
        'span',
        {
          class: cls('z-gridsuggest__cell', column.id === 'text' && 'z-gridsuggest__cell--text'),
          'data-column': column.id,
          title: column.header,
        },
        cellText(row, column)
      )
    );
    return ctx.h('span', { class: 'z-gridsuggest__row' }, cells);
  };

  // La base pide la plantilla en `ctx.props.template`; es interna, el consumidor
  // configura las columnas con `columns` y las filas con `data`.
  ctx.props.template = rowTemplate;

  const base = buildControl(ctx, { kind: 'gridsuggest', editable: true, template: true });
  const baseUpdate = base.update;

  const syncOptions = (props) => {
    const rows = Array.isArray(props.data) ? props.data : [];
    columns = gridColumns(props.columns, rows);
    const options = gridOptions(rows, columns);
    const next = JSON.stringify({ columns, options });
    if (next !== signature) {
      signature = next;
      props.options = options;
      ctx.props.options = options;
    }
    const template = columns
      .map((column) => (column.width !== undefined && column.width !== '' ? asText(column.width) : 'minmax(0, 1fr)'))
      .join(' ');
    if (template === '') removeVar(base.el, '--z-gridsuggest-columns');
    else setVar(base.el, '--z-gridsuggest-columns', template);
  };

  const update = (props) => {
    syncOptions(props);
    baseUpdate(props);
  };
  update(ctx.props);

  return {
    el: base.el,
    update,
    destroy: base.destroy,
    api: apiOf(base.api, {
      /** @returns {{ id: string, header: string }[]} */
      get columns() {
        return columns.slice();
      },
    }),
  };
});

// --- datasuggest ------------------------------------------------------

/**
 * Convierte las tarjetas de `data` en opciones de la base suggest.
 *
 * @param {unknown} data
 * @returns {Record<string, unknown>[]}
 */
function cardOptions(data) {
  if (!Array.isArray(data)) return [];
  return data.map((row, index) => {
    if (row === null || row === undefined) return { value: String(index), text: '' };
    if (typeof row !== 'object' || Array.isArray(row)) {
      return { value: asText(row), text: asText(row) };
    }
    const raw = row.id !== undefined ? row.id : row.value !== undefined ? row.value : index;
    const title = row.title !== undefined ? row.title : row.text !== undefined ? row.text : raw;
    return { ...row, value: asText(raw), text: asText(title) };
  });
}

define('datasuggest', (ctx) => {
  let signature = null;
  let userTemplate = ctx.props.template;

  const defaultCard = (text, item) => {
    const row = item && typeof item === 'object' ? item : {};
    const title = row.title !== undefined ? row.title : text;
    const detail = row.description !== undefined ? row.description : row.detail;
    const media = row.media !== undefined ? row.media : row.icon;
    const parts = [];
    if (media !== undefined && media !== null && media !== '') {
      parts.push(ctx.h('span', { class: 'z-datasuggest__media', 'aria-hidden': 'true' }, asText(media)));
    }
    const body = ctx.h('span', { class: 'z-datasuggest__body' });
    body.appendChild(ctx.h('span', { class: 'z-datasuggest__title' }, asText(title)));
    if (detail !== undefined && detail !== null && detail !== '') {
      body.appendChild(ctx.h('span', { class: 'z-datasuggest__text' }, asText(detail)));
    }
    parts.push(body);
    return ctx.h('span', { class: 'z-datasuggest__card' }, parts);
  };

  // Cada cambio de plantilla del consumidor produce una funcion nueva, de modo
  // que la base detecta el cambio y rearma las tarjetas.
  const makeTemplate = () => (text, item) =>
    typeof userTemplate === 'function' ? userTemplate(text, item) : defaultCard(text, item);
  let cardTemplate = makeTemplate();

  // La base resuelve la plantilla desde `ctx.props.template`; se conserva la
  // del consumidor en `userTemplate` para no perderla en los `set()`.
  ctx.props.template = cardTemplate;

  const base = buildControl(ctx, { kind: 'datasuggest', editable: true, template: true });
  const baseUpdate = base.update;

  const syncOptions = (props) => {
    if (props.template !== cardTemplate) {
      userTemplate = props.template;
      cardTemplate = makeTemplate();
    }
    props.template = cardTemplate;
    ctx.props.template = cardTemplate;
    const options = cardOptions(props.data);
    const next = JSON.stringify(options);
    if (next !== signature) {
      signature = next;
      props.options = options;
      ctx.props.options = options;
    }
  };

  const update = (props) => {
    syncOptions(props);
    baseUpdate(props);
  };
  update(ctx.props);

  return {
    el: base.el,
    update,
    destroy: base.destroy,
    api: apiOf(base.api, {
      /** @returns {number} */
      get cardCount() {
        return Array.isArray(ctx.props.data) ? ctx.props.data.length : 0;
      },
    }),
  };
});

// --- mentionsuggest ---------------------------------------------------

define('mentionsuggest', (ctx) => {
  /** @type {{ start: number, end: number }|null} */
  let mention = null;

  const config = {
    kind: 'mentionsuggest',
    editable: true,
    // La primera coincidencia queda activa: Enter elige sin bajar con flechas.
    autoActive: true,
    // El campo conserva el texto completo mientras la lista esta abierta.
    fieldText({ opened, input }) {
      if (!opened) mention = null;
      return opened ? input.value : asText(ctx.props.value);
    },
    // La base filtra por el token posterior a `@`, no por todo el campo.
    queryText(text, input) {
      ctx.props.value = text;
      const caret = typeof input.selectionStart === 'number' ? input.selectionStart : text.length;
      const upto = text.slice(0, caret);
      const at = upto.lastIndexOf('@');
      if (at < 0) {
        mention = null;
        return false;
      }
      const token = upto.slice(at + 1);
      if (token !== '' && /\s/.test(token)) {
        mention = null;
        return false;
      }
      mention = { start: at, end: caret };
      return token;
    },
    // Al elegir, reemplaza `@token` por el nombre y conserva el resto.
    selection(item, { text }) {
      if (!mention) return null;
      const source = item.source;
      const name = source && typeof source === 'object' && source.name !== undefined
        ? asText(source.name)
        : item.text;
      const next = text.slice(0, mention.start) + name + text.slice(mention.end);
      mention = null;
      return { value: next, text: next, label: name };
    },
  };

  const base = buildControl(ctx, config);
  return {
    el: base.el,
    update: base.update,
    destroy: base.destroy,
    api: apiOf(base.api, {
      /** @returns {boolean} true si hay un token `@` activo */
      get mentioning() {
        return mention !== null;
      },
    }),
  };
});
