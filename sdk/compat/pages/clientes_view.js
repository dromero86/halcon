/**
 * Pantalla Clientes migrada al shim de Zorzal.
 *
 * Origen: `sdk/app/abm/clientes_view.js` (Webix + plugin `datalist` + query
 * SQL). El original montaba un `datalist` con la query contra `clientes` y el
 * join a `cobradores`; aca los datos salen del store en memoria
 * (`compat/store/clientes.js`), con la misma forma que devolveria la query.
 *
 * Diferencias con el original (ver `sdk/compat/README.md`):
 *  - no hay query SQL ni backend: la tabla se carga con `store.list()`;
 *  - el doble clic sobre una fila abre el formulario. El original abria el
 *    formulario con un clic (`onItemClick` del `datalist`); se conserva el
 *    clic como seleccion y se agrega el doble clic que pide el contrato;
 *  - el orden por columna lo resuelve el `datatable` de Zorzal al hacer clic
 *    en el encabezado (ascendente/descendente);
 *  - el formato de `fingreso` es ISO (`YYYY-MM-DD`), como el
 *    `DATE_FORMAT(...,'%Y-%m-%d')` del original. El `dd/mm/yyyy` que aplicaba
 *    `format` de Webix no se traslada: el shim no emula `format` por columna.
 *
 * Uso:
 *
 *   import { mount } from './pages/clientes_view.js';
 *   mount(document.querySelector('#contenido'));
 *
 * El modulo registra la pantalla como `app.abm.clientes_view` al importarse.
 */

import { webix } from '../webix-shim.js';
import { app } from '../app-shim.js';
import * as store from '../store/clientes.js';

/** Id de la pantalla en el shim de `app`. */
export const PAGE_ID = 'app.abm.clientes_view';

/** Id de la tabla montada. */
export const TABLE_ID = 'clientes_tabla';

/** Id del boton de alta de la barra. */
export const ADD_ID = 'clientes_nuevo';

/**
 * Columnas con la forma que lee el `datatable` de Zorzal. Los `header` son los
 * del original; el orden se resuelve al hacer clic en cada encabezado.
 */
export const COLUMNS = [
  { id: 'cliente', header: 'Cliente', fillspace: true },
  { id: 'addr', header: 'Dirección', fillspace: true },
  { id: 'doc', header: 'DNI', adjust: true },
  { id: 'tel', header: 'Teléfono', width: 150 },
  { id: 'fingreso', header: 'Ingreso', adjust: true },
  { id: 'cobrador', header: 'Cobrador', width: 150 },
];

/**
 * Vacia un contenedor. Las pantallas del ABM se montan en el mismo nodo de
 * contenido, asi que la navegacion reemplaza el contenido anterior.
 * @param {Element} host
 */
function vaciar(host) {
  while (host.firstChild) host.removeChild(host.firstChild);
}

/**
 * Monta la vista dentro de `host`.
 *
 * @param {Element|string} host contenedor o selector
 * @param {{ onOpenForm?: (row: Record<string, unknown>|null) => unknown }} [options]
 * @returns {{
 *   root: Element,
 *   table: any,
 *   openForm: (row?: Record<string, unknown>|null) => unknown,
 *   destroy: () => void,
 * }}
 */
export function mount(host, options = {}) {
  const target = typeof host === 'string' ? document.querySelector(host) : host;
  if (!target || typeof target.appendChild !== 'function') {
    throw new Error('clientes_view.mount: falta el contenedor');
  }

  const root = document.createElement('div');
  root.className = 'hc-page hc-page--clientes';
  root.dataset.page = PAGE_ID;
  target.appendChild(root);

  /**
   * Abre el formulario en el mismo contenedor. Sin fila es un alta; con fila
   * es una edicion. Al guardar o volver, el formulario remonta esta vista.
   *
   * @param {Record<string, unknown>|null} [row]
   * @returns {unknown}
   */
  function openForm(row = null) {
    const id = row && row.id !== undefined ? row.id : null;
    if (typeof options.onOpenForm === 'function') return options.onOpenForm(row || null);

    const page = app.require('app.abm.clientes_form');
    vaciar(target);
    return page.mount(target, {
      id,
      onSaved: () => mount(target),
      onBack: () => mount(target),
    });
  }

  const toolbar = webix.ui(
    {
      id: 'clientes_barra',
      view: 'toolbar',
      cols: [
        { view: 'label', label: 'Clientes' },
        { view: 'spacer' },
        {
          id: ADD_ID,
          view: 'button',
          value: 'Nuevo cliente',
          icon: 'fa-plus',
          click: () => openForm(null),
        },
      ],
    },
    root
  );

  const table = webix.ui(
    {
      id: TABLE_ID,
      view: 'datatable',
      columns: COLUMNS,
      data: store.list(),
    },
    root
  );

  // El `datatable` de Zorzal emite `select` con un clic, no emite doble clic.
  // El listener va sobre el contenedor del widget (no sobre las filas), asi
  // sobrevive a los reordenamientos y a los cambios de datos.
  const onDoubleClick = (event) => {
    const row = event.target && typeof event.target.closest === 'function' ? event.target.closest('tr[data-id]') : null;
    if (!row || !table.el.contains(row)) return;
    const fila = store.getById(row.getAttribute('data-id'));
    if (fila) openForm(fila);
  };
  if (table.el && typeof table.el.addEventListener === 'function') {
    table.el.addEventListener('dblclick', onDoubleClick);
  }

  const hint = document.createElement('p');
  hint.className = 'hc-page__hint';
  hint.textContent = 'Doble clic en una fila para editar.';
  root.appendChild(hint);

  return {
    root,
    table,
    toolbar,
    openForm,
    destroy() {
      if (table.el && typeof table.el.removeEventListener === 'function') {
        table.el.removeEventListener('dblclick', onDoubleClick);
      }
      if (toolbar && typeof toolbar.destroy === 'function') toolbar.destroy();
      if (table && typeof table.destroy === 'function') table.destroy();
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

/**
 * Definicion en el shim de `app`. La factory no toca el DOM.
 */
app.define(PAGE_ID, () => ({ mount }));

export default { mount, COLUMNS };
