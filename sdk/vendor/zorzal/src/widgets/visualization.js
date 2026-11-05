/**
 * Indicadores de visualizacion: `bullet`, `gage` y `treemap`.
 *
 * Los tres arman su propio SVG con `viewBox`; la geometria vive en atributos
 * del SVG (`d`, `x`, `y`, `width`, `height`) y el color en variables CSS con
 * prefijo `z-`. Reutilizan de `chart.js` la escala redonda (`niceTicks`), el
 * creador de nodos SVG (`snode`), el redondeo (`n2`) y la proyeccion polar,
 * de modo que no hay librerias ni canvas.
 *
 * - `bullet`: barra horizontal con valor, objetivo y hasta tres rangos
 *   cualitativos.
 * - `gage`: indicador semicircular con arco de progreso, aguja y valor
 *   central.
 * - `treemap`: rectangulos proporcionales al valor con un nivel de jerarquia
 *   (`children`).
 */

import { define } from '../core/registry.js';
import { n2, niceTicks, polar, positive, snode, toNumber } from './chart.js';

const DEFAULT_BULLET_WIDTH = 420;
const DEFAULT_BULLET_HEIGHT = 80;
const DEFAULT_GAGE_WIDTH = 260;
const DEFAULT_GAGE_HEIGHT = 150;
const DEFAULT_TREEMAP_WIDTH = 600;
const DEFAULT_TREEMAP_HEIGHT = 320;
const RANGE_LIMIT = 3;
const TONES = 8;
/** La convencion de `polar` de chart: 0 arriba, 90 a la derecha. */
const GAGE_START = 270;
const GAGE_SWEEP = 180;

/** @param {number} value @param {number} min @param {number} max @returns {number} */
function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** @param {unknown} props @param {number} value @returns {string} */
function formatValue(props, value) {
  if (props && typeof props.format === 'function') {
    const out = props.format(value);
    if (out !== undefined && out !== null) return String(out);
  }
  return String(n2(value));
}

/** @param {unknown} item @param {number|string} fallback @returns {string} */
function labelOf(item, fallback) {
  if (item && typeof item === 'object') {
    for (const key of ['label', 'text', 'id', 'name']) {
      if (item[key] !== undefined && item[key] !== null) return String(item[key]);
    }
  }
  return String(fallback);
}

/**
 * Path de un arco de circunferencia (sin cerrar al centro), en la convencion
 * de `polar`: 0 arriba y sentido horario.
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number} from
 * @param {number} to
 * @returns {string}
 */
export function arcPath(cx, cy, radius, from, to) {
  if (!(radius > 0) || !(to > from)) return '';
  const [x1, y1] = polar(cx, cy, radius, from);
  const [x2, y2] = polar(cx, cy, radius, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${n2(radius)} ${n2(radius)} 0 ${large} 1 ${x2} ${y2}`;
}

// --- bullet -----------------------------------------------------------

/**
 * Escala y medidas de la barra. Sin `max` toma el dominio redondo que cubre
 * valor, objetivo y umbrales (`niceTicks`).
 *
 * @param {Record<string, unknown>} [props]
 * @returns {any}
 */
export function bulletGeometry(props = {}) {
  const width = positive(props.width, DEFAULT_BULLET_WIDTH);
  const height = positive(props.height, DEFAULT_BULLET_HEIGHT);
  const min = toNumber(props.min) ?? 0;
  const declaredMax = toNumber(props.max);
  const rawValue = toNumber(props.value);
  const rawTarget = toNumber(props.target);

  const thresholds = [];
  const declared = Array.isArray(props.ranges) ? props.ranges : [];
  for (const entry of declared) {
    if (thresholds.length >= RANGE_LIMIT) break;
    const threshold = entry && typeof entry === 'object'
      ? toNumber(entry.to !== undefined ? entry.to : entry.value)
      : toNumber(entry);
    if (threshold !== null && threshold > min) thresholds.push(threshold);
  }

  let max = declaredMax !== null && declaredMax > min ? declaredMax : null;
  if (max === null) {
    const candidates = [min + 1];
    if (rawValue !== null) candidates.push(rawValue);
    if (rawTarget !== null) candidates.push(rawTarget);
    for (const threshold of thresholds) candidates.push(threshold);
    max = niceTicks(min, Math.max(...candidates), 4).max;
  }

  const value = clamp(rawValue === null ? min : rawValue, min, max);
  const target = rawTarget === null ? null : clamp(rawTarget, min, max);
  const left = 16;
  const right = 16;
  const plotW = Math.max(1, width - left - right);
  const span = max - min || 1;
  const xAt = (input) => n2(left + ((clamp(input, min, max) - min) / span) * plotW);

  const trackY = 24;
  const trackH = 30;
  const barY = 32;
  const barH = 14;

  const bands = [];
  let from = min;
  for (const threshold of thresholds) {
    if (bands.length >= RANGE_LIMIT) break;
    const to = clamp(threshold, from, max);
    if (to > from) {
      bands.push({ index: bands.length, from, to, x: xAt(from), width: n2(xAt(to) - xAt(from)) });
      from = to;
    }
  }
  if (thresholds.length && bands.length < RANGE_LIMIT && from < max) {
    bands.push({ index: bands.length, from, to: max, x: xAt(from), width: n2(xAt(max) - xAt(from)) });
  }

  return {
    width,
    height,
    min,
    max,
    value,
    target,
    left,
    right,
    plotW,
    span,
    xAt,
    trackY,
    trackH,
    barY,
    barH,
    fraction: (value - min) / span,
    valueX: xAt(value),
    valueWidth: n2(xAt(value) - xAt(min)),
    targetX: target === null ? null : xAt(target),
    bands,
  };
}

define('bullet', (ctx) => {
  const titleEl = ctx.h('div', { class: 'z-bullet__title' });
  const root = ctx.h('div', { class: 'z-bullet' }, [titleEl]);
  const links = binding(ctx);
  /** @type {Element|null} */
  let svgEl = null;
  /** @type {any} */
  let geo = null;
  let lastSignature = null;

  /** @param {any} props */
  const build = (props) => {
    links.releaseAll();
    if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
    svgEl = null;
    geo = bulletGeometry(props);

    const svg = snode(ctx, 'svg', {
      class: 'z-bullet__svg',
      viewBox: `0 0 ${n2(geo.width)} ${n2(geo.height)}`,
      width: geo.width,
      height: geo.height,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': props.ariaLabel || props.title || 'Indicador de rango',
      focusable: 'false',
    });

    svg.appendChild(
      snode(ctx, 'rect', {
        class: 'z-bullet__track',
        x: geo.left,
        y: geo.trackY,
        width: geo.plotW,
        height: geo.trackH,
      })
    );

    for (const band of geo.bands) {
      svg.appendChild(
        snode(ctx, 'rect', {
          class: `z-bullet__range z-bullet__range--${(band.index % RANGE_LIMIT) + 1}`,
          x: band.x,
          y: geo.trackY,
          width: band.width,
          height: geo.trackH,
          'data-range': band.index,
          'data-from': band.from,
          'data-to': band.to,
        })
      );
    }

    svg.appendChild(
      snode(ctx, 'rect', {
        class: 'z-bullet__bar',
        x: geo.left,
        y: geo.barY,
        width: geo.valueWidth,
        height: geo.barH,
        'data-value': geo.value,
      })
    );

    if (geo.target !== null) {
      svg.appendChild(
        snode(ctx, 'line', {
          class: 'z-bullet__target',
          x1: geo.targetX,
          x2: geo.targetX,
          y1: n2(geo.trackY - 6),
          y2: n2(geo.trackY + geo.trackH + 6),
          'data-target': geo.target,
        })
      );
      svg.appendChild(
        snode(ctx, 'text', {
          class: 'z-bullet__target-label',
          x: geo.targetX,
          y: 13,
          'text-anchor': 'middle',
          text: formatValue(props, geo.target),
        })
      );
    }

    svg.appendChild(
      snode(ctx, 'text', {
        class: 'z-bullet__value',
        x: geo.left,
        y: 13,
        'text-anchor': 'start',
        text: formatValue(props, geo.value),
      })
    );
    svg.appendChild(
      snode(ctx, 'text', {
        class: 'z-bullet__tick',
        x: geo.left,
        y: n2(geo.height - 8),
        'text-anchor': 'start',
        text: formatValue(props, geo.min),
      })
    );
    svg.appendChild(
      snode(ctx, 'text', {
        class: 'z-bullet__tick',
        x: n2(geo.left + geo.plotW),
        y: n2(geo.height - 8),
        'text-anchor': 'end',
        text: formatValue(props, geo.max),
      })
    );

    root.appendChild(svg);
    svgEl = svg;
  };

  /** @param {any} props */
  const update = (props) => {
    const title = props.title === undefined || props.title === null ? '' : String(props.title);
    titleEl.textContent = title;
    if (title) titleEl.removeAttribute('hidden');
    else titleEl.setAttribute('hidden', '');

    const signature = JSON.stringify([
      props.value ?? null,
      props.target ?? null,
      props.min ?? null,
      props.max ?? null,
      props.ranges || null,
      props.width ?? null,
      props.height ?? null,
      props.ariaLabel || '',
      typeof props.format,
    ]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    build(props);
  };
  update(ctx.props);

  const currentValue = () => (geo ? geo.value : bulletGeometry(ctx.props).value);

  return {
    el: root,
    update,
    destroy: () => {
      links.releaseAll();
      if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
      svgEl = null;
      geo = null;
    },
    api: {
      /** @returns {number} */
      getValue: currentValue,
      /**
       * @param {unknown} value
       * @returns {number}
       */
      setValue(value) {
        const previous = currentValue();
        const next = bulletGeometry({ ...ctx.props, value }).value;
        ctx.props.value = next;
        update(ctx.props);
        if (next !== previous) {
          ctx.emit('change', { value: next, previous, target: geo ? geo.target : null });
        }
        return next;
      },
      /**
       * @param {unknown} value
       * @returns {number|null}
       */
      setTarget(value) {
        const previous = geo && geo.target !== null ? geo.target : null;
        const props = { ...ctx.props, target: value };
        const next = bulletGeometry(props).target;
        ctx.props.target = next === null ? value : next;
        update(ctx.props);
        if (next !== previous) {
          ctx.emit('change', {
            value: currentValue(),
            target: next,
            previousTarget: previous,
            reason: 'target',
          });
        }
        return next;
      },
      /** @returns {number|null} */
      get target() {
        return geo ? geo.target : null;
      },
      /** @returns {number} */
      get min() {
        return geo ? geo.min : 0;
      },
      /** @returns {number} */
      get max() {
        return geo ? geo.max : 0;
      },
      /** @returns {Element|null} */
      get svg() {
        return svgEl;
      },
    },
  };
});

// --- gage -------------------------------------------------------------

/**
 * Escala y medidas del indicador semicircular (180 grados, de izquierda a
 * derecha pasando por arriba).
 *
 * @param {Record<string, unknown>} [props]
 * @returns {any}
 */
export function gageGeometry(props = {}) {
  const width = positive(props.width, DEFAULT_GAGE_WIDTH);
  const height = positive(props.height, DEFAULT_GAGE_HEIGHT);
  const min = toNumber(props.min) ?? 0;
  const declaredMax = toNumber(props.max);
  const max = declaredMax === null || declaredMax <= min ? min + 100 : declaredMax;
  const raw = toNumber(props.value);
  const value = clamp(raw === null ? min : raw, min, max);
  const span = max - min || 1;
  const fraction = (value - min) / span;

  const pad = 14;
  const cx = n2(width / 2);
  const cy = n2(height - 22);
  const radius = n2(Math.max(1, Math.min(width / 2 - pad, height - 40)));
  const angle = GAGE_START + fraction * GAGE_SWEEP;

  return {
    width,
    height,
    min,
    max,
    value,
    fraction,
    cx,
    cy,
    radius,
    angle,
    start: polar(cx, cy, radius, GAGE_START),
    end: polar(cx, cy, radius, angle),
    needle: polar(cx, cy, radius * 0.82, angle),
    trackPath: arcPath(cx, cy, radius, GAGE_START, GAGE_START + GAGE_SWEEP),
    progressPath: fraction > 0 ? arcPath(cx, cy, radius, GAGE_START, angle) : '',
    hubRadius: 5,
    labelY: n2(cy + 18),
  };
}

define('gage', (ctx) => {
  const titleEl = ctx.h('div', { class: 'z-gage__title' });
  const root = ctx.h('div', { class: 'z-gage' }, [titleEl]);
  const links = binding(ctx);
  /** @type {Element|null} */
  let svgEl = null;
  /** @type {any} */
  let geo = null;
  let lastSignature = null;

  /** @param {any} props */
  const build = (props) => {
    links.releaseAll();
    if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
    svgEl = null;
    geo = gageGeometry(props);

    const svg = snode(ctx, 'svg', {
      class: 'z-gage__svg',
      viewBox: `0 0 ${n2(geo.width)} ${n2(geo.height)}`,
      width: geo.width,
      height: geo.height,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': props.ariaLabel || props.title || 'Indicador semicircular',
      focusable: 'false',
    });

    svg.appendChild(snode(ctx, 'path', { class: 'z-gage__track', d: geo.trackPath }));
    if (geo.progressPath) {
      svg.appendChild(
        snode(ctx, 'path', {
          class: 'z-gage__progress',
          d: geo.progressPath,
          'data-value': geo.value,
        })
      );
    }
    svg.appendChild(
      snode(ctx, 'line', {
        class: 'z-gage__needle',
        x1: geo.cx,
        y1: geo.cy,
        x2: geo.needle[0],
        y2: geo.needle[1],
        'data-value': geo.value,
      })
    );
    svg.appendChild(
      snode(ctx, 'circle', {
        class: 'z-gage__hub',
        cx: geo.cx,
        cy: geo.cy,
        r: geo.hubRadius,
      })
    );
    svg.appendChild(
      snode(ctx, 'text', {
        class: 'z-gage__value',
        x: geo.cx,
        y: geo.labelY,
        'text-anchor': 'middle',
        text: formatValue(props, geo.value),
      })
    );
    svg.appendChild(
      snode(ctx, 'text', {
        class: 'z-gage__label z-gage__label--min',
        x: n2(geo.cx - geo.radius),
        y: geo.labelY,
        'text-anchor': 'middle',
        text: formatValue(props, geo.min),
      })
    );
    svg.appendChild(
      snode(ctx, 'text', {
        class: 'z-gage__label z-gage__label--max',
        x: n2(geo.cx + geo.radius),
        y: geo.labelY,
        'text-anchor': 'middle',
        text: formatValue(props, geo.max),
      })
    );

    root.appendChild(svg);
    svgEl = svg;
  };

  /** @param {any} props */
  const update = (props) => {
    const title = props.title === undefined || props.title === null ? '' : String(props.title);
    titleEl.textContent = title;
    if (title) titleEl.removeAttribute('hidden');
    else titleEl.setAttribute('hidden', '');

    const signature = JSON.stringify([
      props.value ?? null,
      props.min ?? null,
      props.max ?? null,
      props.width ?? null,
      props.height ?? null,
      props.ariaLabel || '',
      typeof props.format,
    ]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    build(props);
  };
  update(ctx.props);

  const currentValue = () => (geo ? geo.value : gageGeometry(ctx.props).value);

  return {
    el: root,
    update,
    destroy: () => {
      links.releaseAll();
      if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
      svgEl = null;
      geo = null;
    },
    api: {
      /** @returns {number} */
      getValue: currentValue,
      /**
       * @param {unknown} value
       * @returns {number}
       */
      setValue(value) {
        const previous = currentValue();
        const next = gageGeometry({ ...ctx.props, value }).value;
        ctx.props.value = next;
        update(ctx.props);
        if (next !== previous) {
          ctx.emit('change', { value: next, previous, min: geo.min, max: geo.max });
        }
        return next;
      },
      /** @returns {number} */
      get min() {
        return geo ? geo.min : 0;
      },
      /** @returns {number} */
      get max() {
        return geo ? geo.max : 0;
      },
      /** @returns {number} */
      get fraction() {
        return geo ? geo.fraction : 0;
      },
      /** @returns {Element|null} */
      get svg() {
        return svgEl;
      },
    },
  };
});

// --- treemap ----------------------------------------------------------

/**
 * Normaliza `data` a ramas `{ index, label, value, children }`. El valor de
 * una rama es el propio o, si falta, la suma de sus hijos.
 *
 * @param {unknown} data
 * @returns {any[]}
 */
export function normalizeTreemap(data) {
  if (!Array.isArray(data)) return [];
  return data.map((item, index) => {
    const source = item && typeof item === 'object' ? item : { value: item };
    const children = Array.isArray(source.children)
      ? source.children.map((child, childIndex) => {
          const childSource = child && typeof child === 'object' ? child : { value: child };
          return {
            index: childIndex,
            item: child,
            label: labelOf(child, childIndex),
            value: Math.max(0, toNumber(childSource.value) ?? 0),
          };
        })
      : [];
    const own = toNumber(source.value);
    const sum = children.reduce((total, child) => total + child.value, 0);
    return {
      index,
      item,
      label: labelOf(item, index),
      value: Math.max(0, own === null ? sum : own),
      children,
    };
  });
}

/**
 * Layout de un nivel: las ramas se reparten el ancho en columnas
 * proporcionales y los hijos el alto de su rama en filas proporcionales.
 *
 * @param {unknown} data
 * @param {{ width?: unknown, height?: unknown }} [options]
 * @returns {any}
 */
export function treemapLayout(data, options = {}) {
  const width = positive(options.width, DEFAULT_TREEMAP_WIDTH);
  const height = positive(options.height, DEFAULT_TREEMAP_HEIGHT);
  const branches = normalizeTreemap(data);
  const total = branches.reduce((sum, branch) => sum + branch.value, 0);
  const cells = [];

  if (total > 0) {
    let x = 0;
    for (const branch of branches) {
      const cellW = (branch.value / total) * width;
      const cell = {
        index: branch.index,
        item: branch.item,
        label: branch.label,
        value: branch.value,
        x: n2(x),
        y: 0,
        width: n2(cellW),
        height: n2(height),
        children: [],
      };
      let y = 0;
      for (const child of branch.children) {
        const remaining = Math.max(0, height - y);
        const ratio = branch.value > 0 ? child.value / branch.value : 0;
        const childH = Math.min(remaining, ratio * height);
        cell.children.push({
          index: child.index,
          item: child.item,
          label: child.label,
          value: child.value,
          x: n2(x),
          y: n2(y),
          width: n2(cellW),
          height: n2(childH),
        });
        y += childH;
      }
      cells.push(cell);
      x += cellW;
    }
  }

  return { width, height, total, branches, cells };
}

define('treemap', (ctx) => {
  const titleEl = ctx.h('div', { class: 'z-treemap__title' });
  const root = ctx.h('div', { class: 'z-treemap' }, [titleEl]);
  const links = binding(ctx);
  /** @type {Element|null} */
  let svgEl = null;
  /** @type {any} */
  let geo = null;
  let lastSignature = null;
  let lastData = null;
  /** @type {{ el: Element, index: number, child: number|null }[]} */
  let marks = [];

  const paintSelection = () => {
    const selected = ctx.props.selected;
    const isBranch = (index) =>
      selected !== null && selected !== undefined && typeof selected !== 'object' && Number(selected) === index;
    const isChild = (index, child) =>
      selected !== null &&
      selected !== undefined &&
      typeof selected === 'object' &&
      Number(selected.branch) === index &&
      Number(selected.child) === child;
    for (const mark of marks) {
      const on = mark.child === null ? isBranch(mark.index) : isChild(mark.index, mark.child);
      if (on) mark.el.classList.add('z-treemap__cell--selected');
      else mark.el.classList.remove('z-treemap__cell--selected');
    }
  };

  const addHit = (element, index, child, cell) => {
    links.bind(element, 'click', (event) => {
      ctx.props.selected = child === null ? index : { branch: index, child };
      paintSelection();
      ctx.emit('select', {
        index,
        branch: index,
        child,
        label: cell.label,
        value: cell.value,
        item: cell.item,
        event,
      });
    });
  };

  /** @param {any} props */
  const build = (props) => {
    links.releaseAll();
    if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
    svgEl = null;
    marks = [];
    geo = treemapLayout(props.data, props);

    const svg = snode(ctx, 'svg', {
      class: 'z-treemap__svg',
      viewBox: `0 0 ${n2(geo.width)} ${n2(geo.height)}`,
      width: geo.width,
      height: geo.height,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': props.ariaLabel || props.title || 'Mapa de arbol',
      focusable: 'false',
    });
    const group = snode(ctx, 'g', { class: 'z-treemap__cells' });

    for (const cell of geo.cells) {
      const tone = (cell.index % TONES) + 1;
      const cellRect = snode(ctx, 'rect', {
        class: `z-treemap__cell z-treemap__cell--${tone}`,
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height,
        'data-index': cell.index,
        'data-value': cell.value,
      });
      group.appendChild(cellRect);
      marks.push({ el: cellRect, index: cell.index, child: null });
      addHit(cellRect, cell.index, null, cell);
    }

    for (const cell of geo.cells) {
      const tone = (cell.index % TONES) + 1;
      for (const child of cell.children) {
        const childRect = snode(ctx, 'rect', {
          class: `z-treemap__cell z-treemap__cell--${tone} z-treemap__cell--child`,
          x: child.x,
          y: child.y,
          width: child.width,
          height: child.height,
          'data-index': cell.index,
          'data-child': child.index,
          'data-value': child.value,
        });
        group.appendChild(childRect);
        marks.push({ el: childRect, index: cell.index, child: child.index });
        addHit(childRect, cell.index, child.index, child);
      }
    }

    for (const cell of geo.cells) {
      const nested = cell.children.length > 0;
      group.appendChild(
        snode(ctx, 'text', {
          class: nested ? 'z-treemap__label z-treemap__label--branch' : 'z-treemap__label',
          x: n2(cell.x + 6),
          y: nested ? n2(cell.y + cell.height - 8) : n2(cell.y + 16),
          text: cell.label,
        })
      );
      for (const child of cell.children) {
        group.appendChild(
          snode(ctx, 'text', {
            class: 'z-treemap__label z-treemap__label--child',
            x: n2(child.x + 4),
            y: n2(child.y + 13),
            text: child.label,
          })
        );
      }
    }

    svg.appendChild(group);
    root.appendChild(svg);
    svgEl = svg;
    paintSelection();
  };

  /** @param {any} props */
  const update = (props) => {
    const title = props.title === undefined || props.title === null ? '' : String(props.title);
    titleEl.textContent = title;
    if (title) titleEl.removeAttribute('hidden');
    else titleEl.setAttribute('hidden', '');

    const signature = JSON.stringify([
      props.width ?? null,
      props.height ?? null,
      props.ariaLabel || '',
      typeof props.format,
    ]);
    if (signature === lastSignature && props.data === lastData) {
      paintSelection();
      return;
    }
    lastSignature = signature;
    lastData = props.data;
    build(props);
  };
  update(ctx.props);

  return {
    el: root,
    update,
    destroy: () => {
      links.releaseAll();
      if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
      svgEl = null;
      geo = null;
      marks = [];
    },
    api: {
      /** @param {unknown} data @returns {number} */
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
      /** @returns {unknown[]} */
      get data() {
        return Array.isArray(ctx.props.data) ? ctx.props.data : [];
      },
      /** @returns {number} */
      get count() {
        return geo ? geo.branches.length : 0;
      },
      /** @returns {any[]} */
      get branches() {
        return geo ? geo.branches : [];
      },
      /** @returns {unknown} */
      get selected() {
        return ctx.props.selected === undefined ? null : ctx.props.selected;
      },
      /** @returns {Element|null} */
      get svg() {
        return svgEl;
      },
    },
  };
});

/**
 * Bindeo de listeners con liberacion al rearmar el SVG.
 * @param {any} ctx
 */
function binding(ctx) {
  /** @type {[Element, string, Function][]} */
  let records = [];
  return {
    /** @param {Element} target @param {string} type @param {Function} fn */
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
