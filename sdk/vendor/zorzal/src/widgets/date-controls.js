/**
 * Widgets de fecha y hora: calendar, datepicker, daterange, daterangepicker,
 * daterangesuggest y timeboard.
 *
 * `calendar` es la base: dibuja un mes, navega y elige un dia. Los pickers
 * componen ese mismo calendario dentro de un popup y `timeboard` resuelve la
 * hora por separado. Todas las fechas se arman en horario local y el formato y
 * el parseo reutilizan el servicio `date`; no hay dependencias externas.
 *
 * Semantica de valores:
 *  - `calendar` y `datepicker` devuelven el texto formateado con `format`
 *    (`YYYY-MM-DD` por omision).
 *  - `daterange`, `daterangepicker` y `daterangesuggest` devuelven
 *    `{ start, end }` con extremos inclusivos y el mismo formateo.
 *  - `timeboard` devuelve siempre `HH:MM`.
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import { format as formatDate, parse as parseDate, toDate } from '../services/date.js';

const DEFAULT_FORMAT = 'YYYY-MM-DD';
const HINT_FORMAT = 'DD/MM/YYYY';
const MINUTES_IN_DAY = 24 * 60;

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const WEEKDAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sa', 'do'];

/** @param {unknown} value */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/** @param {number} value */
function pad2(value) {
  return String(value).padStart(2, '0');
}

/** @param {Date} value */
function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/** @param {Date} value */
function firstOfMonth(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

/** @param {Date} a @param {Date} b */
function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** @param {number} year @param {number} month */
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** @param {Date} value @param {number} delta */
function addDays(value, delta) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + delta);
}

/** @returns {Date} */
function today() {
  return startOfDay(new Date());
}

/** @param {Date|null} value @param {string} [pattern] */
function fmtDate(value, pattern = DEFAULT_FORMAT) {
  return value ? formatDate(value, pattern) : '';
}

/**
 * Convierte Date, epoch o texto a una fecha local a medianoche.
 * Los textos se prueban primero contra `pattern` para no pasar por UTC.
 *
 * @param {unknown} value
 * @param {string} [pattern]
 * @returns {Date|null}
 */
function toLocalDate(value, pattern = DEFAULT_FORMAT) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfDay(value);
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : startOfDay(date);
  }
  const text = asText(value).trim();
  if (text === '') return null;
  const parsed = parseDate(text, pattern) || parseDate(text, DEFAULT_FORMAT) || toDate(text);
  return parsed ? startOfDay(parsed) : null;
}

/**
 * Normaliza un valor de rango. Si los extremos vienen invertidos los ordena.
 *
 * @param {unknown} value
 * @param {string} [pattern]
 * @returns {{ start: Date|null, end: Date|null }}
 */
function toRange(value, pattern = DEFAULT_FORMAT) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { start: null, end: null };
  }
  let start = toLocalDate(value.start, pattern);
  let end = toLocalDate(value.end, pattern);
  if (start && end && end.getTime() < start.getTime()) [start, end] = [end, start];
  return { start, end };
}

/** @param {{ start: Date|null, end: Date|null }} range */
function completeRange(range) {
  return Boolean(range && range.start && range.end);
}

/** @param {{ start: Date|null, end: Date|null }} range @param {string} pattern */
function rangeText(range, pattern) {
  return { start: fmtDate(range.start, pattern), end: fmtDate(range.end, pattern) };
}

/**
 * Aplica un clic de dia sobre un rango: primer extremo, cierre o reinicio.
 *
 * @param {{ start: Date|null, end: Date|null }} current
 * @param {Date} date
 * @returns {{ start: Date, end: Date|null }}
 */
function extendRange(current, date) {
  const start = current ? current.start : null;
  const end = current ? current.end : null;
  if (!start || end) return { start: date, end: null };
  if (date.getTime() < start.getTime()) return { start: date, end: start };
  return { start, end: date };
}

/**
 * Sube por el arbol hasta el nodo que declara `data-*`.
 *
 * @param {Node|null} node
 * @param {Node|null} stop
 * @param {string} attr
 * @returns {Element|null}
 */
function nodeWithAttr(node, stop, attr) {
  let current = node;
  while (current && current !== stop) {
    if (typeof current.getAttribute === 'function' && current.getAttribute(attr) !== null) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Refleja el estado deshabilitado en un control nativo.
 *
 * @param {Element} el
 * @param {unknown} disabled
 */
function setDisabled(el, disabled) {
  if (disabled) el.setAttribute('disabled', '');
  else el.removeAttribute('disabled');
}

/**
 * Calendario de mes reutilizable.
 *
 * Devuelve el nodo y un API de pintado; el widget que lo compone decide que
 * hacer en `onPick` y en `onNavigate`. No registra listeners fuera de sus
 * propios nodos.
 *
 * @param {any} ctx
 * @param {{ onPick?: (date: Date) => void, onNavigate?: (view: { year: number, month: number }) => void }} [config]
 */
export function buildCalendar(ctx, config = {}) {
  const title = ctx.h('span', { class: 'z-calendar__title', 'aria-live': 'polite' });
  const prev = ctx.h('button', {
    class: 'z-calendar__nav z-calendar__nav--prev',
    type: 'button',
    'aria-label': 'Mes anterior',
  }, ['\u2039']);
  const next = ctx.h('button', {
    class: 'z-calendar__nav z-calendar__nav--next',
    type: 'button',
    'aria-label': 'Mes siguiente',
  }, ['\u203a']);
  const header = ctx.h('div', { class: 'z-calendar__header' }, [prev, title, next]);
  const weekdays = ctx.h(
    'div',
    { class: 'z-calendar__weekdays', 'aria-hidden': 'true' },
    WEEKDAYS.map((name) => ctx.h('span', { class: 'z-calendar__weekday' }, [name]))
  );
  const grid = ctx.h('div', { class: 'z-calendar__grid', role: 'grid' });
  const el = ctx.h('div', {
    class: 'z-calendar',
    role: 'group',
    'aria-label': 'Calendario',
  }, [header, weekdays, grid]);

  let view = firstOfMonth(today());
  let selected = null;
  let range = { start: null, end: null };

  const inRange = (date) => Boolean(range.start && range.end)
    && date.getTime() >= range.start.getTime()
    && date.getTime() <= range.end.getTime();

  const isEndpoint = (date) => sameDay(date, range.start) || sameDay(date, range.end);

  const cellClass = (date) => {
    const outside = date.getMonth() !== view.getMonth();
    return cls(
      'z-calendar__day',
      outside && 'z-calendar__day--outside',
      sameDay(date, today()) && 'z-calendar__day--today',
      sameDay(date, selected) && 'z-calendar__day--selected',
      sameDay(date, range.start) && 'z-calendar__day--range-start',
      sameDay(date, range.end) && 'z-calendar__day--range-end',
      inRange(date) && 'z-calendar__day--in-range'
    );
  };

  const renderDays = () => {
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    const year = view.getFullYear();
    const month = view.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = Math.ceil((offset + daysInMonth(year, month)) / 7) * 7;
    for (let index = 0; index < total; index += 1) {
      const date = new Date(year, month, index - offset + 1);
      const chosen = sameDay(date, selected) || isEndpoint(date);
      const cell = ctx.h('button', {
        class: cellClass(date),
        type: 'button',
        role: 'gridcell',
        'data-date': fmtDate(date),
        'aria-selected': chosen ? 'true' : 'false',
      }, [String(date.getDate())]);
      grid.appendChild(cell);
    }
  };

  const paint = () => {
    title.textContent = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
    renderDays();
  };

  const move = (delta) => {
    if (ctx.props.disabled) return;
    view = new Date(view.getFullYear(), view.getMonth() + delta, 1);
    paint();
    if (typeof config.onNavigate === 'function') {
      config.onNavigate({ year: view.getFullYear(), month: view.getMonth() + 1 });
    }
  };

  const pick = (event) => {
    if (ctx.props.disabled || typeof config.onPick !== 'function') return;
    const cell = nodeWithAttr(event ? event.target : null, grid, 'data-date');
    if (!cell) return;
    const date = parseDate(cell.getAttribute('data-date'), DEFAULT_FORMAT);
    if (!date) return;
    config.onPick(startOfDay(date));
    if (date.getMonth() !== view.getMonth() || date.getFullYear() !== view.getFullYear()) {
      view = firstOfMonth(date);
      paint();
    }
  };

  ctx.on(grid, 'click', pick);
  ctx.on(prev, 'click', () => move(-1));
  ctx.on(next, 'click', () => move(1));
  paint();

  return {
    el,
    paint,
    move,
    /** @param {Date|null} date */
    setValue(date) {
      selected = date ? startOfDay(date) : null;
      if (selected) view = firstOfMonth(selected);
      paint();
    },
    /** @param {{ start: Date|null, end: Date|null }} next */
    setRange(next) {
      range = {
        start: next && next.start ? startOfDay(next.start) : null,
        end: next && next.end ? startOfDay(next.end) : null,
      };
      paint();
    },
    /** @param {Date|null} date */
    show(date) {
      view = firstOfMonth(date ? startOfDay(date) : today());
      paint();
    },
    /** @returns {{ year: number, month: number }} */
    get view() {
      return { year: view.getFullYear(), month: view.getMonth() + 1 };
    },
  };
}

// --- calendar ---------------------------------------------------------

define('calendar', (ctx) => {
  let value = null;
  let applied;
  let appliedFormat = asText(ctx.props.format) || DEFAULT_FORMAT;

  const pattern = () => asText(ctx.props.format) || DEFAULT_FORMAT;

  const getValue = () => fmtDate(value, pattern());

  const publish = () => {
    ctx.props.date = value;
    ctx.props.value = getValue();
    applied = ctx.props.date;
    appliedFormat = pattern();
  };

  const choose = (date) => {
    value = startOfDay(date);
    panel.setValue(value);
    publish();
    ctx.emit('change', { value: getValue(), date: new Date(value.getTime()) });
  };

  const panel = buildCalendar(ctx, {
    onPick: choose,
    onNavigate: (view) => ctx.emit('navigate', view),
  });

  const setValue = (next) => {
    value = toLocalDate(next, pattern());
    applied = next;
    appliedFormat = pattern();
    panel.setValue(value);
    ctx.props.date = value;
    ctx.props.value = getValue();
    return getValue();
  };

  const sync = (props) => {
    const raw = props.date !== undefined ? props.date : props.value;
    const nextFormat = asText(props.format) || DEFAULT_FORMAT;
    if (raw === applied) {
      appliedFormat = nextFormat;
      return;
    }
    applied = raw;
    appliedFormat = nextFormat;
    value = toLocalDate(raw, nextFormat);
    panel.setValue(value);
  };

  const update = (props) => {
    panel.el.setAttribute('class', cls('z-calendar', props.disabled && 'z-calendar--disabled'));
    panel.el.setAttribute('aria-disabled', props.disabled ? 'true' : 'false');
    sync(props);
  };
  update(ctx.props);

  return {
    el: panel.el,
    update,
    api: {
      /** @returns {string} */
      getValue,
      /** @returns {Date|null} */
      getDate() {
        return value ? new Date(value.getTime()) : null;
      },
      /**
       * @param {Date|number|string|null} next
       * @returns {string}
       */
      setValue,
      /** @returns {import('../core/widget.js').Widget} */
      prev() {
        panel.move(-1);
        return ctx.instance;
      },
      /** @returns {import('../core/widget.js').Widget} */
      next() {
        panel.move(1);
        return ctx.instance;
      },
      /** @param {Date|number|string} date */
      show(date) {
        panel.show(toLocalDate(date, pattern()));
      },
    },
  };
});

// --- datepicker -------------------------------------------------------

define('datepicker', (ctx) => {
  const input = ctx.h('input', {
    class: 'z-datepicker__input',
    type: 'text',
    autocomplete: 'off',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
  });
  const toggle = ctx.h('button', {
    class: 'z-datepicker__toggle',
    type: 'button',
    'aria-label': 'Abrir calendario',
    'aria-expanded': 'false',
  }, ['\u25be']);
  const field = ctx.h('div', { class: 'z-datepicker__field' }, [input, toggle]);
  const popup = ctx.h('div', {
    class: cls('z-datepicker__popup', 'z-hidden'),
    role: 'dialog',
    'aria-label': 'Elegir fecha',
  });
  const el = ctx.h('div', { class: 'z-datepicker' }, [field, popup]);

  let value = null;
  let applied;
  let appliedFormat = asText(ctx.props.format) || DEFAULT_FORMAT;
  let opened = false;
  let outside = null;
  let escape = null;

  const pattern = () => asText(ctx.props.format) || DEFAULT_FORMAT;
  const getValue = () => fmtDate(value, pattern());

  const paint = () => {
    input.value = getValue();
    input.setAttribute('aria-expanded', opened ? 'true' : 'false');
    toggle.setAttribute('aria-expanded', opened ? 'true' : 'false');
    setDisabled(input, ctx.props.disabled);
    setDisabled(toggle, ctx.props.disabled);
    popup.setAttribute('class', cls('z-datepicker__popup', !opened && 'z-hidden'));
    el.setAttribute('class', cls(
      'z-datepicker',
      opened && 'z-datepicker--open',
      ctx.props.disabled && 'z-datepicker--disabled'
    ));
  };

  const publish = (date) => {
    value = date ? startOfDay(date) : null;
    ctx.props.value = getValue();
    applied = ctx.props.value;
    appliedFormat = pattern();
    panel.setValue(value);
    paint();
  };

  const releaseDoc = () => {
    if (outside) {
      ctx.release(ctx.doc(), 'click', outside);
      outside = null;
    }
    if (escape) {
      ctx.release(ctx.doc(), 'keydown', escape);
      escape = null;
    }
  };

  const hide = (reason = 'api') => {
    if (!opened) return false;
    opened = false;
    releaseDoc();
    paint();
    ctx.emit('close', { reason });
    return true;
  };

  const show = () => {
    if (opened || ctx.props.disabled) return false;
    opened = true;
    panel.show(value);
    outside = (event) => {
      const target = event ? event.target : null;
      if (target && el.contains(target)) return;
      hide('outside');
    };
    escape = (event) => {
      if (event && event.key === 'Escape') hide('escape');
    };
    ctx.on(ctx.doc(), 'click', outside);
    ctx.on(ctx.doc(), 'keydown', escape);
    paint();
    ctx.emit('open');
    return true;
  };

  const emitChange = () => {
    ctx.emit('change', {
      value: getValue(),
      date: value ? new Date(value.getTime()) : null,
    });
  };

  const choose = (date) => {
    publish(date);
    emitChange();
  };

  const commitTyped = () => {
    if (ctx.props.disabled) return;
    const text = asText(input.value).trim();
    if (text === '') {
      publish(null);
      emitChange();
      return;
    }
    const date = toLocalDate(text, pattern());
    if (!date) {
      paint();
      return;
    }
    const before = value ? value.getTime() : null;
    publish(date);
    if (before !== date.getTime()) emitChange();
  };

  const panel = buildCalendar(ctx, {
    onPick: (date) => {
      choose(date);
      hide('select');
    },
  });
  popup.appendChild(panel.el);

  const setValue = (next) => {
    value = toLocalDate(next, pattern());
    applied = next;
    appliedFormat = pattern();
    panel.setValue(value);
    ctx.props.value = getValue();
    paint();
    return getValue();
  };

  const sync = (props) => {
    const raw = props.value !== undefined ? props.value : props.date;
    const nextFormat = asText(props.format) || DEFAULT_FORMAT;
    if (raw === applied) {
      appliedFormat = nextFormat;
      return;
    }
    applied = raw;
    appliedFormat = nextFormat;
    value = toLocalDate(raw, nextFormat);
    panel.setValue(value);
  };

  const update = (props) => {
    sync(props);
    paint();
    if (props.disabled && opened) hide('disabled');
  };

  ctx.on(toggle, 'click', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (opened) hide('toggle');
    else show();
  });
  ctx.on(input, 'click', () => {
    if (!opened) show();
  });
  ctx.on(input, 'change', commitTyped);

  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      getValue,
      /** @returns {Date|null} */
      getDate() {
        return value ? new Date(value.getTime()) : null;
      },
      /**
       * @param {Date|number|string|null} next
       * @returns {string}
       */
      setValue,
      /** @returns {boolean} */
      get open() {
        return opened;
      },
      /** @returns {boolean} */
      show,
      /** @returns {boolean} */
      hide() {
        return hide('api');
      },
      /** @returns {HTMLInputElement} */
      get input() {
        return input;
      },
      /** @returns {Element} */
      get popup() {
        return popup;
      },
    },
  };
});

// --- daterange --------------------------------------------------------

define('daterange', (ctx) => {
  let value = { start: null, end: null };
  let applied;
  let appliedFormat = asText(ctx.props.format) || DEFAULT_FORMAT;

  const pattern = () => asText(ctx.props.format) || DEFAULT_FORMAT;
  const getValue = () => rangeText(value, pattern());

  const publish = () => {
    ctx.props.value = value;
    applied = value;
    appliedFormat = pattern();
  };

  const emitChange = () => {
    ctx.emit('change', {
      value: getValue(),
      start: value.start ? new Date(value.start.getTime()) : null,
      end: value.end ? new Date(value.end.getTime()) : null,
    });
  };

  const panel = buildCalendar(ctx, {
    onPick: (date) => {
      value = extendRange(value, date);
      panel.setRange(value);
      publish();
      emitChange();
    },
  });

  const el = ctx.h('div', { class: 'z-daterange' }, [panel.el]);

  const setValue = (next) => {
    value = toRange(next, pattern());
    applied = next;
    appliedFormat = pattern();
    panel.setRange(value);
    if (value.start || value.end) panel.show(value.start || value.end);
    ctx.props.value = value;
    return getValue();
  };

  const sync = (props) => {
    const raw = props.value;
    const nextFormat = asText(props.format) || DEFAULT_FORMAT;
    if (raw === applied) {
      appliedFormat = nextFormat;
      return;
    }
    applied = raw;
    appliedFormat = nextFormat;
    value = toRange(raw, nextFormat);
    panel.setRange(value);
    if (value.start || value.end) panel.show(value.start || value.end);
  };

  const update = (props) => {
    el.setAttribute('class', cls('z-daterange', props.disabled && 'z-daterange--disabled'));
    panel.el.setAttribute('aria-disabled', props.disabled ? 'true' : 'false');
    sync(props);
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {{ start: string, end: string }} */
      getValue,
      /** @returns {{ start: Date|null, end: Date|null }} */
      getRange() {
        return {
          start: value.start ? new Date(value.start.getTime()) : null,
          end: value.end ? new Date(value.end.getTime()) : null,
        };
      },
      /**
       * @param {{ start: unknown, end: unknown }|null} next
       * @returns {{ start: string, end: string }}
       */
      setValue,
      /** @returns {Element} */
      get calendar() {
        return panel.el;
      },
    },
  };
});

// --- daterangepicker --------------------------------------------------

define('daterangepicker', (ctx) => {
  const startInput = ctx.h('input', {
    class: 'z-daterangepicker__input',
    type: 'text',
    autocomplete: 'off',
    'aria-label': 'Desde',
  });
  const endInput = ctx.h('input', {
    class: 'z-daterangepicker__input',
    type: 'text',
    autocomplete: 'off',
    'aria-label': 'Hasta',
  });
  const separator = ctx.h('span', { class: 'z-daterangepicker__separator', 'aria-hidden': 'true' }, ['\u2013']);
  const field = ctx.h('div', { class: 'z-daterangepicker__field' }, [startInput, separator, endInput]);
  const popup = ctx.h('div', {
    class: cls('z-daterangepicker__popup', 'z-hidden'),
    role: 'dialog',
    'aria-label': 'Elegir rango de fechas',
  });
  const el = ctx.h('div', { class: 'z-daterangepicker' }, [field, popup]);

  let value = { start: null, end: null };
  let applied;
  let appliedFormat = asText(ctx.props.format) || DEFAULT_FORMAT;
  let opened = false;
  let outside = null;
  let escape = null;

  const pattern = () => asText(ctx.props.format) || DEFAULT_FORMAT;
  const getValue = () => rangeText(value, pattern());

  const paint = () => {
    const text = getValue();
    startInput.value = text.start;
    endInput.value = text.end;
    setDisabled(startInput, ctx.props.disabled);
    setDisabled(endInput, ctx.props.disabled);
    popup.setAttribute('class', cls('z-daterangepicker__popup', !opened && 'z-hidden'));
    el.setAttribute('class', cls(
      'z-daterangepicker',
      opened && 'z-daterangepicker--open',
      ctx.props.disabled && 'z-daterangepicker--disabled'
    ));
  };

  const publish = () => {
    ctx.props.value = value;
    applied = value;
    appliedFormat = pattern();
  };

  const emitChange = () => {
    ctx.emit('change', {
      value: getValue(),
      start: value.start ? new Date(value.start.getTime()) : null,
      end: value.end ? new Date(value.end.getTime()) : null,
    });
  };

  const releaseDoc = () => {
    if (outside) {
      ctx.release(ctx.doc(), 'click', outside);
      outside = null;
    }
    if (escape) {
      ctx.release(ctx.doc(), 'keydown', escape);
      escape = null;
    }
  };

  const hide = (reason = 'api') => {
    if (!opened) return false;
    opened = false;
    releaseDoc();
    paint();
    ctx.emit('close', { reason });
    return true;
  };

  const show = () => {
    if (opened || ctx.props.disabled) return false;
    opened = true;
    panel.show(value.start || value.end);
    outside = (event) => {
      const target = event ? event.target : null;
      if (target && el.contains(target)) return;
      hide('outside');
    };
    escape = (event) => {
      if (event && event.key === 'Escape') hide('escape');
    };
    ctx.on(ctx.doc(), 'click', outside);
    ctx.on(ctx.doc(), 'keydown', escape);
    paint();
    ctx.emit('open');
    return true;
  };

  const panel = buildCalendar(ctx, {
    onPick: (date) => {
      value = extendRange(value, date);
      panel.setRange(value);
      publish();
      paint();
      emitChange();
      if (completeRange(value)) hide('select');
    },
  });
  popup.appendChild(panel.el);

  const setValue = (next) => {
    value = toRange(next, pattern());
    applied = next;
    appliedFormat = pattern();
    panel.setRange(value);
    if (value.start || value.end) panel.show(value.start || value.end);
    ctx.props.value = value;
    paint();
    return getValue();
  };

  const sync = (props) => {
    const raw = props.value;
    const nextFormat = asText(props.format) || DEFAULT_FORMAT;
    if (raw === applied) {
      appliedFormat = nextFormat;
      return;
    }
    applied = raw;
    appliedFormat = nextFormat;
    value = toRange(raw, nextFormat);
    panel.setRange(value);
    if (value.start || value.end) panel.show(value.start || value.end);
  };

  const commitTyped = () => {
    if (ctx.props.disabled) return;
    const start = toLocalDate(startInput.value, pattern());
    const end = toLocalDate(endInput.value, pattern());
    if (!start || !end) {
      paint();
      return;
    }
    value = start.getTime() <= end.getTime()
      ? { start, end }
      : { start: end, end: start };
    publish();
    paint();
    emitChange();
    hide('commit');
  };

  const update = (props) => {
    sync(props);
    paint();
    if (props.disabled && opened) hide('disabled');
  };

  ctx.on(startInput, 'change', commitTyped);
  ctx.on(endInput, 'change', commitTyped);
  ctx.on(field, 'click', () => {
    if (!opened) show();
  });

  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {{ start: string, end: string }} */
      getValue,
      /** @returns {{ start: Date|null, end: Date|null }} */
      getRange() {
        return {
          start: value.start ? new Date(value.start.getTime()) : null,
          end: value.end ? new Date(value.end.getTime()) : null,
        };
      },
      /**
       * @param {{ start: unknown, end: unknown }|null} next
       * @returns {{ start: string, end: string }}
       */
      setValue,
      /** @returns {boolean} */
      get open() {
        return opened;
      },
      /** @returns {boolean} */
      show,
      /** @returns {boolean} */
      hide() {
        return hide('api');
      },
      /** @returns {HTMLInputElement} */
      get startInput() {
        return startInput;
      },
      /** @returns {HTMLInputElement} */
      get endInput() {
        return endInput;
      },
      /** @returns {Element} */
      get popup() {
        return popup;
      },
    },
  };
});

// --- daterangesuggest ------------------------------------------------

const RANGE_PRESETS = [
  {
    id: 'today',
    text: 'Hoy',
    range: () => {
      const day = today();
      return { start: day, end: day };
    },
  },
  {
    id: 'yesterday',
    text: 'Ayer',
    range: () => {
      const day = addDays(today(), -1);
      return { start: day, end: day };
    },
  },
  {
    id: 'last7',
    text: '\u00daltimos 7 d\u00edas',
    range: () => ({ start: addDays(today(), -6), end: today() }),
  },
  {
    id: 'thismonth',
    text: 'Este mes',
    range: () => {
      const base = today();
      return {
        start: firstOfMonth(base),
        end: new Date(base.getFullYear(), base.getMonth() + 1, 0),
      };
    },
  },
  {
    id: 'prevmonth',
    text: 'Mes anterior',
    range: () => {
      const base = today();
      const start = new Date(base.getFullYear(), base.getMonth() - 1, 1);
      const end = new Date(base.getFullYear(), base.getMonth(), 0);
      return { start, end };
    },
  },
];

define('daterangesuggest', (ctx) => {
  const el = ctx.h('div', {
    class: 'z-daterangesuggest',
    role: 'listbox',
    'aria-label': 'Rangos de fecha',
  });

  let value = { start: null, end: null };
  let applied;
  let appliedFormat = asText(ctx.props.format) || DEFAULT_FORMAT;

  const pattern = () => asText(ctx.props.format) || DEFAULT_FORMAT;
  const getValue = () => rangeText(value, pattern());

  const rows = RANGE_PRESETS.map((preset) => {
    const hint = ctx.h('span', { class: 'z-daterangesuggest__hint' });
    const button = ctx.h('button', {
      class: 'z-daterangesuggest__item',
      type: 'button',
      role: 'option',
      'data-id': preset.id,
      'aria-selected': 'false',
    }, [ctx.h('span', { class: 'z-daterangesuggest__text' }, [preset.text]), hint]);
    el.appendChild(button);
    return { preset, button, hint };
  });

  const paint = () => {
    const text = getValue();
    for (const row of rows) {
      const range = toRange(row.preset.range(), DEFAULT_FORMAT);
      row.hint.textContent = `${fmtDate(range.start, HINT_FORMAT)} \u2013 ${fmtDate(range.end, HINT_FORMAT)}`;
      const chosen = sameDay(value.start, range.start) && sameDay(value.end, range.end);
      row.button.setAttribute('class', cls('z-daterangesuggest__item', chosen && 'z-daterangesuggest__item--selected'));
      row.button.setAttribute('aria-selected', chosen ? 'true' : 'false');
    }
    el.setAttribute('class', cls('z-daterangesuggest', ctx.props.disabled && 'z-daterangesuggest--disabled'));
    el.setAttribute('aria-disabled', ctx.props.disabled ? 'true' : 'false');
    return text;
  };

  const emitChange = (id) => {
    ctx.emit('change', {
      value: getValue(),
      id,
      start: value.start ? new Date(value.start.getTime()) : null,
      end: value.end ? new Date(value.end.getTime()) : null,
    });
  };

  const select = (id) => {
    if (ctx.props.disabled) return getValue();
    const found = rows.find((row) => row.preset.id === asText(id));
    if (!found) return getValue();
    value = toRange(found.preset.range(), DEFAULT_FORMAT);
    ctx.props.value = value;
    applied = value;
    appliedFormat = pattern();
    paint();
    emitChange(found.preset.id);
    return getValue();
  };

  for (const row of rows) {
    ctx.on(row.button, 'click', () => select(row.preset.id));
  }

  const setValue = (next) => {
    value = toRange(next, pattern());
    applied = next;
    appliedFormat = pattern();
    ctx.props.value = value;
    paint();
    return getValue();
  };

  const sync = (props) => {
    const raw = props.value;
    const nextFormat = asText(props.format) || DEFAULT_FORMAT;
    if (raw === applied) {
      appliedFormat = nextFormat;
      return;
    }
    applied = raw;
    appliedFormat = nextFormat;
    value = toRange(raw, nextFormat);
  };

  const update = (props) => {
    sync(props);
    paint();
  };
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {{ start: string, end: string }} */
      getValue,
      /** @returns {{ start: Date|null, end: Date|null }} */
      getRange() {
        return {
          start: value.start ? new Date(value.start.getTime()) : null,
          end: value.end ? new Date(value.end.getTime()) : null,
        };
      },
      /**
       * @param {{ start: unknown, end: unknown }|null} next
       * @returns {{ start: string, end: string }}
       */
      setValue,
      /** @param {string} id @returns {{ start: string, end: string }} */
      select,
      /** @returns {string[]} */
      get ids() {
        return RANGE_PRESETS.map((preset) => preset.id);
      },
    },
  };
});

// --- timeboard --------------------------------------------------------

/** @param {unknown} value @returns {{ hours: number, minutes: number }|null} */
function parseTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { hours: value.getHours(), minutes: value.getMinutes() };
  }
  const match = asText(value).trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** @param {{ hours: number, minutes: number }} time */
function fmtTime(time) {
  return `${pad2(time.hours)}:${pad2(time.minutes)}`;
}

/** @param {unknown} value */
function normalizeStep(value) {
  const step = Number(value);
  if (!Number.isFinite(step)) return 5;
  return Math.min(30, Math.max(1, Math.round(step)));
}

define('timeboard', (ctx) => {
  const input = ctx.h('input', {
    class: 'z-timeboard__input',
    type: 'text',
    inputmode: 'numeric',
    maxlength: '5',
    autocomplete: 'off',
    'aria-label': 'Hora (HH:MM)',
  });
  const display = ctx.h('div', { class: 'z-timeboard__display' }, [input]);
  const hourColumn = ctx.h('div', {
    class: 'z-timeboard__column z-timeboard__column--hours',
    role: 'listbox',
    'aria-label': 'Horas',
  });
  const minuteColumn = ctx.h('div', {
    class: 'z-timeboard__column z-timeboard__column--minutes',
    role: 'listbox',
    'aria-label': 'Minutos',
  });
  const panel = ctx.h('div', { class: 'z-timeboard__panel' }, [hourColumn, minuteColumn]);
  const el = ctx.h('div', { class: 'z-timeboard' }, [display, panel]);

  let time = parseTime(ctx.props.value) || { hours: 0, minutes: 0 };
  let applied = ctx.props.value;
  let step = normalizeStep(ctx.props.step);
  let hourButtons = [];
  let minuteButtons = [];

  const getValue = () => fmtTime(time);

  const paintButtons = (buttons, current) => {
    for (const button of buttons) {
      const chosen = Number(button.getAttribute('data-value')) === current;
      button.setAttribute('class', cls(
        'z-timeboard__button',
        chosen && 'z-timeboard__button--selected'
      ));
      button.setAttribute('aria-selected', chosen ? 'true' : 'false');
    }
  };

  const paint = () => {
    input.value = getValue();
    paintButtons(hourButtons, time.hours);
    paintButtons(minuteButtons, time.minutes);
    setDisabled(input, ctx.props.disabled);
    el.setAttribute('class', cls('z-timeboard', ctx.props.disabled && 'z-timeboard--disabled'));
    input.setAttribute('aria-disabled', ctx.props.disabled ? 'true' : 'false');
  };

  const makeButton = (column, label, kind) => {
    const button = ctx.h('button', {
      class: 'z-timeboard__button',
      type: 'button',
      role: 'option',
      'data-kind': kind,
      'data-value': label,
      'aria-selected': 'false',
    }, [label]);
    column.appendChild(button);
    return button;
  };

  const buildHours = () => {
    while (hourColumn.firstChild) hourColumn.removeChild(hourColumn.firstChild);
    hourButtons = [];
    for (let hour = 0; hour < 24; hour += 1) {
      hourButtons.push(makeButton(hourColumn, pad2(hour), 'hours'));
    }
  };

  const buildMinutes = () => {
    while (minuteColumn.firstChild) minuteColumn.removeChild(minuteColumn.firstChild);
    minuteButtons = [];
    for (let minute = 0; minute < 60; minute += step) {
      minuteButtons.push(makeButton(minuteColumn, pad2(minute), 'minutes'));
    }
  };

  const emitChange = () => {
    ctx.emit('change', { value: getValue(), hours: time.hours, minutes: time.minutes });
  };

  const commit = (next) => {
    if (!next) return getValue();
    time = next;
    ctx.props.value = getValue();
    applied = ctx.props.value;
    paint();
    emitChange();
    return getValue();
  };

  const pick = (kind, value) => {
    if (ctx.props.disabled) return getValue();
    const next = { hours: time.hours, minutes: time.minutes };
    next[kind] = Number(value);
    return commit(next);
  };

  const shift = (delta) => {
    const total = (time.hours * 60 + time.minutes + delta + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    commit({ hours: Math.floor(total / 60), minutes: total % 60 });
  };

  const commitTyped = () => {
    const next = parseTime(input.value);
    if (next) {
      commit(next);
      return;
    }
    paint();
  };

  const setValue = (next) => {
    const parsed = parseTime(next);
    if (!parsed) return getValue();
    time = parsed;
    applied = next;
    ctx.props.value = getValue();
    paint();
    return getValue();
  };

  const sync = (props) => {
    if (props.value === applied) return;
    applied = props.value;
    time = parseTime(props.value) || { hours: 0, minutes: 0 };
  };

  const update = (props) => {
    const nextStep = normalizeStep(props.step);
    if (nextStep !== step) {
      step = nextStep;
      buildMinutes();
    }
    sync(props);
    paint();
  };

  ctx.on(hourColumn, 'click', (event) => {
    const button = nodeWithAttr(event ? event.target : null, hourColumn, 'data-value');
    if (button) pick('hours', button.getAttribute('data-value'));
  });
  ctx.on(minuteColumn, 'click', (event) => {
    const button = nodeWithAttr(event ? event.target : null, minuteColumn, 'data-value');
    if (button) pick('minutes', button.getAttribute('data-value'));
  });
  ctx.on(input, 'change', commitTyped);
  ctx.on(input, 'keydown', (event) => {
    if (!event || ctx.props.disabled) return;
    if (event.key === 'ArrowUp') {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      shift(step);
    } else if (event.key === 'ArrowDown') {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      shift(-step);
    } else if (event.key === 'Enter') {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      commitTyped();
    }
  });

  buildHours();
  buildMinutes();
  update(ctx.props);

  return {
    el,
    update,
    api: {
      /** @returns {string} */
      getValue,
      /**
       * @param {string|number|Date|null} next
       * @returns {string}
       */
      setValue,
      /** @returns {number} */
      get hours() {
        return time.hours;
      },
      /** @returns {number} */
      get minutes() {
        return time.minutes;
      },
      /** @returns {HTMLInputElement} */
      get input() {
        return input;
      },
      /** @param {number} delta @returns {string} */
      shift(delta) {
        shift(Number(delta) || 0);
        return getValue();
      },
    },
  };
});

export const DATE_CONTROLS = [
  'calendar',
  'datepicker',
  'daterange',
  'daterangepicker',
  'daterangesuggest',
  'timeboard',
];
