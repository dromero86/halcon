/**
 * Pantalla Clientes sobre los widgets de Zorzal.
 *
 * Origen: `sdk/app/abm/clientes_view.js` (SDK heredado + plugin `datalist` +
 * query SQL). El original montaba un `datalist` con la query contra `clientes`
 * y el join a `cobradores`; aca las filas salen de la API JSON del emulador
 * (`GET /api/clientes`) y se copian al store en memoria
 * (`compat/store/clientes.js`), con la misma forma que devolveria la query.
 *
 * Carga: la primera pantalla que se monta en la pagina pide
 * `session.fetch('/api/clientes')` y copia las filas al store; despues manda
 * el store, que es el que recibe las altas y bajas del ABM. `reiniciarCarga()`
 * vuelve a habilitar el pedido (el piloto lo llama al cerrar sesion).
 *
 * Respuestas que no son 200:
 *
 *  - `401`: mensaje de sesion vencida y evento `halcon:sesion-vencida` para
 *    que el shell vuelva al login;
 *  - `403`: aviso de falta de permiso; el listado sigue usable con las filas
 *    que ya tenia y no se desmonta nada;
 *  - error de red o cualquier otro estado: aviso y datos locales.
 *
 * Diferencias con el original:
 *
 *  - no hay query SQL: el listado se arma con `store.list()`;
 *  - el doble clic sobre una fila abre el formulario;
 *  - la tabla es propia (DOM + las clases del theme `hc-table`), porque el
 *    `datatable` de Zorzal no renderiza nada mas que texto y esta pantalla
 *    necesita checkbox por fila;
 *  - la barra de herramientas y el boton de baja siguen siendo widgets de
 *    Zorzal (`toolbar`, `button`);
 *  - busqueda, orden, paginacion y seleccion viven en el estado del listado y
 *    se recalculan sobre el store con las funciones puras de
 *    `compat/store/clientes_listado.js`: no se reconsulta nada por tecla;
 *  - `Dar de baja` borra las filas del store en memoria (`store.remove`); la
 *    baja logica corresponde al backend.
 *
 * Uso:
 *
 *   import { mount } from './pages/clientes_view.js';
 *   mount(document.querySelector('#contenido'));
 *
 * El modulo registra la pantalla como `app.abm.clientes_view` al importarse.
 */

import { create } from '../../vendor/zorzal/src/zorzal.js';
import { app } from '../app-shim.js';
import { getSession } from '../session-shim.js';
import * as store from '../store/clientes.js';
import {
  POR_PAGINA,
  POR_PAGINA_DEFAULT,
  filtrar,
  ordenar,
  paginar,
  contar,
  siguienteOrden,
  estadoInicial,
  alternarSeleccion,
  seleccionarFilas,
} from '../store/clientes_listado.js';

/** Id de la pantalla en el registro de `app`. */
export const PAGE_ID = 'app.abm.clientes_view';

/** Id de la tabla montada. */
export const TABLE_ID = 'clientes_tabla';

/** Id del boton de alta de la barra. */
export const ADD_ID = 'clientes_nuevo';

/** Id del campo de busqueda. */
export const SEARCH_ID = 'clientes_buscar';

/** Id del boton de baja masiva. */
export const REMOVE_ID = 'clientes_baja';

/** Id del contador de resultados. */
export const COUNTER_ID = 'clientes_contador';

/**
 * Ancho minimo de la tabla, igual al del theme. Debajo de ese ancho las siete
 * columnas se comprimen, asi que el scroll horizontal queda en el contenedor.
 */
export const ANCHO_MINIMO_TABLA = '720px';

/** Mensaje cuando el emulador responde 401. */
export const MENSAJE_SESION_VENCIDA = 'La sesión venció. Volvé a entrar.';

/** Aviso cuando el emulador responde 403: el listado sigue usable. */
export const MENSAJE_SIN_PERMISO =
  'No tenés permiso para consultar los clientes. El listado sigue disponible con los datos locales.';

/** Aviso cuando no hay respuesta de la API. */
export const MENSAJE_SIN_API = 'No se pudo consultar /api/clientes: se muestran los datos locales.';

/** Evento que avisa al shell que hay que volver al login. */
export const EVENTO_SESION_VENCIDA = 'halcon:sesion-vencida';

/**
 * La carga desde la API se hace una vez por pagina: despues manda el store,
 * que recibe las altas y bajas del ABM y no debe pisarse con cada remontaje.
 */
let sincronizado = false;

/**
 * Vuelve a habilitar el pedido a la API en el proximo montaje. El piloto lo
 * llama al cerrar sesion, para que el siguiente usuario vea sus datos.
 */
export function reiniciarCarga() {
  sincronizado = false;
}

/**
 * Columnas del listado. Los `header` son los del original; el orden se
 * resuelve al hacer clic en cada encabezado.
 */
export const COLUMNS = [
  { id: 'cliente', header: 'Cliente' },
  { id: 'addr', header: 'Dirección' },
  { id: 'doc', header: 'DNI' },
  { id: 'tel', header: 'Teléfono' },
  { id: 'fingreso', header: 'Ingreso' },
  { id: 'cobrador', header: 'Cobrador' },
];

/**
 * Crea un elemento con clase y texto opcionales.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function nodo(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

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
 * @param {{
 *   onOpenForm?: (row: Record<string, unknown>|null) => unknown,
 *   session?: any,
 *   request?: () => Promise<Response>,
 * }} [options]
 * @returns {{
 *   root: Element,
 *   table: Element,
 *   toolbar: any,
 *   add: any,
 *   baja: any,
 *   openForm: (row?: Record<string, unknown>|null) => unknown,
 *   refresh: () => void,
 *   reload: () => Promise<void>,
 *   destroy: () => void,
 * }}
 */
export function mount(host, options = {}) {
  const target = typeof host === 'string' ? document.querySelector(host) : host;
  if (!target || typeof target.appendChild !== 'function') {
    throw new Error('clientes_view.mount: falta el contenedor');
  }

  const session = options.session || getSession();
  const traerClientes =
    typeof options.request === 'function'
      ? options.request
      : session && typeof session.fetch === 'function'
        ? () => session.fetch('/api/clientes')
        : null;

  /** La pantalla se puede desmontar mientras el pedido esta en vuelo. */
  let vivo = true;

  const root = nodo('div', 'hc-page hc-page--clientes');
  root.dataset.page = PAGE_ID;
  target.appendChild(root);

  /** Estado del listado: busqueda, orden, pagina y tamano de pagina. */
  const estado = estadoInicial();

  /** @type {Set<string>} ids seleccionados */
  let seleccion = new Set();

  /** Ultimo corte de paginacion calculado, para el checkbox del encabezado. */
  let corteActual = paginar([], 1, estado.porPagina);

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
      onSaved: () => {
        vaciar(target);
        return mount(target);
      },
      onBack: () => {
        vaciar(target);
        return mount(target);
      },
    });
  }

  // --- barra de herramientas ------------------------------------------

  const add = create({
    id: ADD_ID,
    name: ADD_ID,
    kind: 'button',
    text: 'Nuevo cliente',
    icon: 'plus',
    on: { click: () => openForm(null) },
  });

  const toolbar = create({
    kind: 'toolbar',
    items: [create({ kind: 'label', text: 'Clientes' }), create({ kind: 'spacer', flex: true }), add],
  });
  toolbar.el.classList.add('clientes-barra');
  root.appendChild(toolbar.el);

  // --- busqueda, contador y accion masiva ------------------------------

  const baja = create({
    id: REMOVE_ID,
    name: REMOVE_ID,
    kind: 'button',
    text: 'Dar de baja',
    on: { click: () => darDeBaja() },
  });

  const barra = nodo('div', 'hc-lista__barra');

  const etiquetaBusqueda = nodo('label', 'hc-lista__etiqueta', 'Buscar');
  etiquetaBusqueda.setAttribute('for', SEARCH_ID);

  const buscar = nodo('input', 'hc-lista__busqueda');
  buscar.type = 'search';
  buscar.id = SEARCH_ID;
  buscar.name = SEARCH_ID;
  buscar.placeholder = 'Buscar en todas las columnas';
  buscar.setAttribute('aria-label', 'Buscar clientes');

  const contador = nodo('span', 'hc-lista__contador');
  contador.id = COUNTER_ID;
  contador.setAttribute('role', 'status');
  contador.setAttribute('aria-live', 'polite');

  barra.append(etiquetaBusqueda, buscar, contador, baja.el);
  root.appendChild(barra);

  const mensaje = nodo('p', 'hc-lista__mensaje');
  mensaje.setAttribute('role', 'status');
  mensaje.setAttribute('aria-live', 'polite');
  mensaje.hidden = true;
  root.appendChild(mensaje);

  // Aviso persistente: falta de permiso o API caida. No lo borra el repintado
  // del listado, para que el usuario pueda seguir buscando y ordenando.
  const aviso = nodo('p', 'hc-lista__aviso');
  aviso.setAttribute('role', 'status');
  aviso.setAttribute('aria-live', 'polite');
  aviso.hidden = true;
  root.appendChild(aviso);

  // --- tabla -----------------------------------------------------------

  const tabla = nodo('table', 'hc-table hc-lista__tabla');
  tabla.id = TABLE_ID;
  // La tabla conserva sus siete columnas: el ancho minimo la protege de la
  // compresion y el scroll horizontal queda en el contenedor.
  tabla.style.minWidth = ANCHO_MINIMO_TABLA;

  const thead = nodo('thead');
  const filaCabecera = nodo('tr');

  const thTodos = nodo('th', 'hc-lista__th hc-lista__th--check');
  thTodos.setAttribute('scope', 'col');
  const checkTodos = nodo('input', 'hc-lista__todos');
  checkTodos.type = 'checkbox';
  checkTodos.setAttribute('aria-label', 'Seleccionar las filas de la pagina');
  thTodos.appendChild(checkTodos);
  filaCabecera.appendChild(thTodos);

  /** @type {Map<string, { th: HTMLElement, flecha: HTMLElement }>} */
  const cabeceras = new Map();

  for (const columna of COLUMNS) {
    const th = nodo('th', 'hc-lista__th');
    th.dataset.column = columna.id;
    th.setAttribute('scope', 'col');
    th.setAttribute('role', 'columnheader');
    th.setAttribute('aria-sort', 'none');

    const boton = nodo('button', 'hc-lista__orden');
    boton.type = 'button';
    boton.dataset.column = columna.id;
    boton.title = 'Ordenar por esta columna';

    const flecha = nodo('span', 'hc-lista__flecha', '');
    flecha.setAttribute('aria-hidden', 'true');

    boton.append(nodo('span', 'hc-lista__th-text', columna.header), flecha);
    boton.addEventListener('click', () => {
      estado.orden = siguienteOrden(estado.orden, columna.id);
      estado.pagina = 1;
      render();
    });

    th.appendChild(boton);
    filaCabecera.appendChild(th);
    cabeceras.set(columna.id, { th, flecha });
  }

  thead.appendChild(filaCabecera);
  const tbody = nodo('tbody');
  tabla.append(thead, tbody);

  const contenedorTabla = nodo('div', 'hc-lista__contenedor');
  // El contenedor scrollea solo en horizontal: la pagina no desborda cuando
  // la tabla es mas ancha que el panel.
  contenedorTabla.style.overflowX = 'auto';
  contenedorTabla.style.maxWidth = '100%';
  contenedorTabla.appendChild(tabla);
  root.appendChild(contenedorTabla);

  // --- estado vacio ----------------------------------------------------

  const vacio = nodo('div', 'hc-lista__vacio');
  vacio.hidden = true;
  const textoVacio = nodo('p', 'hc-lista__vacio-texto');
  const limpiar = nodo('button', 'hc-lista__limpiar z-button', 'Limpiar filtros');
  limpiar.type = 'button';
  limpiar.addEventListener('click', () => {
    estado.busqueda = '';
    estado.orden = null;
    estado.pagina = 1;
    buscar.value = '';
    render();
    buscar.focus();
  });
  vacio.append(textoVacio, limpiar);
  root.appendChild(vacio);

  // --- paginacion ------------------------------------------------------

  const paginacion = nodo('div', 'hc-lista__paginacion');
  const anterior = nodo('button', 'hc-lista__pagina-btn z-button', 'Anterior');
  anterior.type = 'button';
  const indicador = nodo('span', 'hc-lista__pagina');
  const siguiente = nodo('button', 'hc-lista__pagina-btn z-button', 'Siguiente');
  siguiente.type = 'button';

  const porPagina = nodo('select', 'hc-lista__por-pagina');
  porPagina.setAttribute('aria-label', 'Filas por pagina');
  for (const cantidad of POR_PAGINA) {
    const opcion = nodo('option', undefined, `${cantidad} por pagina`);
    opcion.value = String(cantidad);
    porPagina.appendChild(opcion);
  }
  porPagina.value = String(POR_PAGINA_DEFAULT);

  anterior.addEventListener('click', () => {
    if (estado.pagina <= 1) return;
    estado.pagina -= 1;
    render();
  });
  siguiente.addEventListener('click', () => {
    estado.pagina += 1;
    render();
  });
  porPagina.addEventListener('change', () => {
    estado.porPagina = Number(porPagina.value) || POR_PAGINA_DEFAULT;
    estado.pagina = 1;
    render();
  });

  paginacion.append(anterior, indicador, siguiente, porPagina);
  root.appendChild(paginacion);

  const hint = nodo('p', 'hc-page__hint', 'Doble clic en una fila para editar.');
  root.appendChild(hint);

  // --- eventos ---------------------------------------------------------

  const onBuscar = () => {
    estado.busqueda = buscar.value;
    estado.pagina = 1;
    render();
  };
  buscar.addEventListener('input', onBuscar);

  checkTodos.addEventListener('change', () => {
    seleccion = seleccionarFilas(seleccion, corteActual.filas, checkTodos.checked);
    render();
  });

  const onDoubleClick = (event) => {
    const objetivo = event.target;
    if (objetivo && typeof objetivo.closest === 'function' && objetivo.closest('input')) return;
    const fila = objetivo && typeof objetivo.closest === 'function' ? objetivo.closest('tr[data-id]') : null;
    if (!fila || !tbody.contains(fila)) return;
    const datos = store.getById(fila.getAttribute('data-id'));
    if (datos) openForm(datos);
  };
  tbody.addEventListener('dblclick', onDoubleClick);

  // --- pintado ---------------------------------------------------------

  /**
   * Muestra un aviso en la linea de mensajes.
   * @param {string} texto
   */
  function mostrarMensaje(texto) {
    mensaje.textContent = texto;
    mensaje.hidden = texto === '';
  }

  /**
   * Aviso persistente del listado. No lo borra `render()`.
   * @param {string} texto
   */
  function mostrarAviso(texto) {
    aviso.textContent = texto;
    aviso.hidden = texto === '';
  }

  /**
   * Refleja la seleccion en el checkbox del encabezado y en el boton de baja.
   */
  function pintarSeleccion() {
    const ids = corteActual.filas.map((fila) => String(fila.id));
    const marcadas = ids.filter((id) => seleccion.has(id));
    checkTodos.checked = ids.length > 0 && marcadas.length === ids.length;
    checkTodos.indeterminate = marcadas.length > 0 && marcadas.length < ids.length;
    checkTodos.disabled = ids.length === 0;

    const hay = seleccion.size > 0;
    baja.el.disabled = !hay;
    baja.el.classList.toggle('z-button--disabled', !hay);
    baja.el.setAttribute('aria-disabled', hay ? 'false' : 'true');
  }

  /**
   * Da de baja las filas seleccionadas y lo informa.
   */
  function darDeBaja() {
    const ids = [...seleccion];
    if (ids.length === 0) {
      mostrarMensaje('No hay filas seleccionadas.');
      return;
    }
    const quitadas = store.remove(ids);
    seleccion = new Set();
    render();
    mostrarMensaje(quitadas === 1 ? 'Se dio de baja 1 cliente.' : `Se dieron de baja ${quitadas} clientes.`);
  }

  /**
   * Recalcula filtro, orden y pagina sobre el store y repinta todo.
   */
  function render() {
    const base = store.list();
    const filtradas = filtrar(base, estado.busqueda);
    const ordenadas = estado.orden ? ordenar(filtradas, estado.orden.columna, estado.orden.direccion) : filtradas;
    corteActual = paginar(ordenadas, estado.pagina, estado.porPagina);
    estado.pagina = corteActual.pagina;

    // La seleccion no sobrevive a las filas que ya no estan.
    const existentes = new Set(base.map((fila) => String(fila.id)));
    if ([...seleccion].some((id) => !existentes.has(id))) {
      seleccion = new Set([...seleccion].filter((id) => existentes.has(id)));
    }

    mostrarMensaje('');
    contador.textContent = contar(corteActual.total);

    for (const [id, ref] of cabeceras) {
      const activa = Boolean(estado.orden && estado.orden.columna === id);
      const direccion = activa ? estado.orden.direccion : 'asc';
      ref.th.setAttribute('aria-sort', activa ? (direccion === 'desc' ? 'descending' : 'ascending') : 'none');
      ref.th.classList.toggle('hc-lista__th--activa', activa);
      ref.flecha.textContent = activa ? (direccion === 'desc' ? 'v' : '^') : '';
    }

    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    for (const fila of corteActual.filas) {
      const tr = nodo('tr', 'hc-lista__fila');
      tr.dataset.id = String(fila.id);
      tr.setAttribute('role', 'row');

      const celdaCheck = nodo('td', 'hc-lista__celda hc-lista__celda--check');
      const check = nodo('input', 'hc-lista__check');
      check.type = 'checkbox';
      check.dataset.id = String(fila.id);
      check.checked = seleccion.has(String(fila.id));
      check.setAttribute('aria-label', `Seleccionar ${fila.cliente || fila.id}`);
      check.addEventListener('change', () => {
        seleccion = alternarSeleccion(seleccion, fila.id, check.checked);
        pintarSeleccion();
      });
      celdaCheck.appendChild(check);
      tr.appendChild(celdaCheck);

      for (const columna of COLUMNS) {
        const valor = fila[columna.id];
        const td = nodo('td', 'hc-lista__celda', valor === undefined || valor === null ? '' : String(valor));
        td.dataset.column = columna.id;
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    const sinFilas = corteActual.total === 0;
    contenedorTabla.hidden = sinFilas;
    vacio.hidden = !sinFilas;
    paginacion.hidden = sinFilas;
    if (sinFilas) {
      const termino = estado.busqueda.trim();
      textoVacio.textContent =
        termino === ''
          ? 'No hay clientes cargados.'
          : `No hay clientes que coincidan con "${termino}".`;
    }

    indicador.textContent = `pagina ${corteActual.pagina} de ${corteActual.paginas}`;
    anterior.disabled = corteActual.pagina <= 1;
    siguiente.disabled = corteActual.pagina >= corteActual.paginas;
    anterior.classList.toggle('z-button--disabled', anterior.disabled);
    siguiente.classList.toggle('z-button--disabled', siguiente.disabled);

    pintarSeleccion();
  }

  render();

  /**
   * Avisa al shell que la sesion vencio: el piloto vuelve al login y muestra
   * el aviso en la pantalla de entrada.
   */
  function notificarSesionVencida() {
    if (typeof root.dispatchEvent !== 'function') return;
    root.dispatchEvent(new CustomEvent(EVENTO_SESION_VENCIDA, { bubbles: true }));
  }

  /**
   * Pide las filas a la API y las copia al store. Una sola vez por pagina:
   * despues manda el store, que recibe las altas y bajas del ABM.
   *
   * @returns {Promise<void>}
   */
  async function cargarDesdeApi() {
    if (sincronizado || !traerClientes) return;

    let respuesta;
    try {
      respuesta = await traerClientes();
    } catch (fallo) {
      if (vivo) mostrarAviso(MENSAJE_SIN_API);
      return;
    }
    if (!vivo) return;

    if (respuesta.status === 401) {
      mostrarMensaje(MENSAJE_SESION_VENCIDA);
      notificarSesionVencida();
      return;
    }
    if (respuesta.status === 403) {
      mostrarAviso(MENSAJE_SIN_PERMISO);
      return;
    }
    if (!respuesta.ok) {
      mostrarAviso(`La API respondio ${respuesta.status}: se muestran los datos locales.`);
      return;
    }

    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (fallo) {
      datos = null;
    }
    if (!vivo) return;

    const filas = Array.isArray(datos && datos.clientes) ? datos.clientes : [];
    if (filas.length === 0) {
      mostrarAviso('La API no devolvio clientes: se muestran los datos locales.');
      return;
    }

    for (const fila of filas) store.save(fila);
    sincronizado = true;
    mostrarAviso('');
    render();
  }

  void cargarDesdeApi();

  return {
    root,
    table: tabla,
    toolbar,
    add,
    baja,
    openForm,
    refresh: render,
    reload: async () => {
      sincronizado = false;
      await cargarDesdeApi();
    },
    destroy() {
      vivo = false;
      buscar.removeEventListener('input', onBuscar);
      tbody.removeEventListener('dblclick', onDoubleClick);
      toolbar.destroy();
      if (typeof add.destroy === 'function') add.destroy();
      if (typeof baja.destroy === 'function') baja.destroy();
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

/**
 * Definicion en el registro de `app`. La factory no toca el DOM.
 */
app.define(PAGE_ID, () => ({ mount }));

export default { mount, COLUMNS };
