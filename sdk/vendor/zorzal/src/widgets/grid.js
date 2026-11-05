/**
 * Widgets de datos complejos.
 *
 * - `datatable`: tabla plana con columnas, orden por clic en el header y
 *   seleccion de fila.
 * - `tree`: arbol de nodos con `children`, expansion por API y por clic, y
 *   seleccion.
 * - `treetable`: la jerarquia del tree en formato de tabla, con las columnas
 *   del datatable y las filas indentadas por profundidad.
 * - `filter`: barra con un campo por columna, valores y evento `change`.
 *
 * Los cuatro comparten el adaptador del core: `data` es un array de objetos,
 * `id` es la clave natural y `setData()` rearma la vista. El orden y el
 * criterio de los filtros se resuelven en memoria.
 *
 * Fuera de alcance en esta version: edicion inline, virtual scroll,
 * paginacion, columnas redimensionables y drag de columnas.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { date as dateService } from '../services/date.js';
import { filters } from '../services/filters.js';

const EMPTY = [];
const ALIGNMENTS = new Set(['left', 'center', 'right']);
const FILTER_TYPES = new Set(['text', 'search', 'number', 'date']);

/** @param {unknown} value */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/** @param {unknown} value @returns {unknown[]} */
function asList(value) {
  return Array.isArray(value) ? value : EMPTY;
}

/**
 * Texto por defecto de un nodo o elemento: `title`, `text`, `label`, `name` o
 * el propio valor.
 * @param {unknown} item
 * @returns {string}
 */
function textOf(item) {
  if (item === undefined || item === null) return '';
  if (typeof item !== 'object' || Array.isArray(item)) return String(item);
  const value =
    item.title !== undefined
      ? item.title
      : item.text !== undefined
        ? item.text
        : item.label !== undefined
          ? item.label
          : item.name;
  return value === undefined || value === null ? '' : String(value);
}

/**
 * Escribe una custom property documentada. No se usan atributos `style` con
 * valores de diseno: la geometria vive en `zorzal.css`.
 * @param {Element} el
 * @param {string} name
 * @param {string|number|null} value
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
 * Columnas normalizadas: `{ id, header, width, align, type, placeholder }`.
 * Acepta `id` sueltos o `{ id, header, width, align }`.
 * @param {unknown} columns
 * @returns {{ id: string, header: string, width: unknown, align: string, type: string, placeholder: string }[]}
 */
function normalizeColumns(columns) {
  const out = [];
  const seen = new Set();
  asList(columns).forEach((column, index) => {
    if (column === null || column === undefined || column === false) return;
    const base = column && typeof column === 'object' && !Array.isArray(column) ? column : { id: column };
    const id = base.id !== undefined && base.id !== null ? asText(base.id) : asText(index);
    if (id === '' || seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      header: base.header !== undefined && base.header !== null ? asText(base.header) : id,
      width: base.width === undefined || base.width === null || base.width === '' ? null : base.width,
      align: ALIGNMENTS.has(base.align) ? base.align : 'left',
      type: base.type === undefined || base.type === null ? 'text' : asText(base.type),
      placeholder: base.placeholder === undefined || base.placeholder === null ? '' : asText(base.placeholder),
    });
  });
  return out;
}

/**
 * Columnas de una tabla: si no se declaran, una sola columna `text`.
 * @param {unknown} columns
 */
function tableColumns(columns) {
  const list = normalizeColumns(columns);
  return list.length ? list : normalizeColumns(['text']);
}

/**
 * Ancho CSS de una columna. Los numeros se interpretan como pixeles.
 * @param {unknown} width
 * @returns {string|null}
 */
function widthValue(width) {
  if (width === undefined || width === null || width === '') return null;
  if (typeof width === 'number' && Number.isFinite(width)) return `${width}px`;
  return String(width);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isBlank(value) {
  return value === undefined || value === null || value === '';
}

/**
 * Compara dos valores por su tipo: numeros y `Date` por magnitud, booleanos y
 * textos por orden alfabetico. Los textos numericos se comparan como numeros
 * (`"2"` antes que `"10"`).
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
function compareValues(a, b) {
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : Number.NaN;
    const tb = b instanceof Date ? b.getTime() : Number.NaN;
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) {
      if (ta === tb) return 0;
      return ta < tb ? -1 : 1;
    }
  }
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    if (a === b) return 0;
    return a ? 1 : -1;
  }
  return asText(a).localeCompare(asText(b), 'es', { numeric: true, sensitivity: 'base' });
}

/**
 * Filas con `id` estable y el indice original, que se usa para desempatar.
 * @param {unknown} data
 * @returns {{ id: string, item: Record<string, unknown>, index: number }[]}
 */
function adaptRows(data) {
  return asList(data).map((item, index) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const natural = item.id !== undefined && item.id !== null ? item.id : index;
      return { id: String(natural), item, index };
    }
    return { id: String(index), item: { text: item }, index };
  });
}

/**
 * Texto de una celda segun la columna. Las fechas se muestran como
 * `YYYY-MM-DD`.
 * @param {unknown} item
 * @param {{ id: string }} column
 * @returns {string}
 */
function cellText(item, column) {
  if (!item || typeof item !== 'object') return '';
  const value = item[column.id];
  if (value === undefined || value === null) return '';
  if (value instanceof Date) return dateService.format(value, 'YYYY-MM-DD');
  return String(value);
}

/**
 * Bindeo de listeners con liberacion al rearmar la vista.
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
 * Modelo recursivo de nodos. `id` es el del dato o la ruta en el arbol.
 * @param {unknown} nodes
 * @param {string} [prefix]
 * @returns {{ id: string, item: Record<string, unknown>, index: number, children: any[] }[]}
 */
function nodeModels(nodes, prefix = '') {
  return asList(nodes).map((node, index) => {
    const item = node && typeof node === 'object' && !Array.isArray(node) ? node : { text: node };
    const id =
      node && typeof node === 'object' && node.id !== undefined && node.id !== null
        ? String(node.id)
        : `${prefix}${index}`;
    return { id, item, index, children: nodeModels(item.children, `${id}.`) };
  });
}

/**
 * Recorre los nodos en preorden.
 * @param {any[]} models
 * @param {(model: any, depth: number) => void} visit
 * @param {number} [depth]
 */
function walk(models, visit, depth = 0) {
  for (const model of models) {
    visit(model, depth);
    walk(model.children, visit, depth + 1);
  }
}

/**
 * Estado de expansion inicial: los nodos con `open: true` y los `openIds`
 * declarados.
 * @param {any} ctx
 * @param {any[]} models
 * @returns {Set<string>}
 */
function initialOpen(ctx, models) {
  const open = new Set();
  walk(models, (model) => {
    if (model.item.open === true) open.add(model.id);
  });
  for (const id of asList(ctx.props.openIds)) open.add(String(id));
  return open;
}

/**
 * Refleja el estado de expansion en la prop y devuelve la lista.
 * @param {any} ctx
 * @param {Set<string>} open
 * @returns {string[]}
 */
function syncOpen(ctx, open) {
  const ids = [...open];
  ctx.props.openIds = ids;
  return ids;
}

// --- datatable -------------------------------------------------------

define('datatable', (ctx) => {
  const colgroup = ctx.h('colgroup');
  const thead = ctx.h('thead');
  const tbody = ctx.h('tbody');
  const table = ctx.h('table', { class: 'z-datatable__table', role: 'grid' }, [colgroup, thead, tbody]);
  const el = ctx.h('div', { class: 'z-datatable' }, [table]);
  const links = binding(ctx);

  let entries = [];
  let columns = [];
  let sortState = null;
  let dataSource;
  let columnsSource;
  let filterSource;
  let activeFilter = null;
  let unfilter = null;

  const selectedId = () => {
    const value = ctx.props.selected;
    return value === undefined || value === null ? null : String(value);
  };

  const paintSelected = () => {
    const selected = selectedId();
    for (const row of tbody.children) {
      const on = selected !== null && row.getAttribute('data-id') === selected;
      row.setAttribute('class', cls('z-datatable__row', on && 'z-datatable__row--selected'));
      row.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  };

  const viewEntries = () => {
    const list = activeFilter ? entries.filter((entry) => activeFilter.matches(entry.item)) : entries.slice();
    if (!sortState) return list;
    const column = columns.find((item) => item.id === sortState.id);
    if (!column) return list;
    const direction = sortState.dir === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      const va = a.item ? a.item[column.id] : undefined;
      const vb = b.item ? b.item[column.id] : undefined;
      const emptyA = isBlank(va);
      const emptyB = isBlank(vb);
      if (emptyA && emptyB) return a.index - b.index;
      if (emptyA) return 1;
      if (emptyB) return -1;
      const result = compareValues(va, vb);
      return result === 0 ? a.index - b.index : result * direction;
    });
    return list;
  };

  const select = (entry, event) => {
    if (entry.item && entry.item.disabled) return;
    ctx.props.selected = entry.id;
    paintSelected();
    ctx.emit('select', { id: entry.id, item: entry.item, index: entry.index, event });
  };

  const render = () => {
    links.releaseAll();
    while (colgroup.firstChild) colgroup.removeChild(colgroup.firstChild);
    while (thead.firstChild) thead.removeChild(thead.firstChild);
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    for (const column of columns) {
      const col = ctx.h('col', { class: 'z-datatable__col' });
      applyVar(col, '--z-datatable-column-width', widthValue(column.width));
      colgroup.appendChild(col);
    }

    const headerRow = ctx.h('tr', { class: 'z-datatable__header-row' });
    for (const column of columns) {
      const active = Boolean(sortState && sortState.id === column.id);
      const dir = active ? sortState.dir : null;
      const th = ctx.h(
        'th',
        {
          class: cls('z-datatable__header', `z-datatable__cell--${column.align}`),
          scope: 'col',
          role: 'columnheader',
          'data-column': column.id,
          'aria-sort': active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none',
        },
        [
          ctx.h('button', { class: 'z-datatable__sort', type: 'button' }, [
            ctx.h('span', { class: 'z-datatable__header-text', text: column.header }),
            ctx.h('span', {
              class: 'z-datatable__arrow',
              'aria-hidden': 'true',
              text: active ? (dir === 'desc' ? 'v' : '^') : '',
            }),
          ]),
        ]
      );
      links.bind(th, 'click', () => applySort(column.id));
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);

    for (const entry of viewEntries()) {
      const row = ctx.h('tr', {
        class: 'z-datatable__row',
        role: 'row',
        'data-id': entry.id,
        'aria-selected': 'false',
      });
      for (const column of columns) {
        row.appendChild(
          ctx.h('td', {
            class: cls('z-datatable__cell', `z-datatable__cell--${column.align}`),
            role: 'gridcell',
            text: cellText(entry.item, column),
          })
        );
      }
      links.bind(row, 'click', (event) => select(entry, event));
      tbody.appendChild(row);
    }
    paintSelected();
  };

  const applySort = (id, dir) => {
    const column = columns.find((item) => item.id === asText(id));
    if (!column) return false;
    let next;
    if (dir === 'asc' || dir === 'desc') {
      next = dir;
    } else if (sortState && sortState.id === column.id) {
      next = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      next = 'asc';
    }
    sortState = { id: column.id, dir: next };
    ctx.props.sort = { id: column.id, dir: next };
    render();
    ctx.emit('sort', { id: column.id, dir: next });
    return true;
  };

  /**
   * Resuelve la prop `filter` y se suscribe a sus cambios: cualquier criterio
   * nuevo rearma la vista.
   * @param {unknown} value
   */
  const bindFilter = (value) => {
    if (value === filterSource) return;
    filterSource = value;
    if (unfilter) {
      unfilter();
      unfilter = null;
    }
    activeFilter = filters.resolve(value);
    if (activeFilter && typeof activeFilter.onChange === 'function') {
      unfilter = activeFilter.onChange(() => render());
      if (typeof unfilter !== 'function') unfilter = null;
    }
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-datatable', props.plain && 'z-datatable--plain', props.compact && 'z-datatable--compact'));
    bindFilter(props.filter);
    if (props.columns !== columnsSource) {
      columnsSource = props.columns;
      columns = tableColumns(props.columns);
    }
    const declared = props.sort;
    if (declared && typeof declared === 'object' && declared.id !== undefined) {
      const column = columns.find((item) => item.id === asText(declared.id));
      if (column) {
        const next = declared.dir === 'desc' ? 'desc' : 'asc';
        if (!sortState || sortState.id !== column.id || sortState.dir !== next) {
          sortState = { id: column.id, dir: next };
        }
      }
    }
    const data = Array.isArray(props.data) ? props.data : EMPTY;
    if (data !== dataSource) {
      dataSource = data;
      entries = adaptRows(data);
    }
    render();
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => {
      if (unfilter) unfilter();
      unfilter = null;
      links.releaseAll();
    },
    api: {
      /**
       * Reemplaza las filas y rearma la vista.
       * @param {unknown[]} data
       * @returns {number} cantidad de filas
       */
      setData(data) {
        const list = Array.isArray(data) ? data : [];
        ctx.props.data = list;
        dataSource = list;
        entries = adaptRows(list);
        render();
        return list.length;
      },
      /**
       * Cambia el filtro activo. Acepta una instancia de `filters.create()`,
       * un objeto de criterios o `null` para quitarlo.
       * @param {unknown} value
       * @returns {number} filas visibles
       */
      setFilter(value) {
        ctx.props.filter = value;
        bindFilter(value);
        render();
        return viewEntries().length;
      },
      /**
       * Ordena por una columna. Sin `dir` alterna ascendente/descendente.
       * @param {string} id
       * @param {'asc'|'desc'} [dir]
       * @returns {boolean} `false` si la columna no existe
       */
      sortBy(id, dir) {
        return applySort(id, dir);
      },
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : EMPTY;
      },
      /** @returns {number} */
      get count() {
        return entries.length;
      },
      /** @returns {string[]} ids en el orden visible */
      get order() {
        return viewEntries().map((entry) => entry.id);
      },
      /** @returns {string|null} */
      get selected() {
        return selectedId();
      },
      /** @returns {object|null} filtro activo */
      get filter() {
        return activeFilter;
      },
      /** @returns {{ id: string, dir: string }|null} */
      get sort() {
        return sortState ? { id: sortState.id, dir: sortState.dir } : null;
      },
      /** @returns {{ id: string, header: string, width: unknown, align: string }[]} */
      get columns() {
        return columns.map((column) => ({ ...column }));
      },
    },
  };
});

// --- tree ------------------------------------------------------------

define('tree', (ctx) => {
  const el = ctx.h('ul', { class: 'z-tree', role: 'tree' });
  const links = binding(ctx);
  let records = new Map();
  let models = [];
  let open = new Set();
  let dataSource;
  let openSource;

  const selectedId = () => {
    const value = ctx.props.selected;
    return value === undefined || value === null ? null : String(value);
  };

  const paintSelected = () => {
    const selected = selectedId();
    for (const [id, record] of records) {
      const on = selected !== null && id === selected;
      record.row.setAttribute('class', cls('z-tree__row', on && 'z-tree__row--selected'));
      record.li.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  };

  const applyVisibility = () => {
    for (const [id, record] of records) {
      const hasChildren = record.model.children.length > 0;
      const isOpen = hasChildren && open.has(id);
      record.li.setAttribute('class', cls('z-tree__node', isOpen && 'z-tree__node--open'));
      if (hasChildren) {
        record.li.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        record.toggle.textContent = isOpen ? '-' : '+';
        if (isOpen) record.childrenEl.removeAttribute('hidden');
        else record.childrenEl.setAttribute('hidden', '');
      }
    }
    paintSelected();
  };

  const select = (model, event) => {
    if (model.item && model.item.disabled) return;
    ctx.props.selected = model.id;
    paintSelected();
    ctx.emit('select', { id: model.id, item: model.item, index: model.index, event });
  };

  const setOpen = (id, next) => {
    const record = records.get(asText(id));
    if (!record || record.model.children.length === 0) return false;
    const current = open.has(record.model.id);
    if (current === next) return false;
    if (next) open.add(record.model.id);
    else open.delete(record.model.id);
    openSource = syncOpen(ctx, open);
    applyVisibility();
    ctx.emit('toggle', { id: record.model.id, open: next });
    return true;
  };

  const buildNodes = (list, host, depth) => {
    for (const model of list) {
      const hasChildren = model.children.length > 0;
      const toggle = hasChildren
        ? ctx.h('button', { class: 'z-tree__toggle', type: 'button', 'aria-label': 'Expandir o contraer' })
        : ctx.h('span', { class: 'z-tree__toggle z-tree__toggle--empty', 'aria-hidden': 'true' });
      const row = ctx.h('div', { class: 'z-tree__row', tabindex: '0' }, [
        toggle,
        ctx.h('span', { class: 'z-tree__text', text: textOf(model.item) }),
      ]);
      const childrenEl = ctx.h('ul', { class: 'z-tree__children', role: 'group' });
      const li = ctx.h('li', { class: 'z-tree__node', role: 'treeitem', 'data-id': model.id }, [row, childrenEl]);
      applyVar(row, '--z-tree-depth', depth);
      records.set(model.id, { model, li, row, childrenEl, toggle, depth });
      links.bind(row, 'click', (event) => select(model, event));
      if (hasChildren) {
        links.bind(toggle, 'click', (event) => {
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
          setOpen(model.id, !open.has(model.id));
        });
        buildNodes(model.children, childrenEl, depth + 1);
      }
      host.appendChild(li);
    }
  };

  const build = (data) => {
    links.releaseAll();
    records = new Map();
    while (el.firstChild) el.removeChild(el.firstChild);
    models = nodeModels(data);
    open = initialOpen(ctx, models);
    openSource = syncOpen(ctx, open);
    buildNodes(models, el, 0);
    applyVisibility();
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-tree', props.plain && 'z-tree--plain', props.compact && 'z-tree--compact'));
    const data = Array.isArray(props.data) ? props.data : EMPTY;
    if (data !== dataSource) {
      dataSource = data;
      build(data);
      return;
    }
    if (props.openIds !== openSource) {
      open = initialOpen(ctx, nodeModels(data));
      openSource = syncOpen(ctx, open);
      applyVisibility();
      return;
    }
    applyVisibility();
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => links.releaseAll(),
    api: {
      /**
       * Reemplaza los nodos y rearma el arbol.
       * @param {unknown[]} data
       * @returns {number} cantidad de nodos
       */
      setData(data) {
        const list = Array.isArray(data) ? data : [];
        ctx.props.data = list;
        dataSource = list;
        build(list);
        return records.size;
      },
      /**
       * @param {string|number} id
       * @returns {boolean} `false` si no existe o ya estaba abierto
       */
      open(id) {
        return setOpen(id, true);
      },
      /**
       * @param {string|number} id
       * @returns {boolean} `false` si no existe o ya estaba cerrado
       */
      close(id) {
        return setOpen(id, false);
      },
      /**
       * @param {string|number} id
       * @returns {boolean}
       */
      toggle(id) {
        const record = records.get(asText(id));
        if (!record) return false;
        return setOpen(id, !open.has(record.model.id));
      },
      /**
       * @param {string|number} id
       * @returns {boolean}
       */
      isOpen(id) {
        return open.has(asText(id));
      },
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : EMPTY;
      },
      /** @returns {number} */
      get count() {
        return records.size;
      },
      /** @returns {string[]} ids expandidos, en orden de arbol */
      get openIds() {
        return [...records.keys()].filter((id) => open.has(id));
      },
      /** @returns {string|null} */
      get selected() {
        return selectedId();
      },
    },
  };
});

// --- treetable -------------------------------------------------------

define('treetable', (ctx) => {
  const colgroup = ctx.h('colgroup');
  const thead = ctx.h('thead');
  const tbody = ctx.h('tbody');
  const table = ctx.h('table', { class: 'z-treetable__table', role: 'treegrid' }, [colgroup, thead, tbody]);
  const el = ctx.h('div', { class: 'z-treetable' }, [table]);
  const links = binding(ctx);

  let models = [];
  let columns = [];
  let records = new Map();
  let open = new Set();
  let dataSource;
  let columnsSource;
  let openSource;
  let filterSource;
  let activeFilter = null;
  let unfilter = null;
  let keep = null;
  let forced = new Set();

  const selectedId = () => {
    const value = ctx.props.selected;
    return value === undefined || value === null ? null : String(value);
  };

  const paintSelected = () => {
    const selected = selectedId();
    for (const [id, record] of records) {
      const on = selected !== null && id === selected;
      record.tr.setAttribute('class', cls('z-treetable__row', on && 'z-treetable__row--selected'));
      record.tr.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  };

  /**
   * Nodos que sobreviven al filtro: los que coinciden y todos sus ancestros.
   * `forced` guarda los ancestros, que se muestran abiertos mientras el
   * filtro este activo.
   */
  const computeFilter = () => {
    if (!activeFilter) {
      keep = null;
      forced = new Set();
      return;
    }
    keep = new Set();
    forced = new Set();
    const visit = (list) => {
      let any = false;
      for (const model of list) {
        const self = activeFilter.matches(model.item);
        const child = visit(model.children);
        if (self || child) {
          keep.add(model.id);
          any = true;
        }
        if (child) forced.add(model.id);
      }
      return any;
    };
    visit(models);
  };

  const bindFilter = (value) => {
    if (value === filterSource) return;
    filterSource = value;
    if (unfilter) {
      unfilter();
      unfilter = null;
    }
    activeFilter = filters.resolve(value);
    if (activeFilter && typeof activeFilter.onChange === 'function') {
      unfilter = activeFilter.onChange(() => {
        computeFilter();
        render();
        applyVisibility();
      });
      if (typeof unfilter !== 'function') unfilter = null;
    }
  };

  const applyVisibility = () => {
    for (const [id, record] of records) {
      const hasChildren = record.model.children.length > 0;
      const isOpen = hasChildren && (open.has(id) || forced.has(id));
      if (hasChildren) {
        record.tr.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        record.toggle.textContent = isOpen ? '-' : '+';
      }
    }
    const visible = new Set();
    const markVisible = (model, parentOpen) => {
      if (keep && !keep.has(model.id)) return;
      if (!parentOpen) return;
      visible.add(model.id);
      const isOpen = open.has(model.id) || forced.has(model.id);
      for (const child of model.children) markVisible(child, isOpen);
    };
    for (const model of models) markVisible(model, true);
    for (const [id, record] of records) {
      if (visible.has(id)) record.tr.removeAttribute('hidden');
      else record.tr.setAttribute('hidden', '');
    }
    paintSelected();
  };

  const select = (model, event) => {
    if (model.item && model.item.disabled) return;
    ctx.props.selected = model.id;
    paintSelected();
    ctx.emit('select', { id: model.id, item: model.item, index: model.index, event });
  };

  const setOpen = (id, next) => {
    const record = records.get(asText(id));
    if (!record || record.model.children.length === 0) return false;
    const current = open.has(record.model.id);
    if (current === next) return false;
    if (next) open.add(record.model.id);
    else open.delete(record.model.id);
    openSource = syncOpen(ctx, open);
    applyVisibility();
    ctx.emit('toggle', { id: record.model.id, open: next });
    return true;
  };

  const render = () => {
    links.releaseAll();
    records = new Map();
    while (colgroup.firstChild) colgroup.removeChild(colgroup.firstChild);
    while (thead.firstChild) thead.removeChild(thead.firstChild);
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    for (const column of columns) {
      const col = ctx.h('col', { class: 'z-treetable__col' });
      applyVar(col, '--z-datatable-column-width', widthValue(column.width));
      colgroup.appendChild(col);
    }

    const headerRow = ctx.h('tr', { class: 'z-treetable__header-row' });
    for (const column of columns) {
      headerRow.appendChild(
        ctx.h('th', {
          class: cls('z-treetable__header', `z-datatable__cell--${column.align}`),
          scope: 'col',
          role: 'columnheader',
          'data-column': column.id,
          text: column.header,
        })
      );
    }
    thead.appendChild(headerRow);

    const drawNode = (model, depth) => {
      const hasChildren = model.children.length > 0;
      const toggle = hasChildren
        ? ctx.h('button', { class: 'z-treetable__toggle', type: 'button', 'aria-label': 'Expandir o contraer' })
        : ctx.h('span', { class: 'z-treetable__toggle z-treetable__toggle--empty', 'aria-hidden': 'true' });
      const row = ctx.h('tr', {
        class: 'z-treetable__row',
        role: 'row',
        'data-id': model.id,
        'aria-level': String(depth + 1),
        'aria-selected': 'false',
      });

      const firstCell = ctx.h('td', {
        class: cls('z-treetable__cell', 'z-treetable__cell--tree', `z-datatable__cell--${columns[0].align}`),
        role: 'gridcell',
      });
      applyVar(firstCell, '--z-treetable-depth', depth);
      const label = cellText(model.item, columns[0]);
      firstCell.appendChild(toggle);
      firstCell.appendChild(
        ctx.h('span', { class: 'z-treetable__text', text: label === '' ? textOf(model.item) : label })
      );
      row.appendChild(firstCell);

      for (const column of columns.slice(1)) {
        row.appendChild(
          ctx.h('td', {
            class: cls('z-treetable__cell', `z-datatable__cell--${column.align}`),
            role: 'gridcell',
            text: cellText(model.item, column),
          })
        );
      }

      const record = { model, tr: row, toggle };
      records.set(model.id, record);
      links.bind(row, 'click', (event) => select(model, event));
      if (hasChildren) {
        links.bind(toggle, 'click', (event) => {
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
          setOpen(model.id, !open.has(model.id));
        });
      }
      tbody.appendChild(row);
    };

    const drawList = (list, depth) => {
      for (const model of list) {
        if (keep && !keep.has(model.id)) continue;
        drawNode(model, depth);
        drawList(model.children, depth + 1);
      }
    };
    drawList(models, 0);
  };

  const build = (data) => {
    models = nodeModels(data);
    open = initialOpen(ctx, models);
    openSource = syncOpen(ctx, open);
    computeFilter();
    render();
    applyVisibility();
  };

  const update = (props) => {
    el.setAttribute(
      'class',
      cls('z-treetable', props.plain && 'z-treetable--plain', props.compact && 'z-treetable--compact')
    );
    const filterChanged = props.filter !== filterSource;
    bindFilter(props.filter);
    const columnsChanged = props.columns !== columnsSource;
    if (columnsChanged) {
      columnsSource = props.columns;
      columns = tableColumns(props.columns);
    }
    const data = Array.isArray(props.data) ? props.data : EMPTY;
    if (data !== dataSource) {
      dataSource = data;
      build(data);
      return;
    }
    if (columnsChanged || filterChanged) {
      computeFilter();
      render();
      applyVisibility();
      return;
    }
    if (props.openIds !== openSource) {
      open = initialOpen(ctx, nodeModels(data));
      openSource = syncOpen(ctx, open);
      applyVisibility();
      return;
    }
    paintSelected();
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => {
      if (unfilter) unfilter();
      unfilter = null;
      links.releaseAll();
    },
    api: {
      /**
       * Reemplaza los nodos y rearma la tabla.
       * @param {unknown[]} data
       * @returns {number} cantidad de nodos
       */
      setData(data) {
        const list = Array.isArray(data) ? data : [];
        ctx.props.data = list;
        dataSource = list;
        build(list);
        return records.size;
      },
      /**
       * Cambia el filtro activo. Acepta una instancia de `filters.create()`,
       * un objeto de criterios o `null` para quitarlo.
       * @param {unknown} value
       * @returns {number} filas visibles
       */
      setFilter(value) {
        ctx.props.filter = value;
        bindFilter(value);
        computeFilter();
        render();
        applyVisibility();
        return records.size;
      },
      /** @returns {object|null} filtro activo */
      get filter() {
        return activeFilter;
      },
      /**
       * @param {string|number} id
       * @returns {boolean}
       */
      open(id) {
        return setOpen(id, true);
      },
      /**
       * @param {string|number} id
       * @returns {boolean}
       */
      close(id) {
        return setOpen(id, false);
      },
      /**
       * @param {string|number} id
       * @returns {boolean}
       */
      toggle(id) {
        const record = records.get(asText(id));
        if (!record) return false;
        return setOpen(id, !open.has(record.model.id));
      },
      /**
       * @param {string|number} id
       * @returns {boolean}
       */
      isOpen(id) {
        return open.has(asText(id));
      },
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : EMPTY;
      },
      /** @returns {number} */
      get count() {
        return records.size;
      },
      /** @returns {string[]} */
      get openIds() {
        return [...records.keys()].filter((id) => open.has(id));
      },
      /** @returns {string|null} */
      get selected() {
        return selectedId();
      },
    },
  };
});

// --- filter ----------------------------------------------------------

define('filter', (ctx) => {
  const el = ctx.h('div', { class: 'z-filter', role: 'search' });
  const links = binding(ctx);
  let columns = [];
  let inputs = new Map();
  let columnsSource;
  let valuesSource;

  const readValues = () => {
    const out = {};
    for (const [id, input] of inputs) {
      const value = input.value;
      if (value !== undefined && value !== null && value !== '') out[id] = value;
    }
    return out;
  };

  const writeValues = (values) => {
    if (!values || typeof values !== 'object') return readValues();
    for (const [id, input] of inputs) {
      const value = values[id];
      input.value = value === undefined || value === null ? '' : String(value);
    }
    return readValues();
  };

  const build = (list) => {
    links.releaseAll();
    inputs = new Map();
    while (el.firstChild) el.removeChild(el.firstChild);
    columns = normalizeColumns(list);
    for (const column of columns) {
      const type = FILTER_TYPES.has(column.type) ? column.type : 'text';
      const input = ctx.h('input', {
        class: 'z-filter__input',
        type,
        name: column.id,
        placeholder: column.placeholder,
      });
      inputs.set(column.id, input);
      links.bind(input, 'change', () => {
        const values = readValues();
        ctx.props.values = values;
        valuesSource = values;
        ctx.emit('change', { id: column.id, value: input.value, values });
      });
      el.appendChild(
        ctx.h('label', { class: 'z-filter__field', 'data-column': column.id }, [
          ctx.h('span', { class: 'z-filter__label', text: column.header }),
          input,
        ])
      );
    }
  };

  const update = (props) => {
    el.setAttribute(
      'class',
      cls(
        'z-filter',
        props.plain && 'z-filter--plain',
        props.compact && 'z-filter--compact',
        props.disabled && 'z-filter--disabled'
      )
    );
    const declared = props.columns !== undefined ? props.columns : props.fields;
    if (declared !== columnsSource) {
      columnsSource = declared;
      build(declared);
    }
    for (const input of inputs.values()) input.disabled = Boolean(props.disabled);
    if (props.values !== undefined && props.values !== valuesSource) {
      valuesSource = props.values;
      writeValues(props.values);
    }
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: () => links.releaseAll(),
    api: {
      /**
       * Valores no vacios de la barra.
       * @returns {Record<string, string>}
       */
      getValues() {
        return readValues();
      },
      /**
       * Aplica valores por columna. No emite `change`.
       * @param {Record<string, unknown>} values
       * @returns {Record<string, string>}
       */
      setValues(values) {
        const result = writeValues(values);
        ctx.props.values = result;
        valuesSource = result;
        return result;
      },
      /**
       * Vacia todos los campos y emite `change` con el criterio vacio.
       * @returns {Record<string, string>}
       */
      clear() {
        for (const input of inputs.values()) input.value = '';
        const empty = {};
        ctx.props.values = empty;
        valuesSource = empty;
        ctx.emit('change', { id: null, value: null, values: empty });
        return readValues();
      },
      /** @returns {Record<string, string>} */
      get values() {
        return readValues();
      },
      /** @returns {number} cantidad de campos */
      get count() {
        return inputs.size;
      },
      /** @returns {string[]} ids de columna con campo */
      get columns() {
        return [...inputs.keys()];
      },
    },
  };
});
