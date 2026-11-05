/**
 * Controles numericos: counter, slider, rangeslider y pager.
 *
 * Los cuatro comparten el mismo normalizado de rango (`min`, `max`, `step`) y
 * la misma regla de recorte: el valor siempre queda dentro de los limites y
 * sobre la grilla que marca `step`, sin arrastrar errores de coma flotante.
 *
 * - `counter`: boton menos, entrada editable y boton mas; el valor es un
 *   numero. Sirve para cantidades chicas donde conviene escribir el valor
 *   exacto ademas de incrementarlo.
 * - `slider`: una manija sobre una pista; se arrastra con pointer events y
 *   tambien responde al teclado (flechas, Home y End).
 * - `rangeslider`: dos manijas con valor `{ start, end }`; las manijas no se
 *   cruzan.
 * - `pager`: pagina, tamano de pagina y total, con el rango visible y botones
 *   de pagina anterior, siguiente y numeros.
 *
 * Todos exponen `getValue()` y `setValue()`, emiten `change` solo ante la
 * interaccion del usuario y escriben su estado visual con variables CSS
 * (`--z-slider-percent`, `--z-range-start`, `--z-range-end`).
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';

/** @param {unknown} value @returns {string} */
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/** @param {unknown} event */
function prevent(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
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
function setVar(el, name, value) {
  const style = el && el.style;
  if (!style) return;
  if (typeof style.setProperty === 'function') style.setProperty(name, value);
  else style[name] = value;
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Cantidad de decimales de un numero escrito en base 10.
 * @param {number} value
 * @returns {number}
 */
function decimalsOf(value) {
  const text = String(value);
  const exponent = text.indexOf('e-');
  if (exponent >= 0) return Number(text.slice(exponent + 2)) || 0;
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** @param {number} value @param {number} decimals @returns {number} */
function roundTo(value, decimals) {
  if (decimals <= 0) return Math.round(value);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Lee `min`, `max` y `step` de las props y devuelve un rango usable.
 * Si los limites vienen invertidos se ordenan; un `step` invalido vale 1.
 *
 * @param {Record<string, unknown>} props
 * @returns {{ min: number, max: number, step: number }}
 */
function rangeOf(props) {
  let min = toNumber(props.min, 0);
  let max = toNumber(props.max, 100);
  if (max < min) {
    const swap = min;
    min = max;
    max = swap;
  }
  const step = toNumber(props.step, 1);
  return { min, max, step: step > 0 ? step : 1 };
}

/**
 * Recorta a los limites y ajusta a la grilla de `step` tomando `min` como
 * origen. Los decimales salen del `step` y del `min` para no devolver
 * `0.30000000000000004`.
 *
 * @param {unknown} value
 * @param {{ min: number, max: number, step: number }} range
 * @returns {number}
 */
function quantize(value, range) {
  const number = Number(value);
  if (!Number.isFinite(number)) return range.min;
  const decimals = Math.max(decimalsOf(range.step), decimalsOf(range.min));
  const steps = Math.round((number - range.min) / range.step);
  const snapped = roundTo(range.min + steps * range.step, decimals);
  return Math.min(Math.max(snapped, range.min), range.max) + 0;
}

/**
 * Caja de un nodo de pista. Usa `getBoundingClientRect` cuando existe y cae a
 * un ancho declarado por props o a 100 px, suficiente para el teclado y para
 * entornos sin medidas reales.
 *
 * @param {Element} node
 * @param {unknown} declaredWidth
 * @returns {{ left: number, width: number }}
 */
function rectOf(node, declaredWidth) {
  if (node && typeof node.getBoundingClientRect === 'function') {
    const rect = node.getBoundingClientRect() || {};
    const left = toNumber(rect.left, 0);
    const width = toNumber(rect.width, 0);
    if (width > 0) return { left, width };
  }
  const width = toNumber(declaredWidth, 0);
  return { left: 0, width: width > 0 ? width : 100 };
}

/**
 * Texto escrito en una entrada numerica a numero, o `null` si no se puede
 * leer. Acepta coma como separador decimal.
 *
 * @param {unknown} text
 * @returns {number|null}
 */
function parseNumber(text) {
  const raw = asText(text).trim().replace(',', '.');
  if (raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// --- counter ----------------------------------------------------------

define('counter', (ctx) => {
  const minus = ctx.h('button', {
    class: 'z-counter__button z-counter__button--minus',
    type: 'button',
    'aria-label': 'Disminuir',
    title: 'Disminuir',
  });
  minus.appendChild(ctx.doc().createTextNode('\u2212'));

  const input = ctx.h('input', {
    class: 'z-counter__input',
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    role: 'spinbutton',
  });

  const plus = ctx.h('button', {
    class: 'z-counter__button z-counter__button--plus',
    type: 'button',
    'aria-label': 'Aumentar',
    title: 'Aumentar',
  });
  plus.appendChild(ctx.doc().createTextNode('+'));

  const el = ctx.h('div', { class: 'z-counter' }, [minus, input, plus]);

  let current = quantize(toNumber(ctx.props.value, rangeOf(ctx.props).min), rangeOf(ctx.props));

  const getValue = () => current;

  /** @param {number} value */
  const apply = (value) => {
    current = value;
    ctx.props.value = value;
    input.value = String(value);
    paint();
    return current;
  };

  const paint = () => {
    const range = rangeOf(ctx.props);
    const disabled = Boolean(ctx.props.disabled);
    el.setAttribute('class', cls('z-counter', disabled && 'z-counter--disabled'));
    input.disabled = disabled;
    input.value = String(current);
    input.setAttribute('aria-valuemin', String(range.min));
    input.setAttribute('aria-valuemax', String(range.max));
    input.setAttribute('aria-valuenow', String(current));
    input.setAttribute('value', String(current));
    minus.disabled = disabled || current <= range.min;
    plus.disabled = disabled || current >= range.max;
  };

  /**
   * Mueve el valor `direction` pasos y emite `change` si cambio.
   * @param {number} direction
   * @param {unknown} [event]
   */
  const stepBy = (direction, event) => {
    const range = rangeOf(ctx.props);
    const next = quantize(current + direction * range.step, range);
    if (next === current) {
      paint();
      return current;
    }
    apply(next);
    ctx.emit('change', { value: next, event });
    return next;
  };

  /**
   * Interpreta lo escrito. Un texto vacio o invalido vuelve al valor vigente.
   * @param {unknown} [event]
   */
  const commit = (event) => {
    const parsed = parseNumber(input.value);
    if (parsed === null) {
      paint();
      return current;
    }
    const next = quantize(parsed, rangeOf(ctx.props));
    if (next === current) {
      paint();
      return current;
    }
    apply(next);
    ctx.emit('change', { value: next, event });
    return next;
  };

  const update = (props) => {
    const range = rangeOf(props);
    if (props.value !== undefined) current = quantize(props.value, range);
    else current = quantize(current, range);
    ctx.props.value = current;
    paint();
  };
  update(ctx.props);

  ctx.on(minus, 'click', (event) => {
    prevent(event);
    if (ctx.props.disabled) return;
    stepBy(-1, event);
  });

  ctx.on(plus, 'click', (event) => {
    prevent(event);
    if (ctx.props.disabled) return;
    stepBy(1, event);
  });

  ctx.on(input, 'change', (event) => {
    if (ctx.props.disabled) {
      paint();
      return;
    }
    commit(event);
  });

  ctx.on(input, 'keydown', (event) => {
    if (!event || ctx.props.disabled) return;
    if (event.key === 'ArrowUp') {
      prevent(event);
      stepBy(1, event);
    } else if (event.key === 'ArrowDown') {
      prevent(event);
      stepBy(-1, event);
    } else if (event.key === 'Enter') {
      prevent(event);
      commit(event);
    }
  });

  return {
    el,
    update,
    api: {
      /** @returns {number} */
      getValue,
      /**
       * @param {unknown} value
       * @returns {number}
       */
      setValue(value) {
        return apply(quantize(value, rangeOf(ctx.props)));
      },
      /** @returns {HTMLInputElement} */
      get input() {
        return input;
      },
      /** @returns {number} */
      get min() {
        return rangeOf(ctx.props).min;
      },
      /** @returns {number} */
      get max() {
        return rangeOf(ctx.props).max;
      },
      /** @returns {number} */
      get step() {
        return rangeOf(ctx.props).step;
      },
    },
  };
});

// --- slider -----------------------------------------------------------

define('slider', (ctx) => {
  const fill = ctx.h('div', { class: 'z-slider__fill' });
  const knob = ctx.h('div', {
    class: 'z-slider__knob',
    role: 'slider',
    tabindex: '0',
    'aria-orientation': 'horizontal',
  });
  const track = ctx.h('div', { class: 'z-slider__track' }, [fill, knob]);
  const el = ctx.h('div', { class: 'z-slider' }, [track]);

  let current = quantize(toNumber(ctx.props.value, rangeOf(ctx.props).min), rangeOf(ctx.props));
  let drag = null;

  const getValue = () => current;

  const paint = () => {
    const range = rangeOf(ctx.props);
    const disabled = Boolean(ctx.props.disabled);
    const span = range.max - range.min;
    const percent = span > 0 ? ((current - range.min) / span) * 100 : 0;
    el.setAttribute('class', cls('z-slider', disabled && 'z-slider--disabled', drag && 'z-slider--dragging'));
    setVar(el, '--z-slider-percent', `${Math.round(percent * 100) / 100}%`);
    knob.setAttribute('aria-valuemin', String(range.min));
    knob.setAttribute('aria-valuemax', String(range.max));
    knob.setAttribute('aria-valuenow', String(current));
    knob.setAttribute('aria-valuetext', String(current));
    knob.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    knob.setAttribute('tabindex', disabled ? '-1' : '0');
  };

  /**
   * Fija el valor y emite `change` salvo en el uso programatico.
   * @param {number} value
   * @param {unknown} [event]
   * @param {string} [reason]
   * @param {boolean} [silent]
   */
  const change = (value, event, reason = 'api', silent = false) => {
    const next = quantize(value, rangeOf(ctx.props));
    if (next === current) {
      paint();
      return current;
    }
    current = next;
    ctx.props.value = next;
    paint();
    if (!silent) ctx.emit('change', { value: next, reason, event });
    return next;
  };

  const pointValue = (event) => {
    const clientX = event ? event.clientX : undefined;
    if (!Number.isFinite(Number(clientX))) return null;
    const rect = rectOf(track, ctx.props.width);
    const ratio = (Number(clientX) - rect.left) / rect.width;
    const range = rangeOf(ctx.props);
    return range.min + Math.min(Math.max(ratio, 0), 1) * (range.max - range.min);
  };

  const onMove = (event) => {
    if (!drag) return;
    const raw = pointValue(event);
    if (raw === null) return;
    change(raw, event, 'drag');
  };

  const stopDrag = (event) => {
    if (!drag) return;
    drag = null;
    ctx.release(ctx.doc(), 'pointermove', onMove);
    ctx.release(ctx.doc(), 'pointerup', stopDrag);
    ctx.release(ctx.doc(), 'pointercancel', stopDrag);
    paint();
    ctx.emit('changeend', { value: current, event });
  };

  const update = (props) => {
    const range = rangeOf(props);
    if (props.value !== undefined) current = quantize(props.value, range);
    else current = quantize(current, range);
    ctx.props.value = current;
    paint();
  };
  update(ctx.props);

  ctx.on(track, 'pointerdown', (event) => {
    if (ctx.props.disabled) return;
    prevent(event);
    const raw = pointValue(event);
    if (raw !== null) change(raw, event, 'drag');
    drag = true;
    el.classList.add('z-slider--dragging');
    ctx.on(ctx.doc(), 'pointermove', onMove);
    ctx.on(ctx.doc(), 'pointerup', stopDrag);
    ctx.on(ctx.doc(), 'pointercancel', stopDrag);
  });

  ctx.on(knob, 'keydown', (event) => {
    if (!event || ctx.props.disabled) return;
    const range = rangeOf(ctx.props);
    const grow = event.key === 'ArrowRight' || event.key === 'ArrowUp';
    const shrink = event.key === 'ArrowLeft' || event.key === 'ArrowDown';
    let next = null;
    if (grow) next = current + range.step;
    else if (shrink) next = current - range.step;
    else if (event.key === 'Home') next = range.min;
    else if (event.key === 'End') next = range.max;
    else if (event.key === 'PageUp') next = current + range.step * 10;
    else if (event.key === 'PageDown') next = current - range.step * 10;
    else return;
    prevent(event);
    change(next, event, 'keyboard');
  });

  return {
    el,
    update,
    destroy() {
      drag = null;
    },
    api: {
      /** @returns {number} */
      getValue,
      /**
       * @param {unknown} value
       * @returns {number}
       */
      setValue(value) {
        return change(value, undefined, 'api', true);
      },
      /** @returns {Element} */
      get track() {
        return track;
      },
      /** @returns {Element} */
      get knob() {
        return knob;
      },
      /** @returns {number} */
      get min() {
        return rangeOf(ctx.props).min;
      },
      /** @returns {number} */
      get max() {
        return rangeOf(ctx.props).max;
      },
      /** @returns {number} */
      get step() {
        return rangeOf(ctx.props).step;
      },
    },
  };
});

// --- rangeslider ------------------------------------------------------

define('rangeslider', (ctx) => {
  const fill = ctx.h('div', { class: 'z-rangeslider__fill' });
  const startKnob = ctx.h('div', {
    class: 'z-rangeslider__knob z-rangeslider__knob--start',
    role: 'slider',
    tabindex: '0',
    'aria-orientation': 'horizontal',
    'aria-label': 'Inicio del rango',
  });
  const endKnob = ctx.h('div', {
    class: 'z-rangeslider__knob z-rangeslider__knob--end',
    role: 'slider',
    tabindex: '0',
    'aria-orientation': 'horizontal',
    'aria-label': 'Fin del rango',
  });
  const track = ctx.h('div', { class: 'z-rangeslider__track' }, [fill, startKnob, endKnob]);
  const el = ctx.h('div', { class: 'z-rangeslider' }, [track]);

  const initial = rangeOf(ctx.props);
  let start = quantize(toNumber(ctx.props.value && ctx.props.value.start, initial.min), initial);
  let end = quantize(toNumber(ctx.props.value && ctx.props.value.end, initial.max), initial);
  if (start > end) {
    const swap = start;
    start = end;
    end = swap;
  }
  let drag = null;

  const getValue = () => ({ start, end });

  const percentOf = (value, range) => {
    const span = range.max - range.min;
    return span > 0 ? ((value - range.min) / span) * 100 : 0;
  };

  const paint = () => {
    const range = rangeOf(ctx.props);
    const disabled = Boolean(ctx.props.disabled);
    el.setAttribute(
      'class',
      cls('z-rangeslider', disabled && 'z-rangeslider--disabled', drag && 'z-rangeslider--dragging')
    );
    const from = Math.round(percentOf(start, range) * 100) / 100;
    const to = Math.round(percentOf(end, range) * 100) / 100;
    setVar(el, '--z-range-start', `${from}%`);
    setVar(el, '--z-range-end', `${to}%`);
    for (const [knob, value, label] of [
      [startKnob, start, 'Inicio del rango'],
      [endKnob, end, 'Fin del rango'],
    ]) {
      knob.setAttribute('aria-valuemin', String(range.min));
      knob.setAttribute('aria-valuemax', String(range.max));
      knob.setAttribute('aria-valuenow', String(value));
      knob.setAttribute('aria-valuetext', String(value));
      knob.setAttribute('aria-label', label);
      knob.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      knob.setAttribute('tabindex', disabled ? '-1' : '0');
    }
  };

  /** @param {unknown} [event] @param {string} [reason] */
  const emitChange = (event, reason = 'api') => {
    ctx.props.value = { start, end };
    paint();
    ctx.emit('change', { start, end, value: { start, end }, reason, event });
  };

  /**
   * Fija un extremo sin cruzar el otro; devuelve el valor efectivo.
   * @param {'start'|'end'} edge
   * @param {unknown} value
   * @param {unknown} [event]
   * @param {string} [reason]
   */
  const setEdge = (edge, value, event, reason = 'api') => {
    const range = rangeOf(ctx.props);
    const next = quantize(value, range);
    if (edge === 'start') {
      if (next === start) {
        paint();
        return start;
      }
      start = Math.min(next, end);
    } else {
      if (next === end) {
        paint();
        return end;
      }
      end = Math.max(next, start);
    }
    emitChange(event, reason);
    return edge === 'start' ? start : end;
  };

  /**
   * Normaliza `{ start, end }`; un objeto incompleto toma los extremos del
   * rango y dos valores cruzados se ordenan.
   * @param {unknown} value
   */
  const applyValue = (value) => {
    const range = rangeOf(ctx.props);
    const source = value && typeof value === 'object' ? value : {};
    let nextStart = quantize(toNumber(source.start, range.min), range);
    let nextEnd = quantize(toNumber(source.end, range.max), range);
    if (nextStart > nextEnd) {
      const swap = nextStart;
      nextStart = nextEnd;
      nextEnd = swap;
    }
    start = nextStart;
    end = nextEnd;
    ctx.props.value = { start, end };
    paint();
    return getValue();
  };

  const pointValue = (event) => {
    const clientX = event ? event.clientX : undefined;
    if (!Number.isFinite(Number(clientX))) return null;
    const rect = rectOf(track, ctx.props.width);
    const ratio = (Number(clientX) - rect.left) / rect.width;
    const range = rangeOf(ctx.props);
    return range.min + Math.min(Math.max(ratio, 0), 1) * (range.max - range.min);
  };

  const onMove = (event) => {
    if (!drag) return;
    const raw = pointValue(event);
    if (raw === null) return;
    setEdge(drag.edge, raw, event, 'drag');
  };

  const stopDrag = (event) => {
    if (!drag) return;
    drag = null;
    ctx.release(ctx.doc(), 'pointermove', onMove);
    ctx.release(ctx.doc(), 'pointerup', stopDrag);
    ctx.release(ctx.doc(), 'pointercancel', stopDrag);
    paint();
    ctx.emit('changeend', { start, end, value: { start, end }, event });
  };

  const update = (props) => {
    const range = rangeOf(props);
    if (props.value !== undefined) {
      applyValue(props.value);
      return;
    }
    start = quantize(start, range);
    end = quantize(end, range);
    if (start > end) {
      const swap = start;
      start = end;
      end = swap;
    }
    ctx.props.value = { start, end };
    paint();
  };
  update(ctx.props);

  /**
   * Elige la manija a mover: la que esta mas cerca del puntero.
   * @param {unknown} event
   * @returns {'start'|'end'}
   */
  const nearestEdge = (event) => {
    const raw = pointValue(event);
    if (raw === null) return 'start';
    return Math.abs(raw - start) <= Math.abs(raw - end) ? 'start' : 'end';
  };

  const startDrag = (edge, event) => {
    if (ctx.props.disabled) return;
    prevent(event);
    drag = { edge };
    el.classList.add('z-rangeslider--dragging');
    ctx.on(ctx.doc(), 'pointermove', onMove);
    ctx.on(ctx.doc(), 'pointerup', stopDrag);
    ctx.on(ctx.doc(), 'pointercancel', stopDrag);
  };

  ctx.on(startKnob, 'pointerdown', (event) => startDrag('start', event));
  ctx.on(endKnob, 'pointerdown', (event) => startDrag('end', event));

  ctx.on(track, 'pointerdown', (event) => {
    if (drag) return;
    const edge = nearestEdge(event);
    startDrag(edge, event);
    if (!drag) return;
    const raw = pointValue(event);
    if (raw !== null) setEdge(edge, raw, event, 'drag');
  });

  /** @param {'start'|'end'} edge @param {unknown} event */
  const keyMove = (edge, event) => {
    if (!event || ctx.props.disabled) return;
    const range = rangeOf(ctx.props);
    const base = edge === 'start' ? start : end;
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = base + range.step;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = base - range.step;
    else if (event.key === 'Home') next = range.min;
    else if (event.key === 'End') next = range.max;
    else if (event.key === 'PageUp') next = base + range.step * 10;
    else if (event.key === 'PageDown') next = base - range.step * 10;
    else return;
    prevent(event);
    setEdge(edge, next, event, 'keyboard');
  };

  ctx.on(startKnob, 'keydown', (event) => keyMove('start', event));
  ctx.on(endKnob, 'keydown', (event) => keyMove('end', event));

  return {
    el,
    update,
    destroy() {
      drag = null;
    },
    api: {
      /** @returns {{ start: number, end: number }} */
      getValue,
      /**
       * @param {unknown} value
       * @returns {{ start: number, end: number }}
       */
      setValue(value) {
        return applyValue(value);
      },
      /** @returns {Element} */
      get track() {
        return track;
      },
      /** @returns {Element} */
      get startKnob() {
        return startKnob;
      },
      /** @returns {Element} */
      get endKnob() {
        return endKnob;
      },
      /** @returns {number} */
      get start() {
        return start;
      },
      /** @returns {number} */
      get end() {
        return end;
      },
    },
  };
});

// --- pager ------------------------------------------------------------

/**
 * Lista de paginas a dibujar: todas si son pocas y, si no, primera, ultima y
 * el entorno de la actual. `null` representa los puntos suspensivos.
 *
 * @param {number} page
 * @param {number} pages
 * @returns {(number|null)[]}
 */
function pageList(page, pages) {
  if (pages <= 7) {
    const list = [];
    for (let index = 1; index <= pages; index += 1) list.push(index);
    return list;
  }
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 4) {
    for (const near of [2, 3, 4, 5]) wanted.add(near);
  }
  if (page >= pages - 3) {
    for (let near = pages - 4; near <= pages; near += 1) wanted.add(near);
  }
  const ordered = [...wanted].filter((value) => value >= 1 && value <= pages).sort((a, b) => a - b);
  const out = [];
  let previous = 0;
  for (const value of ordered) {
    if (value - previous > 1) out.push(null);
    out.push(value);
    previous = value;
  }
  return out;
}

define('pager', (ctx) => {
  const previousButton = ctx.h('button', {
    class: 'z-pager__button z-pager__button--prev',
    type: 'button',
    'aria-label': 'Pagina anterior',
    title: 'Pagina anterior',
    'data-step': '-1',
  });
  previousButton.appendChild(ctx.doc().createTextNode('\u2039'));

  const pagesHost = ctx.h('div', { class: 'z-pager__pages' });

  const nextButton = ctx.h('button', {
    class: 'z-pager__button z-pager__button--next',
    type: 'button',
    'aria-label': 'Pagina siguiente',
    title: 'Pagina siguiente',
    'data-step': '1',
  });
  nextButton.appendChild(ctx.doc().createTextNode('\u203a'));

  const rangeLabel = ctx.h('span', { class: 'z-pager__range', 'aria-live': 'polite' });

  const el = ctx.h('nav', { class: 'z-pager' }, [
    previousButton,
    pagesHost,
    nextButton,
    rangeLabel,
  ]);

  let page = 1;
  let total = 0;
  let size = 10;
  let signature = null;

  const pagesOf = () => Math.max(1, Math.ceil(total / size));

  const clampPage = (value) => {
    const number = Math.round(toNumber(value, 1));
    return Math.min(Math.max(number, 1), pagesOf());
  };

  const rangeOfPage = () => {
    if (total === 0) return { from: 0, to: 0 };
    const from = (page - 1) * size + 1;
    return { from, to: Math.min(page * size, total) };
  };

  const getValue = () => ({ page, size, total, pages: pagesOf() });

  const buildPages = () => {
    while (pagesHost.firstChild) pagesHost.removeChild(pagesHost.firstChild);
    for (const entry of pageList(page, pagesOf())) {
      if (entry === null) {
        const gap = ctx.h('span', { class: 'z-pager__gap' });
        gap.appendChild(ctx.doc().createTextNode('\u2026'));
        pagesHost.appendChild(gap);
        continue;
      }
      const button = ctx.h('button', {
        class: cls('z-pager__button', 'z-pager__page', entry === page && 'z-pager__page--active'),
        type: 'button',
        'data-page': String(entry),
        'aria-label': `Pagina ${entry}`,
      });
      button.appendChild(ctx.doc().createTextNode(String(entry)));
      if (entry === page) button.setAttribute('aria-current', 'page');
      pagesHost.appendChild(button);
    }
  };

  const paint = () => {
    const count = pagesOf();
    page = clampPage(page);
    const disabled = Boolean(ctx.props.disabled);
    el.setAttribute('class', cls('z-pager', disabled && 'z-pager--disabled'));
    el.setAttribute('aria-label', asText(ctx.props.label) || 'Paginacion');
    const { from, to } = rangeOfPage();
    rangeLabel.textContent = `${from}-${to} de ${total}`;
    previousButton.disabled = disabled || page <= 1;
    nextButton.disabled = disabled || page >= count;
    const sig = `${page}|${size}|${total}`;
    if (sig !== signature) {
      signature = sig;
      buildPages();
    }
  };

  /**
   * Cambia de pagina. Sin `emit`, no emite evento (uso programatico).
   * @param {unknown} value
   * @param {unknown} [event]
   * @param {boolean} [silent]
   * @returns {number}
   */
  const goTo = (value, event, silent = false) => {
    const next = clampPage(value);
    if (next === page) {
      paint();
      return page;
    }
    page = next;
    ctx.props.page = next;
    paint();
    if (!silent) {
      const { from, to } = rangeOfPage();
      ctx.emit('change', { page, size, total, pages: pagesOf(), from, to, event });
    }
    return page;
  };

  const update = (props) => {
    size = Math.max(1, Math.floor(toNumber(props.size, 10)));
    total = Math.max(0, Math.floor(toNumber(props.total, 0)));
    page = clampPage(props.page !== undefined ? props.page : page);
    ctx.props.page = page;
    paint();
  };
  update(ctx.props);

  const stepPage = (delta, event) => {
    if (ctx.props.disabled) return page;
    return goTo(page + delta, event);
  };

  ctx.on(previousButton, 'click', (event) => {
    prevent(event);
    stepPage(-1, event);
  });

  ctx.on(nextButton, 'click', (event) => {
    prevent(event);
    stepPage(1, event);
  });

  ctx.on(pagesHost, 'click', (event) => {
    if (ctx.props.disabled) return;
    let node = event ? event.target : null;
    while (node && node !== pagesHost && !(node.getAttribute && node.getAttribute('data-page'))) {
      node = node.parentNode;
    }
    if (!node || node === pagesHost || typeof node.getAttribute !== 'function') return;
    const value = node.getAttribute('data-page');
    if (value === null) return;
    prevent(event);
    goTo(Number(value), event);
  });

  return {
    el,
    update,
    api: {
      /** @returns {{ page: number, size: number, total: number, pages: number }} */
      getValue,
      /**
       * Alias de `setPage` para la API comun de los controles.
       * @param {unknown} value
       * @returns {number}
       */
      setValue(value) {
        return goTo(value, undefined, true);
      },
      /**
       * @param {unknown} value
       * @returns {number}
       */
      setPage(value) {
        return goTo(value, undefined, true);
      },
      /**
       * @param {unknown} value
       * @returns {number}
       */
      setTotal(value) {
        total = Math.max(0, Math.floor(toNumber(value, 0)));
        ctx.props.total = total;
        page = clampPage(page);
        ctx.props.page = page;
        paint();
        return total;
      },
      /**
       * @param {unknown} value
       * @returns {number}
       */
      setSize(value) {
        size = Math.max(1, Math.floor(toNumber(value, 10)));
        ctx.props.size = size;
        page = clampPage(page);
        ctx.props.page = page;
        paint();
        return size;
      },
      /** @returns {number} */
      get page() {
        return page;
      },
      /** @returns {number} */
      get size() {
        return size;
      },
      /** @returns {number} */
      get total() {
        return total;
      },
      /** @returns {number} */
      get pages() {
        return pagesOf();
      },
      /** @returns {{ from: number, to: number }} */
      get range() {
        return rangeOfPage();
      },
    },
  };
});

export const NUMBER_CONTROLS = ['counter', 'slider', 'rangeslider', 'pager'];
