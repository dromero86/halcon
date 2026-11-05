/**
 * Formulario de Clientes migrado al shim de Zorzal.
 *
 * Origen: `sdk/app/abm/clientes_form.js` (Webix + plugin `formview` + payload
 * al backend). El original pedia la fila con `__.GET`/`__.PAYLOAD`, validaba
 * con las reglas de Webix y publicaba con `__.sendPost`; aca el alta y la
 * modificacion van al store en memoria (`compat/store/clientes.js`).
 *
 * Campos (los seis del contrato): nombre, apellido, direccion, DNI, telefono y
 * cobrador. La fecha de ingreso no se edita: las altas la reciben del store
 * (hoy) y las modificaciones conservan la de la fila.
 *
 * Validacion: `nombre`, `apellido`, `addr`, `doc` e `id_cobrador` son
 * obligatorios. Se declaran en `rules` del formulario de Zorzal
 * (`webix.rules.required()`); el telefono queda opcional. Si la validacion
 * falla se pinta el error en cada campo y se avisa con `webix.message`.
 *
 * Guardado: `store.save()` agrega o actualiza la fila y emite `save`; ademas
 * se despacha un `CustomEvent('clientes:guardado')` en la raiz de la pantalla,
 * con la fila y el total de filas en `detail`, para que el piloto (o la
 * aplicacion) lo escuche sin acoplarse al store.
 *
 * Uso:
 *
 *   import { mount } from './pages/clientes_form.js';
 *   mount(document.querySelector('#contenido'), { id: 3 });
 *
 * Sin `id` es un alta. `onSaved` y `onBack` permiten decidir a donde volver;
 * por omision se remonta `app.abm.clientes_view` en el mismo contenedor.
 */

import { webix } from '../webix-shim.js';
import { app } from '../app-shim.js';
import * as store from '../store/clientes.js';

/** Id de la pantalla en el shim de `app`. */
export const PAGE_ID = 'app.abm.clientes_form';

/** Id del formulario montado. */
export const FORM_ID = 'clientes_form';

/** Id del boton de guardado. */
export const SAVE_ID = 'clientes_guardar';

/** Id del boton de volver. */
export const BACK_ID = 'clientes_volver';

/** Campos de texto, en el orden del formulario. */
export const CAMPOS = [
  { name: 'apellido', label: 'Apellidos', placeholder: 'Apellidos' },
  { name: 'nombre', label: 'Nombres', placeholder: 'Nombres' },
  { name: 'addr', label: 'Dirección', placeholder: 'Calle y numero' },
  { name: 'doc', label: 'DNI', placeholder: 'Documento' },
  { name: 'tel', label: 'Teléfono', placeholder: 'Telefono' },
];

/** Campos con validacion obligatoria. */
export const OBLIGATORIOS = ['apellido', 'nombre', 'addr', 'doc', 'id_cobrador'];

/**
 * Vacia un contenedor antes de montar la pantalla siguiente.
 * @param {Element} host
 */
function vaciar(host) {
  while (host.firstChild) host.removeChild(host.firstChild);
}

/**
 * Monta el formulario dentro de `host`.
 *
 * @param {Element|string} host contenedor o selector
 * @param {{
 *   id?: number|string|null,
 *   onSaved?: (row: Record<string, unknown>) => unknown,
 *   onBack?: () => unknown,
 * }} [options]
 * @returns {{
 *   root: Element,
 *   form: any,
 *   save: () => boolean,
 *   back: () => unknown,
 *   destroy: () => void,
 * }}
 */
export function mount(host, options = {}) {
  const target = typeof host === 'string' ? document.querySelector(host) : host;
  if (!target || typeof target.appendChild !== 'function') {
    throw new Error('clientes_form.mount: falta el contenedor');
  }

  const editando = options.id !== undefined && options.id !== null && options.id !== '';
  const actual = editando ? store.getById(options.id) : null;
  const titulo = actual ? `CLIENTE: ${actual.cliente}` : 'NUEVO CLIENTE';

  const root = document.createElement('div');
  root.className = 'hc-page hc-page--clientes-form';
  root.dataset.page = PAGE_ID;
  target.appendChild(root);

  /**
   * Vuelve a la vista, o al callback que haya pasado quien monto.
   * @returns {unknown}
   */
  function back() {
    if (typeof options.onBack === 'function') return options.onBack();
    const page = app.require('app.abm.clientes_view');
    vaciar(target);
    return page.mount(target);
  }

  /**
   * Valida y guarda. Agrega si no hay fila en edicion; actualiza si la hay.
   * @returns {boolean} `true` si guardo
   */
  function save() {
    const form = webix.$$(FORM_ID);
    if (!form) {
      console.warn('[compat/pages/clientes_form] el formulario no esta montado');
      return false;
    }

    const valido = form.validate() === true;
    if (!valido) {
      webix.message({ type: 'error', text: 'Complete los campos obligatorios' });
      return false;
    }

    const valores = form.getValues();
    const guardado = store.save({ id: actual ? actual.id : null, ...valores });

    root.dispatchEvent(
      new CustomEvent('clientes:guardado', {
        bubbles: true,
        detail: { cliente: guardado, filas: store.list().length },
      })
    );

    if (typeof options.onSaved === 'function') options.onSaved(guardado);
    else back();
    return true;
  }

  const reglas = {};
  for (const campo of OBLIGATORIOS) {
    reglas[campo] = webix.rules.required(`Complete ${campo}`);
  }

  const toolbar = webix.ui(
    {
      id: 'clientes_form_barra',
      view: 'toolbar',
      cols: [
        {
          id: BACK_ID,
          view: 'button',
          value: 'Volver',
          icon: 'fa-chevron-left',
          click: () => back(),
        },
        { view: 'label', label: titulo },
        { view: 'spacer' },
        {
          id: SAVE_ID,
          view: 'button',
          value: 'Guardar',
          icon: 'save',
          click: () => save(),
        },
      ],
    },
    root
  );

  const formView = webix.ui(
    {
      id: FORM_ID,
      view: 'form',
      elements: [
        ...CAMPOS.map((campo) => ({ view: 'text', ...campo })),
        {
          id: 'clientes_cobrador',
          view: 'select',
          name: 'id_cobrador',
          label: 'Cobrador',
          placeholder: 'Elegir cobrador',
          options: store.cobradorOptions(),
        },
      ],
      rules: reglas,
    },
    root
  );

  const form = webix.$$(FORM_ID);
  if (form && actual && typeof form.setValues === 'function') {
    form.setValues({
      apellido: actual.apellido,
      nombre: actual.nombre,
      addr: actual.addr,
      doc: actual.doc,
      tel: actual.tel,
      id_cobrador: actual.id_cobrador,
    });
  }

  const primero = form && typeof form.field === 'function' ? form.field('apellido') : null;
  if (primero && primero.input && typeof primero.input.focus === 'function') primero.input.focus();

  return {
    root,
    form,
    save,
    back,
    destroy() {
      if (toolbar && typeof toolbar.destroy === 'function') toolbar.destroy();
      if (formView && typeof formView.destroy === 'function') formView.destroy();
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

/**
 * Definicion en el shim de `app`. La factory no toca el DOM.
 */
app.define(PAGE_ID, () => ({ mount }));

export default { mount, CAMPOS };
