/**
 * Widgets de visualizacion.
 *
 * - `chart`: lineas, barras, areas y torta sobre un SVG armado por el propio
 *   widget. Sin dependencias y sin canvas.
 * - `rangechart`: area entre dos series (minimo y maximo) sobre la misma
 *   escala y los mismos ejes que `chart`.
 *
 * La geometria vive en atributos del SVG (`viewBox`, `d`, `x`, `y`, `width`,
 * `height`, `r`) y el color y el trazo en `zorzal.css` mediante clases
 * `z-chart__*`. El unico valor que se escribe como custom property es la
 * posicion del tooltip HTML (`--z-chart-tooltip-x`, `--z-chart-tooltip-y`).
 */

import { define } from '../core/registry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TYPES = ['line', 'bar', 'area', 'pie'];
const SERIES_COLORS = 8;
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 340;
const PIE_LIMIT = 359.999;

/** @param {unknown} value @returns {number} */
export function n2(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const rounded = Math.round(number * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** @param {unknown} value @returns {number|null} */
export function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** @param {unknown} value @param {number} fallback @returns {number} */
export function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/**
 * Crea un nodo SVG. En el navegador usa el namespace correcto; el DOM minimo
 * de los tests devuelve un elemento comun, suficiente para leer atributos.
 *
 * @param {any} ctx
 * @param {string} name
 * @param {Record<string, unknown>} [attrs]
 * @param {unknown[]} [children]
 * @returns {Element}
 */
export function snode(ctx, name, attrs = {}, children = []) {
  const doc = ctx.doc();
  const el =
    typeof doc.createElementNS === 'function'
      ? doc.createElementNS(SVG_NS, name)
      : doc.createElement(name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') {
      el.textContent = String(value);
      continue;
    }
    if (key === 'class') {
      const list = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
      if (list) el.setAttribute('class', list);
      continue;
    }
    el.setAttribute(key, typeof value === 'number' ? String(n2(value)) : String(value));
  }
  for (const child of [].concat(children)) if (child) el.appendChild(child);
  return el;
}

/** @param {Element} el @param {string} name @param {string} value */
function setVar(el, name, value) {
  const style = el && el.style;
  if (!style) return;
  if (typeof style.setProperty === 'function') style.setProperty(name, value);
  else style[name] = value;
}

// --- geometria --------------------------------------------------------

/**
 * Escala "redonda" para el eje Y: devuelve el dominio y las marcas.
 *
 * @param {number} min
 * @param {number} max
 * @param {number} [count] cantidad de intervalos deseados
 * @returns {{ min: number, max: number, step: number, ticks: number[] }}
 */
export function niceTicks(min, max, count = 4) {
  let lo = Number.isFinite(min) ? min : 0;
  let hi = Number.isFinite(max) ? max : 1;
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) hi = lo + 1;

  const steps = Math.max(1, Math.round(Number(count) || 4));
  const rough = (hi - lo) / steps;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  const step = magnitude * (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const total = Math.round((end - start) / step);
  const ticks = [];
  for (let index = 0; index <= total; index += 1) ticks.push(n2(start + index * step));
  return { min: n2(start), max: n2(end), step: n2(step), ticks };
}

/**
 * Path de una polilinea. Los huecos (`null`) cortan la linea con un nuevo
 * movimiento.
 *
 * @param {(number[]|null)[]} points pares `[x, y]`
 * @returns {string}
 */
export function linePath(points) {
  let d = '';
  let pen = false;
  for (const point of points) {
    if (!point) {
      pen = false;
      continue;
    }
    d += `${pen ? ' L' : ' M'} ${n2(point[0])} ${n2(point[1])}`;
    pen = true;
  }
  return d.trim();
}

/**
 * Path cerrado de area: la polilinea y su vuelta por la linea base.
 *
 * @param {(number[]|null)[]} points
 * @param {number} baseline
 * @returns {string}
 */
export function areaPath(points, baseline) {
  let d = '';
  let segment = [];
  const flush = () => {
    if (!segment.length) return;
    const first = segment[0];
    const last = segment[segment.length - 1];
    d += ` M ${n2(first[0])} ${n2(baseline)}`;
    for (const point of segment) d += ` L ${n2(point[0])} ${n2(point[1])}`;
    d += ` L ${n2(last[0])} ${n2(baseline)} Z`;
    segment = [];
  };
  for (const point of points) {
    if (point) segment.push(point);
    else flush();
  }
  flush();
  return d.trim();
}

/**
 * Path del area de rango: borde superior de izquierda a derecha y borde
 * inferior de vuelta.
 *
 * @param {number[][]} upper
 * @param {number[][]} lower
 * @returns {string}
 */
export function rangeAreaPath(upper, lower) {
  if (!upper.length || upper.length !== lower.length) return '';
  let d = `M ${n2(upper[0][0])} ${n2(upper[0][1])}`;
  for (let index = 1; index < upper.length; index += 1) {
    d += ` L ${n2(upper[index][0])} ${n2(upper[index][1])}`;
  }
  for (let index = lower.length - 1; index >= 0; index -= 1) {
    d += ` L ${n2(lower[index][0])} ${n2(lower[index][1])}`;
  }
  return `${d} Z`;
}

/** @param {number} cx @param {number} cy @param {number} radius @param {number} angle */
export function polar(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [n2(cx + radius * Math.cos(radians)), n2(cy + radius * Math.sin(radians))];
}

/**
 * Path de una porcion de torta entre dos angulos (0 arriba, sentido horario).
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
export function slicePath(cx, cy, radius, start, end) {
  const sweep = end - start;
  if (sweep <= 0 || radius <= 0) return '';
  if (sweep >= PIE_LIMIT) {
    return (
      `M ${n2(cx - radius)} ${n2(cy)}` +
      ` A ${n2(radius)} ${n2(radius)} 0 1 1 ${n2(cx + radius)} ${n2(cy)}` +
      ` A ${n2(radius)} ${n2(radius)} 0 1 1 ${n2(cx - radius)} ${n2(cy)} Z`
    );
  }
  const [x1, y1] = polar(cx, cy, radius, start);
  const [x2, y2] = polar(cx, cy, radius, end);
  const large = sweep > 180 ? 1 : 0;
  return (
    `M ${n2(cx)} ${n2(cy)} L ${x1} ${y1}` +
    ` A ${n2(radius)} ${n2(radius)} 0 ${large} 1 ${x2} ${y2} Z`
  );
}

// --- modelo -----------------------------------------------------------

/**
 * Normaliza `data` a filas `{ x, values, item }`.
 *
 * Acepta `{ x, y }` y `{ x, y: [v1, v2] }`; los valores no numericos quedan
 * como `null` para no deformar la escala.
 *
 * @param {unknown} data
 * @returns {{ rows: { x: unknown, values: (number|null)[], item: unknown }[], seriesCount: number }}
 */
export function normalizeData(data) {
  const rows = [];
  let seriesCount = 1;
  if (!Array.isArray(data)) return { rows, seriesCount };

  data.forEach((item, index) => {
    let x = index;
    let y = item;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      x = item.x !== undefined ? item.x : index;
      y = item.y !== undefined ? item.y : item.value;
    }
    const raw = Array.isArray(y) ? y : [y];
    const values = raw.map(toNumber);
    if (values.length > seriesCount) seriesCount = values.length;
    rows.push({ x, values, item });
  });
  for (const row of rows) {
    while (row.values.length < seriesCount) row.values.push(null);
  }
  return { rows, seriesCount };
}

/** @param {unknown} props @param {string} kind @returns {string} */
function resolveType(props, kind) {
  if (kind === 'rangechart') return 'range';
  const type = typeof props.type === 'string' ? props.type.toLowerCase() : '';
  return TYPES.includes(type) ? type : 'line';
}

/**
 * Nombres de serie: `props.series` o `Serie N`.
 * @param {unknown} props
 * @param {number} seriesCount
 * @param {string} type
 * @returns {string[]}
 */
function seriesNamesFor(props, seriesCount, type) {
  if (type === 'pie') return ['valor'];
  const declared = Array.isArray(props.series) ? props.series : null;
  return Array.from({ length: seriesCount }, (_, index) => {
    const name = declared && declared[index] !== undefined ? declared[index] : null;
    return name === null ? `Serie ${index + 1}` : String(name);
  });
}

/** @param {unknown} props @param {number} value @returns {string} */
function formatValue(props, value) {
  if (typeof props.format === 'function') {
    const out = props.format(value);
    if (out !== undefined && out !== null) return String(out);
  }
  return String(n2(value));
}

/**
 * Escala y medidas de la zona de dibujo.
 *
 * @param {unknown} props
 * @param {{ rows: any[], seriesCount: number }} model
 * @param {number} ticks
 * @returns {any}
 */
export function cartesianGeometry(props, model, ticks = 4) {
  const width = positive(props.width, DEFAULT_WIDTH);
  const height = positive(props.height, DEFAULT_HEIGHT);
  const pad = { top: 16, right: 20, bottom: 40, left: 54 };
  const x0 = pad.left;
  const y0 = pad.top;
  const plotW = Math.max(1, width - pad.left - pad.right);
  const plotH = Math.max(1, height - pad.top - pad.bottom);

  const values = [];
  for (const row of model.rows) {
    for (const value of row.values) if (value !== null) values.push(value);
  }
  let dataMin = 0;
  let dataMax = 1;
  if (values.length) {
    dataMin = values[0];
    dataMax = values[0];
    for (const value of values) {
      if (value < dataMin) dataMin = value;
      if (value > dataMax) dataMax = value;
    }
  }
  const scale = niceTicks(Math.min(0, dataMin), Math.max(0, dataMax), ticks);

  const yAt = (value) => {
    const ratio = (value - scale.min) / (scale.max - scale.min || 1);
    return n2(y0 + plotH - ratio * plotH);
  };
  const xAt = (index) => {
    if (model.rows.length <= 1) return n2(x0 + plotW / 2);
    return n2(x0 + (index * plotW) / (model.rows.length - 1));
  };
  const bandWidth = plotW / Math.max(1, model.rows.length);

  return {
    width,
    height,
    pad,
    x0,
    y0,
    plotW,
    plotH,
    bandWidth,
    yMin: scale.min,
    yMax: scale.max,
    ticks: scale.ticks,
    yAt,
    xAt,
    baseline: yAt(0),
  };
}

// --- vista ------------------------------------------------------------

/**
 * Bindeo de listeners con liberacion al rearmar el SVG.
 * @param {any} ctx
 */
function binding(ctx) {
  let records = [];
  return {
    bind(target, type, fn) {
      ctx.on(target, type, fn);
      records.push([target, type, fn]);
    },
    releaseAll() {
      for (const [target, type, fn] of records) ctx.release(target, type, fn);
      records = [];
    },
  };
}

/**
 * Factory compartida por `chart` y `rangechart`.
 * @param {any} ctx
 * @param {string} kind
 */
function chartView(ctx, kind) {
  const root = ctx.h('div', { class: `z-chart z-chart--${kind}` });
  const titleEl = ctx.h('div', { class: 'z-chart__title' });
  const canvas = ctx.h('div', { class: 'z-chart__canvas' });
  const tooltip = ctx.h('div', {
    class: 'z-chart__tooltip',
    role: 'tooltip',
    'aria-hidden': 'true',
  });
  const legend = ctx.h('div', { class: 'z-chart__legend', role: 'list' });
  canvas.appendChild(tooltip);
  root.appendChild(titleEl);
  root.appendChild(canvas);
  root.appendChild(legend);

  const links = binding(ctx);
  /** @type {Element|null} */
  let svgEl = null;
  let rows = [];
  let seriesNames = [];
  let marks = [];
  let lastSignature = null;
  let lastData = null;
  let currentType = 'line';

  const hideTooltip = () => {
    tooltip.classList.remove('z-chart__tooltip--open');
    tooltip.setAttribute('aria-hidden', 'true');
  };

  const showTooltip = (hit) => {
    const row = rows[hit.index];
    if (!row) return;
    while (tooltip.firstChild) tooltip.removeChild(tooltip.firstChild);
    tooltip.appendChild(
      ctx.h('div', { class: 'z-chart__tooltip-title', text: String(row.x) })
    );
    const values = kind === 'rangechart'
      ? row.values.slice(0, 2)
      : currentType === 'pie'
        ? row.values.slice(0, 1)
        : row.values;
    values.forEach((value, index) => {
      if (value === null || value === undefined) return;
      const name = seriesNames[index] !== undefined ? seriesNames[index] : `Serie ${index + 1}`;
      tooltip.appendChild(
        ctx.h('div', { class: 'z-chart__tooltip-row' }, [
          ctx.h('span', {
            class: `z-chart__swatch z-chart__s${(index % SERIES_COLORS) + 1}`,
          }),
          ctx.h('span', { class: 'z-chart__tooltip-name', text: name }),
          ctx.h('span', { class: 'z-chart__tooltip-value', text: formatValue(ctx.props, value) }),
        ])
      );
    });
    const width = positive(ctx.props.width, DEFAULT_WIDTH);
    const height = positive(ctx.props.height, DEFAULT_HEIGHT);
    setVar(tooltip, '--z-chart-tooltip-x', `${n2((hit.px / width) * 100)}%`);
    setVar(tooltip, '--z-chart-tooltip-y', `${n2((hit.py / height) * 100)}%`);
    tooltip.classList.add('z-chart__tooltip--open');
    tooltip.setAttribute('aria-hidden', 'false');
  };

  const paintSelection = () => {
    const selected = ctx.props.selected === undefined || ctx.props.selected === null
      ? null
      : String(ctx.props.selected);
    for (const mark of marks) {
      const on = selected !== null && String(mark.index) === selected;
      if (on) mark.el.classList.add('z-chart__mark--selected');
      else mark.el.classList.remove('z-chart__mark--selected');
    }
  };

  /**
   * @param {any} props
   * @param {any} geo
   * @param {{ rows: any[], seriesCount: number }} model
   * @param {Element} svg
   */
  const drawAxes = (props, geo, model) => {
    const axes = snode(ctx, 'g', { class: 'z-chart__axes' });
    for (const tick of geo.ticks) {
      axes.appendChild(
        snode(ctx, 'line', {
          class: 'z-chart__grid',
          x1: geo.x0,
          x2: n2(geo.x0 + geo.plotW),
          y1: geo.yAt(tick),
          y2: geo.yAt(tick),
        })
      );
      axes.appendChild(
        snode(ctx, 'text', {
          class: 'z-chart__tick-label',
          x: n2(geo.x0 - 8),
          y: n2(geo.yAt(tick) + 4),
          'text-anchor': 'end',
          text: formatValue(props, tick),
        })
      );
    }

    axes.appendChild(
      snode(ctx, 'line', {
        class: 'z-chart__axis',
        x1: geo.x0,
        x2: geo.x0,
        y1: geo.y0,
        y2: n2(geo.y0 + geo.plotH),
      })
    );
    axes.appendChild(
      snode(ctx, 'line', {
        class: 'z-chart__axis',
        x1: geo.x0,
        x2: n2(geo.x0 + geo.plotW),
        y1: geo.baseline,
        y2: geo.baseline,
      })
    );

    const maxLabels = Math.max(2, Math.floor(geo.plotW / 64));
    const every = Math.max(1, Math.ceil(model.rows.length / maxLabels));
    model.rows.forEach((row, index) => {
      const last = index === model.rows.length - 1;
      if (index % every !== 0 && !last) return;
      axes.appendChild(
        snode(ctx, 'text', {
          class: 'z-chart__tick-label',
          x: geo.xAt(index),
          y: n2(geo.y0 + geo.plotH + 18),
          'text-anchor': 'middle',
          text: String(row.x),
        })
      );
    });

    if (props.xLabel) {
      axes.appendChild(
        snode(ctx, 'text', {
          class: 'z-chart__axis-title',
          x: n2(geo.x0 + geo.plotW / 2),
          y: n2(geo.height - 6),
          'text-anchor': 'middle',
          text: String(props.xLabel),
        })
      );
    }
    if (props.yLabel) {
      const cx = 14;
      const cy = n2(geo.y0 + geo.plotH / 2);
      axes.appendChild(
        snode(ctx, 'text', {
          class: 'z-chart__axis-title',
          x: cx,
          y: cy,
          'text-anchor': 'middle',
          transform: `rotate(-90 ${cx} ${cy})`,
          text: String(props.yLabel),
        })
      );
    }
    return axes;
  };

  const addHit = (element, hit) => {
    links.bind(element, 'pointermove', () => showTooltip(hit));
    links.bind(element, 'pointerleave', () => hideTooltip());
    links.bind(element, 'click', (event) => {
      ctx.props.selected = hit.index;
      paintSelection();
      const row = rows[hit.index];
      ctx.emit('select', {
        index: hit.index,
        x: row ? row.x : undefined,
        series: hit.series,
        value: hit.value,
        values: row ? row.values.slice() : [],
        item: row ? row.item : undefined,
        event,
      });
    });
  };

  /** @param {any} geo @param {any} model @param {Element} svg */
  const drawPie = (geo, model, svg) => {
    const radius = Math.max(1, Math.min(geo.plotW, geo.plotH) / 2);
    const cx = n2(geo.x0 + geo.plotW / 2);
    const cy = n2(geo.y0 + geo.plotH / 2);
    const values = model.rows.map((row) => {
      const value = row.values[0];
      return value === null || value < 0 ? 0 : value;
    });
    const total = values.reduce((sum, value) => sum + value, 0);
    const group = snode(ctx, 'g', { class: 'z-chart__pie' });

    if (!total) {
      group.appendChild(
        snode(ctx, 'circle', {
          class: 'z-chart__empty',
          cx,
          cy,
          r: radius,
        })
      );
      svg.appendChild(group);
      return;
    }

    let angle = 0;
    model.rows.forEach((row, index) => {
      const value = values[index];
      if (value <= 0) return;
      const sweep = (value / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const slice = snode(ctx, 'path', {
        class: `z-chart__slice z-chart__s${(index % SERIES_COLORS) + 1}`,
        d: slicePath(cx, cy, radius, start, end),
        'data-index': index,
        'data-value': value,
      });
      group.appendChild(slice);
      marks.push({ el: slice, index });
      const mid = (start + end) / 2;
      const [px, py] = polar(cx, cy, radius * 0.6, mid);
      addHit(slice, { index, series: 0, value, px, py });
    });
    svg.appendChild(group);
  };

  /** @param {any} props @param {string} type @param {any} geo @param {any} model @param {Element} svg */
  const drawSeries = (props, type, geo, model, svg) => {
    const group = snode(ctx, 'g', { class: 'z-chart__series' });

    if (type === 'bar') {
      const slot = geo.bandWidth / model.seriesCount;
      const barW = Math.max(1, slot * 0.64);
      model.rows.forEach((row, index) => {
        const center = geo.x0 + geo.bandWidth * index + geo.bandWidth / 2;
        const groupW = barW * model.seriesCount;
        row.values.forEach((value, series) => {
          if (value === null) return;
          const x = center - groupW / 2 + series * barW;
          const yValue = geo.yAt(value);
          const top = Math.min(yValue, geo.baseline);
          const height = Math.max(0, Math.abs(geo.baseline - yValue));
          const bar = snode(ctx, 'rect', {
            class: `z-chart__bar z-chart__s${(series % SERIES_COLORS) + 1}`,
            x: n2(x),
            y: n2(top),
            width: n2(barW),
            height: n2(height),
            'data-index': index,
            'data-series': series,
            'data-value': value,
          });
          group.appendChild(bar);
          marks.push({ el: bar, index });
          addHit(bar, { index, series, value, px: n2(x + barW / 2), py: n2(top) });
        });
      });
      svg.appendChild(group);
      return;
    }

    for (let series = 0; series < model.seriesCount; series += 1) {
      const points = model.rows.map((row, index) => {
        const value = row.values[series];
        return value === null ? null : [geo.xAt(index), geo.yAt(value)];
      });
      const color = `z-chart__s${(series % SERIES_COLORS) + 1}`;

      const areaD = type === 'area' ? areaPath(points, geo.baseline) : '';
      const lineD = type === 'line' || type === 'area' ? linePath(points) : '';
      if (areaD) {
        group.appendChild(snode(ctx, 'path', { class: `z-chart__area ${color}`, d: areaD }));
      }
      if (lineD) {
        group.appendChild(snode(ctx, 'path', { class: `z-chart__line ${color}`, d: lineD }));
      }

      points.forEach((point, index) => {
        if (!point) return;
        const value = model.rows[index].values[series];
        const radius = positive(props.pointSize, 4);
        const dot = snode(ctx, 'circle', {
          class: `z-chart__point ${color}`,
          cx: point[0],
          cy: point[1],
          r: radius,
          'data-index': index,
          'data-series': series,
          'data-value': value,
        });
        group.appendChild(dot);
        marks.push({ el: dot, index });
        addHit(dot, { index, series, value, px: point[0], py: point[1] });
      });
    }
    svg.appendChild(group);
  };

  /** @param {any} geo @param {any} model @param {Element} svg */
  const drawRange = (geo, model, svg) => {
    const group = snode(ctx, 'g', { class: 'z-chart__range-group' });
    const upper = [];
    const lower = [];

    model.rows.forEach((row, index) => {
      const a = row.values[0];
      const b = row.values[1];
      if (a === null || b === null) return;
      const top = Math.max(a, b);
      const bottom = Math.min(a, b);
      upper.push([geo.xAt(index), geo.yAt(top)]);
      lower.push([geo.xAt(index), geo.yAt(bottom)]);
    });

    if (upper.length) {
      group.appendChild(
        snode(ctx, 'path', {
          class: 'z-chart__range',
          d: rangeAreaPath(upper, lower),
        })
      );
      group.appendChild(
        snode(ctx, 'path', { class: 'z-chart__range-edge', d: linePath(upper) })
      );
      group.appendChild(
        snode(ctx, 'path', { class: 'z-chart__range-edge', d: linePath(lower) })
      );
    }

    model.rows.forEach((row, index) => {
      const a = row.values[0];
      const b = row.values[1];
      if (a === null || b === null) return;
      const top = geo.yAt(Math.max(a, b));
      const bottom = geo.yAt(Math.min(a, b));
      const hit = snode(ctx, 'rect', {
        class: 'z-chart__hit',
        x: n2(geo.xAt(index) - 10),
        y: n2(top),
        width: 20,
        height: n2(Math.max(1, bottom - top)),
        'data-index': index,
      });
      group.appendChild(hit);
      addHit(hit, { index, series: 0, value: Math.max(a, b), px: geo.xAt(index), py: top });
    });

    svg.appendChild(group);
  };

  /** @param {string} type @param {{ rows: any[] }} model */
  const buildLegend = (type, model) => {
    while (legend.firstChild) legend.removeChild(legend.firstChild);
    const entries = type === 'pie'
      ? model.rows.map((row, index) => ({ label: String(row.x), color: index }))
      : seriesNames.map((name, index) => ({ label: name, color: index }));

    if (type === 'range' || entries.length <= 1) {
      legend.setAttribute('hidden', '');
      return;
    }
    legend.removeAttribute('hidden');
    for (const entry of entries) {
      legend.appendChild(
        ctx.h('span', { class: 'z-chart__legend-item', role: 'listitem' }, [
          ctx.h('span', {
            class: `z-chart__swatch z-chart__s${(entry.color % SERIES_COLORS) + 1}`,
          }),
          ctx.h('span', { class: 'z-chart__legend-text', text: entry.label }),
        ])
      );
    }
  };

  /** @param {any} props @param {string} type */
  const build = (props, type) => {
    links.releaseAll();
    hideTooltip();
    if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
    svgEl = null;
    marks = [];

    const model = normalizeData(props.data);
    rows = model.rows;
    currentType = type;
    seriesNames = seriesNamesFor(props, model.seriesCount, type);
    const ticks = Number.isFinite(Number(props.ticks)) ? Math.max(1, Number(props.ticks)) : 4;
    const geo = cartesianGeometry(props, model, ticks);

    const svg = snode(ctx, 'svg', {
      class: 'z-chart__svg',
      viewBox: `0 0 ${n2(geo.width)} ${n2(geo.height)}`,
      width: geo.width,
      height: geo.height,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': props.ariaLabel || props.title || 'Grafico',
      focusable: 'false',
    });

    if (type === 'pie') {
      drawPie(geo, model, svg);
    } else {
      svg.appendChild(drawAxes(props, geo, model));
      if (type === 'range') drawRange(geo, model, svg);
      else drawSeries(props, type, geo, model, svg);
    }

    canvas.insertBefore(svg, tooltip);
    svgEl = svg;
    buildLegend(type, model);
    paintSelection();
  };

  const update = (props) => {
    const type = resolveType(props, kind);
    root.setAttribute('class', `z-chart z-chart--${kind} z-chart--${type}`);
    const title = props.title === undefined || props.title === null ? '' : String(props.title);
    titleEl.textContent = title;
    if (title) titleEl.removeAttribute('hidden');
    else titleEl.setAttribute('hidden', '');

    const signature = JSON.stringify([
      kind,
      type,
      props.series || null,
      props.width ?? null,
      props.height ?? null,
      props.ticks ?? null,
      props.pointSize ?? null,
      props.xLabel || '',
      props.yLabel || '',
      props.ariaLabel || '',
      typeof props.format,
    ]);
    if (signature !== lastSignature || props.data !== lastData) {
      lastSignature = signature;
      lastData = props.data;
      build(props, type);
    } else {
      paintSelection();
    }
  };
  update(ctx.props);

  return {
    el: root,
    update,
    destroy: () => {
      links.releaseAll();
      hideTooltip();
      while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
      while (legend.firstChild) legend.removeChild(legend.firstChild);
      svgEl = null;
      rows = [];
      marks = [];
    },
    api: {
      /** Reemplaza los datos y rearma el SVG. @returns {number} */
      setData(data) {
        const list = Array.isArray(data) ? data : [];
        ctx.props.data = list;
        update(ctx.props);
        return list.length;
      },
      /** @returns {unknown[]} */
      getData() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : [];
      },
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : [];
      },
      /** @returns {number} */
      get count() {
        return rows.length;
      },
      /** @returns {number} */
      get seriesCount() {
        return seriesNames.length;
      },
      /** @returns {string} */
      get type() {
        return resolveType(ctx.props, kind);
      },
      /** @returns {string|null} */
      get selected() {
        return ctx.props.selected === undefined || ctx.props.selected === null
          ? null
          : String(ctx.props.selected);
      },
      /** @returns {Element|null} */
      get svg() {
        return svgEl;
      },
      /** @returns {Element} */
      get canvas() {
        return canvas;
      },
      /** @returns {Element} */
      get tooltip() {
        return tooltip;
      },
      /** @returns {Element} */
      get legend() {
        return legend;
      },
    },
  };
}

define('chart', (ctx) => chartView(ctx, 'chart'));
define('rangechart', (ctx) => chartView(ctx, 'rangechart'));
