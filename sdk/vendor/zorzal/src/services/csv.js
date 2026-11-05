/**
 * csv: parser y serializador de CSV (RFC 4180) sin dependencias.
 *
 * `parse(texto)` devuelve filas de celdas de texto y entiende comillas
 * dobles, comas y saltos de linea dentro de un campo, `""` como comilla
 * escapada y finales de linea `\n`, `\r\n` o `\r`. `stringify(filas)` hace el
 * camino inverso y solo entrecomilla cuando hace falta.
 */

/**
 * @param {string} text
 * @param {{ delimiter?: string, quote?: string }} [options]
 * @returns {string[][]}
 */
export function parse(text, options = {}) {
  const delimiter = options.delimiter || ',';
  const quote = options.quote || '"';
  const source = text === null || text === undefined ? '' : String(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let touched = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    touched = true;
    if (inQuotes) {
      if (char === quote) {
        if (source[index + 1] === quote) {
          field += quote;
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === quote) {
      inQuotes = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      endRow();
    } else {
      field += char;
    }
  }

  if (touched && (field !== '' || row.length > 0)) endRow();
  return rows;
}

/**
 * @param {unknown} value
 * @param {string} delimiter
 * @param {string} quote
 */
function formatCell(value, delimiter, quote) {
  const text = value === null || value === undefined ? '' : String(value);
  const needsQuotes =
    text.includes(delimiter) ||
    text.includes(quote) ||
    text.includes('\n') ||
    text.includes('\r') ||
    text !== text.trim();
  if (!needsQuotes) return text;
  return `${quote}${text.split(quote).join(quote + quote)}${quote}`;
}

/**
 * @param {Array<Array<unknown>|unknown[]>} rows
 * @param {{ delimiter?: string, quote?: string, newline?: string }} [options]
 * @returns {string}
 */
export function stringify(rows, options = {}) {
  const delimiter = options.delimiter || ',';
  const quote = options.quote || '"';
  const newline = options.newline || '\n';
  if (!Array.isArray(rows)) throw new Error('zorzal.csv: se espera un arreglo de filas');
  return rows
    .map((row) => (Array.isArray(row) ? row : [row]).map((cell) => formatCell(cell, delimiter, quote)).join(delimiter))
    .join(newline);
}

export const csv = { parse, stringify };

export default csv;
