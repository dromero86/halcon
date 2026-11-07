/**
 * Formulario de Clientes sobre los widgets de Zorzal.
 *
 * Origen: `sdk/app/abm/clientes_form.js` (SDK heredado + plugin `formview` +
 * payload al backend). El original pedia la fila con `__.GET`/`__.PAYLOAD`,
 * validaba con las reglas del SDK heredado y publicaba con `__.sendPost`; aca
 * el alta y la modificacion van al store en memoria
 * (`compat/store/clientes.js`).
 *
 * Campos: nombre, apellido, direccion, DNI, telefono, fecha de ingreso y
 * cobrador. Las altas sin fecha de ingreso la reciben del store (hoy) y las
 * modificaciones conservan la de la fila.
 *
 * Validacion: `sdk/src/rules/clientes.js` declara las reglas por campo y el
 * formulario las pasa en la prop `rules` del widget `form`. Ademas de la
 * obligatoriedad hay formato: DNI de 7 a 9 digitos, telefono opcional con
 * digitos, espacios, guiones y parentesis (6 a 20), fecha de ingreso real en
 * `AAAA-MM-DD` o vacia, y email con arroba y punto si el formulario incorpora
 * el campo. Cada campo invalido se marca con `aria-invalid`, el mensaje se
 * asocia con `aria-describedby` y se pinta debajo del campo; con mas de un
 * error se agrega un resumen al inicio del formulario con un enlace por campo.
 *
 * Guardado: el boton se deshabilita y pasa a `Guardando...` mientras se
 * escribe el store; despues se despacha `CustomEvent('clientes:guardado')` en
 * la raiz de la pantalla, con la fila y el total de filas en `detail`, y el
 * boton vuelve a `Guardar` al terminar la tarea.
 *
 * Cancelacion: `Cancelar` y la tecla Escape cierran la pantalla; si el
 * formulario tiene cambios respecto de los valores iniciales piden
 * confirmacion primero.
 *
 * Uso:
 *
 *   import { mount } from './pages/clientes_form.js';
 *   mount(document.querySelector('#contenido'), { id: 3 });
 *
 * Sin `id` es un alta. `onSaved` y `onBack` permiten decidir a donde volver;
 * por omision se remonta `app.abm.clientes_view` en el mismo contenedor.
 * `confirm` permite inyectar la confirmacion de descarte (por omision
 * `globalThis.confirm`); sin una funcion de confirmacion disponible no se
 * descartan cambios.
 */

import { create } from '../../vendor/zorzal/src/zorzal.js';
import { app } from '../app-shim.js';
import * as store from '../store/clientes.js';
import { ORDEN, REGLAS, validar } from '../../src/rules/clientes.js';

/** Id de la pantalla en el registro de `app`. */
export const PAGE_ID = 'app.abm.clientes_form';

/** Id del formulario montado. */
export const FORM_ID = 'clientes_form';

/** Id del boton de guardado. */
export const SAVE_ID = 'clientes_guardar';

/** Id del boton de volver. */
export const BACK_ID = 'clientes_volver';

/** Texto del boton de guardado en reposo. */
export const TEXTO_GUARDAR = 'Guardar';

/** Texto del boton de guardado mientras se escribe la fila. */
export const TEXTO_GUARDANDO = 'Guardando...';

/** Pregunta de la confirmacion de descarte. */
export const MENSAJE_DESCARTE = 'Hay cambios sin guardar. ¿Descartarlos?';

/** Campos de texto, en el orden del formulario. */
export const CAMPOS = [
  { name: 'apellido', label: 'Apellidos', placeholder: 'Apellidos' },
  { name: 'nombre', label: 'Nombres', placeholder: 'Nombres' },
  { name: 'addr', label: 'Dirección', placeholder: 'Calle y numero' },
  { name: 'doc', label: 'DNI', placeholder: 'Documento' },
  { name: 'tel', label: 'Teléfono', placeholder: 'Telefono' },
  { name: 'fingreso', label: 'Ingreso', placeholder: 'AAAA-MM-DD' },
];

/** Campos con validacion obligatoria. */
export const OBLIGATORIOS = ['apellido', 'nombre', 'addr', 'doc', 'id_cobrador'];

/** Id del parrafo de error de un campo. */
function errorId(name) {
  return `clientes-error-${name}`;
}

/** Id del control de un campo, destino del enlace del resumen. */
function campoId(name) {
  return `clientes-campo-${name}`;
}

/**
 * Vacia un contenedor antes de montar la pantalla siguiente.
 * @param {Element} host
 */
function vaciar(host) {
  while (host.firstChild) host.removeChild(host.firstChild);
}

/**
 * Texto recortado; cualquier valor ausente queda como cadena vacia.
 * @param {unknown} valor
 * @returns {string}
 */
function texto(valor) {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
}

/**
 * Crea el nodo con el mensaje de error de un campo. Va en el contenedor del
 * campo, debajo del control, y reutiliza el estilo `z-field__error` del
 * vendor.
 *
 * @param {string} name
 * @returns {Element}
 */
function crearError(name) {
  const error = document.createElement('span');
  error.setAttribute('class', 'z-field__error hc-field__error');
  error.setAttribute('id', errorId(name));
  error.hidden = true;
  return error;
}

/**
 * Monta el formulario dentro de `host`.
 *
 * @param {Element|string} host contenedor o selector
 * @param {{
 *   id?: number|string|null,
 *   onSaved?: (row: Record<string, unknown>) => unknown,
 *   onBack?: () => unknown,
 *   confirm?: (mensaje: string) => boolean,
 * }} [options]
 * @returns {{
 *   root: Element,
 *   form: any,
 *   toolbar: any,
 *   save: () => boolean,
 *   cancel: () => boolean,
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

  let guardando = false;
  let inicial = {};

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

  const campos = CAMPOS.map((campo) => create({ kind: 'text', ...campo }));

  const selectCobrador = create({
    id: 'clientes_cobrador',
    kind: 'select',
    name: 'id_cobrador',
    label: 'Cobrador',
    placeholder: 'Elegir cobrador',
    options: store.cobradorOptions(),
  });

  const guardarBoton = create({
    id: SAVE_ID,
    name: SAVE_ID,
    kind: 'button',
    text: TEXTO_GUARDAR,
    icon: 'save',
    on: { click: () => guardar() },
  });

  const volverBoton = create({
    id: BACK_ID,
    name: BACK_ID,
    kind: 'button',
    text: 'Cancelar',
    icon: 'chevron-left',
    on: { click: () => cancelar() },
  });

  const toolbar = create({
    kind: 'toolbar',
    items: [
      volverBoton,
      create({ kind: 'label', text: titulo }),
      create({ kind: 'spacer', flex: true }),
      guardarBoton,
    ],
  });

  const form = create({
    id: FORM_ID,
    kind: 'form',
    fields: [toolbar, ...campos, selectCobrador],
    rules: REGLAS,
  });

  const resumen = document.createElement('div');
  resumen.setAttribute('class', 'hc-resumen');
  resumen.setAttribute('role', 'alert');
  resumen.hidden = true;
  root.appendChild(resumen);
  root.appendChild(form.el);

  /**
   * Controles con mensaje propio: el nombre del campo, la instancia, el
   * `<input>` que recibe los atributos ARIA y el nodo del mensaje de error.
   * @type {{ name: string, instancia: any, input: HTMLInputElement, error: Element }[]}
   */
  const controles = [];
  const etiquetas = new Map();
  for (const campo of CAMPOS) etiquetas.set(campo.name, campo.label);
  etiquetas.set('id_cobrador', 'Cobrador');

  /**
   * Envuelve el nodo del widget en un contenedor con su mensaje de error
   * debajo del control. El mensaje queda fuera del `<label>` del campo para
   * que no forme parte de su nombre accesible.
   *
   * @param {any} instancia
   * @returns {Element} el contenedor
   */
  function envolver(instancia) {
    const envoltorio = document.createElement('div');
    envoltorio.setAttribute('class', 'hc-campo');
    const padre = instancia.el.parentNode;
    padre.insertBefore(envoltorio, instancia.el);
    envoltorio.appendChild(instancia.el);
    return envoltorio;
  }

  /**
   * Registra un control del formulario y le agrega su mensaje de error.
   * @param {string} name
   * @param {any} instancia
   */
  function registrar(name, instancia) {
    if (!instancia || !instancia.el) return;
    const input = instancia.input || instancia.el.querySelector('input');
    if (!input) return;
    const error = crearError(name);
    envolver(instancia).appendChild(error);
    input.setAttribute('id', campoId(name));
    input.setAttribute('aria-invalid', 'false');
    controles.push({ name, instancia, input, error });
  }

  for (const campo of campos) registrar(campo.props.name, campo);
  registrar('id_cobrador', selectCobrador);

  /** @param {string} name @returns {any|null} */
  function controlDe(name) {
    const encontrado = controles.find((control) => control.name === name);
    return encontrado || null;
  }

  /** @param {string} name */
  function enfocar(name) {
    const control = controlDe(name);
    if (!control) return;
    if (typeof control.input.focus === 'function') control.input.focus();
  }

  /**
   * Pinta el mensaje de cada error debajo de su campo y sincroniza los
   * atributos ARIA del control.
   *
   * @param {{ errors: Record<string, string>, orden: string[] }} resultado
   */
  function pintarErrores(resultado) {
    for (const control of controles) {
      const mensaje = resultado.errors[control.name] || '';
      control.error.textContent = mensaje;
      control.error.hidden = mensaje === '';
      control.input.setAttribute('aria-invalid', mensaje === '' ? 'false' : 'true');
      if (mensaje === '') control.input.removeAttribute('aria-describedby');
      else control.input.setAttribute('aria-describedby', errorId(control.name));
      control.instancia.set({ invalid: mensaje !== '', error: mensaje });
    }
  }

  /**
   * Pinta el resumen de errores al inicio del formulario cuando hay mas de
   * uno, con un enlace que lleva el foco a cada campo.
   *
   * @param {{ errors: Record<string, string>, orden: string[] }} resultado
   */
  function pintarResumen(resultado) {
    while (resumen.firstChild) resumen.removeChild(resumen.firstChild);
    const nombres = new Set(controles.map((control) => control.name));
    const errores = resultado.orden.filter(
      (name) => Boolean(resultado.errors[name]) && nombres.has(name)
    );
    if (errores.length <= 1) {
      resumen.hidden = true;
      return;
    }

    resumen.hidden = false;
    const titulo = document.createElement('p');
    titulo.setAttribute('class', 'hc-resumen__titulo');
    titulo.textContent = `Hay ${errores.length} campos para corregir:`;
    const lista = document.createElement('ul');
    lista.setAttribute('class', 'hc-resumen__lista');

    for (const name of errores) {
      const item = document.createElement('li');
      const enlace = document.createElement('a');
      enlace.setAttribute('class', 'hc-resumen__enlace');
      enlace.setAttribute('href', `#${campoId(name)}`);
      enlace.textContent = `${etiquetas.get(name) || name}: ${resultado.errors[name]}`;
      enlace.addEventListener('click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        enfocar(name);
      });
      item.appendChild(enlace);
      lista.appendChild(item);
    }

    resumen.appendChild(titulo);
    resumen.appendChild(lista);
  }

  /**
   * Quita mensajes, resumen y marcas de error.
   */
  function limpiarErrores() {
    pintarErrores({ errors: {}, orden: [] });
    pintarResumen({ errors: {}, orden: [] });
  }

  /**
   * Indica si el formulario difiere de los valores con los que se monto.
   * @returns {boolean}
   */
  function hayCambios() {
    const valores = form.getValues();
    return Object.keys(inicial).some((name) => texto(valores[name]) !== texto(inicial[name]));
  }

  /**
   * Pide confirmacion para descartar cambios. Usa `options.confirm` si vino y
   * `globalThis.confirm` si no; sin ninguna de las dos no se descarta nada.
   * @returns {boolean}
   */
  function confirmarDescarte() {
    if (typeof options.confirm === 'function') return options.confirm(MENSAJE_DESCARTE) !== false;
    if (typeof globalThis.confirm === 'function') return globalThis.confirm(MENSAJE_DESCARTE) !== false;
    return false;
  }

  /**
   * Cancela la edicion: cierra directo si no hay cambios y pide confirmacion
   * si los hay.
   * @returns {boolean} `true` si cerro
   */
  function cancelar() {
    if (hayCambios() && !confirmarDescarte()) return false;
    back();
    return true;
  }

  /**
   * Valida y guarda. Agrega si no hay fila en edicion; actualiza si la hay.
   * @returns {boolean} `true` si guardo
   */
  function guardar() {
    if (guardando) return false;

    const valores = form.getValues();
    const resultado = validar(valores);
    form.validate();

    if (!resultado.valid) {
      pintarErrores(resultado);
      pintarResumen(resultado);
      const primero = resultado.orden.find((name) => Boolean(resultado.errors[name]) && controlDe(name));
      if (primero) enfocar(primero);
      return false;
    }

    limpiarErrores();
    guardando = true;
    guardarBoton.set({ disabled: true, text: TEXTO_GUARDANDO });

    try {
      const guardado = store.save({ id: actual ? actual.id : null, ...valores });
      inicial = form.getValues();

      root.dispatchEvent(
        new CustomEvent('clientes:guardado', {
          bubbles: true,
          detail: { cliente: guardado, filas: store.list().length },
        })
      );

      if (typeof options.onSaved === 'function') options.onSaved(guardado);
      else back();
      return true;
    } finally {
      queueMicrotask(() => {
        guardando = false;
        guardarBoton.set({ disabled: false, text: TEXTO_GUARDAR });
      });
    }
  }

  /**
   * Escape hace lo mismo que Cancelar.
   * @param {KeyboardEvent} event
   */
  function manejarTecla(event) {
    if (!event || event.key !== 'Escape') return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    cancelar();
  }

  root.addEventListener('keydown', manejarTecla);

  if (actual) {
    form.setValues({
      apellido: actual.apellido,
      nombre: actual.nombre,
      addr: actual.addr,
      doc: actual.doc,
      tel: actual.tel,
      fingreso: actual.fingreso,
      id_cobrador: actual.id_cobrador,
    });
  }

  inicial = form.getValues();

  const primero = form.field('apellido');
  if (primero && primero.input && typeof primero.input.focus === 'function') primero.input.focus();

  return {
    root,
    form,
    toolbar,
    save: guardar,
    cancel: cancelar,
    back,
    destroy() {
      root.removeEventListener('keydown', manejarTecla);
      form.destroy();
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

/**
 * Definicion en el registro de `app`. La factory no toca el DOM.
 */
app.define(PAGE_ID, () => ({ mount }));

export default { mount, CAMPOS };
