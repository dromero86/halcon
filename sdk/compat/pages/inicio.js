/**
 * Pantalla de inicio de Halcon sobre el widget set de Zorzal.
 *
 * Es la pantalla que el dashboard monta al entrar y la que resume el estado
 * del negocio a partir del store de clientes (`compat/store/clientes.js`):
 *
 *  - cuatro KPI: clientes totales, altas del mes, cobradores activos y saldo
 *    total;
 *  - un grafico de barras (`chart` de Zorzal) con los clientes por cobrador;
 *  - un indicador semicircular (`gage` de Zorzal) con el porcentaje de
 *    clientes con saldo cero;
 *  - una tabla (`datatable` de Zorzal) con las ultimas cinco altas.
 *
 * Nada de esto se escribe a mano: `resumen()` calcula los numeros sobre las
 * filas del store y la pantalla los repinta cada vez que el store emite
 * `change`. Con el store vacio los KPI muestran 0, el gage queda en 0 y la
 * tabla muestra su estado vacio.
 *
 * Uso:
 *
 *   import { mount } from './pages/inicio.js';
 *   const inicio = mount(document.querySelector('#contenido'));
 *
 * El modulo registra la pantalla como `app.inicio` al importarse.
 */

import { create } from '../../vendor/zorzal/src/zorzal.js';
import { app } from '../app-shim.js';
import * as store from '../store/clientes.js';
import { renderIcon } from '../icons.js';

/** Id de la pantalla en el registro de `app`. */
export const PAGE_ID = 'app.inicio';

/** Ids de los cuatro KPI. */
export const KPI_IDS = {
  clientes: 'inicio-kpi-clientes',
  altas: 'inicio-kpi-altas',
  cobradores: 'inicio-kpi-cobradores',
  saldo: 'inicio-kpi-saldo',
};

/** Id del grafico de barras. */
export const CHART_ID = 'inicio_grafico';

/** Id del gage. */
export const GAGE_ID = 'inicio_gage';

/** Id de la tabla de ultimas altas. */
export const TABLE_ID = 'inicio_tabla';

/** Id del contenedor de la tabla (se oculta cuando no hay altas). */
export const TABLE_HOST_ID = 'inicio_tabla_host';

/** Id del estado vacio de la tabla. */
export const EMPTY_ID = 'inicio_vacio';

/** Cuantas altas muestra la tabla. */
export const ULTIMAS_ALTAS = 5;

/** Columnas de la tabla de ultimas altas. */
export const COLUMNS = [
  { id: 'cliente', header: 'Cliente' },
  { id: 'fingreso', header: 'Ingreso' },
  { id: 'cobrador', header: 'Cobrador' },
  { id: 'saldo', header: 'Saldo', align: 'right' },
];

/** Descripcion de cada KPI: id, etiqueta e icono del set de Zorzal. */
const TARJETAS = [
  { clave: 'clientes', id: KPI_IDS.clientes, etiqueta: 'Clientes totales', icono: 'address-book' },
  { clave: 'altas', id: KPI_IDS.altas, etiqueta: 'Altas del mes', icono: 'plus' },
  { clave: 'cobradores', id: KPI_IDS.cobradores, etiqueta: 'Cobradores activos', icono: 'shopping-bag' },
  { clave: 'saldo', id: KPI_IDS.saldo, etiqueta: 'Saldo total', icono: 'shopping-cart' },
];

/**
 * Texto de un valor; lo ausente queda como cadena vacia.
 * @param {unknown} value
 * @returns {string}
 */
function texto(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * Numero redondeado a dos decimales.
 * @param {number} value
 * @returns {number}
 */
function redondear(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Agrupa los miles de un entero en texto: `23251` -> `23.251`.
 * @param {string} value
 * @returns {string}
 */
function agruparMiles(value) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Importe en pesos con separador de miles y dos decimales.
 * @param {unknown} value
 * @returns {string}
 */
export function formatearMoneda(value) {
  const numero = Math.max(0, Number(value) || 0);
  const [entero, decimales] = numero.toFixed(2).split('.');
  return `$ ${agruparMiles(entero)},${decimales}`;
}

/**
 * Clave `YYYY-MM` de una fecha. Es la que se compara con `fingreso` para
 * contar las altas del mes.
 * @param {Date} [fecha]
 * @returns {string}
 */
export function claveMes(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  return `${anio}-${mes < 10 ? `0${mes}` : mes}`;
}

/**
 * Altas del mes: filas con `fingreso` en el mes de la fecha indicada.
 * @param {Record<string, unknown>[]} filas
 * @param {string} mes clave `YYYY-MM`
 * @returns {number}
 */
function contarAltas(filas, mes) {
  return filas.filter((fila) => texto(fila && fila.fingreso).slice(0, 7) === mes).length;
}

/**
 * Clientes por cobrador, en el orden en que aparecen en el store.
 * @param {Record<string, unknown>[]} filas
 * @returns {{ nombre: string, clientes: number }[]}
 */
function agruparPorCobrador(filas) {
  const grupos = new Map();
  for (const fila of filas) {
    const nombre = texto(fila && fila.cobrador).trim();
    if (nombre === '') continue;
    grupos.set(nombre, (grupos.get(nombre) || 0) + 1);
  }
  return [...grupos].map(([nombre, clientes]) => ({ nombre, clientes }));
}

/**
 * Compara dos filas por fecha de ingreso descendente y, a igual fecha, por id
 * descendente.
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @returns {number}
 */
function porIngresoDesc(a, b) {
  const fechaA = texto(a && a.fingreso);
  const fechaB = texto(b && b.fingreso);
  if (fechaA !== fechaB) return fechaA < fechaB ? 1 : -1;
  return (Number(b && b.id) || 0) - (Number(a && a.id) || 0);
}

/**
 * Ultimas altas del store, como maximo `ULTIMAS_ALTAS`.
 * @param {Record<string, unknown>[]} filas
 * @returns {Record<string, unknown>[]}
 */
export function ultimasAltas(filas) {
  const lista = Array.isArray(filas) ? filas.slice() : [];
  return lista.sort(porIngresoDesc).slice(0, ULTIMAS_ALTAS);
}

/**
 * Porcentaje de clientes con saldo cero, acotado a 0..100 y redondeado.
 * @param {number} cero cantidad de clientes sin deuda
 * @param {number} total cantidad de clientes
 * @returns {number}
 */
export function porcentaje(cero, total) {
  if (!total || total <= 0) return 0;
  const valor = Math.round((cero / total) * 100);
  return Math.min(100, Math.max(0, valor));
}

/**
 * Resumen que alimenta la pantalla. Es puro: recibe las filas y la fecha, no
 * toca el DOM ni el store.
 *
 * @param {Record<string, unknown>[]} filas
 * @param {Date} [fecha]
 * @returns {{
 *   clientes: number,
 *   altasDelMes: number,
 *   cobradoresActivos: number,
 *   saldoTotal: number,
 *   saldoCero: number,
 *   porcentajeSaldoCero: number,
 *   porCobrador: { nombre: string, clientes: number }[],
 *   ultimasAltas: Record<string, unknown>[],
 * }}
 */
export function resumen(filas, fecha = new Date()) {
  const lista = Array.isArray(filas) ? filas : [];
  const porCobrador = agruparPorCobrador(lista);
  const saldos = lista.map((fila) => store.numero(fila && fila.saldo));
  const saldoTotal = redondear(saldos.reduce((total, saldo) => total + saldo, 0));
  const saldoCero = saldos.filter((saldo) => saldo === 0).length;

  return {
    clientes: lista.length,
    altasDelMes: contarAltas(lista, claveMes(fecha)),
    cobradoresActivos: porCobrador.length,
    saldoTotal,
    saldoCero,
    porcentajeSaldoCero: porcentaje(saldoCero, lista.length),
    porCobrador,
    ultimasAltas: ultimasAltas(lista),
  };
}

/**
 * Crea un elemento con clase y texto opcionales.
 * @param {Document} doc
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function nodo(doc, tag, className, text) {
  const el = doc.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * Aplica un mapa de estilos inline. El theme del piloto no cambia: la pantalla
 * trae sus propios margenes y su grilla.
 * @param {HTMLElement} el
 * @param {Record<string, string>} estilos
 */
function estilo(el, estilos) {
  for (const [propiedad, valor] of Object.entries(estilos)) el.style[propiedad] = valor;
}

/**
 * Tarjeta de un KPI: icono, etiqueta y valor. Devuelve el nodo del valor para
 * repintarlo en cada refresco.
 *
 * @param {Document} doc
 * @param {{ id: string, etiqueta: string, icono: string }} spec
 * @returns {{ el: HTMLElement, valor: HTMLElement }}
 */
function tarjeta(doc, spec) {
  const el = nodo(doc, 'div', 'hc-inicio__kpi');
  el.id = spec.id;
  el.setAttribute('data-kpi', spec.etiqueta);
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', spec.etiqueta);
  estilo(el, {
    flex: '1 1 190px',
    minWidth: '160px',
    padding: '12px 14px',
    border: '1px solid #d7dce3',
    borderRadius: '8px',
    background: '#fff',
  });

  const cabecera = nodo(doc, 'div');
  estilo(cabecera, { display: 'flex', alignItems: 'center', gap: '8px', color: '#5b6676' });
  const icono = nodo(doc, 'span', 'hc-inicio__kpi-icono');
  icono.setAttribute('aria-hidden', 'true');
  icono.appendChild(renderIcon(spec.icono, { doc }));
  cabecera.appendChild(icono);
  cabecera.appendChild(nodo(doc, 'span', 'hc-inicio__kpi-label', spec.etiqueta));

  const valor = nodo(doc, 'strong', 'hc-inicio__kpi-valor', '0');
  estilo(valor, { display: 'block', marginTop: '6px', fontSize: '22px', lineHeight: '1.2' });

  el.append(cabecera, valor);
  return { el, valor };
}

/**
 * Monta la pantalla de inicio dentro de `host`.
 *
 * @param {Element|string} host contenedor o selector
 * @returns {{
 *   root: Element,
 *   chart: any,
 *   gage: any,
 *   table: any,
 *   kpis: Record<string, HTMLElement>,
 *   datos: () => ReturnType<typeof resumen>,
 *   refresh: () => ReturnType<typeof resumen>,
 *   destroy: () => void,
 * }}
 */
export function mount(host) {
  const target = typeof host === 'string' ? document.querySelector(host) : host;
  if (!target || typeof target.appendChild !== 'function') {
    throw new Error('inicio.mount: falta el contenedor');
  }
  const doc = target.ownerDocument || document;

  const root = nodo(doc, 'div', 'hc-page hc-page--inicio');
  root.setAttribute('data-page', PAGE_ID);
  estilo(root, { display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0 8px' });
  target.appendChild(root);

  // --- KPI --------------------------------------------------------------

  const filaKpis = nodo(doc, 'div', 'hc-inicio__kpis');
  estilo(filaKpis, { display: 'flex', flexWrap: 'wrap', gap: '12px' });

  /** @type {Record<string, HTMLElement>} */
  const kpis = {};
  const tarjetas = {};
  for (const spec of TARJETAS) {
    const creada = tarjeta(doc, spec);
    tarjetas[spec.clave] = creada.valor;
    kpis[spec.clave] = creada.el;
    filaKpis.appendChild(creada.el);
  }
  root.appendChild(filaKpis);

  // --- grafico y gage ---------------------------------------------------

  const filaGraficos = nodo(doc, 'div', 'hc-inicio__graficos');
  estilo(filaGraficos, { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'stretch' });

  const cajaGrafico = nodo(doc, 'div', 'hc-inicio__panel');
  estilo(cajaGrafico, {
    flex: '1 1 380px',
    minWidth: '260px',
    padding: '10px 12px',
    border: '1px solid #d7dce3',
    borderRadius: '8px',
    background: '#fff',
  });
  const chart = create({
    id: CHART_ID,
    kind: 'chart',
    type: 'bar',
    title: 'Clientes por cobrador',
    width: 600,
    height: 260,
    series: ['Clientes'],
    data: [],
  });
  cajaGrafico.appendChild(chart.el);

  const cajaGage = nodo(doc, 'div', 'hc-inicio__panel');
  estilo(cajaGage, {
    flex: '0 1 240px',
    minWidth: '200px',
    padding: '10px 12px',
    border: '1px solid #d7dce3',
    borderRadius: '8px',
    background: '#fff',
  });
  const gage = create({
    id: GAGE_ID,
    kind: 'gage',
    title: 'Clientes con saldo cero',
    min: 0,
    max: 100,
    value: 0,
    width: 220,
    height: 150,
    format: (valor) => `${Math.round(Number(valor) || 0)}%`,
  });
  cajaGage.appendChild(gage.el);

  filaGraficos.append(cajaGrafico, cajaGage);
  root.appendChild(filaGraficos);

  // --- ultimas altas ----------------------------------------------------

  const cajaTabla = nodo(doc, 'div', 'hc-inicio__panel hc-inicio__panel--altas');
  estilo(cajaTabla, {
    padding: '10px 12px',
    border: '1px solid #d7dce3',
    borderRadius: '8px',
    background: '#fff',
  });
  const subtitulo = nodo(doc, 'h3', 'hc-inicio__subtitulo', 'Ultimas altas');
  estilo(subtitulo, { margin: '2px 0 8px', fontSize: '14px' });
  cajaTabla.appendChild(subtitulo);

  const hostTabla = nodo(doc, 'div', 'hc-lista__contenedor');
  hostTabla.id = TABLE_HOST_ID;
  const table = create({ id: TABLE_ID, kind: 'datatable', columns: COLUMNS, data: [] });
  hostTabla.appendChild(table.el);
  cajaTabla.appendChild(hostTabla);

  const vacio = nodo(doc, 'p', 'hc-inicio__vacio', 'No hay clientes cargados.');
  vacio.id = EMPTY_ID;
  vacio.hidden = true;
  cajaTabla.appendChild(vacio);
  root.appendChild(cajaTabla);

  const pie = nodo(doc, 'p', 'hc-page__hint', 'Los indicadores se recalculan con cada alta o baja de clientes.');
  root.appendChild(pie);

  // --- pintado ----------------------------------------------------------

  /**
   * Recalcula el resumen sobre el store y repinta KPI, grafico, gage y tabla.
   * @returns {ReturnType<typeof resumen>}
   */
  function render() {
    const datos = resumen(store.list());
    tarjetas.clientes.textContent = texto(datos.clientes);
    tarjetas.altas.textContent = texto(datos.altasDelMes);
    tarjetas.cobradores.textContent = texto(datos.cobradoresActivos);
    tarjetas.saldo.textContent = formatearMoneda(datos.saldoTotal);

    chart.set({ data: datos.porCobrador.map((grupo) => ({ x: grupo.nombre, y: grupo.clientes })) });
    gage.set({ value: datos.porcentajeSaldoCero });
    table.set({
      data: datos.ultimasAltas.map((fila) => ({
        cliente: texto(fila.cliente),
        fingreso: texto(fila.fingreso),
        cobrador: texto(fila.cobrador),
        saldo: formatearMoneda(fila.saldo),
      })),
    });

    const sinAltas = datos.ultimasAltas.length === 0;
    hostTabla.hidden = sinAltas;
    vacio.hidden = !sinAltas;
    return datos;
  }

  const desuscribir = store.on('change', () => render());
  render();

  return {
    root,
    chart,
    gage,
    table,
    kpis,
    datos: () => resumen(store.list()),
    refresh: render,
    destroy() {
      desuscribir();
      chart.destroy();
      gage.destroy();
      table.destroy();
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

/**
 * Definicion de la pantalla en el registro de `app`. La factory no toca el
 * DOM: montar sigue siendo responsabilidad de quien llama a `mount`.
 */
app.define(PAGE_ID, () => ({ mount }));

export default { mount, resumen, ultimasAltas, formatearMoneda };
