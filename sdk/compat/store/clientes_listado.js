/**
 * Logica del listado de clientes: busqueda, orden, paginacion y seleccion.
 *
 * El listado de `compat/pages/clientes_view.js` no consulta a nadie: filtra,
 * ordena y corta en paginas sobre las filas que ya tiene en memoria. Este
 * modulo concentra esa logica en funciones puras (sin DOM y sin estado), para
 * que la vista solo se ocupe de pintar y para poder verificarla en Node desde
 * `sdk/src/plugins/check.mjs`.
 *
 * Convenciones:
 *
 *  - la busqueda no distingue mayusculas ni acentos: `normalizar()` pliega
 *    ambos antes de comparar;
 *  - el orden usa `localeCompare` con `numeric: true` (los textos numericos se
 *    comparan como numeros) y deja las celdas vacias al final;
 *  - la paginacion nunca devuelve una pagina fuera de rango: `paginar()`
 *    recorta a la ultima pagina valida y lo informa en `pagina`.
 *
 * Uso:
 *
 *   import { filtrar, ordenar, paginar, contar } from '../store/clientes_listado.js';
 *   const visibles = ordenar(filtrar(store.list(), termino), 'cliente', 'asc');
 *   const corte = paginar(visibles, 1, 10);
 */

/** Filas por pagina que ofrece el selector del listado. */
export const POR_PAGINA = [10, 25, 50];

/** Filas por pagina por omision. */
export const POR_PAGINA_DEFAULT = 10;

/** Columnas por las que se puede ordenar (las mismas del listado). */
export const COLUMNAS_ORDEN = ['cliente', 'addr', 'doc', 'tel', 'fingreso', 'cobrador'];

/**
 * Texto comparable: sin acentos, en minusculas y recortado.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizar(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Texto sobre el que busca el filtro: todas las columnas de la fila menos el
 * `id` interno, unidas por espacios.
 *
 * @param {Record<string, unknown>} fila
 * @returns {string}
 */
function textoDeFila(fila) {
  if (!fila || typeof fila !== 'object') return '';
  const partes = [];
  for (const [columna, valor] of Object.entries(fila)) {
    if (columna === 'id') continue;
    partes.push(normalizar(valor));
  }
  return partes.join(' ');
}

/**
 * Filtra por cualquier columna. Un termino vacio devuelve todas las filas; si
 * no hay coincidencias devuelve un arreglo vacio.
 *
 * @param {Record<string, unknown>[]} filas
 * @param {unknown} termino
 * @returns {Record<string, unknown>[]}
 */
export function filtrar(filas, termino) {
  const lista = Array.isArray(filas) ? filas : [];
  const buscado = normalizar(termino);
  if (buscado === '') return lista.slice();
  return lista.filter((fila) => textoDeFila(fila).includes(buscado));
}

/**
 * Celdas vacias: `undefined`, `null` o cadena en blanco.
 * @param {unknown} value
 * @returns {boolean}
 */
function vacia(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Compara dos celdas: numeros por magnitud y el resto como texto con criterio
 * alfabetico, sin acentos y con los numeros embebidos comparados como numeros.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function comparar(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

/**
 * Ordena por columna sin mutar el arreglo original. Las celdas vacias quedan
 * al final en las dos direcciones; los empates conservan el orden de entrada.
 *
 * @param {Record<string, unknown>[]} filas
 * @param {string} columna
 * @param {'asc'|'desc'} [direccion]
 * @returns {Record<string, unknown>[]}
 */
export function ordenar(filas, columna, direccion = 'asc') {
  const lista = Array.isArray(filas) ? filas : [];
  if (!columna) return lista.slice();
  const factor = direccion === 'desc' ? -1 : 1;
  return lista
    .map((fila, indice) => ({ fila, indice }))
    .sort((a, b) => {
      const va = a.fila ? a.fila[columna] : undefined;
      const vb = b.fila ? b.fila[columna] : undefined;
      const vaciaA = vacia(va);
      const vaciaB = vacia(vb);
      if (vaciaA && vaciaB) return a.indice - b.indice;
      if (vaciaA) return 1;
      if (vaciaB) return -1;
      const resultado = comparar(va, vb);
      return resultado === 0 ? a.indice - b.indice : resultado * factor;
    })
    .map((entrada) => entrada.fila);
}

/**
 * Siguiente estado de orden para un clic en el encabezado: la primera vez
 * asciende y, sobre la misma columna, alterna ascendente y descendente.
 *
 * @param {{ columna: string, direccion: 'asc'|'desc' }|null} actual
 * @param {string} columna
 * @returns {{ columna: string, direccion: 'asc'|'desc' }}
 */
export function siguienteOrden(actual, columna) {
  if (actual && actual.columna === columna) {
    return { columna, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' };
  }
  return { columna, direccion: 'asc' };
}

/**
 * Filas por pagina saneado: un entero positivo; si no sirve, el valor por
 * omision.
 *
 * @param {unknown} valor
 * @returns {number}
 */
function tamanioPagina(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return POR_PAGINA_DEFAULT;
  return Math.trunc(numero);
}

/**
 * Corta el listado en la pagina pedida.
 *
 * Devuelve `pagina` ya recortada al rango valido (1..paginas), `paginas` con un
 * minimo de 1 y `desde`/`hasta` con la numeracion visible (1-based) para el
 * indicador `pagina X de Y` y el contador.
 *
 * @param {Record<string, unknown>[]} filas
 * @param {unknown} pagina
 * @param {unknown} [porPagina]
 * @returns {{
 *   filas: Record<string, unknown>[],
 *   pagina: number,
 *   paginas: number,
 *   total: number,
 *   desde: number,
 *   hasta: number,
 *   porPagina: number,
 * }}
 */
export function paginar(filas, pagina, porPagina = POR_PAGINA_DEFAULT) {
  const lista = Array.isArray(filas) ? filas : [];
  const tamanio = tamanioPagina(porPagina);
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / tamanio));
  const pedida = Number(pagina);
  const actual = Number.isFinite(pedida) && pedida >= 1 ? Math.min(Math.trunc(pedida), paginas) : 1;
  const inicio = (actual - 1) * tamanio;
  return {
    filas: lista.slice(inicio, inicio + tamanio),
    pagina: actual,
    paginas,
    total,
    desde: total === 0 ? 0 : inicio + 1,
    hasta: Math.min(inicio + tamanio, total),
    porPagina: tamanio,
  };
}

/**
 * Texto del contador de resultados.
 * @param {unknown} total
 * @returns {string}
 */
export function contar(total) {
  const numero = Number(total);
  const cantidad = Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 0;
  return `${cantidad} ${cantidad === 1 ? 'cliente' : 'clientes'}`;
}

/**
 * Estado inicial del listado: sin busqueda, sin orden, primera pagina y el
 * tamano de pagina por omision.
 * @returns {{ busqueda: string, orden: null, pagina: number, porPagina: number }}
 */
export function estadoInicial() {
  return { busqueda: '', orden: null, pagina: 1, porPagina: POR_PAGINA_DEFAULT };
}

/**
 * Alterna la seleccion de un id y devuelve una seleccion nueva (no muta la
 * anterior). Un segundo argumento explicito fija el estado.
 *
 * @param {Set<string>} seleccion
 * @param {unknown} id
 * @param {boolean} [activo]
 * @returns {Set<string>}
 */
export function alternarSeleccion(seleccion, id, activo) {
  const siguiente = new Set(seleccion);
  const clave = String(id);
  const encender = activo === undefined ? !siguiente.has(clave) : Boolean(activo);
  if (encender) siguiente.add(clave);
  else siguiente.delete(clave);
  return siguiente;
}

/**
 * Selecciona o deselecciona de una vez todas las filas indicadas (el checkbox
 * del encabezado).
 *
 * @param {Set<string>} seleccion
 * @param {{ id?: unknown }[]} filas
 * @param {boolean} activo
 * @returns {Set<string>}
 */
export function seleccionarFilas(seleccion, filas, activo) {
  const siguiente = new Set(seleccion);
  for (const fila of Array.isArray(filas) ? filas : []) {
    if (!fila || fila.id === undefined || fila.id === null) continue;
    const clave = String(fila.id);
    if (activo) siguiente.add(clave);
    else siguiente.delete(clave);
  }
  return siguiente;
}

export default {
  POR_PAGINA,
  POR_PAGINA_DEFAULT,
  COLUMNAS_ORDEN,
  normalizar,
  comparar,
  filtrar,
  ordenar,
  siguienteOrden,
  paginar,
  contar,
  estadoInicial,
  alternarSeleccion,
  seleccionarFilas,
};
