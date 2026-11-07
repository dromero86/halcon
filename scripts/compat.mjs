#!/usr/bin/env node
/**
 * Verificador de compatibilidad de navegadores de `@halcon/sdk`, sin
 * dependencias.
 *
 * La matriz de navegadores vive en `browserslist` (`package.json`) y se
 * documenta en `docs/2026-11-07-navegadores.md`. Este script es el control
 * automatico de esa matriz: recorre `sdk/src` y `sdk/compat` (`.js` y `.mjs`)
 * y falla si encuentra APIs fuera de la matriz o que necesitarian polyfill:
 *
 *  - `document.execCommand` (obsoleta, sin soporte garantizado);
 *  - `window.event` (no estandar, Firefox no la implementa);
 *  - `navigator.userAgent` usado para decidir features;
 *  - `attachEvent` (API de Internet Explorer);
 *  - `document.all` (reliquia de deteccion de IE).
 *
 * Lista los hallazgos con archivo y linea relativa a la raiz del repositorio.
 *
 * Excepciones: `EXCEPCIONES` es una lista vacia por defecto. Cada entrada
 * declara `archivo`, `regla`, `motivo` y, opcionalmente, `linea`; se justifica
 * en `docs/2026-11-07-navegadores.md`. Una excepcion sin motivo, o que no
 * coincide con ningun hallazgo, tambien hace fallar el script: una excepcion
 * silenciosa es una regresion futura.
 *
 * Los comentarios se descartan antes de buscar, para que la documentacion
 * pueda nombrar una API sin marcarse como hallazgo. Los literales de expresion
 * regular no se interpretan: un `//` dentro de una regex se toma como
 * comentario.
 *
 * Sale 0 si no hay hallazgos y 1 si hay al menos uno.
 *
 * Uso: node scripts/compat.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raiz del repositorio (el directorio que contiene `scripts/`). */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Directorios que se revisan, relativos a la raiz del repositorio. */
const OBJETIVOS = ['sdk/src', 'sdk/compat'];

/** Extensiones que se revisan. */
const EXTENSIONES = new Set(['.js', '.mjs']);

/**
 * APIs prohibidas. `patron` se busca sobre el texto sin comentarios.
 * @type {Array<{ id: string, patron: RegExp, motivo: string }>}
 */
export const REGLAS = [
  {
    id: 'document.execCommand',
    patron: /\bdocument\s*\.\s*execCommand\b/,
    motivo: 'API obsoleta y fuera de la matriz: usar la Clipboard API o el formulario nativo',
  },
  {
    id: 'window.event',
    patron: /\bwindow\s*\.\s*event\b/,
    motivo: 'propiedad no estandar y deprecada: Firefox no la implementa; el evento llega por el listener',
  },
  {
    id: 'navigator.userAgent',
    patron: /\bnavigator\s*\.\s*userAgent\b/,
    motivo: 'deteccion de features por user agent: se rompe con la reduccion de UA; detectar por capacidad',
  },
  {
    id: 'attachEvent',
    patron: /\battachEvent\b/,
    motivo: 'API de Internet Explorer: usar addEventListener',
  },
  {
    id: 'document.all',
    patron: /\bdocument\s*\.\s*all\b/,
    motivo: 'reliquia de deteccion de IE que los motores mantienen por compatibilidad: no usar',
  },
];

/**
 * Excepciones documentadas. Vacia por defecto: cada entrada necesita
 * `archivo` (ruta relativa), `regla` (el `id` de `REGLAS`), `motivo` y, si
 * aplica solo a una linea, `linea`.
 * @type {Array<{ archivo: string, regla: string, motivo: string, linea?: number }>}
 */
export const EXCEPCIONES = [];

/**
 * Lista archivos revisables de un directorio, recursivo y ordenado.
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (EXTENSIONES.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Reemplaza los comentarios por espacios, conservando los saltos de linea para
 * que los indices del texto devuelto coincidan con los del original.
 *
 * @param {string} texto
 * @returns {string}
 */
function sinComentarios(texto) {
  const salida = texto.split('');
  const largo = texto.length;
  let estado = 'codigo';
  let indice = 0;

  /**
   * Sustituye un tramo por espacios, respetando los saltos de linea.
   * @param {number} desde
   * @param {number} hasta
   */
  const blanquear = (desde, hasta) => {
    for (let i = desde; i < hasta; i += 1) {
      if (salida[i] !== '\n') salida[i] = ' ';
    }
  };

  while (indice < largo) {
    const caracter = texto[indice];
    const siguiente = indice + 1 < largo ? texto[indice + 1] : '';

    if (estado === 'codigo') {
      if (caracter === '/' && siguiente === '/') {
        const fin = texto.indexOf('\n', indice);
        const hasta = fin < 0 ? largo : fin;
        blanquear(indice, hasta);
        indice = hasta;
        continue;
      }
      if (caracter === '/' && siguiente === '*') {
        estado = 'bloque';
        blanquear(indice, indice + 2);
        indice += 2;
        continue;
      }
      if (caracter === "'") estado = 'simple';
      else if (caracter === '"') estado = 'doble';
      else if (caracter === '`') estado = 'plantilla';
      indice += 1;
      continue;
    }

    if (estado === 'linea') {
      estado = 'codigo';
      continue;
    }

    if (estado === 'bloque') {
      if (caracter === '*' && siguiente === '/') {
        blanquear(indice, indice + 2);
        indice += 2;
        estado = 'codigo';
        continue;
      }
      blanquear(indice, indice + 1);
      indice += 1;
      continue;
    }

    // Estados de cadena: 'simple', 'doble' y 'plantilla'.
    if (caracter === '\\') {
      indice += 2;
      continue;
    }
    if (
      (estado === 'simple' && caracter === "'") ||
      (estado === 'doble' && caracter === '"') ||
      (estado === 'plantilla' && caracter === '`')
    ) {
      estado = 'codigo';
    }
    indice += 1;
  }

  return salida.join('');
}

/**
 * Numero de linea (1-based) de una posicion del texto.
 * @param {string} texto
 * @param {number} indice
 * @returns {number}
 */
function lineaDe(texto, indice) {
  let linea = 1;
  for (let i = 0; i < indice; i += 1) {
    if (texto[i] === '\n') linea += 1;
  }
  return linea;
}

/**
 * Normaliza una ruta a la forma que usan las excepciones: relativa a la raiz y
 * con barras inclinadas.
 * @param {string} ruta
 * @returns {string}
 */
function rutaRelativa(ruta) {
  return relative(ROOT, ruta).split(sep).join('/');
}

/**
 * Hallazgos de un archivo.
 * @param {string} archivo
 * @returns {Array<{ archivo: string, linea: number, regla: string, motivo: string }>}
 */
function revisarArchivo(archivo) {
  const original = readFileSync(archivo, 'utf8');
  const texto = sinComentarios(original);
  const hallazgos = [];

  for (const regla of REGLAS) {
    const patron = new RegExp(regla.patron.source, 'g');
    let encontrado = patron.exec(texto);
    while (encontrado !== null) {
      hallazgos.push({
        archivo: rutaRelativa(archivo),
        linea: lineaDe(texto, encontrado.index),
        regla: regla.id,
        motivo: regla.motivo,
      });
      encontrado = patron.exec(texto);
    }
  }

  return hallazgos.sort((uno, otro) => uno.linea - otro.linea || uno.regla.localeCompare(otro.regla));
}

/**
 * Indica si una excepcion tiene la forma esperada.
 * @param {any} excepcion
 * @returns {string|null} el problema encontrado, o `null` si esta bien formada
 */
function problemaDeExcepcion(excepcion) {
  if (!excepcion || typeof excepcion !== 'object') return 'no es un objeto';
  if (typeof excepcion.archivo !== 'string' || excepcion.archivo === '') return 'le falta archivo';
  if (typeof excepcion.regla !== 'string' || excepcion.regla === '') return 'le falta regla';
  if (!REGLAS.some((regla) => regla.id === excepcion.regla)) {
    return `la regla "${excepcion.regla}" no existe`;
  }
  if (typeof excepcion.motivo !== 'string' || excepcion.motivo.trim() === '') return 'le falta motivo';
  if (excepcion.linea !== undefined && !Number.isInteger(excepcion.linea)) return 'la linea no es un entero';
  return null;
}

/**
 * Recorre los objetivos y devuelve el informe completo.
 * @param {{ root?: string, objetivos?: string[], excepciones?: Array<object> }} [opciones]
 * @returns {{
 *   hallazgos: Array<{ archivo: string, linea: number, regla: string, motivo: string }>,
 *   perdonados: Array<{ archivo: string, linea: number, regla: string, motivo: string }>,
 *   excepcionesInvalidas: Array<{ excepcion: any, problema: string }>,
 *   excepcionesSinUso: Array<object>,
 *   archivos: number,
 *   reglas: number,
 *   excepciones: number,
 * }}
 */
export function revisar(opciones = {}) {
  const root = opciones.root === undefined ? ROOT : opciones.root;
  const objetivos = opciones.objetivos === undefined ? OBJETIVOS : opciones.objetivos;
  const excepciones = opciones.excepciones === undefined ? EXCEPCIONES : opciones.excepciones;

  const archivos = objetivos.flatMap((objetivo) => collectFiles(join(root, objetivo)));
  const hallazgos = archivos.flatMap(revisarArchivo).map((hallazgo) => ({ ...hallazgo }));

  const excepcionesInvalidas = excepciones
    .map((excepcion) => ({ excepcion, problema: problemaDeExcepcion(excepcion) }))
    .filter((entrada) => entrada.problema !== null);

  const usadas = new Set();
  const perdonados = [];
  const restantes = [];

  for (const hallazgo of hallazgos) {
    const indice = excepciones.findIndex(
      (excepcion, posicion) =>
        excepcionesInvalidas.every((invalida) => invalida.excepcion !== excepcion) &&
        excepcion.archivo === hallazgo.archivo &&
        excepcion.regla === hallazgo.regla &&
        (excepcion.linea === undefined || excepcion.linea === hallazgo.linea) &&
        !usadas.has(posicion)
    );
    if (indice >= 0) {
      usadas.add(indice);
      perdonados.push(hallazgo);
    } else {
      restantes.push(hallazgo);
    }
  }

  const excepcionesSinUso = excepciones.filter(
    (excepcion, posicion) =>
      excepcionesInvalidas.every((invalida) => invalida.excepcion !== excepcion) && !usadas.has(posicion)
  );

  return {
    hallazgos: restantes,
    perdonados,
    excepcionesInvalidas,
    excepcionesSinUso,
    archivos: archivos.length,
    reglas: REGLAS.length,
    excepciones: excepciones.length,
  };
}

const esEntrada =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (esEntrada) {
  const informe = revisar();
  const salida = [];

  for (const hallazgo of informe.hallazgos) {
    salida.push(`${hallazgo.archivo}:${hallazgo.linea}: ${hallazgo.regla}: ${hallazgo.motivo}`);
  }
  for (const hallazgo of informe.perdonados) {
    salida.push(
      `${hallazgo.archivo}:${hallazgo.linea}: ${hallazgo.regla}: exceptuado (ver docs/2026-11-07-navegadores.md)`
    );
  }
  for (const invalida of informe.excepcionesInvalidas) {
    salida.push(`excepcion invalida (${invalida.problema}): ${JSON.stringify(invalida.excepcion)}`);
  }
  for (const sinUso of informe.excepcionesSinUso) {
    salida.push(
      `excepcion sin uso: ${sinUso.archivo} ${sinUso.regla}${sinUso.linea === undefined ? '' : `:${sinUso.linea}`}`
    );
  }

  const fallas =
    informe.hallazgos.length + informe.excepcionesInvalidas.length + informe.excepcionesSinUso.length;

  if (fallas === 0) {
    process.stdout.write(
      `compat: sin hallazgos en ${OBJETIVOS.join(', ')} ` +
        `(${informe.archivos} archivos, ${informe.reglas} reglas, ${informe.excepciones} excepciones)\n`
    );
    process.exit(0);
  }

  for (const linea of salida) process.stdout.write(`${linea}\n`);
  process.stdout.write(
    `compat: ${informe.hallazgos.length} hallazgo(s), ` +
      `${informe.excepcionesInvalidas.length} excepcion(es) invalida(s), ` +
      `${informe.excepcionesSinUso.length} excepcion(es) sin uso\n`
  );
  process.exit(1);
}
