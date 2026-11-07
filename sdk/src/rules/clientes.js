/**
 * Reglas de validacion del formulario de clientes.
 *
 * Modulo puro, sin DOM y sin dependencias: cada regla es una funcion
 * `(valor) => string|null` con la firma del servicio `rules` de Zorzal, de modo
 * que el formulario las declara en la prop `rules` y Zorzal las aplica con
 * `form.validate()`. `validar()` es la misma validacion como funcion suelta,
 * para el resumen de errores y para las verificaciones de `check.mjs`.
 *
 * Formato de cada campo, ademas de la obligatoriedad:
 *
 *  - `doc`: solo digitos, entre 7 y 9 caracteres.
 *  - `tel`: opcional; si viene, solo digitos, espacios, guiones y parentesis,
 *    con un largo de 6 a 20.
 *  - `email`: opcional; si existe el campo, arroba y un punto en el dominio.
 *  - `fingreso`: opcional; fecha real en formato `AAAA-MM-DD` (el formato del
 *    store), o vacio.
 *
 * `ORDEN` fija el orden del formulario para elegir el primer campo invalido.
 */

/** Campos en el orden en que se recorren y se pintan. */
export const ORDEN = ['apellido', 'nombre', 'addr', 'doc', 'tel', 'fingreso', 'id_cobrador', 'email'];

/** Mensaje unico del DNI: cubre el formato y el largo. */
export const MENSAJE_DNI = 'El DNI debe tener entre 7 y 9 dígitos, sin puntos ni letras';

/** Mensaje unico del telefono fuera de formato. */
export const MENSAJE_TELEFONO = 'El teléfono solo admite números, espacios, guiones y paréntesis';

/** Mensaje del telefono fuera de largo. */
export const MENSAJE_TELEFONO_LARGO = 'El teléfono debe tener entre 6 y 20 caracteres';

/** Mensaje del email fuera de formato. */
export const MENSAJE_EMAIL = 'El email debe tener una arroba y un punto en el dominio';

/** Mensaje de la fecha de ingreso fuera de formato. */
export const MENSAJE_FECHA = 'La fecha de ingreso debe ser una fecha válida en formato AAAA-MM-DD';

/** Caracteres admitidos en el telefono. */
const TELEFONO_PERMITIDO = /^[0-9 ()-]+$/;

/** Formato minimo de email: algo antes de la arroba y un punto en el dominio. */
const EMAIL_FORMATO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Fecha ISO corta. */
const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Texto recortado; cualquier valor ausente queda como cadena vacia.
 * @param {unknown} valor
 * @returns {string}
 */
export function texto(valor) {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
}

/**
 * Indica si un valor cuenta como vacio para la validacion.
 * @param {unknown} valor
 * @returns {boolean}
 */
export function esVacio(valor) {
  if (valor === undefined || valor === null) return true;
  if (Array.isArray(valor)) return valor.length === 0;
  return texto(valor) === '';
}

/**
 * Valida que el campo tenga contenido.
 * @param {string} mensaje mensaje especifico del campo
 * @returns {(valor: unknown) => string|null}
 */
export function obligatorio(mensaje) {
  return (valor) => (esVacio(valor) ? mensaje : null);
}

/**
 * Valida un DNI: solo digitos y entre 7 y 9 caracteres.
 * Un valor vacio no se reporta aca: la obligatoriedad es otra regla.
 * @returns {(valor: unknown) => string|null}
 */
export function documento() {
  return (valor) => {
    if (esVacio(valor)) return null;
    const limpio = texto(valor);
    if (!/^\d+$/.test(limpio)) return MENSAJE_DNI;
    if (limpio.length < 7 || limpio.length > 9) return MENSAJE_DNI;
    return null;
  };
}

/**
 * Valida un telefono opcional: caracteres admitidos y largo de 6 a 20.
 * @returns {(valor: unknown) => string|null}
 */
export function telefono() {
  return (valor) => {
    if (esVacio(valor)) return null;
    const limpio = texto(valor);
    if (!TELEFONO_PERMITIDO.test(limpio)) return MENSAJE_TELEFONO;
    if (limpio.length < 6 || limpio.length > 20) return MENSAJE_TELEFONO_LARGO;
    return null;
  };
}

/**
 * Valida un email opcional con arroba y punto en el dominio.
 * @returns {(valor: unknown) => string|null}
 */
export function correo() {
  return (valor) => {
    if (esVacio(valor)) return null;
    return EMAIL_FORMATO.test(texto(valor)) ? null : MENSAJE_EMAIL;
  };
}

/**
 * Indica si el texto es una fecha real en formato `AAAA-MM-DD`.
 * @param {unknown} valor
 * @returns {boolean}
 */
export function fechaValida(valor) {
  const partes = FECHA_ISO.exec(texto(valor));
  if (!partes) return false;
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/**
 * Valida una fecha de ingreso opcional: vacia o fecha real `AAAA-MM-DD`.
 * @returns {(valor: unknown) => string|null}
 */
export function ingreso() {
  return (valor) => {
    if (esVacio(valor)) return null;
    return fechaValida(valor) ? null : MENSAJE_FECHA;
  };
}

/**
 * Esquema por campo, con la firma que consume el widget `form` de Zorzal.
 * `email` queda declarado por si el formulario incorpora el campo; con el
 * valor ausente la regla no reporta nada.
 *
 * @type {Record<string, Array<(valor: unknown) => string|null>>}
 */
export const REGLAS = {
  apellido: [obligatorio('Los apellidos son obligatorios')],
  nombre: [obligatorio('Los nombres son obligatorios')],
  addr: [obligatorio('La dirección es obligatoria')],
  doc: [obligatorio('El DNI es obligatorio'), documento()],
  tel: [telefono()],
  fingreso: [ingreso()],
  email: [correo()],
  id_cobrador: [obligatorio('Elegí un cobrador')],
};

/**
 * Primer mensaje de error de una lista de validadores.
 * @param {unknown} valor
 * @param {Array<(valor: unknown) => string|null>} validadores
 * @returns {string|null}
 */
function primerError(valor, validadores) {
  for (const validador of validadores) {
    const mensaje = validador(valor);
    if (mensaje) return String(mensaje);
  }
  return null;
}

/**
 * Valida los valores de un cliente campo por campo.
 *
 * @param {Record<string, unknown>} [valores]
 * @returns {{
 *   valid: boolean,
 *   errors: Record<string, string>,
 *   orden: string[],
 *   primero: string|null,
 * }}
 */
export function validar(valores = {}) {
  const datos = valores && typeof valores === 'object' ? valores : {};
  const errors = {};
  const orden = [];
  for (const campo of ORDEN) {
    const mensaje = primerError(datos[campo], REGLAS[campo] || []);
    if (mensaje === null) continue;
    errors[campo] = mensaje;
    orden.push(campo);
  }
  return { valid: orden.length === 0, errors, orden, primero: orden[0] || null };
}

export default { ORDEN, REGLAS, validar, fechaValida };
