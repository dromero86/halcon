/**
 * Controles de seleccion multiple: multicombo, multiselect, multitext y dbllist.
 *
 * Tres de ellos se arman sobre la factory `buildControl` de `select-controls.js`
 * y heredan el campo, la lista flotante, el filtro por texto, el teclado y el
 * cierre por clic fuera. Solo cambia el modelo de presentacion:
 *
 * - `multicombo`: campo editable con etiquetas visibles; el valor es un array.
 * - `multiselect`: campo cerrado que abre una lista con casillas; el valor es
 *   un array y la lista queda abierta para seguir marcando.
 * - `multitext`: campo editable con etiquetas; Enter agrega el texto escrito y
 *   la cruz de cada etiqueta lo quita.
 * - `dbllist`: dos listas, disponibles y seleccionados, con botones de mover.
 *   Reutiliza el mismo normalizado de opciones y el mismo modelo de valor
 *   array, sin repetir el filtro de la base.
 *
 * Los estilos viven en `src/zorzal.css` con prefijo `z-`; solo se escriben
 * variables CSS (`--z-suggest-width`, `--z-dbllist-width`).
 */

import { define } from '../core/registry.js';
import { cls } from '../core/dom.js';
import {
  buildControl,
  normalizeOptions,
  valuesOf,
  setVar,
  removeVar,
  isMeasure,
  measureOf,
} from './select-controls.js';

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
 * Widget de dos listas: disponibles a la izquierda, seleccionados a la derecha.
 *
 * El clic marca un elemento y los botones mueven los marcados; el doble clic
 * mueve ese elemento solo. `moveRight(valores)` y `moveLeft(valores)` aceptan
 * una lista explicita y, sin argumentos, mueven lo marcado.
 *
 * @param {any} ctx
 */
function buildDblList(ctx) {
  const label = ctx.h('span', { class: 'z-select-control__label z-hidden' });
  const leftTitle = ctx.h('div', { class: 'z-dbllist__title' });
  const rightTitle = ctx.h('div', { class: 'z-dbllist__title' });
  const leftList = ctx.h('div', {
    class: 'z-dbllist__list',
    role: 'listbox',
    'aria-multiselectable': 'true',
  });
  const rightList = ctx.h('div', {
    class: 'z-dbllist__list',
    role: 'listbox',
    'aria-multiselectable': 'true',
  });
  const leftEmpty = ctx.h('div', { class: cls('z-dbllist__empty', 'z-hidden') });
  const rightEmpty = ctx.h('div', { class: cls('z-dbllist__empty', 'z-hidden') });

  const moveRight = ctx.h('button', {
    class: 'z-dbllist__button z-dbllist__button--right',
    type: 'button',
    'aria-label': 'Mover a seleccionados',
    title: 'Mover a seleccionados',
  });
  moveRight.appendChild(ctx.doc().createTextNode('\u2192'));

  const moveLeft = ctx.h('button', {
    class: 'z-dbllist__button z-dbllist__button--left',
    type: 'button',
    'aria-label': 'Quitar de seleccionados',
    title: 'Quitar de seleccionados',
  });
  moveLeft.appendChild(ctx.doc().createTextNode('\u2190'));

  const actions = ctx.h('div', { class: 'z-dbllist__actions' }, [moveRight, moveLeft]);
  const leftPanel = ctx.h('div', { class: 'z-dbllist__panel' }, [leftTitle, leftList, leftEmpty]);
  const rightPanel = ctx.h('div', { class: 'z-dbllist__panel' }, [rightTitle, rightList, rightEmpty]);
  const body = ctx.h('div', { class: 'z-dbllist__body' }, [leftPanel, actions, rightPanel]);
  const el = ctx.h('div', { class: cls('z-dbllist') }, [label, body]);

  let items = [];
  let marked = new Set();
  let signature = null;

  /** @returns {string[]} */
  const values = () => valuesOf(ctx.props.value);

  /** @param {unknown} node @returns {string|null} */
  const itemValueOf = (node) => {
    let current = node;
    while (current && current.getAttribute) {
      const value = current.getAttribute('data-value');
      if (value !== null) return value;
      current = current.parentNode;
    }
    return null;
  };

  const paint = () => {
    const selected = new Set(values());
    while (leftList.firstChild) leftList.removeChild(leftList.firstChild);
    while (rightList.firstChild) rightList.removeChild(rightList.firstChild);

    for (const item of items) {
      const isSelected = selected.has(item.value);
      const row = ctx.h('button', {
        class: cls(
          'z-dbllist__item',
          isSelected ? 'z-dbllist__item--selected' : 'z-dbllist__item--available',
          marked.has(item.value) && 'z-dbllist__item--marked',
          item.disabled && 'z-dbllist__item--disabled'
        ),
        type: 'button',
        role: 'option',
        'data-value': item.value,
        'aria-selected': isSelected || marked.has(item.value) ? 'true' : 'false',
        'aria-disabled': item.disabled ? 'true' : 'false',
      });
      row.appendChild(ctx.doc().createTextNode(item.text));
      if (item.disabled) row.setAttribute('disabled', '');
      (isSelected ? rightList : leftList).appendChild(row);
    }

    const hasLeft = leftList.childNodes.length > 0;
    leftEmpty.setAttribute('class', cls('z-dbllist__empty', hasLeft && 'z-hidden'));
    leftEmpty.textContent = hasLeft ? '' : asText(ctx.props.emptyText) || 'Sin opciones';
    const hasRight = rightList.childNodes.length > 0;
    rightEmpty.setAttribute('class', cls('z-dbllist__empty', hasRight && 'z-hidden'));
    rightEmpty.textContent = hasRight ? '' : asText(ctx.props.emptySelectedText) || 'Sin seleccion';
  };

  /**
   * @param {'right'|'left'} direction
   * @param {unknown} [subset]
   * @returns {string[]} los valores movidos
   */
  const move = (direction, subset) => {
    const current = values();
    const selected = new Set(current);
    const pool = items.filter((item) =>
      direction === 'right' ? !selected.has(item.value) : selected.has(item.value)
    );
    const wanted = subset === undefined ? [...marked] : valuesOf(subset);
    const moving = pool
      .filter((item) => wanted.includes(item.value) && !item.disabled)
      .map((item) => item.value);
    if (moving.length === 0) return [];

    const next = direction === 'right'
      ? [...current, ...moving]
      : current.filter((value) => !moving.includes(value));
    marked = new Set();
    ctx.props.value = next;
    paint();
    ctx.emit('change', { value: next.slice(), moved: moving.slice() });
    return moving;
  };

  const update = (props) => {
    const text = asText(props.label);
    label.textContent = text;
    label.setAttribute('class', cls('z-select-control__label', text === '' && 'z-hidden'));
    el.setAttribute(
      'class',
      cls(
        'z-dbllist',
        props.disabled && 'z-dbllist--disabled',
        props.plain && 'z-dbllist--plain'
      )
    );
    leftTitle.textContent = asText(props.leftTitle) || 'Disponibles';
    rightTitle.textContent = asText(props.rightTitle) || 'Seleccionados';
    if (props.disabled) {
      moveRight.setAttribute('disabled', '');
      moveLeft.setAttribute('disabled', '');
      el.setAttribute('aria-disabled', 'true');
    } else {
      moveRight.removeAttribute('disabled');
      moveLeft.removeAttribute('disabled');
      el.removeAttribute('aria-disabled');
    }

    const options = normalizeOptions(props.options);
    const sig = JSON.stringify(options);
    if (sig !== signature) {
      signature = sig;
      items = options;
    }
    paint();

    if (isMeasure(props.width)) setVar(el, '--z-dbllist-width', measureOf(props.width));
    else removeVar(el, '--z-dbllist-width');
    if (isMeasure(props.height)) setVar(el, '--z-dbllist-list-height', measureOf(props.height));
    else removeVar(el, '--z-dbllist-list-height');
  };

  /** @param {unknown} node */
  const itemOfNode = (node) => {
    const value = itemValueOf(node);
    if (value === null) return null;
    return items.find((item) => item.value === value) || null;
  };

  const toggleMark = (item) => {
    if (!item || item.disabled) return;
    if (marked.has(item.value)) marked.delete(item.value);
    else marked.add(item.value);
    paint();
  };

  ctx.on(leftList, 'click', (event) => {
    if (ctx.props.disabled) return;
    toggleMark(itemOfNode(event ? event.target : null));
  });

  ctx.on(rightList, 'click', (event) => {
    if (ctx.props.disabled) return;
    toggleMark(itemOfNode(event ? event.target : null));
  });

  ctx.on(leftList, 'dblclick', (event) => {
    prevent(event);
    if (ctx.props.disabled) return;
    const item = itemOfNode(event ? event.target : null);
    if (item && !item.disabled) move('right', [item.value]);
  });

  ctx.on(rightList, 'dblclick', (event) => {
    prevent(event);
    if (ctx.props.disabled) return;
    const item = itemOfNode(event ? event.target : null);
    if (item && !item.disabled) move('left', [item.value]);
  });

  ctx.on(moveRight, 'click', (event) => {
    prevent(event);
    if (ctx.props.disabled) return;
    move('right');
  });

  ctx.on(moveLeft, 'click', (event) => {
    prevent(event);
    if (ctx.props.disabled) return;
    move('left');
  });

  update(ctx.props);

  return {
    el,
    update,
    destroy() {
      marked = new Set();
    },
    api: {
      /** @returns {string[]} valores seleccionados */
      getValue() {
        return values().slice();
      },
      /**
       * Fija los seleccionados sin emitir eventos. Descarta valores que no
       * esten en `options`.
       * @param {unknown} value
       * @returns {string[]}
       */
      setValue(value) {
        const known = new Set(items.map((item) => item.value));
        const next = [...new Set(valuesOf(value).filter((entry) => known.has(entry)))];
        ctx.props.value = next;
        marked = new Set();
        paint();
        return next.slice();
      },
      /**
       * Mueve a seleccionados los marcados o los valores indicados.
       * @param {unknown} [value]
       * @returns {string[]}
       */
      moveRight(value) {
        return move('right', value);
      },
      /**
       * Quita de seleccionados los marcados o los valores indicados.
       * @param {unknown} [value]
       * @returns {string[]}
       */
      moveLeft(value) {
        return move('left', value);
      },
      /** @returns {string[]} valores disponibles */
      get available() {
        const selected = new Set(values());
        return items.filter((item) => !selected.has(item.value)).map((item) => item.value);
      },
      /** @returns {string[]} valores seleccionados */
      get selected() {
        return values();
      },
      /** @returns {number} cantidad de opciones armadas */
      get count() {
        return items.length;
      },
      /** @returns {Element} lista de disponibles */
      get left() {
        return leftList;
      },
      /** @returns {Element} lista de seleccionados */
      get right() {
        return rightList;
      },
    },
  };
}

define('multicombo', (ctx) =>
  buildControl(ctx, { kind: 'multicombo', editable: true, multiple: true, tags: true }));

define('multiselect', (ctx) =>
  buildControl(ctx, { kind: 'multiselect', multiple: true }));

define('multitext', (ctx) =>
  buildControl(ctx, { kind: 'multitext', editable: true, multiple: true, freeText: true, tags: true }));

define('dbllist', (ctx) => buildDblList(ctx));
