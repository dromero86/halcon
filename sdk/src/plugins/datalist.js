/**
 * Plugin `datalist` como kind de Zorzal.
 *
 * Origen: `sdk/sys/plugins/datalist.js`. El port conserva la barra de
 * herramientas, el alta y la navegacion al formulario, la carga por `query` /
 * `url` / `json` y el guard de "cargar una sola vez".
 *
 * El kind se registra con `define('datalist', factory)` y arma un `layout`
 * vertical con una `toolbar` y el widget de datos (`datatable` por omision, o
 * el `kind` que indique `data_type`).
 *
 * API del plugin:
 *
 *  - props: `title`, `store`, `form`, `data_type`, `data_id`, `columns`,
 *    `json`, `query`, `url`, `back`.
 *  - metodos: `export_to_excel()` y `load()`.
 *  - instancias expuestas: `table`, `toolbar`.
 *
 * Degradaciones: `toExcel` no esta implementado y devuelve `false`; el menu
 * contextual de exportacion no se monta (la accion queda en
 * `export_to_excel()`); el evento `select` del datatable de Zorzal reemplaza a
 * `onItemClick`; `parse()`, `resize()` y `getItem()` no existen en el widget
 * nativo y no se emulan; `footer` no se traslada.
 */

import { create, define } from '../../vendor/zorzal/src/zorzal.js';
import { __ } from '../../compat/globals.js';

/**
 * Exportacion a planilla: fuera de alcance en el port.
 * @param {unknown} table
 * @param {Record<string, unknown>} [options]
 * @returns {false}
 */
export function toExcel(table, options = {}) {
  console.warn('[datalist] toExcel no esta implementado: la exportacion a Excel queda fuera del port');
  return false;
}

/**
 * @param {unknown} response
 * @returns {unknown[]}
 */
function asRows(response) {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && Array.isArray(response.data)) return response.data;
  return [];
}

define('datalist', (ctx) => {
  const props = ctx.props;
  __.setTitle(props.title);

  const dataId = props.data_id !== undefined ? props.data_id : `_dt_${Date.now()}`;
  const dataKind = props.data_type !== undefined ? props.data_type : 'datatable';

  /**
   * Abre el formulario con la fila elegida, como el `onItemClick` original.
   * Navega con el callback `props.openForm`; sin callback solo avisa.
   * @param {{ item?: Record<string, any> }} [payload]
   */
  const onSelect = (payload) => {
    const item = payload && payload.item ? payload.item : null;
    if (!item || item.folder === true) return;
    __.current[props.store] = item;
    if (typeof props.openForm === 'function') props.openForm(item);
    else console.warn(`[datalist] sin props.openForm: no se abre "${props.form}"`);
  };

  const table = create({
    id: dataId,
    kind: dataKind,
    columns: props.columns,
    data: asRows(props.json),
    on: { select: onSelect },
  });

  const title = create({ kind: 'label', text: props.title });

  const toolbar = create({
    kind: 'toolbar',
    items: [
      create({
        id: `btn_left_${props.store}`,
        name: `btn_left_${props.store}`,
        kind: 'button',
        icon: 'chevron-left',
        title: 'Volver',
        on: {
          click: () => {
            if (typeof props.back === 'function') return props.back();
            console.warn('[datalist] sin props.back: no se navega al dashcenter');
            return false;
          },
        },
      }),
      title,
      create({ id: `${props.store}_combo`, kind: 'spacer' }),
      create({ id: `${props.store}_extra`, kind: 'spacer', flex: true }),
      create({ id: `${props.store}_extra_b`, kind: 'spacer' }),
      create({
        id: `btn_add_${props.store}`,
        name: `btn_add_${props.store}`,
        kind: 'button',
        icon: 'plus',
        title: 'Nuevo',
        on: {
          click: () => {
            delete __.current[props.store];
            if (typeof props.openForm === 'function') props.openForm(null);
            else console.warn(`[datalist] sin props.openForm: no se abre "${props.form}"`);
          },
        },
      }),
    ],
  });
  toolbar.el.classList.add('toolbar-interior');

  const root = create({ kind: 'layout', orientation: 'vertical', children: [toolbar, table] });
  root.el.classList.add('data-view');

  let loaded = false;

  /** Carga inicial de la tabla, una sola vez. */
  const load = () => {
    if (loaded === true) return;
    loaded = true;

    if (typeof table.setData !== 'function') {
      console.warn('[datalist] la vista de datos no soporta setData: no se cargan filas');
      return;
    }

    const done = (rows) => table.setData(rows);

    if (props.query !== undefined) {
      __.PAYLOAD({ action: 'databot' }, props.query, (response) => {
        let parsed = null;
        try {
          parsed = JSON.parse(response);
        } catch (error) {
          console.warn('[datalist] la respuesta de PAYLOAD no es JSON');
        }
        done(asRows(parsed));
      });
      return;
    }

    if (props.url !== undefined) {
      __.GET(props.url, (response) => done(asRows(response)));
      return;
    }

    done(asRows(props.json));
  };

  const exportToExcel = () =>
    toExcel(table, {
      filename: props.store,
      name: props.store,
      filterHTML: true,
    });

  queueMicrotask(load);

  return {
    el: root.el,
    update() {},
    destroy() {
      root.destroy();
    },
    api: {
      /** @returns {any} widget de datos montado */
      get table() {
        return table;
      },
      /** @returns {any} toolbar del plugin */
      get toolbar() {
        return toolbar;
      },
      /** @returns {string} id del widget de datos */
      get data_id() {
        return dataId;
      },
      export_to_excel: exportToExcel,
      load,
    },
  };
});

export default 'datalist';
