/**
 * Store en memoria de clientes para el piloto del ABM.
 *
 * Origen: la query SQL de `sdk/app/abm/clientes_view.js` (tabla `clientes` con
 * join a `cobradores`). El backend no esta disponible en este repositorio, asi
 * que este modulo guarda las filas con la misma forma que devolveria la query:
 *
 *   { id, apellido, nombre, cliente, addr, doc, tel, fingreso, id_cobrador, cobrador }
 *
 * `cliente` y `cobrador` son las columnas calculadas del SQL
 * (`CONCAT(apellido,' ',nombre)` y `CONCAT(CO.apellido,' ',CO.nombre)`).
 * `fingreso` se guarda como texto ISO (`YYYY-MM-DD`), igual que el
 * `DATE_FORMAT(...,'%Y-%m-%d')` del original.
 *
 * La vista y el formulario comparten esta unica instancia: el formulario
 * escribe con `save()` y la vista lee con `list()` al montarse. `save()` emite
 * `save` (una vez por alta o modificacion) y `change` (despues de cada
 * escritura); `on()`/`off()` son la via para escuchar sin tocar el store.
 *
 * Lo que falta para el backend real (query SQL, store persistente y sesion)
 * esta documentado en `sdk/compat/README.md`.
 */

/** Cobradores de ejemplo: el combo del formulario y el join del SQL. */
export const COBRADORES = [
  { id: '1', value: 'Gomez Ana' },
  { id: '2', value: 'Lopez Beto' },
  { id: '3', value: 'Diaz Carla' },
];

/**
 * Filas de ejemplo. Cinco clientes, como la tabla del piloto.
 * @returns {Record<string, unknown>[]}
 */
function seed() {
  return [
    {
      id: 1,
      apellido: 'Perez',
      nombre: 'Juan',
      cliente: 'Perez Juan',
      addr: 'Av. Siempre Viva 742',
      doc: '30111222',
      tel: '11 5555-1001',
      fingreso: '2021-03-15',
      id_cobrador: '1',
      cobrador: 'Gomez Ana',
    },
    {
      id: 2,
      apellido: 'Rodriguez',
      nombre: 'Maria',
      cliente: 'Rodriguez Maria',
      addr: 'Calle Falsa 123',
      doc: '27888999',
      tel: '11 5555-1002',
      fingreso: '2022-07-01',
      id_cobrador: '2',
      cobrador: 'Lopez Beto',
    },
    {
      id: 3,
      apellido: 'Fernandez',
      nombre: 'Carlos',
      cliente: 'Fernandez Carlos',
      addr: 'Mitre 450',
      doc: '32444555',
      tel: '11 5555-1003',
      fingreso: '2023-01-20',
      id_cobrador: '1',
      cobrador: 'Gomez Ana',
    },
    {
      id: 4,
      apellido: 'Silva',
      nombre: 'Lucia',
      cliente: 'Silva Lucia',
      addr: 'San Martin 88',
      doc: '35666777',
      tel: '11 5555-1004',
      fingreso: '2023-11-05',
      id_cobrador: '3',
      cobrador: 'Diaz Carla',
    },
    {
      id: 5,
      apellido: 'Torres',
      nombre: 'Pedro',
      cliente: 'Torres Pedro',
      addr: 'Belgrano 1020',
      doc: '29888777',
      tel: '11 5555-1005',
      fingreso: '2024-05-12',
      id_cobrador: '2',
      cobrador: 'Lopez Beto',
    },
  ];
}

/** @type {Record<string, unknown>[]} */
let filas = seed();

/** Proximo id para las altas. */
let proximoId = filas.length + 1;

/** @type {Map<string, Set<(payload: unknown) => void>>} */
const listeners = new Map();

/**
 * Fecha de hoy en ISO corto, para las altas.
 * @returns {string}
 */
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Texto recortado; cualquier valor ausente queda como cadena vacia.
 * @param {unknown} value
 * @returns {string}
 */
function texto(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/**
 * Nombre visible de un cobrador por id.
 * @param {unknown} id
 * @returns {string}
 */
export function nombreCobrador(id) {
  const encontrado = COBRADORES.find((item) => String(item.id) === texto(id));
  return encontrado ? encontrado.value : '';
}

/**
 * Normaliza una fila con la forma de la query. Calcula `cliente` y `cobrador`
 * a partir de los campos editables, para que el formulario no tenga que
 * conocer las columnas derivadas.
 *
 * @param {Record<string, unknown>} row
 * @param {number|null} id
 * @returns {Record<string, unknown>}
 */
function normalizar(row, id) {
  const apellido = texto(row.apellido);
  const nombre = texto(row.nombre);
  const idCobrador = texto(row.id_cobrador);
  return {
    id,
    apellido,
    nombre,
    cliente: `${apellido} ${nombre}`.trim(),
    addr: texto(row.addr),
    doc: texto(row.doc),
    tel: texto(row.tel),
    fingreso: texto(row.fingreso) || hoy(),
    id_cobrador: idCobrador,
    cobrador: nombreCobrador(idCobrador),
  };
}

/**
 * Emite un evento del store.
 * @param {string} type
 * @param {unknown} payload
 */
function emit(type, payload) {
  const set = listeners.get(type);
  if (!set) return;
  for (const listener of [...set]) {
    try {
      listener(payload);
    } catch (error) {
      console.error(`[compat/store/clientes] fallo un listener de "${type}"`, error);
    }
  }
}

/**
 * Suscribe un listener a un evento del store. Devuelve la funcion para
 * desuscribirlo.
 *
 * @param {'save'|'change'} type
 * @param {(payload: unknown) => void} listener
 * @returns {() => void}
 */
export function on(type, listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('[compat/store/clientes] el listener debe ser una funcion');
  }
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(listener);
  return () => off(type, listener);
}

/**
 * Quita un listener de un evento del store.
 * @param {string} type
 * @param {(payload: unknown) => void} listener
 */
export function off(type, listener) {
  const set = listeners.get(type);
  if (set) set.delete(listener);
}

/**
 * Filas actuales, como copias para que nadie mute el store sin pasar por
 * `save()`.
 * @returns {Record<string, unknown>[]}
 */
export function list() {
  return filas.map((row) => ({ ...row }));
}

/**
 * Busca una fila por id.
 * @param {unknown} id
 * @returns {Record<string, unknown>|null}
 */
export function getById(id) {
  const key = texto(id);
  const row = filas.find((item) => String(item.id) === key);
  return row ? { ...row } : null;
}

/**
 * Opciones del combo de cobradores.
 * @returns {{ id: string, value: string }[]}
 */
export function cobradorOptions() {
  return COBRADORES.map((item) => ({ ...item }));
}

/**
 * Alta o modificacion. Sin `id` (o con `id` desconocido) agrega una fila con
 * el proximo id; con `id` existente reemplaza esa fila. Emite `save` con la
 * fila guardada y `change` con la lista completa.
 *
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>} la fila guardada
 */
export function save(row) {
  const entrada = row && typeof row === 'object' ? row : {};
  const idPedido = entrada.id === undefined || entrada.id === null || entrada.id === '' ? null : Number(entrada.id);
  const existente = idPedido === null ? null : filas.find((item) => item.id === idPedido);

  let guardada;
  if (existente) {
    guardada = normalizar({ ...existente, ...entrada }, existente.id);
    filas = filas.map((item) => (item.id === existente.id ? guardada : item));
  } else {
    const id = Number.isFinite(idPedido) && idPedido !== null ? idPedido : proximoId;
    guardada = normalizar(entrada, id);
    proximoId = Math.max(proximoId, id + 1);
    filas = [...filas, guardada];
  }

  emit('save', { ...guardada });
  emit('change', list());
  return { ...guardada };
}

/**
 * Vuelve a las cinco filas de ejemplo. Pensado para pruebas y para remontar
 * el piloto desde cero.
 */
export function reset() {
  filas = seed();
  proximoId = filas.length + 1;
  emit('change', list());
}

export default { COBRADORES, list, getById, save, reset, on, off, cobradorOptions, nombreCobrador };
