/**
 * Plugin `datalist` portado a modulo ES sobre el shim de Zorzal.
 *
 * Origen: `sdk/sys/plugins/datalist.js` (Webix + globales de la aplicacion).
 * El port conserva la barra de herramientas, el alta y la navegacion al
 * formulario, la carga por `query` / `url` / `json` y el guard de "cargar una
 * sola vez".
 *
 * Degradaciones (ver `sdk/compat/README.md`):
 *  - `toExcel` es un no-op que devuelve `false` y avisa: la exportacion a
 *    planilla queda fuera de alcance;
 *  - el menu contextual de Webix no se monta; la accion de exportar queda en
 *    el metodo `export_to_excel`;
 *  - `onItemClick` (Webix) se reemplaza por el evento `select` del datatable de
 *    Zorzal, que entrega `{ id, item }`;
 *  - `parse()`, `resize()` y `getItem()` no existen en el datatable de Zorzal:
 *    se usa `setData()` y se avisa por consola cuando faltan las otras.
 */

import { webix } from '../webix-shim.js';
import { __, app } from '../globals.js';

/**
 * Exportacion a planilla: fuera de alcance en el port.
 * @param {unknown} table
 * @param {Record<string, unknown>} [options]
 * @returns {false}
 */
export function toExcel(table, options = {}) {
  console.warn('[datalist] toExcel no esta implementado: la exportacion a Excel queda fuera del shim');
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

webix.protoUI(
  {
    name: 'datalist',

    /**
     * @param {Record<string, any>} config
     */
    $init(config) {
      __.setTitle(config.title);

      this.data_id = config.data_id !== undefined ? config.data_id : '_dt_' + +new Date();

      const dataId = this.data_id;

      const back_default = function () {
        const session = __.get_user();

        if (session !== false) {
          app.require(session.dashcenter);
        } else {
          console.warn('[datalist] back por omision sin sesion: no hay dashcenter');
        }
      };

      const onItemClick = function (data) {
        const item = data && typeof data === 'object' && data.item ? data.item : null;
        if (!item) return;
        if (item.folder === true) return;

        __.current[config.store] = item;
        app.require(config.form);
      };

      config.type = 'space';
      config.css = 'data-view';
      config.rows = [
        {
          view: 'toolbar',
          css: 'toolbar-interior',
          cols: [
            {
              id: 'btn_left_' + config.store,
              view: 'button',
              type: 'icon',
              icon: 'chevron-left',
              width: 45,
              align: 'center',
              css: 'app_button',
              borderless: true,
              click: config.back !== undefined ? config.back : back_default,
            },
            { view: 'label', label: config.title },
            { id: config.store + '_combo', width: 1 },
            { id: config.store + '_extra', width: 1 },
            { id: config.store + '_extra_b', width: 1 },
            {
              id: 'btn_add_' + config.store,
              view: 'button',
              type: 'icon',
              icon: 'plus',
              width: 45,
              align: 'center',
              css: 'app_button',
              borderless: true,
              click() {
                delete __.current[config.store];
                app.require(config.form);
              },
            },
          ],
        },
        {
          id: dataId,
          view: config.data_type !== undefined ? config.data_type : 'datatable',
          resizeColumn: true,
          navigation: true,
          select: 'row',
          columns: config.columns,
          flag: false,
          footer: config.footer !== undefined ? config.footer : false,
          data: config.json,
          on: {
            select: onItemClick,
          },
        },
      ];

      this.$ready.push(this.on_render);
      this.$ready.push(this.load);
    },

    on_render() {},

    /**
     * Carga inicial de la tabla. En el original corria en `onAfterRender`; aca
     * corre una vez despues del montaje, con un guard equivalente a
     * `table.config.flag`.
     */
    load() {
      if (this.loaded === true) return;
      this.loaded = true;

      const config = this.config;
      const table = webix.$$(this.data_id);
      if (!table) {
        console.warn(`[datalist] no se encontro la tabla "${this.data_id}"`);
        return;
      }

      if (typeof table.setData !== 'function') {
        console.warn('[datalist] la vista de datos no soporta setData: no se cargan filas');
        return;
      }

      const done = (rows) => {
        table.setData(rows);
        if (typeof table.resize === 'function') table.resize();
        else console.warn('[datalist] resize() no esta en el datatable del shim: se omite');
      };

      if (config.query !== undefined) {
        if (typeof table.show !== 'function') webix.extend(table, webix.ProgressBar);
        if (typeof table.show === 'function') table.show();

        __.PAYLOAD({ action: 'databot' }, config.query, function (response) {
          let parsed = null;
          try {
            parsed = JSON.parse(response);
          } catch (error) {
            console.warn('[datalist] la respuesta de PAYLOAD no es JSON');
          }
          done(asRows(parsed));
          if (typeof table.hide === 'function') table.hide();
        });
      } else if (config.url !== undefined) {
        __.GET(config.url, function (response) {
          done(asRows(response));
        });
      } else {
        done(asRows(config.json));
      }

      console.warn('[datalist] sin menu contextual: la exportacion a Excel queda en export_to_excel()');
    },

    /**
     * Equivalente al item "Exportar a excel" del menu contextual original.
     * @returns {false}
     */
    export_to_excel() {
      const table = webix.$$(this.data_id);
      return toExcel(table, {
        filename: this.store,
        name: this.store,
        filterHTML: true,
      });
    },

    title_setter(value) {
      this.title = value;
    },
    query_setter(value) {
      this.query = value;
    },
    form_setter(value) {
      this.form = value;
    },
    store_setter(value) {
      this.store = value;
    },
    columns_setter(value) {
      this.columns = value;
    },
  },
  webix.ui.layout
);

export default 'datalist';
