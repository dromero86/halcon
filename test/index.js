/**
 * Entrada de la suite para `node --test test/`.
 *
 * Algunas versiones de Node tratan el argumento posicional de `--test` como
 * modulo y no como directorio; en ese caso resuelven `test/` a este archivo.
 * El archivo solo importa la suite real, que vive en `halcon.test.js`.
 */

import './halcon.test.js';
import './auth.test.js';
import './loader.test.js';
import './app-pages.test.js';
import './es2026.test.js';
import './vendor.test.js';
