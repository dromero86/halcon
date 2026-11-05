/**
 * Widgets de datos.
 *
 * - `list` y `card`: lista simple y ficha.
 * - `dataview`: grilla de datos con plantilla por elemento y seleccion.
 * - `grouplist`: lista agrupada por la clave `group`, en orden de aparicion.
 * - `unitlist`: lista con una unidad por elemento, opcionalmente por plantilla.
 * - `property`: tabla de dos columnas nombre:valor con edicion del valor.
 * - `timeline`: linea de tiempo ordenada por fecha ascendente.
 * - `comments`: comentarios con autor, fecha y texto, con alta por API.
 *
 * Los seis widgets de datos comparten un adaptador: `data` es un array de
 * objetos, `id` es la clave natural y `setData()` rearma la vista.
 */

import { define } from '../core/registry.js';
import { cls, isNode } from '../core/dom.js';
import { create, Widget } from '../core/widget.js';
import { tpl } from '../services/tpl.js';
import { date as dateService } from '../services/date.js';

/** @param {unknown} value */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * @param {unknown} items
 * @returns {{ id: string, text: string, detail: string, disabled: boolean }[]}
 */
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (item === null || item === undefined) {
      return { id: String(index), text: '', detail: '', disabled: false };
    }
    if (typeof item === 'object') {
      const id = item.id !== undefined ? item.id : item.value !== undefined ? item.value : index;
      return {
        id: String(id),
        text: asText(item.text !== undefined ? item.text : item.label !== undefined ? item.label : id),
        detail: asText(item.detail !== undefined ? item.detail : item.description),
        disabled: Boolean(item.disabled),
      };
    }
    return { id: String(index), text: asText(item), detail: '', disabled: false };
  });
}

// --- adaptador comun -------------------------------------------------

/**
 * Normaliza `data` a una lista de entradas con `id` estable.
 *
 * Acepta objetos (clave natural `id`, o `key` cuando se indica) y valores
 * sueltos. Los elementos sin clave reciben su indice como id.
 *
 * @param {unknown} data
 * @param {string} [key] clave alternativa cuando el elemento no trae `id`
 * @returns {{ id: string, item: Record<string, unknown>, index: number }[]}
 */
function adaptData(data, key) {
  if (!Array.isArray(data)) return [];
  return data.map((item, index) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const natural =
        key && item[key] !== undefined ? item[key] : item.id !== undefined ? item.id : index;
      return { id: String(natural), item, index };
    }
    return { id: String(index), item: { text: item }, index };
  });
}

/**
 * Texto por defecto de un elemento: `title`, `text`, `label`, `name` o el
 * propio valor.
 * @param {unknown} item
 * @returns {string}
 */
function defaultText(item) {
  if (item === undefined || item === null) return '';
  if (typeof item !== 'object' || Array.isArray(item)) return String(item);
  const value = item.title !== undefined ? item.title : item.text !== undefined ? item.text : item.label !== undefined ? item.label : item.name;
  return value === undefined || value === null ? '' : String(value);
}

/**
 * Clave de orden para una fecha. Acepta `Date`, numero (epoch en ms), textos
 * ISO y fechas numericas en texto. Devuelve `null` cuando no se puede ordenar.
 * @param {unknown} value
 * @returns {number|null}
 */
function timeKey(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Copia una plantilla interpolando `{{ clave }}` con el elemento. Las
 * funciones, nodos e instancias se conservan tal cual.
 * @param {unknown} value
 * @param {Record<string, unknown>} scope
 * @returns {unknown}
 */
function interpolate(value, scope) {
  if (typeof value === 'string') return tpl(value, scope);
  if (Array.isArray(value)) return value.map((entry) => interpolate(entry, scope));
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Widget || typeof value.nodeType === 'number') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = interpolate(item, scope);
  return out;
}

/**
 * Monta un valor de plantilla en un host y registra las instancias creadas
 * para poder destruirlas al rearmar la vista.
 * @param {any} ctx
 * @param {Element} host
 * @param {unknown} value
 * @param {any[]} created
 */
function placeValue(ctx, host, value, created) {
  if (value === undefined || value === null || value === false) return;
  if (Array.isArray(value)) {
    for (const entry of value) placeValue(ctx, host, entry, created);
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
 * Escribe una custom property documentada. No se usan atributos `style` con
 * valores de diseno: la geometria vive en `zorzal.css`.
 * @param {Element} el
 * @param {string} name
 * @param {string|null} value
 */
function applyVar(el, name, value) {
  const style = el && el.style;
  if (!style) return;
  if (value === null || value === undefined || value === '') {
    if (typeof style.removeProperty === 'function') style.removeProperty(name);
    else delete style[name];
    return;
  }
  if (typeof style.setProperty === 'function') style.setProperty(name, String(value));
  else style[name] = String(value);
}

/**
 * Columnas de la grilla: numero de columnas o una medida CSS.
 * @param {unknown} columns
 * @returns {string|null}
 */
function columnsValue(columns) {
  if (columns === undefined || columns === null || columns === '') return null;
  if (typeof columns === 'number' && Number.isFinite(columns)) {
    return `repeat(${Math.max(1, Math.floor(columns))}, minmax(0, 1fr))`;
  }
  return String(columns);
}

/**
 * Bindeo de listeners con liberacion al rearmar la lista.
 * @param {any} ctx
 * @returns {{ bind: Function, releaseAll: Function }}
 */
function binding(ctx) {
  let records = [];
  return {
    bind(target, type, fn) {
      ctx.on(target, type, fn);
      records.push([target, type, fn]);
      return fn;
    },
    releaseAll() {
      for (const [target, type, fn] of records) ctx.release(target, type, fn);
      records = [];
    },
  };
}

/**
 * Fecha legible: `Date` con el patron pedido, texto tal cual.
 * @param {unknown} value
 * @param {string} [pattern]
 * @returns {string}
 */
function dateText(value, pattern) {
  if (value instanceof Date) return dateService.format(value, pattern || 'YYYY-MM-DD');
  return asText(value);
}

// --- list / card -----------------------------------------------------

define('list', (ctx) => {
  const el = ctx.h('ul', { class: 'z-list', role: 'listbox' });
  let buttons = [];
  let signature = null;

  const paintSelected = (selected) => {
    const value = asText(selected);
    for (const button of buttons) {
      const on = button.getAttribute('data-id') === value;
      button.setAttribute('class', cls('z-list__item', on && 'z-list__item--selected'));
      button.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  };

  const build = (props) => {
    const items = normalizeItems(props.items);
    const next = JSON.stringify(items);
    if (next !== signature) {
      signature = next;
      for (const button of buttons) ctx.release(button, 'click');
      while (el.firstChild) el.removeChild(el.firstChild);
      buttons = items.map((item) => {
        const button = ctx.h('button', {
          class: 'z-list__item',
          type: 'button',
          role: 'option',
          'data-id': item.id,
          disabled: item.disabled,
        }, [
          ctx.h('span', { class: 'z-list__text', text: item.text }),
          item.detail ? ctx.h('span', { class: 'z-list__detail', text: item.detail }) : null,
        ]);
        ctx.on(button, 'click', (event) => {
          if (item.disabled) return;
          ctx.props.selected = item.id;
          paintSelected(item.id);
          ctx.emit('select', { id: item.id, item, event });
        });
        el.appendChild(ctx.h('li', { class: 'z-list__row' }, [button]));
        return button;
      });
    }
    paintSelected(props.selected);
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-list', props.compact && 'z-list--compact'));
    build(props);
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      get selected() {
        return asText(ctx.props.selected);
      },
    },
  };
});

define('card', (ctx) => {
  const media = ctx.h('div', { class: 'z-card__media' });
  const titleEl = ctx.h('h3', { class: 'z-card__title' });
  const textEl = ctx.h('p', { class: 'z-card__text' });
  const header = ctx.h('header', { class: 'z-card__header' }, [titleEl]);
  const actions = ctx.h('footer', { class: 'z-card__actions' });
  const el = ctx.h('article', { class: 'z-card' }, [media, header, textEl, actions]);

  const update = (props) => {
    el.setAttribute('class', cls('z-card', props.plain && 'z-card--plain', props.selected && 'z-card--selected'));
    titleEl.textContent = asText(props.title);
    header.style.display = props.title ? '' : 'none';
    textEl.textContent = asText(props.text !== undefined ? props.text : props.description);
    textEl.style.display = props.text === undefined && props.description === undefined ? 'none' : '';
    media.style.display = props.media === undefined ? 'none' : '';
    ctx.content(media, props.media);
    ctx.content(actions, props.actions);
    actions.style.display = props.actions === undefined ? 'none' : '';
  };
  update(ctx.props);

  ctx.on(el, 'click', (event) => {
    if (ctx.props.disabled) return;
    ctx.emit('click', event);
  });

  return { el, update };
});

// --- dataview --------------------------------------------------------

define('dataview', (ctx) => {
  const el = ctx.h('div', { class: 'z-dataview', role: 'listbox' });
  const empty = [];
  const links = binding(ctx);
  let entries = [];
  let created = [];
  let dataSource;
  let templateSource;

  const clearCreated = () => {
    for (const instance of created) instance.destroy();
    created = [];
  };

  const scopeFor = (entry) => ({ ...entry.item, id: entry.id, index: entry.index });

  const contentFor = (entry) => {
    const template = ctx.props.template;
    if (typeof template === 'function') {
      const out = template(entry.item, entry.index);
      return out === undefined ? null : out;
    }
    if (template && typeof template === 'object') return interpolate(template, scopeFor(entry));
    if (typeof template === 'string') return tpl(template, scopeFor(entry));
    return defaultText(entry.item);
  };

  const paintSelected = () => {
    const selected = ctx.props.selected === undefined || ctx.props.selected === null ? null : String(ctx.props.selected);
    for (const cell of el.children) {
      const on = selected !== null && cell.getAttribute('data-id') === selected;
      cell.setAttribute('class', cls('z-dataview__item', on && 'z-dataview__item--selected'));
      cell.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  };

  const build = (data) => {
    links.releaseAll();
    clearCreated();
    while (el.firstChild) el.removeChild(el.firstChild);
    entries = adaptData(data);
    for (const entry of entries) {
      const cell = ctx.h('div', {
        class: 'z-dataview__item',
        role: 'option',
        tabindex: '0',
        'data-id': entry.id,
      });
      placeValue(ctx, cell, contentFor(entry), created);
      links.bind(cell, 'click', (event) => {
        ctx.props.selected = entry.id;
        paintSelected();
        ctx.emit('select', { id: entry.id, item: entry.item, index: entry.index, event });
      });
      el.appendChild(cell);
    }
    paintSelected();
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-dataview', props.plain && 'z-dataview--plain', props.compact && 'z-dataview--compact'));
    applyVar(el, '--z-dataview-columns', columnsValue(props.columns));
    const data = Array.isArray(props.data) ? props.data : empty;
    if (data !== dataSource || props.template !== templateSource) {
      dataSource = data;
      templateSource = props.template;
      build(data);
    } else {
      paintSelected();
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => {
      links.releaseAll();
      clearCreated();
    },
    api: {
      /**
       * Reemplaza los elementos y rearma la grilla.
       * @param {unknown[]} data
       * @returns {number} cantidad de elementos
       */
      setData(data) {
        const list = Array.isArray(data) ? data : [];
        ctx.props.data = list;
        dataSource = list;
        build(list);
        return list.length;
      },
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : [];
      },
      /** @returns {number} */
      get count() {
        return entries.length;
      },
      /** @returns {string|null} */
      get selected() {
        return ctx.props.selected === undefined || ctx.props.selected === null ? null : String(ctx.props.selected);
      },
    },
  };
});

// --- grouplist -------------------------------------------------------

define('grouplist', (ctx) => {
  const el = ctx.h('div', { class: 'z-grouplist', role: 'list' });
  const empty = [];
  const links = binding(ctx);
  let entries = [];
  let dataSource;

  const paintSelected = () => {
    const selected = ctx.props.selected === undefined || ctx.props.selected === null ? null : String(ctx.props.selected);
    for (const item of el.querySelectorAll('.z-grouplist__item')) {
      const on = selected !== null && item.getAttribute('data-id') === selected;
      item.setAttribute('class', cls('z-grouplist__item', on && 'z-grouplist__item--selected'));
      item.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  };

  const groupOf = (item) => {
    if (!item || typeof item !== 'object') return '';
    return item.group === undefined || item.group === null ? '' : String(item.group);
  };

  const build = (data) => {
    links.releaseAll();
    while (el.firstChild) el.removeChild(el.firstChild);
    entries = adaptData(data);

    const groups = new Map();
    for (const entry of entries) {
      const key = groupOf(entry.item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }

    for (const [key, list] of groups) {
      const section = ctx.h('section', { class: 'z-grouplist__group', role: 'group' });
      if (key !== '') section.setAttribute('aria-label', key);
      section.appendChild(
        ctx.h('div', { class: 'z-grouplist__header', text: key === '' ? 'Sin grupo' : key })
      );
      const listEl = ctx.h('div', { class: 'z-grouplist__items', role: 'presentation' });
      for (const entry of list) {
        const item = entry.item;
        const button = ctx.h('button', {
          class: 'z-grouplist__item',
          type: 'button',
          role: 'option',
          'data-id': entry.id,
          disabled: Boolean(item.disabled),
        }, [
          ctx.h('span', { class: 'z-grouplist__text', text: defaultText(item) }),
          item.detail ? ctx.h('span', { class: 'z-grouplist__detail', text: asText(item.detail) }) : null,
        ]);
        links.bind(button, 'click', (event) => {
          if (item.disabled) return;
          ctx.props.selected = entry.id;
          paintSelected();
          ctx.emit('select', { id: entry.id, item, group: key, event });
        });
        listEl.appendChild(button);
      }
      section.appendChild(listEl);
      el.appendChild(section);
    }
    paintSelected();
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-grouplist', props.plain && 'z-grouplist--plain', props.compact && 'z-grouplist--compact'));
    const data = Array.isArray(props.data) ? props.data : empty;
    if (data !== dataSource) {
      dataSource = data;
      build(data);
    } else {
      paintSelected();
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => links.releaseAll(),
    api: {
      /**
       * Reemplaza los elementos y rearma los grupos.
       * @param {unknown[]} data
       * @returns {number} cantidad de elementos
       */
      setData(data) {
        const list = Array.isArray(data) ? data : [];
        ctx.props.data = list;
        dataSource = list;
        build(list);
        return list.length;
      },
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : [];
      },
      /** @returns {number} */
      get count() {
        return entries.length;
      },
      /** @returns {string[]} claves de grupo en orden de aparicion */
      get groups() {
        const keys = [];
        for (const entry of entries) {
          const key = groupOf(entry.item);
          if (!keys.includes(key)) keys.push(key);
        }
        return keys;
      },
    },
  };
});

// --- unitlist --------------------------------------------------------

define('unitlist', (ctx) => {
  const el = ctx.h('ul', { class: 'z-unitlist', role: 'list' });
  const empty = [];
  const links = binding(ctx);
  let entries = [];
  let created = [];
  let dataSource;
  let templateSource;
  let unitSource;

  const clearCreated = () => {
    for (const instance of created) instance.destroy();
    created = [];
  };

  const paintSelected = () => {
    const selected = ctx.props.selected === undefined || ctx.props.selected === null ? null : String(ctx.props.selected);
    for (const item of el.querySelectorAll('.z-unitlist__item')) {
      const on = selected !== null && item.getAttribute('data-id') === selected;
      item.setAttribute('class', cls('z-unitlist__item', on && 'z-unitlist__item--selected'));
      item.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  };

  const unitFor = (entry) => {
    const template = ctx.props.template;
    const item = entry.item;
    const scope = { ...item, id: entry.id, index: entry.index };
    if (scope.unit === undefined && ctx.props.unit !== undefined) scope.unit = ctx.props.unit;
    if (typeof template === 'function') {
      const out = template(scope, entry.index);
      return out === undefined ? null : out;
    }
    if (template && typeof template === 'object') return interpolate(template, scope);
    if (typeof template === 'string') return tpl(template, scope);
    if (item.unitText !== undefined) return asText(item.unitText);
    const unit = scope.unit;
    const parts = [];
    if (item.value !== undefined && item.value !== null && item.value !== '') parts.push(asText(item.value));
    if (unit !== undefined && unit !== null && unit !== '') parts.push(asText(unit));
    return parts.join(' ');
  };

  const build = (data) => {
    links.releaseAll();
    clearCreated();
    while (el.firstChild) el.removeChild(el.firstChild);
    entries = adaptData(data);
    for (const entry of entries) {
      const item = entry.item;
      const text = ctx.h('span', { class: 'z-unitlist__text', text: defaultText(item) });
      const unit = ctx.h('span', { class: 'z-unitlist__unit' });
      placeValue(ctx, unit, unitFor(entry), created);
      const button = ctx.h('button', {
        class: 'z-unitlist__item',
        type: 'button',
        role: 'option',
        'data-id': entry.id,
        disabled: Boolean(item.disabled),
      }, [text, unit]);
      links.bind(button, 'click', (event) => {
        if (item.disabled) return;
        ctx.props.selected = entry.id;
        paintSelected();
        ctx.emit('select', { id: entry.id, item, event });
      });
      el.appendChild(ctx.h('li', { class: 'z-unitlist__row', role: 'listitem' }, [button]));
    }
    paintSelected();
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-unitlist', props.plain && 'z-unitlist--plain', props.compact && 'z-unitlist--compact'));
    const data = Array.isArray(props.data) ? props.data : empty;
    if (data !== dataSource || props.template !== templateSource || props.unit !== unitSource) {
      dataSource = data;
      templateSource = props.template;
      unitSource = props.unit;
      build(data);
    } else {
      paintSelected();
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => {
      links.releaseAll();
      clearCreated();
    },
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
        return list.length;
      },
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : [];
      },
      /** @returns {number} */
      get count() {
        return entries.length;
      },
    },
  };
});

// --- property --------------------------------------------------------

define('property', (ctx) => {
  const el = ctx.h('div', { class: 'z-property', role: 'table' });
  const empty = [];
  const links = binding(ctx);
  let entries = [];
  let dataSource;
  let editor = null;

  const findEntry = (name) => entries.find((entry) => entry.id === String(name)) || null;

  const cancelEdit = () => {
    if (editor) editor.finish(false);
  };

  const beginEdit = (entry) => {
    if (editor && editor.entry === entry) return;
    cancelEdit();
    const cell = entry.valueEl;
    const input = ctx.h('input', {
      class: 'z-property__input',
      type: 'text',
      value: asText(entry.item.value),
    });
    while (cell.firstChild) cell.removeChild(cell.firstChild);
    cell.appendChild(input);

    const finish = (commit) => {
      if (!editor || editor.input !== input) return;
      editor = null;
      ctx.release(input, 'keydown');
      ctx.release(input, 'blur');
      const next = commit ? input.value : asText(entry.item.value);
      cell.textContent = next;
      if (commit) {
        entry.item.value = next;
        ctx.emit('change', { name: entry.id, value: next, item: entry.item });
      }
    };

    editor = { entry, input, finish };
    ctx.on(input, 'keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    });
    ctx.on(input, 'blur', () => finish(true));
    if (typeof input.focus === 'function') input.focus();
  };

  const build = (data) => {
    cancelEdit();
    links.releaseAll();
    while (el.firstChild) el.removeChild(el.firstChild);
    entries = adaptData(data, 'name');
    for (const entry of entries) {
      const nameEl = ctx.h('span', { class: 'z-property__name', role: 'rowheader', text: asText(entry.id) });
      const valueEl = ctx.h('span', { class: 'z-property__value', role: 'cell', tabindex: '0' });
      valueEl.textContent = asText(entry.item.value);
      entry.valueEl = valueEl;
      const row = ctx.h('div', { class: 'z-property__row', role: 'row', 'data-name': entry.id }, [nameEl, valueEl]);
      entry.row = row;
      links.bind(valueEl, 'dblclick', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        beginEdit(entry);
      });
      el.appendChild(row);
    }
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-property', props.plain && 'z-property--plain', props.compact && 'z-property--compact'));
    const data = Array.isArray(props.data) ? props.data : empty;
    if (data !== dataSource) {
      dataSource = data;
      build(data);
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => {
      links.releaseAll();
      if (editor) {
        const { input } = editor;
        editor = null;
        ctx.release(input, 'keydown');
        ctx.release(input, 'blur');
      }
    },
    api: {
      /**
       * Escribe el valor de una propiedad y emite `change`.
       * @param {string} name
       * @param {unknown} value
       * @returns {boolean} `false` si el nombre no existe
       */
      setValue(name, value) {
        const entry = findEntry(name);
        if (!entry) return false;
        if (editor && editor.entry === entry) editor.finish(false);
        entry.item.value = value;
        entry.valueEl.textContent = asText(value);
        ctx.emit('change', { name: entry.id, value, item: entry.item });
        return true;
      },
      /**
       * Reemplaza las filas.
       * @param {unknown[]} data
       * @returns {number} cantidad de filas
       */
      setData(data) {
        const list = Array.isArray(data) ? data : [];
        ctx.props.data = list;
        dataSource = list;
        build(list);
        return list.length;
      },
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : [];
      },
      /** @returns {number} */
      get count() {
        return entries.length;
      },
      /** @returns {Record<string, unknown>} */
      get values() {
        const out = {};
        for (const entry of entries) out[entry.id] = entry.item.value;
        return out;
      },
    },
  };
});

// --- timeline --------------------------------------------------------

define('timeline', (ctx) => {
  const el = ctx.h('ol', { class: 'z-timeline', role: 'list' });
  const empty = [];
  const links = binding(ctx);
  let entries = [];
  let dataSource;
  let formatSource;

  const sortAscending = (data) => {
    return adaptData(data)
      .map((entry) => ({
        ...entry,
        time: timeKey(entry.item.date !== undefined ? entry.item.date : entry.item.time),
      }))
      .sort((a, b) => {
        if (a.time === null && b.time === null) return a.index - b.index;
        if (a.time === null) return 1;
        if (b.time === null) return -1;
        if (a.time === b.time) return a.index - b.index;
        return a.time - b.time;
      });
  };

  const build = (data) => {
    links.releaseAll();
    while (el.firstChild) el.removeChild(el.firstChild);
    entries = sortAscending(data);
    for (const entry of entries) {
      const item = entry.item;
      const value = item.date !== undefined ? item.date : item.time;
      const textEl = ctx.h('p', { class: 'z-timeline__text', text: defaultText(item) });
      const content = ctx.h('div', { class: 'z-timeline__content' }, [
        ctx.h('time', { class: 'z-timeline__date', text: dateText(value, ctx.props.dateFormat) }),
        textEl,
      ]);
      const row = ctx.h('li', { class: 'z-timeline__item', role: 'listitem', 'data-id': entry.id }, [
        ctx.h('span', { class: 'z-timeline__marker', 'aria-hidden': 'true' }),
        content,
      ]);
      links.bind(row, 'click', (event) => {
        ctx.emit('select', { id: entry.id, item, date: value, event });
      });
      el.appendChild(row);
    }
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-timeline', props.plain && 'z-timeline--plain', props.compact && 'z-timeline--compact'));
    const data = Array.isArray(props.data) ? props.data : empty;
    if (data !== dataSource || props.dateFormat !== formatSource) {
      dataSource = data;
      formatSource = props.dateFormat;
      build(data);
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => links.releaseAll(),
    api: {
      /**
       * Reemplaza los eventos y los reordena por fecha ascendente.
       * @param {unknown[]} data
       * @returns {number} cantidad de eventos
       */
      setData(data) {
        const list = Array.isArray(data) ? data : [];
        ctx.props.data = list;
        dataSource = list;
        build(list);
        return list.length;
      },
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : [];
      },
      /** @returns {number} */
      get count() {
        return entries.length;
      },
      /** @returns {string[]} ids en el orden cronologico de la vista */
      get order() {
        return entries.map((entry) => entry.id);
      },
    },
  };
});

// --- comments --------------------------------------------------------

define('comments', (ctx) => {
  const el = ctx.h('div', { class: 'z-comments', role: 'list' });
  const empty = [];
  const links = binding(ctx);
  const ids = new WeakMap();
  let seq = 0;
  let entries = [];
  let dataSource;

  const idFor = (item, index) => {
    if (item && typeof item === 'object' && item.id !== undefined && item.id !== null) return String(item.id);
    if (item && typeof item === 'object') {
      if (!ids.has(item)) ids.set(item, `comment-${++seq}`);
      return ids.get(item);
    }
    return String(index);
  };

  const sortDescending = (data) => {
    const list = data.map((item, index) => {
      const record = item && typeof item === 'object' && !Array.isArray(item) ? item : { text: item };
      return {
        id: idFor(record, index),
        item: record,
        index,
        time: timeKey(record.date),
      };
    });
    return list.sort((a, b) => {
      if (a.time === null && b.time === null) return b.index - a.index;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      if (a.time === b.time) return b.index - a.index;
      return b.time - a.time;
    });
  };

  const build = (data) => {
    links.releaseAll();
    while (el.firstChild) el.removeChild(el.firstChild);
    entries = sortDescending(data);
    for (const entry of entries) {
      const item = entry.item;
      const article = ctx.h('article', { class: 'z-comment', role: 'listitem', 'data-id': entry.id }, [
        ctx.h('header', { class: 'z-comment__header' }, [
          ctx.h('span', { class: 'z-comment__author', text: asText(item.author) }),
          ctx.h('time', { class: 'z-comment__date', text: dateText(item.date, ctx.props.dateFormat) }),
        ]),
        ctx.h('p', { class: 'z-comment__text', text: asText(item.text) }),
      ]);
      links.bind(article, 'click', (event) => {
        ctx.emit('select', { id: entry.id, item, index: entry.index, event });
      });
      el.appendChild(article);
    }
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-comments', props.plain && 'z-comments--plain', props.compact && 'z-comments--compact'));
    const data = Array.isArray(props.data) ? props.data : empty;
    if (data !== dataSource) {
      dataSource = data;
      build(data);
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => links.releaseAll(),
    api: {
      /**
       * Agrega un comentario y reordena por fecha descendente.
       * @param {{ author?: unknown, text?: unknown, date?: unknown }} comment
       * @returns {Record<string, unknown>} el comentario agregado
       */
      addComment(comment) {
        if (!comment || typeof comment !== 'object' || Array.isArray(comment)) {
          throw new TypeError('zorzal: addComment espera un objeto { author, text, date }');
        }
        const entry = { ...comment };
        if (entry.date === undefined) entry.date = new Date();
        const current = Array.isArray(ctx.props.data) ? ctx.props.data : [];
        const next = current.slice();
        next.push(entry);
        ctx.props.data = next;
        dataSource = next;
        build(next);
        ctx.emit('add', { id: idFor(entry, next.length - 1), comment: entry, item: entry });
        return entry;
      },
      /**
       * Reemplaza los comentarios.
       * @param {unknown[]} data
       * @returns {number} cantidad de comentarios
       */
      setData(data) {
        const list = Array.isArray(data) ? data : [];
        ctx.props.data = list;
        dataSource = list;
        build(list);
        return list.length;
      },
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : [];
      },
      /** @returns {number} */
      get count() {
        return entries.length;
      },
    },
  };
});
