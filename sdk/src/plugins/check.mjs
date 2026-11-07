/**
 * Verificacion de registro de los plugins y del shim de `app`.
 *
 * Importa los tres plugins (que registran sus kinds como efecto de modulo),
 * el shim de `app.define`/`app.require`, la pantalla del dashboard, las dos
 * pantallas del ABM de clientes y el shim de sesion. Comprueba:
 *
 *  - que `mainbar`, `formview` y `datalist` existen en el registro de Zorzal;
 *  - que `toExcel` sigue siendo un no-op fuera de alcance;
 *  - que `app.define` y `app.require` existen;
 *  - que el dashboard, `app.abm.clientes_view` y `app.abm.clientes_form`
 *    quedaron registrados y exponen `mount`;
 *  - que una definicion se evalua una sola vez y que un nombre desconocido
 *    falla en lugar de devolver `undefined`;
 *  - que el shim de sesion expone `usr.name`, `usr.menu`, `usr.session.enable`
 *    y `__.current`, `__.isNumber` y `__.session`;
 *  - que el store en memoria de clientes arranca con cinco filas, suma una en
 *    el alta y emite `save`;
 *  - el listado de clientes: filtro que reduce y busca en cualquier columna
 *    (sin acentos ni mayusculas), filtro sin resultados, orden ascendente y
 *    descendente con alternancia por clic, paginacion que corta en 10 con
 *    cambio de pagina, seleccion multiple, baja masiva que elimina del store y
 *    contador de resultados.
 *  - el formulario de clientes, montado sobre un DOM minimo: DNI invalido
 *    rechazado (letras y largo fuera de 7..9), DNI valido aceptado, telefono
 *    invalido rechazado, telefono vacio aceptado, fecha de ingreso invalida
 *    rechazada, guardar con error no emite `clientes:guardado`, guardar valido
 *    lo emite una sola vez con el boton en `Guardando...`, resumen de errores
 *    con un enlace por campo, foco en el primer campo invalido y cancelacion
 *    con y sin cambios (incluida la tecla Escape).
 *  - la pantalla de inicio: los cuatro KPI calculados sobre el store y en 0 con
 *    el store vacio, las altas del mes, el gage entre 0 y 100, la tabla de
 *    ultimas altas limitada a cinco filas y el montaje real de los tres
 *    widgets sobre el DOM minimo.
 *  - los cuatro estados de soporte (`app.estado.403`, `404`, `error` y
 *    `cargando`): registrados, con titulo, icono y la accion que vuelve a
 *    `app.inicio`.
 *  - la accesibilidad del shell: skip link al contenido, `role="main"` en el
 *    cuerpo, `aria-current="page"` solo en el item activo del sidebar y
 *    `aria-label` en el boton de menu.
 *  - el comportamiento mobile: el drawer se cierra al elegir un item del menu
 *    con el ancho del breakpoint, el formulario de clientes declara una sola
 *    columna en el media query de 640, la tabla de clientes tiene el
 *    contenedor con scroll horizontal y el ancho minimo, y los botones y
 *    campos declaran 44 px de alto.
 *  - la compatibilidad de navegadores: `browserslist` en `package.json` con las
 *    cuatro familias y la exclusion de IE, y el verificador `scripts/compat.mjs`
 *    sin hallazgos ni excepciones sueltas.
 *
 * Sale 0 si todo esta y 1 si falta algo.
 *
 * Uso: node sdk/src/plugins/check.mjs
 */

import { isDefined, setDocument } from '../../vendor/zorzal/src/zorzal.js';
import './mainbar.js';
import './formview.js';
import './datalist.js';
import { toExcel } from './datalist.js';

import { app } from '../../compat/app-shim.js';
import { mount as mountDashboard } from '../../compat/pages/dashboard.js';
import { mount as mountClientesView } from '../../compat/pages/clientes_view.js';
import { mount as mountClientesForm } from '../../compat/pages/clientes_form.js';
import * as inicio from '../../compat/pages/inicio.js';
import { ESTADOS as ESTADOS_SOPORTE } from '../../compat/pages/estados.js';
import { usr, __ as sessionUtils } from '../../compat/session-shim.js';
import * as clientesStore from '../../compat/store/clientes.js';
import * as listado from '../../compat/store/clientes_listado.js';
import { validar } from '../rules/clientes.js';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { revisar as revisarCompat, REGLAS as REGLAS_COMPAT } from '../../../scripts/compat.mjs';

/**
 * Escribe una linea de progreso en stdout.
 *
 * Informa por stdout: el lint de `sdk/src` no admite llamadas de registro a la
 * consola de depuracion.
 * @param {string} line
 */
function ok(line) {
  process.stdout.write(`${line}\n`);
}

const esperados = ['mainbar', 'formview', 'datalist'];
const faltantes = esperados.filter((kind) => !isDefined(kind));

if (faltantes.length > 0) {
  console.error(`faltan kinds en el registro: ${faltantes.join(', ')}`);
  process.exit(1);
}

for (const kind of esperados) {
  ok(`ok ${kind}: registrado`);
}

const exportNoop = toExcel({}, { filename: 'check' });
if (exportNoop !== false) {
  console.error('toExcel deberia devolver false (no-op fuera de alcance)');
  process.exit(1);
}
ok('ok toExcel: no-op devuelve false');

// --- shim de app.define / app.require --------------------------------

if (typeof app.define !== 'function' || typeof app.require !== 'function') {
  console.error('el shim de app no expone define y require');
  process.exit(1);
}
ok('ok app.define/app.require: presentes');

if (!app.isDefined('app.dashboard')) {
  console.error('app.dashboard no quedo registrado al importar la pagina');
  process.exit(1);
}
ok('ok app.dashboard: registrado');

const dashboard = app.require('app.dashboard');
if (!dashboard || typeof dashboard.mount !== 'function') {
  console.error('app.require("app.dashboard") no devolvio un objeto con mount');
  process.exit(1);
}
ok('ok app.dashboard: se puede requerir y expone mount');

const otraVez = app.require('app.dashboard', () => {});
if (otraVez !== dashboard) {
  console.error('app.require volvio a evaluar la definicion del dashboard');
  process.exit(1);
}
ok('ok app.require: devuelve el mismo resultado y acepta callback');

let ejecuciones = 0;
app.define('check.unica', () => {
  ejecuciones += 1;
  return { ejecuciones };
});
app.require('check.unica');
app.require('check.unica');
if (ejecuciones !== 1) {
  console.error(`la definicion se evaluo ${ejecuciones} veces, deberia ser 1`);
  process.exit(1);
}
ok('ok app.define: la definicion se evalua una sola vez');

let fallo = false;
try {
  app.require('check.inexistente');
} catch (error) {
  fallo = true;
}
if (!fallo) {
  console.error('app.require de un nombre desconocido deberia fallar');
  process.exit(1);
}
ok('ok app.require: un nombre desconocido falla');

if (typeof mountDashboard !== 'function') {
  console.error('la pagina del dashboard no exporta mount');
  process.exit(1);
}
ok('ok dashboard: exporta mount');

// --- pantallas del ABM de clientes ------------------------------------

for (const [id, mountFn] of [
  ['app.abm.clientes_view', mountClientesView],
  ['app.abm.clientes_form', mountClientesForm],
]) {
  if (!app.isDefined(id)) {
    console.error(`${id} no quedo registrado al importar la pagina`);
    process.exit(1);
  }
  const page = app.require(id);
  if (!page || typeof page.mount !== 'function' || typeof mountFn !== 'function') {
    console.error(`app.require("${id}") no devolvio un objeto con mount`);
    process.exit(1);
  }
  ok(`ok ${id}: registrado y expone mount`);
}

// --- shim de sesion ---------------------------------------------------

if (typeof usr.name !== 'string' || usr.name.trim() === '') {
  console.error('usr.name no es un string no vacio');
  process.exit(1);
}
if (!Array.isArray(usr.menu) || usr.menu.length === 0) {
  console.error('usr.menu no es un array con items');
  process.exit(1);
}
const usrSession = usr.session;
if (!usrSession || typeof usrSession !== 'object' || typeof usrSession.enable !== 'boolean') {
  console.error('usr.session no expone enable booleano');
  process.exit(1);
}
ok(`ok usr: name="${usr.name}", menu=${usr.menu.length} items, session.enable=${usrSession.enable}`);

const idsMenu = [];
const indexar = (items) => {
  for (const item of items) {
    if (item && item.id) idsMenu.push(item.id);
    if (item && Array.isArray(item.items)) indexar(item.items);
    if (item && Array.isArray(item.children)) indexar(item.children);
  }
};
indexar(usr.menu);
if (!idsMenu.includes('app.abm.clientes_view')) {
  console.error('usr.menu no incluye app.abm.clientes_view (el dashboard no puede navegar a Clientes)');
  process.exit(1);
}
ok('ok usr.menu: incluye app.abm.clientes_view');

if (!sessionUtils || typeof sessionUtils !== 'object') {
  console.error('session-shim no expone __');
  process.exit(1);
}
if (!sessionUtils.current || typeof sessionUtils.current !== 'object') {
  console.error('__.current no es un objeto');
  process.exit(1);
}
if (typeof sessionUtils.isNumber !== 'function') {
  console.error('__.isNumber no es una funcion');
  process.exit(1);
}
if (sessionUtils.isNumber('42') !== true || sessionUtils.isNumber('4x') !== false) {
  console.error('__.isNumber no respeta la semantica de sdk/sys/core/helper.js');
  process.exit(1);
}
if (sessionUtils.session === undefined) {
  console.error('__.session no esta expuesto');
  process.exit(1);
}
ok('ok __: current, isNumber y session presentes');

// --- store en memoria de clientes -------------------------------------

const iniciales = clientesStore.list();
if (iniciales.length !== 5) {
  console.error(`el store arranca con ${iniciales.length} filas, deberia arrancar con 5`);
  process.exit(1);
}
let guardados = 0;
const desuscribir = clientesStore.on('save', () => {
  guardados += 1;
});
const guardado = clientesStore.save({
  apellido: 'Lopez',
  nombre: 'Ana',
  addr: 'Rivadavia 1',
  doc: '36000111',
  tel: '11 5555-1006',
  id_cobrador: '3',
});
desuscribir();
if (!guardado || clientesStore.list().length !== 6) {
  console.error('el alta no dejo seis filas en el store');
  process.exit(1);
}
if (guardados !== 1) {
  console.error(`el store emitio ${guardados} veces "save", deberia emitir 1`);
  process.exit(1);
}
if (guardado.cliente !== 'Lopez Ana' || guardado.cobrador !== 'Diaz Carla') {
  console.error('el store no calculo las columnas derivadas cliente/cobrador');
  process.exit(1);
}
ok('ok store: 5 filas, el alta deja 6 y emite save');
clientesStore.reset();

// --- listado: busqueda, orden, paginacion y seleccion -----------------

/**
 * Corta la verificacion con mensaje cuando una comprobacion no se cumple.
 * @param {boolean} condicion
 * @param {string} mensaje
 */
function exigir(condicion, mensaje) {
  if (condicion) return;
  console.error(mensaje);
  process.exit(1);
}

const filas = clientesStore.list();

// Filtro que reduce: por cualquier columna, sin distinguir mayusculas ni
// acentos (Perez / pérez / PÉREZ).
const porApellido = listado.filtrar(filas, 'pérez');
exigir(porApellido.length === 1, `el filtro "pérez" devuelve ${porApellido.length} filas, deberia devolver 1`);
exigir(porApellido[0].cliente === 'Perez Juan', 'el filtro no encontro a Perez Juan');
exigir(listado.filtrar(filas, 'PÉREZ').length === 1, 'el filtro distingue mayusculas');
exigir(listado.filtrar(filas, 'mitre').length === 1, 'el filtro no busca en la columna Dirección');
exigir(listado.filtrar(filas, '27888999').length === 1, 'el filtro no busca en la columna DNI');
exigir(listado.filtrar(filas, '5555-1003').length === 1, 'el filtro no busca en la columna Teléfono');
exigir(listado.filtrar(filas, 'gomez').length === 2, 'el filtro no busca en la columna Cobrador');
exigir(listado.filtrar(filas, '').length === filas.length, 'un filtro vacio deberia devolver todas las filas');
ok('ok listado: el filtro reduce y busca en cualquier columna');

// Filtro sin resultados.
const sinResultados = listado.filtrar(filas, 'zzz-no-existe');
exigir(sinResultados.length === 0, `un filtro sin coincidencias devuelve ${sinResultados.length} filas`);
ok('ok listado: el filtro sin coincidencias devuelve 0 filas');

// Orden ascendente y descendente por Cliente.
const ascendente = listado.ordenar(filas, 'cliente', 'asc');
exigir(ascendente[0].cliente === 'Fernandez Carlos', `ascendente arranca en "${ascendente[0].cliente}"`);
exigir(ascendente[ascendente.length - 1].cliente === 'Torres Pedro', 'ascendente no termina en Torres Pedro');
const descendente = listado.ordenar(filas, 'cliente', 'desc');
exigir(descendente[0].cliente === 'Torres Pedro', `descendente arranca en "${descendente[0].cliente}"`);
exigir(filas[0].cliente === 'Perez Juan', 'ordenar muto el arreglo original');
const primerClic = listado.siguienteOrden(null, 'cliente');
exigir(primerClic.columna === 'cliente' && primerClic.direccion === 'asc', 'el primer clic deberia ordenar ascendente');
const segundoClic = listado.siguienteOrden(primerClic, 'cliente');
exigir(segundoClic.direccion === 'desc', 'el segundo clic sobre la misma columna deberia ordenar descendente');
const tercerClic = listado.siguienteOrden(segundoClic, 'cliente');
exigir(tercerClic.direccion === 'asc', 'el tercer clic deberia volver a ascendente');
ok('ok listado: orden ascendente y descendente con alternancia por clic');

// Paginacion: 23 filas cortadas de a 10.
const muchas = Array.from({ length: 23 }, (_, indice) => ({
  id: indice + 1,
  cliente: `Cliente ${String(indice + 1).padStart(2, '0')}`,
}));
const primera = listado.paginar(muchas, 1, 10);
exigir(primera.filas.length === 10, `la primera pagina trae ${primera.filas.length} filas, deberian ser 10`);
exigir(primera.paginas === 3, `la paginacion calculo ${primera.paginas} paginas, deberian ser 3`);
exigir(primera.total === 23, `el total paginado es ${primera.total}, deberia ser 23`);
exigir(primera.pagina === 1, `la pagina devuelta es ${primera.pagina}, deberia ser 1`);
ok('ok listado: la paginacion corta en 10 filas');

// Cambio de pagina: la segunda arranca en la fila 11 y la ultima trae 3.
const segunda = listado.paginar(muchas, 2, 10);
exigir(segunda.pagina === 2, `la segunda pagina devolvio ${segunda.pagina}`);
exigir(segunda.filas.length === 10, `la segunda pagina trae ${segunda.filas.length} filas, deberian ser 10`);
exigir(segunda.filas[0].id === 11, `la segunda pagina arranca en el id ${segunda.filas[0].id}, deberia arrancar en 11`);
exigir(segunda.desde === 11 && segunda.hasta === 20, 'el rango visible de la segunda pagina no es 11..20');
const ultima = listado.paginar(muchas, 9, 10);
exigir(ultima.pagina === 3 && ultima.filas.length === 3, 'una pagina fuera de rango no se recorta a la ultima');
exigir(listado.paginar(muchas, 1, 25).filas.length === 23, 'el selector de 25 por pagina no corta en 25');
ok('ok listado: el cambio de pagina mueve el corte y recorta fuera de rango');

// Seleccion multiple, incluido el checkbox del encabezado.
let seleccion = listado.seleccionarFilas(new Set(), primera.filas, true);
exigir(seleccion.size === 10, `el checkbox del encabezado marco ${seleccion.size} filas, deberian ser 10`);
seleccion = listado.alternarSeleccion(seleccion, primera.filas[0].id);
exigir(seleccion.size === 9, `desmarcar una fila deja ${seleccion.size} seleccionadas, deberian ser 9`);
seleccion = listado.alternarSeleccion(seleccion, primera.filas[0].id);
exigir(seleccion.size === 10, 'volver a marcar la misma fila no la reincorpora');
seleccion = listado.seleccionarFilas(seleccion, primera.filas, false);
exigir(seleccion.size === 0, 'desmarcar el encabezado deberia vaciar la seleccion');
ok('ok listado: seleccion multiple por fila y por encabezado');

// Contador: el texto que se pinta junto a la busqueda.
exigir(listado.contar(5) === '5 clientes', `el contador de 5 dice "${listado.contar(5)}"`);
exigir(listado.contar(1) === '1 cliente', `el contador de 1 dice "${listado.contar(1)}"`);
exigir(listado.contar(0) === '0 clientes', `el contador de 0 dice "${listado.contar(0)}"`);
exigir(listado.contar(listado.filtrar(filas, 'gomez').length) === '2 clientes', 'el contador no sigue al filtro');
ok('ok listado: el contador responde al total filtrado');

// Baja masiva: elimina del store y emite change.
const altaA = clientesStore.save({ apellido: 'Baja', nombre: 'Uno', id_cobrador: '1' });
const altaB = clientesStore.save({ apellido: 'Baja', nombre: 'Dos', id_cobrador: '1' });
let cambios = 0;
const desuscribirCambios = clientesStore.on('change', () => {
  cambios += 1;
});
const quitadas = clientesStore.remove([altaA.id, altaB.id]);
desuscribirCambios();
exigir(quitadas === 2, `la baja informo ${quitadas} filas quitadas, deberian ser 2`);
exigir(clientesStore.list().length === 5, `despues de la baja quedan ${clientesStore.list().length} filas, deberian quedar 5`);
exigir(cambios === 1, `la baja emitio ${cambios} veces "change", deberia emitir 1`);
exigir(clientesStore.getById(altaA.id) === null, 'la fila dada de baja sigue en el store');
ok('ok store: la baja masiva elimina las filas y emite change');
clientesStore.reset();

// --- formulario de clientes: formato, estados y accesibilidad ----------
//
// El formulario se monta sobre un DOM minimo: los widgets de Zorzal piden
// `createElement`, atributos, hijos, listeners y foco, nada mas. Se inyecta
// con `setDocument()` y ademas como `globalThis.document`, que es lo que usa
// la pagina para crear su raiz.

/**
 * Documento minimo para montar widgets en Node. Implementa solo lo que usan
 * el `form`, la `toolbar`, los `text`, el `select` y el `button`.
 * @returns {any}
 */
function crearDocumento() {
  const documento = { activeElement: null };

  function despachar(nodo, evento) {
    const ev = evento && typeof evento === 'object' ? evento : { type: String(evento) };
    let actual = nodo;
    while (actual) {
      const lista = actual.escuchas ? actual.escuchas.get(ev.type) : null;
      if (lista) {
        for (const fn of [...lista]) fn.call(actual, ev);
      }
      if (ev.bubbles !== true) break;
      actual = actual.parentNode;
    }
    return ev.defaultPrevented !== true;
  }

  function nuevoElemento(tag) {
    const nodo = {
      nodeType: 1,
      tagName: String(tag || 'div').toUpperCase(),
      childNodes: [],
      parentNode: null,
      attributes: new Map(),
      escuchas: new Map(),
      style: {},
      dataset: {},
      className: '',
      value: '',
      checked: false,
      hidden: false,
      textoNodo: '',
    };

    Object.defineProperty(nodo, 'firstChild', {
      get() {
        return nodo.childNodes.length > 0 ? nodo.childNodes[0] : null;
      },
    });

    Object.defineProperty(nodo, 'textContent', {
      get() {
        if (nodo.childNodes.length === 0) return nodo.textoNodo;
        return nodo.childNodes.map((hijo) => hijo.textContent).join('');
      },
      set(valor) {
        nodo.textoNodo = valor === undefined || valor === null ? '' : String(valor);
        while (nodo.childNodes.length > 0) nodo.removeChild(nodo.childNodes[nodo.childNodes.length - 1]);
      },
    });

    nodo.appendChild = (hijo) => {
      if (hijo.parentNode) hijo.parentNode.removeChild(hijo);
      nodo.childNodes.push(hijo);
      hijo.parentNode = nodo;
      return hijo;
    };

    /**
     * Agrega varios hijos, como `Element.append`.
     * @param {...any} hijos
     */
    nodo.append = (...hijos) => {
      for (const hijo of hijos) {
        if (hijo === undefined || hijo === null) continue;
        nodo.appendChild(typeof hijo === 'string' ? documento.createTextNode(hijo) : hijo);
      }
    };

    nodo.removeChild = (hijo) => {
      const indice = nodo.childNodes.indexOf(hijo);
      if (indice >= 0) nodo.childNodes.splice(indice, 1);
      hijo.parentNode = null;
      return hijo;
    };

    nodo.insertBefore = (hijo, referencia) => {
      if (hijo.parentNode) hijo.parentNode.removeChild(hijo);
      const indice = referencia ? nodo.childNodes.indexOf(referencia) : -1;
      if (indice < 0) nodo.childNodes.push(hijo);
      else nodo.childNodes.splice(indice, 0, hijo);
      hijo.parentNode = nodo;
      return hijo;
    };

    nodo.setAttribute = (name, valor) => {
      nodo.attributes.set(String(name), String(valor));
      if (name === 'value') nodo.value = String(valor);
    };
    nodo.getAttribute = (name) =>
      nodo.attributes.has(String(name)) ? nodo.attributes.get(String(name)) : null;
    nodo.removeAttribute = (name) => {
      nodo.attributes.delete(String(name));
    };

    // Propiedades reflejadas: en el DOM real `id`, `className` y `href`
    // escriben el atributo correspondiente, y los selectores las leen de ahi.
    for (const [propiedad, atributo] of [
      ['id', 'id'],
      ['className', 'class'],
      ['href', 'href'],
    ]) {
      Object.defineProperty(nodo, propiedad, {
        configurable: true,
        /** @returns {string} */
        get() {
          return nodo.getAttribute(atributo) || '';
        },
        /** @param {unknown} valor */
        set(valor) {
          nodo.setAttribute(atributo, String(valor));
        },
      });
    }

    nodo.addEventListener = (type, fn) => {
      if (!nodo.escuchas.has(type)) nodo.escuchas.set(type, []);
      nodo.escuchas.get(type).push(fn);
    };
    nodo.removeEventListener = (type, fn) => {
      const lista = nodo.escuchas.get(type) || [];
      const indice = lista.indexOf(fn);
      if (indice >= 0) lista.splice(indice, 1);
    };
    nodo.dispatchEvent = (evento) => despachar(nodo, evento);
    nodo.click = () =>
      nodo.dispatchEvent({
        type: 'click',
        bubbles: true,
        target: nodo,
        preventDefault() {
          this.defaultPrevented = true;
        },
      });
    nodo.focus = () => {
      documento.activeElement = nodo;
    };
    nodo.blur = () => {
      if (documento.activeElement === nodo) documento.activeElement = null;
    };
    nodo.remove = () => {
      if (nodo.parentNode) nodo.parentNode.removeChild(nodo);
    };
    nodo.contains = (otro) => {
      let actual = otro;
      while (actual) {
        if (actual === nodo) return true;
        actual = actual.parentNode;
      }
      return false;
    };

    // --- clases, busqueda y ascendencia --------------------------------
    // Lo que necesitan los widgets de Zorzal al montar (sidebar, mainbar,
    // popup) y lo que necesitan las verificaciones de accesibilidad.
    nodo.ownerDocument = documento;

    const listaClases = () =>
      (nodo.getAttribute('class') || '')
        .split(/\s+/)
        .filter((clase) => clase !== '');

    const fijarClases = (clases) => nodo.setAttribute('class', clases.join(' '));

    nodo.classList = {
      /**
       * @param {...string} nombres
       */
      add(...nombres) {
        const clases = listaClases();
        for (const nombre of nombres) if (!clases.includes(nombre)) clases.push(nombre);
        fijarClases(clases);
      },
      /** @param {...string} nombres */
      remove(...nombres) {
        fijarClases(listaClases().filter((clase) => !nombres.includes(clase)));
      },
      /**
       * @param {string} nombre
       * @returns {boolean}
       */
      contains(nombre) {
        return listaClases().includes(nombre);
      },
      /**
       * @param {string} nombre
       * @param {boolean} [activo]
       * @returns {boolean}
       */
      toggle(nombre, activo) {
        const encendido = activo === undefined ? !listaClases().includes(nombre) : Boolean(activo);
        if (encendido) nodo.classList.add(nombre);
        else nodo.classList.remove(nombre);
        return encendido;
      },
    };

    /**
     * Elementos hijos (sin nodos de texto).
     * @returns {any[]}
     */
    Object.defineProperty(nodo, 'children', {
      get() {
        return nodo.childNodes.filter((hijo) => hijo && hijo.nodeType === 1);
      },
    });

    /** @param {string} selector */
    nodo.matches = (selector) => coincideSelector(nodo, selector);

    /** @param {string} selector */
    nodo.closest = (selector) => {
      let actual = nodo;
      while (actual) {
        if (actual.nodeType === 1 && coincideSelector(actual, selector)) return actual;
        actual = actual.parentNode;
      }
      return null;
    };

    /** @param {string} selector @returns {any} */
    nodo.querySelectorAll = (selector) => buscarTodos(nodo, selector);

    /** @param {string} selector @returns {any|null} */
    nodo.querySelector = (selector) => {
      const encontrados = buscarTodos(nodo, selector);
      return encontrados.length > 0 ? encontrados[0] : null;
    };

    return nodo;
  }

  /**
   * Indica si un nodo cumple un selector simple: etiqueta, `#id`, `.clase` y
   * `[atributo]` / `[atributo="valor"]`.
   * @param {any} nodo
   * @param {string} simple
   * @returns {boolean}
   */
  function coincideSimple(nodo, simple) {
    if (!nodo || nodo.nodeType !== 1) return false;
    const atributos = [];
    let resto = String(simple).trim();
    resto = resto.replace(/\[([^\]]+)\]/g, (_todo, interior) => {
      atributos.push(interior);
      return '';
    });
    const clasesPedidas = [];
    resto = resto.replace(/\.([^.#]+)/g, (_todo, clase) => {
      clasesPedidas.push(clase);
      return '';
    });
    let idPedido = null;
    resto = resto.replace(/#([^.#]+)/g, (_todo, valor) => {
      idPedido = valor;
      return '';
    });
    const etiqueta = resto.trim();
    if (etiqueta && etiqueta !== '*' && nodo.tagName !== etiqueta.toUpperCase()) return false;
    if (idPedido !== null && nodo.getAttribute('id') !== idPedido) return false;
    const clases = new Set((nodo.getAttribute('class') || '').split(/\s+/).filter(Boolean));
    for (const clase of clasesPedidas) if (!clases.has(clase)) return false;
    for (const atributo of atributos) {
      const [nombre, valor] = atributo.split('=');
      const clave = nombre.trim();
      if (nodo.getAttribute(clave) === null) return false;
      if (valor !== undefined) {
        const esperado = valor.trim().replace(/^["']|["']$/g, '');
        if (nodo.getAttribute(clave) !== esperado) return false;
      }
    }
    return true;
  }

  /**
   * Indica si un nodo cumple una lista de selectores separados por coma.
   * @param {any} nodo
   * @param {string} selector
   * @returns {boolean}
   */
  function coincideSelector(nodo, selector) {
    return String(selector)
      .split(',')
      .map((parte) => parte.trim())
      .filter(Boolean)
      .some((parte) => coincideSimple(nodo, parte));
  }

  /**
   * Indica si el nodo cierra la cadena de descendencia `partes[indice..0]`.
   * @param {any} nodo
   * @param {string[]} partes
   * @param {number} indice
   * @returns {boolean}
   */
  function cadenaCoincide(nodo, partes, indice) {
    let pendiente = indice - 1;
    let actual = nodo.parentNode;
    while (pendiente >= 0) {
      while (actual && !coincideSelector(actual, partes[pendiente])) actual = actual.parentNode;
      if (!actual) return false;
      actual = actual.parentNode;
      pendiente -= 1;
    }
    return true;
  }

  /**
   * Busca descendientes por selector, con descendencia por espacios.
   * @param {any} raiz
   * @param {string} selector
   * @returns {any[]}
   */
  function buscarTodos(raiz, selector) {
    const partes = String(selector).trim().split(/\s+/).filter(Boolean);
    const ultima = partes[partes.length - 1];
    const encontrados = [];
    const recorrer = (nodo) => {
      for (const hijo of nodo.childNodes) {
        if (!hijo || hijo.nodeType !== 1) continue;
        if (coincideSelector(hijo, ultima) && cadenaCoincide(hijo, partes, partes.length - 1)) {
          encontrados.push(hijo);
        }
        recorrer(hijo);
      }
    };
    recorrer(raiz);
    return encontrados;
  }

  documento.createElement = (tag) => nuevoElemento(tag);
  documento.createElementNS = (namespace, tag) => nuevoElemento(tag);
  documento.createTextNode = (valor) => ({
    nodeType: 3,
    childNodes: [],
    parentNode: null,
    textContent: valor === undefined || valor === null ? '' : String(valor),
  });
  documento.body = nuevoElemento('body');

  // El dashboard registra un listener de teclado en el documento.
  documento.escuchas = new Map();
  documento.addEventListener = (type, fn) => {
    if (!documento.escuchas.has(type)) documento.escuchas.set(type, []);
    documento.escuchas.get(type).push(fn);
  };
  documento.removeEventListener = (type, fn) => {
    const lista = documento.escuchas.get(type) || [];
    const indice = lista.indexOf(fn);
    if (indice >= 0) lista.splice(indice, 1);
  };

  return documento;
}

/**
 * Busca un elemento por atributo `name` en un subarbol.
 * @param {any} nodo
 * @param {string} name
 * @returns {any|null}
 */
function buscarPorNombre(nodo, name) {
  if (!nodo || nodo.nodeType !== 1) return null;
  if (nodo.getAttribute('name') === name) return nodo;
  for (const hijo of nodo.childNodes) {
    const encontrado = buscarPorNombre(hijo, name);
    if (encontrado) return encontrado;
  }
  return null;
}

/**
 * Busca un elemento por clase en un subarbol.
 * @param {any} nodo
 * @param {string} clase
 * @returns {any|null}
 */
function buscarPorClase(nodo, clase) {
  if (!nodo || nodo.nodeType !== 1) return null;
  const clases = nodo.getAttribute('class') || '';
  if (clases.split(/\s+/).includes(clase)) return nodo;
  for (const hijo of nodo.childNodes) {
    const encontrado = buscarPorClase(hijo, clase);
    if (encontrado) return encontrado;
  }
  return null;
}

/**
 * Cuenta las etiquetas de un tipo en un subarbol.
 * @param {any} nodo
 * @param {string} tag
 * @returns {number}
 */
function contarEtiquetas(nodo, tag) {
  if (!nodo || nodo.nodeType !== 1) return 0;
  let total = nodo.tagName === tag.toUpperCase() ? 1 : 0;
  for (const hijo of nodo.childNodes) total += contarEtiquetas(hijo, tag);
  return total;
}

/**
 * Busca un elemento por id en un subarbol.
 * @param {any} nodo
 * @param {string} id
 * @returns {any|null}
 */
function buscarPorId(nodo, id) {
  if (!nodo || nodo.nodeType !== 1) return null;
  if (nodo.getAttribute('id') === id) return nodo;
  for (const hijo of nodo.childNodes) {
    const encontrado = buscarPorId(hijo, id);
    if (encontrado) return encontrado;
  }
  return null;
}

const documento = crearDocumento();
globalThis.document = documento;
setDocument(documento);

// --- pantalla de inicio: KPI, gage y ultimas altas --------------------

if (!app.isDefined(inicio.PAGE_ID)) {
  console.error(`${inicio.PAGE_ID} no quedo registrado al importar la pagina`);
  process.exit(1);
}
const paginaInicio = app.require(inicio.PAGE_ID);
exigir(
  Boolean(paginaInicio) && typeof paginaInicio.mount === 'function',
  'app.require("app.inicio") no devolvio un objeto con mount'
);
ok('ok app.inicio: registrado y expone mount');

const sinClientes = inicio.resumen([]);
exigir(
  sinClientes.clientes === 0 && sinClientes.altasDelMes === 0 && sinClientes.cobradoresActivos === 0 && sinClientes.saldoTotal === 0,
  'con el store vacio los cuatro KPI deberian valer 0'
);
exigir(sinClientes.porcentajeSaldoCero === 0, `el gage vacio vale ${sinClientes.porcentajeSaldoCero}, deberia valer 0`);
exigir(sinClientes.ultimasAltas.length === 0, 'con el store vacio la tabla deberia quedar sin filas');
ok('ok inicio: con el store vacio los cuatro KPI valen 0 y la tabla queda vacia');

clientesStore.reset();
const filasInicio = clientesStore.list();
const desdeStore = inicio.resumen(filasInicio);
exigir(desdeStore.clientes === 5, `los clientes totales son ${desdeStore.clientes}, deberian ser 5`);
exigir(desdeStore.cobradoresActivos === 3, `los cobradores activos son ${desdeStore.cobradoresActivos}, deberian ser 3`);
exigir(desdeStore.saldoTotal === 23251.25, `el saldo total es ${desdeStore.saldoTotal}, deberia ser 23251.25`);
exigir(desdeStore.saldoCero === 2, `los clientes con saldo cero son ${desdeStore.saldoCero}, deberian ser 2`);
exigir(
  desdeStore.porcentajeSaldoCero === 40,
  `el gage vale ${desdeStore.porcentajeSaldoCero}, deberia valer 40`
);
exigir(
  desdeStore.porCobrador.length === 3 && desdeStore.porCobrador[0].clientes === 2,
  'el grafico no agrupa los clientes por cobrador'
);
ok('ok inicio: los cuatro KPI salen del store (5 clientes, 3 cobradores, 23251.25 de saldo)');

const mesActual = inicio.claveMes(new Date());
const filasMes = [
  { id: 1, cliente: 'A', fingreso: `${mesActual}-03`, saldo: 0, cobrador: 'Gomez Ana' },
  { id: 2, cliente: 'B', fingreso: `${mesActual}-18`, saldo: 500, cobrador: 'Gomez Ana' },
  { id: 3, cliente: 'C', fingreso: '2020-01-10', saldo: 0, cobrador: 'Diaz Carla' },
];
exigir(
  inicio.resumen(filasMes, new Date()).altasDelMes === 2,
  'la KPI de altas del mes no cuenta solo las fechas del mes en curso'
);
exigir(inicio.resumen(filasMes, new Date('2030-05-01')).altasDelMes === 0, 'las altas del mes ignoran la fecha recibida');
ok('ok inicio: las altas del mes se cuentan con la fecha de ingreso');

const doceAltas = Array.from({ length: 12 }, (_, indice) => ({
  id: indice + 1,
  cliente: `Cliente ${indice + 1}`,
  fingreso: `2024-01-${String(indice + 1).padStart(2, '0')}`,
  saldo: 0,
  cobrador: 'Gomez Ana',
}));
const ultimas = inicio.ultimasAltas(doceAltas);
exigir(ultimas.length === 5, `la tabla muestra ${ultimas.length} altas, deberia mostrar 5`);
exigir(ultimas[0].cliente === 'Cliente 12', `la primera alta de la tabla es ${ultimas[0].cliente}, deberia ser Cliente 12`);
ok('ok inicio: la tabla de altas se limita a las cinco mas recientes');

for (const [cero, total] of [
  [0, 3],
  [3, 3],
  [1, 3],
  [0, 0],
  [7, 2],
]) {
  const valor = inicio.porcentaje(cero, total);
  exigir(valor >= 0 && valor <= 100, `el gage devolvio ${valor} con ${cero}/${total}`);
}
ok('ok inicio: el gage se mantiene entre 0 y 100');

// --- estados de soporte ----------------------------------------------

const idsEstados = ESTADOS_SOPORTE.map((estado) => estado.id);
exigir(
  idsEstados.join('|') === 'app.estado.403|app.estado.404|app.estado.error|app.estado.cargando',
  `los ids de los estados son ${idsEstados.join(', ')}`
);
for (const estado of ESTADOS_SOPORTE) {
  const pagina = app.isDefined(estado.id) ? app.require(estado.id) : null;
  exigir(Boolean(pagina) && typeof pagina.mount === 'function', `${estado.id} no quedo registrado con mount`);
}
ok('ok estados: app.estado.403, 404, error y cargando registrados');

const hostEstados = documento.createElement('div');
documento.body.appendChild(hostEstados);

for (const estado of ESTADOS_SOPORTE) {
  const controlador = app.require(estado.id).mount(hostEstados);
  const nodoEstado = hostEstados.querySelector(`[data-estado="${estado.codigo}"]`);
  exigir(Boolean(nodoEstado), `el estado ${estado.codigo} no monto su contenedor`);
  exigir(nodoEstado.textContent.includes(estado.titulo), `el estado ${estado.codigo} no muestra su titulo`);
  exigir(Boolean(nodoEstado.querySelector('svg.hc-icon')), `el estado ${estado.codigo} no dibuja el icono de Zorzal`);
  exigir(
    controlador.accion.el.textContent.includes('Volver al inicio'),
    `el estado ${estado.codigo} no ofrece la accion Volver al inicio`
  );
  controlador.destroy();
}
ok('ok estados: titulo, icono y accion Volver al inicio en los cuatro');

const estado404 = app.require('app.estado.404').mount(hostEstados);
estado404.accion.el.click();
exigir(
  Boolean(hostEstados.querySelector('.hc-page--inicio')),
  'Volver al inicio no monto app.inicio en el contenedor'
);
ok('ok estados: Volver al inicio navega a app.inicio');

clientesStore.remove(clientesStore.list().map((fila) => fila.id));
const hostVacio = documento.createElement('div');
documento.body.appendChild(hostVacio);
const inicioVacio = inicio.mount(hostVacio);
const kpisVacios = hostVacio.querySelectorAll('.hc-inicio__kpi-valor').map((nodo) => nodo.textContent);
exigir(kpisVacios.length === 4, `con el store vacio se montaron ${kpisVacios.length} KPI, deberian ser 4`);
exigir(kpisVacios.slice(0, 3).join('|') === '0|0|0', `con el store vacio los KPI muestran ${kpisVacios.join(' | ')}`);
exigir(kpisVacios[3].includes('0,00'), `con el store vacio el saldo muestra ${kpisVacios[3]}`);
exigir(
  hostVacio.querySelector('.hc-inicio__vacio').hidden === false,
  'con el store vacio no se muestra el estado vacio de la tabla'
);
exigir(
  hostVacio.querySelector('.hc-lista__contenedor').hidden === true,
  'con el store vacio la tabla de altas sigue visible'
);
inicioVacio.destroy();
clientesStore.reset();
ok('ok inicio: con el store vacio los KPI valen 0 y la tabla muestra su estado vacio');

// --- accesibilidad del shell -----------------------------------------

const hostPanel = documento.createElement('div');
documento.body.appendChild(hostPanel);
const panel = mountDashboard(hostPanel, {
  menu: [
    { id: 'app.inicio', name: 'Inicio', icon: 'dashboard' },
    { id: 'app.demo.otra', name: 'Otra', icon: 'flag' },
  ],
});
panel.select('app.inicio');

const skip = hostPanel.querySelector('a.hc-skip-link');
exigir(Boolean(skip), 'el shell no tiene skip link');
exigir(skip.getAttribute('href') === '#hc-main', `el skip link apunta a ${skip.getAttribute('href')}, deberia apuntar a #hc-main`);
ok('ok dashboard: skip link al contenido');

const main = hostPanel.querySelector('#hc-main');
exigir(Boolean(main) && main.getAttribute('role') === 'main', 'el cuerpo del dashboard no es la region main');
ok('ok dashboard: role main en el cuerpo');

const itemsSidebar = hostPanel.querySelectorAll('.z-sidebar__item');
const activoInicio = itemsSidebar.find((item) => item.getAttribute('data-id') === 'app.inicio');
const inactivoDemo = itemsSidebar.find((item) => item.getAttribute('data-id') === 'app.demo.otra');
exigir(
  Boolean(activoInicio) && activoInicio.getAttribute('aria-current') === 'page',
  'el item activo del sidebar no lleva aria-current="page"'
);
exigir(
  Boolean(inactivoDemo) && inactivoDemo.getAttribute('aria-current') === null,
  'un item inactivo del sidebar conserva aria-current'
);
ok('ok dashboard: aria-current="page" solo en el item activo');

const etiquetaMenu = panel.mainbar.action ? panel.mainbar.action.getAttribute('aria-label') : null;
exigir(etiquetaMenu === 'Abrir o cerrar el menu', `el boton de menu tiene aria-label "${etiquetaMenu}"`);
ok('ok dashboard: aria-label en el boton de menu');

exigir(
  Boolean(hostPanel.querySelector('.hc-page--inicio .hc-inicio__kpi')),
  'el dashboard no monto la pantalla de inicio al seleccionarla'
);
const valoresKpi = hostPanel.querySelectorAll('.hc-inicio__kpi-valor').map((nodo) => nodo.textContent);
exigir(valoresKpi.length === 4, `la pantalla de inicio muestra ${valoresKpi.length} KPI, deberian ser 4`);
exigir(valoresKpi[0] === '5', `el KPI de clientes muestra "${valoresKpi[0]}", deberia mostrar 5`);
ok(`ok inicio: cuatro KPI montados desde el dashboard (${valoresKpi.join(' | ')})`);

const tablaInicio = hostPanel.querySelector('.hc-inicio__panel--altas .z-datatable');
exigir(Boolean(tablaInicio), 'la pantalla de inicio no monto la tabla de ultimas altas');
const filasTablaInicio = hostPanel.querySelectorAll('.hc-inicio__panel--altas .z-datatable__row');
exigir(filasTablaInicio.length === 5, `la tabla de ultimas altas tiene ${filasTablaInicio.length} filas, deberia tener 5`);
ok('ok inicio: la tabla montada muestra las cinco altas mas recientes');

const gageInicio = hostPanel.querySelector('.z-gage svg');
exigir(Boolean(gageInicio), 'la pantalla de inicio no monto el gage');
const valorGage = Number(gageInicio.querySelector('.z-gage__value').textContent.replace('%', ''));
exigir(valorGage >= 0 && valorGage <= 100, `el gage montado muestra ${valorGage}, deberia estar entre 0 y 100`);
ok(`ok inicio: el gage montado muestra ${valorGage}%`);

panel.destroy();

// --- mobile: drawer, formulario, tabla y targets ----------------------
//
// El drawer solo existe por debajo del breakpoint de 900 px, asi que estas
// verificaciones montan el dashboard con la media query en modo angosto. En
// Node no hay `matchMedia`: se inyecta un objeto minimo en `globalThis` y se
// restaura al terminar.

/**
 * Activa un ancho de pantalla angosto para el proximo montaje del dashboard.
 * @returns {() => void} restaura el global previo
 */
function simularAnchoAngosto() {
  const previo = globalThis.window;
  const consulta = {
    media: '(max-width: 900px)',
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.window = { matchMedia: () => consulta };
  return () => {
    globalThis.window = previo;
  };
}

/**
 * Devuelve el cuerpo del primer bloque `@media (max-width: <ancho>px)`.
 * @param {string} css
 * @param {number} ancho
 * @returns {string}
 */
function bloqueMedia(css, ancho) {
  const marca = `@media (max-width: ${ancho}px)`;
  const inicio = css.indexOf(marca);
  if (inicio < 0) return '';
  const abre = css.indexOf('{', inicio);
  if (abre < 0) return '';
  let nivel = 0;
  for (let indice = abre; indice < css.length; indice += 1) {
    if (css[indice] === '{') nivel += 1;
    else if (css[indice] === '}') {
      nivel -= 1;
      if (nivel === 0) return css.slice(abre + 1, indice);
    }
  }
  return '';
}

const hostAngosto = documento.createElement('div');
documento.body.appendChild(hostAngosto);
const restaurarAncho = simularAnchoAngosto();
const angosto = mountDashboard(hostAngosto, {
  menu: [
    { id: 'app.inicio', name: 'Inicio', icon: 'dashboard' },
    {
      id: 'app.abm',
      name: 'ABM',
      icon: 'table',
      items: [{ id: 'app.abm.clientes_view', name: 'Clientes' }],
    },
  ],
});

exigir(angosto.drawer.isOpen() === false, 'el drawer deberia arrancar cerrado en ancho angosto');
angosto.drawer.open();
exigir(angosto.drawer.isOpen() === true, 'el drawer no se abrio en ancho angosto');
exigir(
  angosto.root.classList.contains('hc-dashboard--drawer-open'),
  'el shell no marca el drawer abierto'
);

angosto.select('app.abm');
exigir(
  angosto.drawer.isOpen() === false,
  'el drawer sigue abierto despues de elegir un item con hijos'
);
exigir(
  angosto.root.classList.contains('hc-dashboard--drawer-open') === false,
  'el shell conserva la clase del drawer abierto despues de elegir un item con hijos'
);

angosto.drawer.open();
angosto.select('app.inicio');
exigir(
  angosto.drawer.isOpen() === false,
  'el drawer sigue abierto despues de elegir un item hoja'
);
exigir(
  Boolean(hostAngosto.querySelector('.hc-page--inicio')),
  'la navegacion en ancho angosto no pinto el contenido del item elegido'
);
ok('ok dashboard: el drawer se cierra despues de pintar el contenido elegido');

angosto.destroy();
restaurarAncho();

const raizSrc = dirname(fileURLToPath(import.meta.url));
const cssTema = readFileSync(join(raizSrc, '..', '..', 'compat', 'theme.css'), 'utf8');
const fuenteVista = readFileSync(join(raizSrc, '..', '..', 'compat', 'pages', 'clientes_view.js'), 'utf8');
const compacto = bloqueMedia(cssTema, 640);

exigir(compacto !== '', 'theme.css no declara un bloque @media (max-width: 640px)');
exigir(
  /\.hc-page--clientes-form\s+\.z-form\s*\{[^}]*grid-template-columns\s*:\s*minmax\(\s*0\s*,\s*1fr\s*\)/.test(compacto),
  'el media query de 640 no deja el formulario de clientes en una sola columna'
);
exigir(
  /\.hc-page--clientes-form\s+\.hc-campo[^{]*\{[^}]*width:\s*100%/.test(compacto),
  'en el media query de 640 los campos del formulario no ocupan el ancho completo'
);
ok('ok mobile: el formulario de clientes usa una columna por debajo de 640');

exigir(
  /\.hc-dashboard\s+\.z-button[^{]*\{[^}]*min-height:\s*44px/.test(compacto),
  'en el media query de 640 los botones no declaran 44 px de alto'
);
exigir(
  /\.z-text__input[^{]*\{[^}]*min-height:\s*44px/.test(compacto),
  'en el media query de 640 los campos de entrada no declaran 44 px de alto'
);
ok('ok mobile: botones y campos declaran 44 px de alto por debajo de 640');

exigir(
  /\.hc-lista__contenedor\s*\{[^}]*overflow-x:\s*auto/.test(cssTema),
  'el contenedor de la tabla no declara scroll horizontal propio'
);
exigir(
  /\.hc-lista__contenedor\s*\{[^}]*max-width:\s*100%/.test(cssTema),
  'el contenedor de la tabla no acota su ancho al del panel'
);
const anchoTabla = cssTema.match(/\.hc-page--clientes\s+\.hc-lista__tabla\s*\{[^}]*min-width:\s*(\d+)px/);
exigir(anchoTabla !== null, 'la tabla de clientes no declara un ancho minimo');
exigir(
  Number(anchoTabla[1]) >= 640,
  `el ancho minimo de la tabla es ${anchoTabla[1]}px, deberia evitar comprimir las siete columnas`
);
exigir(
  /overflowX/.test(fuenteVista) && /minWidth/.test(fuenteVista),
  'clientes_view.js no deja el scroll horizontal en el contenedor ni el ancho minimo en la tabla'
);
ok(`ok mobile: la tabla scrollea en su contenedor con ${anchoTabla[1]}px de ancho minimo`);

// --- tema claro/oscuro ------------------------------------------------
//
// El theme declara la paleta oscura dos veces: en `[data-theme="dark"]` y en el
// media query de `prefers-color-scheme` (que aplica cuando la raiz no lleva
// atributo). Las dos listas tienen que cubrir exactamente los tokens de color
// de `:root`: si se agrega un token al tema claro y se olvida en el oscuro, el
// check falla. Los pares de contraste se miden con la formula de luminancia de
// WCAG 2.1 y tienen que llegar a 4.5, el minimo para texto normal.

/**
 * Devuelve el interior del primer bloque cuya marca aparece en el CSS.
 *
 * Empareja llaves desde la primera `{` que sigue a la marca, asi que sirve
 * tanto para una regla (`.clase { ... }`) como para un `@media { ... }`.
 *
 * @param {string} css
 * @param {string} marca
 * @returns {string}
 */
function bloqueDe(css, marca) {
  const inicio = css.indexOf(marca);
  if (inicio < 0) return '';
  const abre = css.indexOf('{', inicio);
  if (abre < 0) return '';
  let nivel = 0;
  for (let indice = abre; indice < css.length; indice += 1) {
    if (css[indice] === '{') nivel += 1;
    else if (css[indice] === '}') {
      nivel -= 1;
      if (nivel === 0) return css.slice(abre + 1, indice);
    }
  }
  return '';
}

/**
 * Tokens `--hc-*` de un bloque CSS, con el valor normalizado.
 * @param {string} bloque
 * @returns {Map<string, string>}
 */
function tokensDe(bloque) {
  const tokens = new Map();
  const patron = /(--hc-[a-z0-9-]+)\s*:\s*([^;]+);/g;
  let encontrado = patron.exec(bloque);
  while (encontrado) {
    tokens.set(encontrado[1], encontrado[2].trim().replace(/\s+/g, ' '));
    encontrado = patron.exec(bloque);
  }
  return tokens;
}

/**
 * Indica si el valor de un token es un color literal.
 * @param {string} valor
 * @returns {boolean}
 */
function esColor(valor) {
  return /^#[0-9a-f]{3,8}$/i.test(valor) || /^rgba?\(/i.test(valor);
}

/**
 * Luminancia relativa de un color `#rrggbb`, segun WCAG 2.1.
 * @param {string} hex
 * @returns {number}
 */
function luminancia(hex) {
  const limpio = String(hex).trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(limpio)) {
    throw new TypeError(`luminancia: "${hex}" no es un color #rrggbb`);
  }
  const canales = [0, 2, 4].map((inicio) => {
    const valor = parseInt(limpio.slice(inicio, inicio + 2), 16) / 255;
    return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

/**
 * Contraste entre dos colores `#rrggbb` (1 a 21).
 * @param {string} unColor
 * @param {string} otroColor
 * @returns {number}
 */
function contraste(unColor, otroColor) {
  const uno = luminancia(unColor);
  const otro = luminancia(otroColor);
  const claro = Math.max(uno, otro);
  const oscuro = Math.min(uno, otro);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Contraste minimo de AA para texto normal. */
const AA_TEXTO = 4.5;

/** Pares obligatorios: etiqueta, token del texto y token del fondo. */
const PARES_CONTRASTE = [
  ['texto sobre fondo', '--hc-text', '--hc-bg'],
  ['texto sobre superficie', '--hc-text', '--hc-surface'],
  ['texto atenuado sobre superficie', '--hc-muted', '--hc-surface'],
  ['blanco sobre primario', '#ffffff', '--hc-primary'],
];

const tokensClaro = tokensDe(bloqueDe(cssTema, ':root {'));
const tokensOscuro = tokensDe(bloqueDe(cssTema, '[data-theme="dark"] {'));
const bloqueSistema = bloqueDe(cssTema, '@media (prefers-color-scheme: dark)');
const tokensSistema = tokensDe(bloqueSistema);

exigir(tokensClaro.size > 0, 'theme.css no declara tokens en :root');
exigir(tokensOscuro.size > 0, 'theme.css no declara un bloque [data-theme="dark"]');

const tokensDeColor = [...tokensClaro].filter(([, valor]) => esColor(valor)).map(([nombre]) => nombre);
exigir(tokensDeColor.length >= 20, `:root declara ${tokensDeColor.length} tokens de color, se esperaban al menos 20`);

const faltanEnOscuro = tokensDeColor.filter((nombre) => !tokensOscuro.has(nombre));
exigir(
  faltanEnOscuro.length === 0,
  `el bloque [data-theme="dark"] no redefine: ${faltanEnOscuro.join(', ')}`
);

const sobranEnOscuro = [...tokensOscuro.keys()].filter((nombre) => !tokensClaro.has(nombre));
exigir(
  sobranEnOscuro.length === 0,
  `el bloque [data-theme="dark"] define tokens que no existen en :root: ${sobranEnOscuro.join(', ')}`
);
ok(`ok tema: el bloque oscuro redefine los ${tokensDeColor.length} tokens de color de :root`);

const TOKENS_OBLIGATORIOS = [
  '--hc-bg',
  '--hc-surface',
  '--hc-surface-2',
  '--hc-border',
  '--hc-text',
  '--hc-muted',
  '--hc-primary',
  '--hc-primary-text',
  '--hc-danger',
  '--hc-mainbar-bg',
  '--hc-mainbar-text',
  '--hc-mainbar-hover',
];
for (const nombre of TOKENS_OBLIGATORIOS) {
  exigir(tokensOscuro.has(nombre), `el bloque oscuro no define ${nombre}`);
}
ok(`ok tema: el bloque oscuro define ${TOKENS_OBLIGATORIOS.length} tokens obligatorios (fondo, superficies, borde, textos, primario, peligro, mainbar y hover)`);

exigir(bloqueSistema !== '', 'theme.css no declara @media (prefers-color-scheme: dark)');
exigir(
  /:root:not\(\[data-theme\]\)/.test(bloqueSistema),
  'el media query de prefers-color-scheme no excluye el tema explicito'
);
exigir(
  tokensSistema.size === tokensOscuro.size,
  `el media query define ${tokensSistema.size} tokens y el bloque oscuro ${tokensOscuro.size}`
);
for (const [nombre, valor] of tokensOscuro) {
  exigir(
    tokensSistema.get(nombre) === valor,
    `el media query y el bloque oscuro no coinciden en ${nombre} (${tokensSistema.get(nombre)} vs ${valor})`
  );
}
ok('ok tema: preferencias del sistema y bloque oscuro declaran los mismos tokens con los mismos valores');

exigir(
  luminancia(tokensOscuro.get('--hc-bg')) < 0.2,
  `el fondo oscuro (${tokensOscuro.get('--hc-bg')}) no es oscuro`
);
exigir(
  luminancia(tokensClaro.get('--hc-bg')) > 0.5,
  `el fondo claro (${tokensClaro.get('--hc-bg')}) no es claro`
);
exigir(
  tokensOscuro.get('--hc-bg') !== tokensClaro.get('--hc-bg'),
  'el tema oscuro repite el fondo del tema claro'
);
ok('ok tema: la paleta oscura cambia fondo, superficies y textos respecto del claro');

const contrastesFallidos = [];
for (const [etiqueta, tokenTexto, tokenFondo] of PARES_CONTRASTE) {
  for (const [tema, tokens] of [
    ['claro', tokensClaro],
    ['oscuro', tokensOscuro],
  ]) {
    exigir(tokens.has(tokenFondo), `el tema ${tema} no define ${tokenFondo}`);
    const valorTexto = tokenTexto.startsWith('#') ? tokenTexto : tokens.get(tokenTexto);
    exigir(typeof valorTexto === 'string', `el tema ${tema} no define ${tokenTexto}`);
    const valorFondo = tokens.get(tokenFondo);
    const medido = contraste(valorTexto, valorFondo);
    const linea = `${etiqueta} (${tema}): ${valorTexto} sobre ${valorFondo} = ${medido.toFixed(2)}`;
    if (medido < AA_TEXTO) contrastesFallidos.push(linea);
    else ok(`ok contraste: ${linea}`);
  }
}
exigir(
  contrastesFallidos.length === 0,
  `pares por debajo de ${AA_TEXTO}:\n  ${contrastesFallidos.join('\n  ')}`
);

// Sin eleccion guardada manda el sistema: la raiz queda sin `data-theme` y el
// CSS resuelve con el media query. Si el shell escribiera el atributo, el
// dashboard se quedaria en un tema fijo y `prefers-color-scheme` no serviria.
const matchMediaPrevio = globalThis.matchMedia;
globalThis.matchMedia = (consulta) => ({
  media: consulta,
  matches: consulta === '(prefers-color-scheme: dark)',
});
documento.body.removeAttribute('data-theme');
const hostSistema = documento.createElement('div');
documento.body.appendChild(hostSistema);
const panelSistema = mountDashboard(hostSistema, {
  menu: [{ id: 'app.inicio', name: 'Inicio', icon: 'dashboard' }],
});
exigir(
  documento.body.getAttribute('data-theme') === null,
  'sin eleccion guardada el shell escribe data-theme y deja sin efecto a prefers-color-scheme'
);
exigir(
  panelSistema.mainbar.theme.getAttribute('aria-pressed') === 'true',
  'sin eleccion guardada el boton no refleja el tema oscuro que pide el sistema'
);
ok('ok tema: sin hc-theme la raiz queda sin data-theme y el tema lo resuelve prefers-color-scheme');
panelSistema.destroy();
if (matchMediaPrevio === undefined) delete globalThis.matchMedia;
else globalThis.matchMedia = matchMediaPrevio;

// --- toggle, persistencia y montaje ------------------------------------

/**
 * `localStorage` en memoria, para verificar la persistencia sin navegador.
 * @returns {Storage}
 */
function crearAlmacen() {
  const datos = new Map();
  return {
    getItem: (clave) => (datos.has(String(clave)) ? datos.get(String(clave)) : null),
    setItem: (clave, valor) => {
      datos.set(String(clave), String(valor));
    },
    removeItem: (clave) => {
      datos.delete(String(clave));
    },
    clear: () => {
      datos.clear();
    },
    key: (indice) => [...datos.keys()][indice] ?? null,
    get length() {
      return datos.size;
    },
  };
}

const fuenteMainbar = readFileSync(join(raizSrc, 'mainbar.js'), 'utf8');
const lineasConAlmacen = fuenteMainbar
  .split('\n')
  .filter((linea) => /localStorage/.test(linea) && !/^\s*(\*|\/\/|\/\*)/.test(linea));
exigir(lineasConAlmacen.length > 0, 'mainbar.js no usa localStorage para persistir el tema');
for (const linea of lineasConAlmacen) {
  exigir(
    /^\s{2,}\S/.test(linea),
    `mainbar.js toca localStorage fuera de una funcion (al importar el modulo): "${linea.trim()}"`
  );
}
ok('ok tema: el acceso a localStorage vive dentro de funciones, no al importar el modulo');

const almacen = crearAlmacen();
const almacenPrevio = globalThis.localStorage;
globalThis.localStorage = almacen;

const hostTema = documento.createElement('div');
documento.body.appendChild(hostTema);
const panelTema = mountDashboard(hostTema, {
  menu: [{ id: 'app.inicio', name: 'Inicio', icon: 'dashboard' }],
});

const botonTema = panelTema.mainbar.theme;
exigir(Boolean(botonTema), 'la mainbar no tiene el boton de tema');
const etiquetaTema = botonTema.getAttribute('aria-label');
exigir(typeof etiquetaTema === 'string' && etiquetaTema.trim() !== '', 'el boton de tema no tiene aria-label');
const presionadoInicial = botonTema.getAttribute('aria-pressed');
exigir(
  presionadoInicial === 'true' || presionadoInicial === 'false',
  `el boton de tema tiene aria-pressed="${presionadoInicial}", deberia ser "true" o "false"`
);
const iconoTema = botonTema.querySelector('svg.hc-icon');
exigir(Boolean(iconoTema), 'el boton de tema no dibuja el icono de Zorzal');
const nombreIcono = iconoTema.getAttribute('data-hc-icon');
exigir(
  nombreIcono === 'moon' || nombreIcono === 'sun',
  `el boton de tema usa el icono "${nombreIcono}", deberia ser moon o sun`
);
ok(`ok tema: boton con aria-label="${etiquetaTema}", aria-pressed="${presionadoInicial}" e icono ${nombreIcono}`);

botonTema.click();
exigir(almacen.getItem('hc-theme') === 'dark', `al pasar a oscuro se guardo "${almacen.getItem('hc-theme')}" en hc-theme`);
exigir(documento.body.getAttribute('data-theme') === 'dark', 'el tema oscuro no quedo en data-theme de la raiz');
exigir(botonTema.getAttribute('aria-pressed') === 'true', 'aria-pressed no quedo en true con el tema oscuro');
exigir(
  botonTema.querySelector('svg.hc-icon').getAttribute('data-hc-icon') === 'sun',
  'con el tema oscuro el boton no muestra el icono sun'
);

botonTema.click();
exigir(almacen.getItem('hc-theme') === 'light', `al volver a claro se guardo "${almacen.getItem('hc-theme')}"`);
exigir(documento.body.getAttribute('data-theme') === 'light', 'el tema claro no quedo en data-theme de la raiz');
exigir(botonTema.getAttribute('aria-pressed') === 'false', 'aria-pressed no quedo en false con el tema claro');
exigir(
  botonTema.querySelector('svg.hc-icon').getAttribute('data-hc-icon') === 'moon',
  'con el tema claro el boton no muestra el icono moon'
);
ok('ok tema: el toggle alterna data-theme, aria-pressed, el icono y la clave hc-theme');

almacen.setItem('hc-theme', 'dark');
const hostTemaGuardado = documento.createElement('div');
documento.body.appendChild(hostTemaGuardado);
const panelGuardado = mountDashboard(hostTemaGuardado, {
  menu: [{ id: 'app.inicio', name: 'Inicio', icon: 'dashboard' }],
});
exigir(
  documento.body.getAttribute('data-theme') === 'dark',
  'al montar el shell no se leyo hc-theme de localStorage'
);
exigir(
  panelGuardado.mainbar.theme.getAttribute('aria-pressed') === 'true',
  'al montar el shell el boton no refleja el tema guardado'
);
ok('ok tema: al montar el shell se aplica la eleccion guardada en hc-theme');

panelGuardado.destroy();
almacen.setItem('hc-theme', 'light');
panelTema.destroy();
if (almacenPrevio === undefined) delete globalThis.localStorage;
else globalThis.localStorage = almacenPrevio;

clientesStore.reset();

/** Cliente valido base para las pruebas del formulario. */
const CLIENTE_VALIDO = {
  apellido: 'Lopez',
  nombre: 'Ana',
  addr: 'Rivadavia 1',
  doc: '36000111',
  tel: '11 5555-1006',
  fingreso: '2024-05-12',
  id_cobrador: '3',
};

/**
 * Monta el formulario de alta sobre el DOM minimo.
 * @param {Record<string, unknown>} [options]
 * @returns {{ host: any, controlador: any, eventos: any[], navegaciones: { total: number } }}
 */
function montarFormulario(options = {}) {
  clientesStore.reset();
  const host = documento.createElement('div');
  documento.body.appendChild(host);
  const eventos = [];
  const navegaciones = { total: 0 };
  const controlador = mountClientesForm(host, {
    onBack: () => {
      navegaciones.total += 1;
    },
    ...options,
  });
  controlador.root.addEventListener('clientes:guardado', (evento) => {
    eventos.push(evento.detail);
  });
  return { host, controlador, eventos, navegaciones };
}

// DNI invalido: letras y largo fuera del rango se rechazan, con el mensaje
// debajo del campo y los atributos ARIA asociados.
const dniLetras = montarFormulario({ onSaved: () => {} });
dniLetras.controlador.form.setValues({ ...CLIENTE_VALIDO, doc: '12AB3456' });
exigir(dniLetras.controlador.save() === false, 'un DNI con letras no deberia guardarse');
const campoDocLetras = dniLetras.controlador.form.field('doc');
const errorDocLetras = buscarPorId(dniLetras.controlador.root, 'clientes-error-doc');
exigir(campoDocLetras.input.getAttribute('aria-invalid') === 'true', 'el DNI invalido no se marco con aria-invalid');
exigir(
  campoDocLetras.input.getAttribute('aria-describedby') === 'clientes-error-doc',
  'el DNI invalido no se asocio con su mensaje por aria-describedby'
);
exigir(
  Boolean(errorDocLetras) && errorDocLetras.textContent.includes('7 y 9') && errorDocLetras.hidden === false,
  'el mensaje del DNI no aparece debajo del campo'
);
exigir(dniLetras.eventos.length === 0, 'un error de DNI emitio clientes:guardado');
ok('ok formulario: DNI invalido rechazado con mensaje y ARIA');

const dniCorto = montarFormulario({ onSaved: () => {} });
dniCorto.controlador.form.setValues({ ...CLIENTE_VALIDO, doc: '123456' });
exigir(dniCorto.controlador.save() === false, 'un DNI de 6 digitos no deberia guardarse');
ok('ok formulario: DNI con menos de 7 digitos rechazado');

const dniLargo = montarFormulario({ onSaved: () => {} });
dniLargo.controlador.form.setValues({ ...CLIENTE_VALIDO, doc: '1234567890' });
exigir(dniLargo.controlador.save() === false, 'un DNI de 10 digitos no deberia guardarse');
ok('ok formulario: DNI con mas de 9 digitos rechazado');

// DNI valido: 7 y 9 digitos se aceptan.
const dniValido = montarFormulario({ onSaved: () => {} });
dniValido.controlador.form.setValues({ ...CLIENTE_VALIDO, doc: '1234567' });
exigir(dniValido.controlador.save() === true, 'un DNI de 7 digitos deberia aceptarse');
exigir(dniValido.eventos.length === 1, `el alta valida emitio ${dniValido.eventos.length} eventos`);
ok('ok formulario: DNI valido aceptado');

// Edicion: el formulario viene precargado, conserva la fecha de ingreso y
// actualiza la fila en lugar de agregar.
const edicion = montarFormulario({ id: 1, onSaved: () => {} });
const editado = edicion.controlador.form.getValues();
exigir(editado.apellido === 'Perez', `el formulario de edicion no precargo el apellido (${editado.apellido})`);
exigir(editado.fingreso === '2021-03-15', `el formulario de edicion no precargo la fecha (${editado.fingreso})`);
edicion.controlador.form.setValues({ tel: '11 5555-9999' });
exigir(edicion.controlador.save() === true, 'la edicion con datos validos no guardo');
const filasEditadas = clientesStore.list();
exigir(filasEditadas.length === 5, `la edicion dejo ${filasEditadas.length} filas, deberian ser 5`);
const filaUno = clientesStore.getById(1);
exigir(filaUno.tel === '11 5555-9999', `la edicion no actualizo el telefono (${filaUno.tel})`);
exigir(filaUno.fingreso === '2021-03-15', `la edicion perdio la fecha de ingreso (${filaUno.fingreso})`);
ok('ok formulario: la edicion actualiza la fila y conserva la fecha de ingreso');

// Telefono invalido: letras fuera de los caracteres admitidos.
const telefonoMal = montarFormulario({ onSaved: () => {} });
telefonoMal.controlador.form.setValues({ ...CLIENTE_VALIDO, tel: 'abc123' });
exigir(telefonoMal.controlador.save() === false, 'un telefono con letras no deberia guardarse');
const campoTelMal = telefonoMal.controlador.form.field('tel');
const errorTelMal = buscarPorId(telefonoMal.controlador.root, 'clientes-error-tel');
exigir(
  campoTelMal.input.getAttribute('aria-invalid') === 'true',
  'el telefono invalido no se marco con aria-invalid'
);
exigir(
  Boolean(errorTelMal) && errorTelMal.textContent.includes('solo admite') && errorTelMal.hidden === false,
  'el mensaje del telefono no aparece debajo del campo'
);
exigir(telefonoMal.eventos.length === 0, 'un error de telefono emitio clientes:guardado');
ok('ok formulario: telefono invalido rechazado');

// Telefono fuera de largo: menos de 6 caracteres.
const telefonoCorto = montarFormulario({ onSaved: () => {} });
telefonoCorto.controlador.form.setValues({ ...CLIENTE_VALIDO, tel: '12345' });
exigir(telefonoCorto.controlador.save() === false, 'un telefono de 5 caracteres no deberia guardarse');
ok('ok formulario: telefono corto rechazado');

// Telefono vacio: la regla es opcional.
const telefonoVacio = montarFormulario({ onSaved: () => {} });
telefonoVacio.controlador.form.setValues({ ...CLIENTE_VALIDO, tel: '' });
exigir(telefonoVacio.controlador.save() === true, 'un telefono vacio deberia aceptarse');
exigir(telefonoVacio.eventos.length === 1, 'el alta sin telefono no emitio clientes:guardado');
ok('ok formulario: telefono vacio aceptado');

// Fecha de ingreso: real o vacia.
const fechaMal = montarFormulario({ onSaved: () => {} });
fechaMal.controlador.form.setValues({ ...CLIENTE_VALIDO, fingreso: '2024-02-31' });
exigir(fechaMal.controlador.save() === false, 'una fecha inexistente no deberia guardarse');
const errorFecha = buscarPorId(fechaMal.controlador.root, 'clientes-error-fingreso');
exigir(
  Boolean(errorFecha) && errorFecha.textContent.includes('fecha válida'),
  'el mensaje de la fecha de ingreso no aparece debajo del campo'
);
const fechaVacia = montarFormulario({ onSaved: () => {} });
fechaVacia.controlador.form.setValues({ ...CLIENTE_VALIDO, fingreso: '' });
exigir(fechaVacia.controlador.save() === true, 'una fecha de ingreso vacia deberia aceptarse');
ok('ok formulario: fecha de ingreso invalida rechazada y vacia aceptada');

// Email: la regla existe para cuando el formulario tenga el campo.
const sinEmail = validar({ ...CLIENTE_VALIDO, email: 'ana.example.com' });
exigir(Boolean(sinEmail.errors.email), 'un email sin arroba ni punto no se reporto');
exigir(!validar({ ...CLIENTE_VALIDO, email: 'ana@example.com' }).errors.email, 'un email valido se rechazo');
ok('ok formulario: email con arroba y punto validado');

// Estado de guardado: el boton pasa a Guardando... y deshabilitado, y vuelve
// a Guardar cuando termina. El evento llega una sola vez.
const estados = montarFormulario({ onSaved: () => {} });
estados.controlador.form.setValues({ ...CLIENTE_VALIDO });
let estadoDurante = null;
estados.controlador.root.addEventListener('clientes:guardado', () => {
  const boton = buscarPorNombre(estados.controlador.root, 'clientes_guardar');
  estadoDurante = {
    texto: boton ? boton.textContent : '',
    deshabilitado: Boolean(boton && boton.getAttribute('disabled') === ''),
  };
});
const guardoValido = estados.controlador.save();
exigir(guardoValido === true, 'el alta con datos validos no guardo');
exigir(estados.eventos.length === 1, `el alta valida emitio ${estados.eventos.length} eventos`);
exigir(
  Boolean(estadoDurante) && estadoDurante.texto === 'Guardando...' && estadoDurante.deshabilitado,
  `el boton no quedo en Guardando... durante el guardado (${estadoDurante ? estadoDurante.texto : 'sin estado'})`
);
await Promise.resolve();
const botonFinal = buscarPorNombre(estados.controlador.root, 'clientes_guardar');
exigir(
  Boolean(botonFinal) && botonFinal.textContent === 'Guardar' && botonFinal.getAttribute('disabled') === null,
  'el boton no volvio a Guardar despues del guardado'
);
ok('ok formulario: guardar valido emite clientes:guardado una vez con el boton en Guardando...');

// Foco: el primer campo invalido recibe el foco.
const foco = montarFormulario({ onSaved: () => {} });
foco.controlador.form.setValues({ ...CLIENTE_VALIDO, doc: '123' });
exigir(foco.controlador.save() === false, 'un DNI corto no deberia guardarse');
exigir(
  documento.activeElement === foco.controlador.form.field('doc').input,
  'el foco no se movio al primer campo invalido'
);
ok('ok formulario: el foco va al primer campo invalido');

// Resumen: con mas de un error aparece arriba, con un enlace por campo.
const resumen = montarFormulario({ onSaved: () => {} });
exigir(resumen.controlador.save() === false, 'el alta vacia no deberia guardarse');
const cajaResumen = buscarPorClase(resumen.controlador.root, 'hc-resumen');
exigir(Boolean(cajaResumen) && cajaResumen.hidden === false, 'el resumen no se muestra con varios errores');
const enlaces = contarEtiquetas(cajaResumen, 'a');
exigir(enlaces === 5, `el resumen tiene ${enlaces} enlaces, deberia tener 5`);
const primerEnlace = cajaResumen.childNodes[1].childNodes[0].childNodes[0];
exigir(
  primerEnlace.getAttribute('href') === '#clientes-campo-apellido',
  `el primer enlace del resumen apunta a ${primerEnlace.getAttribute('href')}`
);
ok('ok formulario: resumen de errores con un enlace por campo');

// Cancelar sin cambios: cierra sin preguntar.
let confirmaciones = 0;
let respuesta = false;
const sinCambios = montarFormulario({
  confirm: () => {
    confirmaciones += 1;
    return respuesta;
  },
});
exigir(sinCambios.controlador.cancel() === true, 'cancelar sin cambios no cerro');
exigir(confirmaciones === 0, 'cancelar sin cambios pidio confirmacion');
exigir(sinCambios.navegaciones.total === 1, 'cancelar sin cambios no volvio a la vista');
ok('ok formulario: cancelar sin cambios cierra directo');

// Cancelar con cambios: pide confirmacion y respeta la respuesta.
confirmaciones = 0;
respuesta = false;
const conCambios = montarFormulario({
  confirm: () => {
    confirmaciones += 1;
    return respuesta;
  },
});
conCambios.controlador.form.setValues({ apellido: 'Lopez Corregido' });
exigir(conCambios.controlador.cancel() === false, 'cancelar con cambios y respuesta negativa cerro igual');
exigir(confirmaciones === 1, 'cancelar con cambios no pidio confirmacion');
exigir(conCambios.navegaciones.total === 0, 'la respuesta negativa navego igual');
respuesta = true;
exigir(conCambios.controlador.cancel() === true, 'cancelar con cambios y respuesta positiva no cerro');
exigir(conCambios.navegaciones.total === 1, 'la respuesta positiva no volvio a la vista');
ok('ok formulario: cancelar con cambios pide confirmacion');

// Escape: hace lo mismo que Cancelar.
confirmaciones = 0;
respuesta = false;
const conEscape = montarFormulario({
  confirm: () => {
    confirmaciones += 1;
    return respuesta;
  },
});
conEscape.controlador.form.setValues({ nombre: 'Ana Maria' });
const inputNombre = conEscape.controlador.form.field('nombre').input;
inputNombre.dispatchEvent({ type: 'keydown', key: 'Escape', bubbles: true });
exigir(confirmaciones === 1, 'Escape con cambios no pidio confirmacion');
exigir(conEscape.navegaciones.total === 0, 'Escape con respuesta negativa cerro igual');
respuesta = true;
inputNombre.dispatchEvent({ type: 'keydown', key: 'Escape', bubbles: true });
exigir(conEscape.navegaciones.total === 1, 'Escape con respuesta positiva no cerro');
ok('ok formulario: Escape cancela como el boton');

clientesStore.reset();

// --- compatibilidad de navegadores ------------------------------------
//
// La matriz vive en `browserslist` (package.json) y se documenta en el SSOT
// (`projects/halcon/docs/2026-11-07-manual.md`). El verificador propio revisa `sdk/src` y
// `sdk/compat` en busca de APIs fuera de la matriz, y sus excepciones tienen
// que estar justificadas: una excepcion sin uso o sin motivo es una regresion
// futura, asi que tambien hace fallar el check.

const raizRepo = join(raizSrc, '..', '..', '..');
const paquete = JSON.parse(readFileSync(join(raizRepo, 'package.json'), 'utf8'));

exigir(Array.isArray(paquete.browserslist), 'package.json no declara browserslist');
exigir(paquete.browserslist.length > 0, 'browserslist esta vacio');

const FAMILIAS = ['Chrome', 'Edge', 'Firefox', 'Safari'];
for (const familia of FAMILIAS) {
  const consulta = paquete.browserslist.find((entrada) =>
    new RegExp(`last\\s+2\\s+${familia}\\s+versions`, 'i').test(String(entrada))
  );
  exigir(
    consulta !== undefined,
    `browserslist no pide las ultimas 2 versiones de ${familia} (${paquete.browserslist.join(' | ')})`
  );
}
exigir(
  paquete.browserslist.some((entrada) => /not\s+ie\b/i.test(String(entrada))),
  `browserslist no excluye Internet Explorer (${paquete.browserslist.join(' | ')})`
);
ok(`ok compat: browserslist declara las ultimas 2 versiones de ${FAMILIAS.join(', ')} y excluye IE`);

exigir(REGLAS_COMPAT.length >= 5, `el verificador de compatibilidad declara ${REGLAS_COMPAT.length} reglas`);
const informeCompat = revisarCompat();
exigir(
  informeCompat.archivos > 0,
  `el verificador de compatibilidad no reviso archivos (${informeCompat.archivos})`
);
exigir(
  informeCompat.hallazgos.length === 0,
  `el verificador de compatibilidad encontro ${informeCompat.hallazgos.length} hallazgo(s): ` +
    informeCompat.hallazgos.map((hallazgo) => `${hallazgo.archivo}:${hallazgo.linea} ${hallazgo.regla}`).join(', ')
);
exigir(
  informeCompat.excepcionesInvalidas.length === 0,
  `el verificador de compatibilidad tiene ${informeCompat.excepcionesInvalidas.length} excepcion(es) invalida(s)`
);
exigir(
  informeCompat.excepcionesSinUso.length === 0,
  `el verificador de compatibilidad tiene ${informeCompat.excepcionesSinUso.length} excepcion(es) sin uso`
);
ok(
  `ok compat: ${informeCompat.archivos} archivos sin APIs prohibidas ` +
    `(${informeCompat.reglas} reglas, ${informeCompat.excepciones} excepciones)`
);

process.exit(0);
