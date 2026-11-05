/**
 * Widgets de layout de segundo nivel: button, carousel, portlet y dashboard.
 *
 * - `button`: boton con texto, icono opcional y variantes `primary`, `danger`
 *   y `ghost`. `setValue()` cambia el texto y emite `change`; el clic emite
 *   `click`. Es propio del catalogo y no reemplaza al `action` del core, que
 *   queda para acciones simples.
 * - `carousel`: muestra una diapositiva por vez, con indicadores, navegacion
 *   por API y `autoplay` opcional apagado por defecto.
 * - `portlet`: panel con titulo, icono, contenido, colapso y cierre por API.
 * - `dashboard`: grilla por coordenadas (`col`, `row`, `width`, `height`)
 *   resuelta con custom properties; sin arrastre en esta version.
 *
 * Los hijos se crean con `create()` y se destruyen junto con el widget.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { create, Widget } from '../core/widget.js';

const BUTTON_VARIANTS = new Set(['primary', 'danger', 'ghost']);
const DEFAULT_AUTOPLAY_MS = 4000;
const DEFAULT_DASHBOARD_COLUMNS = 'repeat(12, minmax(0, 1fr))';
const EMPTY = [];
const UNSET = Symbol('unset');

/** @param {unknown} value @returns {string} */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
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

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function toNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * @param {unknown} value
 * @returns {number|null} entero positivo o null
 */
function positive(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.trunc(numeric);
}

/**
 * Escribe una variable CSS en el elemento. En el navegador usa `setProperty`
 * (unica via valida para custom properties); en el DOM minimo de los tests,
 * donde `style` es un objeto plano, asigna la propiedad.
 *
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
 * Agrega un hijo a un host y devuelve las instancias creadas, para poder
 * destruirlas cuando la celda se quita.
 *
 * @param {any} ctx
 * @param {Element} host
 * @param {unknown} value
 * @returns {any[]}
 */
function place(ctx, host, value) {
  if (value === undefined || value === null || value === false) return [];
  if (Array.isArray(value)) {
    const out = [];
    for (const entry of value) out.push(...place(ctx, host, entry));
    return out;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    host.appendChild(ctx.doc().createTextNode(String(value)));
    return [];
  }
  if (value instanceof Widget) {
    host.appendChild(value.el);
    return [value];
  }
  if (typeof value === 'object' && typeof value.nodeType === 'number') {
    host.appendChild(value);
    return [];
  }
  if (value && typeof value === 'object' && typeof value.kind === 'string') {
    const instance = create(value);
    host.appendChild(instance.el);
    return [instance];
  }
  throw new TypeError('zorzal: contenido no soportado en un layout (spec, instancia, string o nodo)');
}

/**
 * Dibuja el icono opcional. Un string se interpreta como nombre del widget
 * `icon`; tambien acepta un spec, una instancia o un nodo.
 *
 * @param {any} ctx
 * @param {Element} host
 * @param {unknown} icon
 */
function paintIcon(ctx, host, icon) {
  const hidden = icon === undefined || icon === null || icon === false || icon === '';
  host.style.display = hidden ? 'none' : '';
  if (hidden) {
    ctx.content(host, EMPTY);
    return;
  }
  ctx.content(host, typeof icon === 'string' ? { kind: 'icon', name: icon } : icon);
}

// --- button -----------------------------------------------------------

define('button', (ctx) => {
  const iconHost = ctx.h('span', { class: 'z-button__icon' });
  const label = ctx.h('span', { class: 'z-button__label' });
  const el = ctx.h('button', { class: 'z-button', type: 'button' }, [iconHost, label]);
  let iconSource = UNSET;

  const update = (props) => {
    const variant = BUTTON_VARIANTS.has(props.variant) ? props.variant : 'default';
    el.setAttribute(
      'class',
      cls('z-button', `z-button--${variant}`, props.block && 'z-button--block', props.disabled && 'z-button--disabled')
    );
    label.textContent = asText(props.text !== undefined ? props.text : props.label);
    label.style.display = props.text === undefined && props.label === undefined ? 'none' : '';
    if (props.icon !== iconSource) {
      iconSource = props.icon;
      paintIcon(ctx, iconHost, props.icon);
    }
    el.setAttribute('type', asText(props.type || 'button'));
    if (props.name) el.setAttribute('name', asText(props.name));
    else el.removeAttribute('name');
    if (props.title) el.setAttribute('title', asText(props.title));
    else el.removeAttribute('title');
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
      /**
       * Cambia el texto del boton y emite `change`.
       * @param {unknown} value
       * @returns {string}
       */
      setValue(value) {
        ctx.props.text = asText(value);
        update(ctx.props);
        ctx.emit('change', { value: ctx.props.text });
        return ctx.props.text;
      },
      /** @returns {string} */
      getValue() {
        return label.textContent;
      },
      /** @returns {string} */
      get text() {
        return label.textContent;
      },
      /** @returns {boolean} */
      get disabled() {
        return Boolean(ctx.props.disabled);
      },
    },
  };
});

// --- carousel ---------------------------------------------------------

/**
 * Normaliza una diapositiva: `{ id, label, content }`. Un item con `kind` es
 * un spec; `content` y `text` designan el contenido de la diapositiva.
 *
 * @param {unknown} item
 * @param {number} index
 * @returns {{ id: unknown, label: string, content: unknown }}
 */
function slideOf(item, index) {
  const object = item !== null && typeof item === 'object' && !Array.isArray(item);
  const id = object && item.id !== undefined ? item.id : index;
  const label = object && item.label !== undefined ? asText(item.label) : `Diapositiva ${index + 1}`;
  if (!object) return { id, label, content: item };
  if (typeof item.kind === 'string') return { id, label, content: item };
  if (item.content !== undefined) return { id, label, content: item.content };
  if (item.text !== undefined) return { id, label, content: item.text };
  if (item.body !== undefined) return { id, label, content: item.body };
  return { id, label, content: '' };
}

define('carousel', (ctx) => {
  const viewport = ctx.h('div', { class: 'z-carousel__viewport' });
  const indicators = ctx.h('div', { class: 'z-carousel__indicators' });
  const prevBtn = ctx.h('button', { class: 'z-carousel__nav z-carousel__nav--prev', type: 'button', 'aria-label': 'Anterior' }, '\u2039');
  const nextBtn = ctx.h('button', { class: 'z-carousel__nav z-carousel__nav--next', type: 'button', 'aria-label': 'Siguiente' }, '\u203a');
  const el = ctx.h('div', { class: 'z-carousel', role: 'region', 'aria-roledescription': 'carrusel' }, [
    viewport,
    prevBtn,
    nextBtn,
    indicators,
  ]);

  let slides = [];
  let itemsSource;
  let index = 0;
  let timer = null;

  const paint = () => {
    const total = slides.length;
    if (total) index = Math.min(Math.max(index, 0), total - 1);
    for (let i = 0; i < total; i += 1) {
      const active = i === index;
      slides[i].slide.setAttribute('class', cls('z-carousel__slide', active && 'z-carousel__slide--active'));
      slides[i].slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      slides[i].button.setAttribute('class', cls('z-carousel__indicator', active && 'z-carousel__indicator--active'));
      slides[i].button.setAttribute('aria-current', active ? 'true' : 'false');
    }
    const empty = total === 0;
    el.setAttribute('class', cls('z-carousel', empty && 'z-carousel--empty', ctx.props.plain && 'z-carousel--plain'));
    prevBtn.style.display = empty ? 'none' : '';
    nextBtn.style.display = empty ? 'none' : '';
    indicators.style.display = empty ? 'none' : '';
  };

  const resolveIndex = (target) => {
    if (typeof target === 'number') {
      return Number.isInteger(target) && target >= 0 && target < slides.length ? target : -1;
    }
    return slides.findIndex((entry) => String(entry.id) === String(target));
  };

  const activate = (target, reason = 'api') => {
    const next = resolveIndex(target);
    if (next < 0 || next === index) return false;
    const previous = slides[index] ? slides[index].id : null;
    index = next;
    paint();
    ctx.emit('change', { index, id: slides[index].id, previous, reason });
    return true;
  };

  const step = (delta, reason = 'api') => {
    if (slides.length === 0) return false;
    const next = (index + delta + slides.length) % slides.length;
    return activate(next, reason);
  };

  const stopTimer = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    const autoplay = ctx.props.autoplay;
    if (!autoplay || slides.length < 2) return;
    const fallback = typeof autoplay === 'number' ? autoplay : DEFAULT_AUTOPLAY_MS;
    const interval = toNumber(
      ctx.props.interval !== undefined ? ctx.props.interval : ctx.props.autoplayInterval,
      fallback
    );
    if (interval <= 0) return;
    timer = setInterval(() => step(1, 'autoplay'), interval);
    if (timer && typeof timer.unref === 'function') timer.unref();
  };

  const build = (items) => {
    for (const entry of slides) {
      ctx.release(entry.button, 'click');
      ctx.content(entry.slide, EMPTY);
    }
    while (viewport.firstChild) viewport.removeChild(viewport.firstChild);
    while (indicators.firstChild) indicators.removeChild(indicators.firstChild);
    slides = [];
    const list = Array.isArray(items) ? items : EMPTY;
    list.forEach((item, i) => {
      const data = slideOf(item, i);
      const slide = ctx.h('div', {
        class: 'z-carousel__slide',
        role: 'group',
        'aria-roledescription': 'diapositiva',
      });
      ctx.content(slide, data.content);
      viewport.appendChild(slide);
      const button = ctx.h('button', {
        class: 'z-carousel__indicator',
        type: 'button',
        'aria-label': data.label,
        'data-index': String(i),
      });
      ctx.on(button, 'click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        activate(i, 'indicator');
      });
      indicators.appendChild(button);
      slides.push({ ...data, slide, button });
    });
    paint();
  };

  const update = (props) => {
    const items = Array.isArray(props.items) ? props.items : EMPTY;
    if (items !== itemsSource) {
      itemsSource = items;
      build(items);
    }
    el.setAttribute(
      'class',
      cls('z-carousel', slides.length === 0 && 'z-carousel--empty', props.plain && 'z-carousel--plain')
    );
    if (props.active !== undefined && props.active !== null) {
      const target = resolveIndex(props.active);
      if (target >= 0 && target !== index) {
        index = target;
        paint();
      }
    }
    startTimer();
  };
  update(ctx.props);

  ctx.on(prevBtn, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    step(-1, 'click');
  });
  ctx.on(nextBtn, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    step(1, 'click');
  });

  return {
    el,
    update,
    destroy: stopTimer,
    api: {
      /** @returns {boolean} */
      next() {
        return step(1, 'api');
      },
      /** @returns {boolean} */
      prev() {
        return step(-1, 'api');
      },
      /**
       * Activa una diapositiva por indice o por id. Devuelve `false` si no
       * existe o si ya estaba activa.
       * @param {number|string} target
       * @returns {boolean}
       */
      setActive(target) {
        return activate(target, 'api');
      },
      /** @returns {unknown} */
      get active() {
        return slides.length ? slides[index].id : null;
      },
      /** @returns {number} */
      get index() {
        return slides.length ? index : -1;
      },
      /** @returns {number} */
      get count() {
        return slides.length;
      },
    },
  };
});

// --- portlet ----------------------------------------------------------

define('portlet', (ctx) => {
  const iconHost = ctx.h('span', { class: 'z-portlet__icon' });
  const titleEl = ctx.h('h3', { class: 'z-portlet__title' });
  const toggleBtn = ctx.h('button', { class: 'z-portlet__toggle', type: 'button', 'aria-expanded': 'true' }, '-');
  const closeBtn = ctx.h('button', { class: 'z-portlet__close', type: 'button', 'aria-label': 'Cerrar' }, 'x');
  const tools = ctx.h('div', { class: 'z-portlet__tools' }, [toggleBtn, closeBtn]);
  const header = ctx.h('header', { class: 'z-portlet__header' }, [iconHost, titleEl, tools]);
  const body = ctx.h('div', { class: 'z-portlet__body' });
  const footer = ctx.h('div', { class: 'z-portlet__footer' });
  const el = ctx.h('section', { class: 'z-portlet' }, [header, body, footer]);
  let iconSource = UNSET;

  const update = (props) => {
    const collapsed = Boolean(props.collapsed);
    const closed = Boolean(props.closed);
    el.setAttribute(
      'class',
      cls(
        'z-portlet',
        collapsed && 'z-portlet--collapsed',
        closed && 'z-portlet--closed',
        props.plain && 'z-portlet--plain'
      )
    );
    el.setAttribute('aria-hidden', closed ? 'true' : 'false');
    if (props.icon !== iconSource) {
      iconSource = props.icon;
      paintIcon(ctx, iconHost, props.icon);
    }
    titleEl.textContent = asText(props.title);
    titleEl.style.display = props.title === undefined || props.title === '' ? 'none' : '';
    toggleBtn.style.display = props.collapsible === false ? 'none' : '';
    toggleBtn.textContent = collapsed ? '+' : '-';
    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggleBtn.setAttribute('aria-label', collapsed ? 'Expandir' : 'Contraer');
    closeBtn.style.display = props.closable === false ? 'none' : '';
    body.style.display = collapsed ? 'none' : '';
    ctx.content(body, props.content !== undefined ? props.content : props.body);
    ctx.content(footer, props.footer);
    footer.style.display = props.footer === undefined ? 'none' : '';
  };
  update(ctx.props);

  const setCollapsed = (value, reason) => {
    const next = Boolean(value);
    if (next === Boolean(ctx.props.collapsed)) return false;
    ctx.props.collapsed = next;
    update(ctx.props);
    ctx.emit('collapse', { collapsed: next, reason });
    return true;
  };

  const closePortlet = (reason = 'api') => {
    if (ctx.props.closed) return false;
    ctx.props.closed = true;
    update(ctx.props);
    ctx.emit('close', { reason });
    return true;
  };

  const openPortlet = (reason = 'api') => {
    if (!ctx.props.closed) return false;
    ctx.props.closed = false;
    update(ctx.props);
    ctx.emit('open', { reason });
    return true;
  };

  ctx.on(toggleBtn, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (ctx.props.collapsible === false) return;
    setCollapsed(!ctx.props.collapsed, 'click');
  });
  ctx.on(closeBtn, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (ctx.props.closable === false) return;
    closePortlet('click');
  });

  return {
    el,
    update,
    api: {
      /**
       * Cambia el titulo y devuelve el valor aplicado.
       * @param {unknown} title
       * @returns {string}
       */
      setTitle(title) {
        ctx.props.title = asText(title);
        update(ctx.props);
        return ctx.props.title;
      },
      /**
       * Pliega o despliega el cuerpo. Sin argumento alterna.
       * @param {boolean} [value]
       * @returns {boolean}
       */
      collapse(value) {
        return setCollapsed(value === undefined ? !ctx.props.collapsed : value, 'api');
      },
      /** @returns {boolean} */
      expand() {
        return setCollapsed(false, 'api');
      },
      /** @returns {boolean} */
      toggle() {
        return setCollapsed(!ctx.props.collapsed, 'api');
      },
      /** @returns {boolean} */
      close(reason) {
        return closePortlet(reason || 'api');
      },
      /** @returns {boolean} */
      open(reason) {
        return openPortlet(reason || 'api');
      },
      /** @returns {boolean} */
      get collapsed() {
        return Boolean(ctx.props.collapsed);
      },
      /** @returns {boolean} */
      get closed() {
        return Boolean(ctx.props.closed);
      },
      /** @returns {string} */
      get title() {
        return titleEl.textContent;
      },
    },
  };
});

// --- dashboard --------------------------------------------------------

/**
 * Posicion normalizada de una celda. `col` y `row` en null dejan que la grilla
 * las ubique sola; `width` y `height` valen 1 por defecto.
 *
 * @param {unknown} item
 * @returns {{ col: number|null, row: number|null, width: number, height: number }}
 */
function positionOf(item) {
  const source = item !== null && typeof item === 'object' ? item : {};
  return {
    col: positive(source.col),
    row: positive(source.row),
    width: positive(source.width) || 1,
    height: positive(source.height) || 1,
  };
}

/**
 * @param {any} base
 * @param {any} patch
 * @returns {{ col: number|null, row: number|null, width: number, height: number }}
 */
function mergePosition(base, patch) {
  const merged = { ...base };
  for (const key of ['col', 'row', 'width', 'height']) {
    if (patch[key] !== undefined && patch[key] !== null) merged[key] = patch[key];
  }
  return positionOf(merged);
}

/**
 * Contenido de una celda: un spec con `kind`, `content`, `text` o el valor tal
 * cual (texto, nodo, instancia).
 *
 * @param {unknown} item
 * @returns {unknown}
 */
function cellContent(item) {
  if (item === null || typeof item !== 'object') return item;
  if (item instanceof Widget) return item;
  if (typeof item.nodeType === 'number') return item;
  if (Array.isArray(item)) return item;
  if (typeof item.kind === 'string') return item;
  if (item.content !== undefined) return item.content;
  if (item.text !== undefined) return item.text;
  return '';
}

/** @param {unknown} cols @returns {string} */
function columnsValue(cols) {
  if (cols === undefined || cols === null || cols === '') return DEFAULT_DASHBOARD_COLUMNS;
  if (typeof cols === 'number' && Number.isFinite(cols) && cols > 0) {
    return `repeat(${Math.trunc(cols)}, minmax(0, 1fr))`;
  }
  const text = String(cols).trim();
  if (/^\d+$/.test(text)) return `repeat(${text}, minmax(0, 1fr))`;
  return text;
}

define('dashboard', (ctx) => {
  const el = ctx.h('div', { class: 'z-dashboard', role: 'grid' });
  let entries = [];
  let items = [];
  let itemsSource;
  let sequence = 0;

  const paintCell = (entry) => {
    const { col, row, width, height } = entry.pos;
    setVar(entry.cell, '--z-cell-column', col === null ? `span ${width}` : `${col} / span ${width}`);
    setVar(entry.cell, '--z-cell-row', row === null ? `span ${height}` : `${row} / span ${height}`);
  };

  const layout = () =>
    entries.map((entry) => ({
      id: entry.id,
      col: entry.pos.col,
      row: entry.pos.row,
      width: entry.pos.width,
      height: entry.pos.height,
    }));

  const createEntry = (item) => {
    const object = item !== null && typeof item === 'object' && !Array.isArray(item);
    sequence += 1;
    const id = object && item.id !== undefined ? item.id : `cell-${sequence}`;
    const cell = ctx.h('div', { class: 'z-dashboard__cell', role: 'gridcell', 'data-id': String(id) });
    const created = place(ctx, cell, cellContent(item));
    const entry = { id, cell, created, pos: positionOf(item) };
    paintCell(entry);
    return entry;
  };

  const destroyEntries = () => {
    for (const entry of entries) {
      for (const child of entry.created) child.destroy();
      entry.created.length = 0;
    }
    entries = [];
  };

  const build = (list) => {
    destroyEntries();
    while (el.firstChild) el.removeChild(el.firstChild);
    sequence = 0;
    entries = list.map((item) => createEntry(item));
    for (const entry of entries) el.appendChild(entry.cell);
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-dashboard', props.plain && 'z-dashboard--plain'));
    const list = Array.isArray(props.items) ? props.items : Array.isArray(props.children) ? props.children : EMPTY;
    if (list !== itemsSource) {
      itemsSource = list;
      items = list.slice();
      build(items);
    }
    setVar(el, '--z-dashboard-columns', columnsValue(props.cols));
    const rowHeight = lengthValue(props.rowHeight);
    if (rowHeight) setVar(el, '--z-dashboard-row-height', rowHeight);
    else removeVar(el, '--z-dashboard-row-height');
    const gap = lengthValue(props.gap);
    if (gap) setVar(el, '--z-dashboard-gap', gap);
    else removeVar(el, '--z-dashboard-gap');
  };
  update(ctx.props);

  return {
    el,
    update,
    destroy: destroyEntries,
    api: {
      /**
       * Agrega una celda con widget o contenido. Devuelve el id asignado.
       * @param {{ id?: unknown, col?: number, row?: number, width?: number, height?: number } & Record<string, unknown>} spec
       * @returns {unknown}
       */
      add(spec) {
        const item = spec === null || typeof spec !== 'object' || Array.isArray(spec) ? { content: spec } : spec;
        const list = items.slice();
        list.push(item);
        items = list;
        itemsSource = list;
        ctx.props.items = list;
        const entry = createEntry(item);
        entries.push(entry);
        el.appendChild(entry.cell);
        ctx.emit('add', { id: entry.id, index: entries.length - 1 });
        ctx.emit('change', { layout: layout() });
        return entry.id;
      },
      /**
       * Quita y destruye la celda con ese id.
       * @param {unknown} id
       * @returns {boolean}
       */
      remove(id) {
        const index = entries.findIndex((entry) => String(entry.id) === String(id));
        if (index < 0) return false;
        const [entry] = entries.splice(index, 1);
        for (const child of entry.created) child.destroy();
        entry.created.length = 0;
        if (entry.cell.parentNode) entry.cell.parentNode.removeChild(entry.cell);
        items.splice(index, 1);
        itemsSource = items;
        ctx.props.items = items;
        ctx.emit('remove', { id: entry.id, index });
        ctx.emit('change', { layout: layout() });
        return true;
      },
      /**
       * Reubica celdas existentes. Ignora ids desconocidos y devuelve cuantas
       * posiciones aplico.
       * @param {{ id: unknown, col?: number, row?: number, width?: number, height?: number }[]} list
       * @returns {number}
       */
      setLayout(list) {
        if (!Array.isArray(list)) {
          throw new TypeError('zorzal: dashboard.setLayout espera un array de posiciones');
        }
        let applied = 0;
        for (const item of list) {
          if (!item || typeof item !== 'object') continue;
          const entry = entries.find((candidate) => String(candidate.id) === String(item.id));
          if (!entry) continue;
          entry.pos = mergePosition(entry.pos, item);
          paintCell(entry);
          applied += 1;
        }
        if (applied) ctx.emit('change', { layout: layout() });
        return applied;
      },
      /** @returns {{ id: unknown, col: number|null, row: number|null, width: number, height: number }[]} */
      get layout() {
        return layout();
      },
      /** @returns {number} */
      get count() {
        return entries.length;
      },
    },
  };
});
