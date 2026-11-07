/**
 * Base64 UTF-8 (`window.B64`) 2.0
 *
 * Codifica y decodifica texto Unicode en Base64. Reemplaza la version que
 * dependia del user-agent para detectar IE6/7 y que trataba los
 * pares surrogados (emoji) como dos caracteres separados.
 *
 * API compatible:
 *
 *   B64.encode('hola')        -> 'aG9sYQ=='
 *   B64.decode('aG9sYQ==')    -> 'hola'
 *   B64.toUtf8('á')           -> [195, 161] (bytes UTF-8)
 *   B64.fromUtf8('w6E=')      -> [195, 161] (Base64 -> bytes)
 *
 * Es un script clasico ES5. No usa `navigator`, `TextEncoder` ni `atob`, para
 * poder cargarse en el mismo orden que el resto del nucleo heredado.
 */
(function (global) {
    'use strict';

    if (global.__halconB64Installed) {
        return;
    }
    global.__halconB64Installed = true;

    var VERSION = '2.0.0';
    var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var PAD = 64;
    var lookup = null;

    function buildLookup() {
        lookup = {};
        for (var i = 0; i < ALPHABET.length; i++) {
            lookup[ALPHABET.charAt(i)] = i;
        }
        B64.lookup = lookup;
        return lookup;
    }

    function invalid(message) {
        return new Error("InvalidCharacterError: 'B64.decode' failed: " + message);
    }

    /** Texto -> bytes UTF-8. Los surrogados sueltos se reemplazan por U+FFFD. */
    function toUtf8(value) {
        var text = value === null || value === undefined ? '' : String(value);
        var buffer = [];
        for (var i = 0; i < text.length; i++) {
            var code = text.charCodeAt(i);

            if (code >= 0xd800 && code <= 0xdbff) {
                var next = text.charCodeAt(i + 1);
                if (next >= 0xdc00 && next <= 0xdfff) {
                    code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
                    i++;
                } else {
                    code = 0xfffd;
                }
            } else if (code >= 0xdc00 && code <= 0xdfff) {
                code = 0xfffd;
            }

            if (code < 0x80) {
                buffer.push(code);
            } else if (code < 0x800) {
                buffer.push((code >> 6) | 0xc0, (code & 63) | 0x80);
            } else if (code < 0x10000) {
                buffer.push((code >> 12) | 0xe0, ((code >> 6) & 63) | 0x80, (code & 63) | 0x80);
            } else {
                buffer.push(
                    (code >> 18) | 0xf0,
                    ((code >> 12) & 63) | 0x80,
                    ((code >> 6) & 63) | 0x80,
                    (code & 63) | 0x80
                );
            }
        }
        return buffer;
    }

    /** Base64 -> bytes. Valida longitud, alfabeto y padding. */
    function fromUtf8(value) {
        var text = String(value === null || value === undefined ? '' : value);
        if (text.length % 4 !== 0) {
            throw invalid('The string to be decoded is not correctly encoded.');
        }
        if (!lookup) {
            buildLookup();
        }

        var buffer = [];
        for (var i = 0; i < text.length; i += 4) {
            var c0 = lookup[text.charAt(i)];
            var c1 = lookup[text.charAt(i + 1)];
            var c2 = lookup[text.charAt(i + 2)];
            var c3 = lookup[text.charAt(i + 3)];

            if (c0 === undefined || c0 === PAD || c1 === undefined || c1 === PAD) {
                throw invalid('invalid byte at position ' + i);
            }
            if (c2 === undefined || c3 === undefined) {
                throw invalid('invalid character at position ' + (i + 2));
            }
            if (c2 === PAD) {
                if (c3 !== PAD || i + 4 < text.length) {
                    throw invalid('invalid padding at position ' + i);
                }
            } else if (c3 === PAD && i + 4 < text.length) {
                throw invalid('invalid padding at position ' + i);
            }

            buffer.push((c0 << 2) | (c1 >> 4));
            if (c2 !== PAD) {
                buffer.push(((c1 & 15) << 4) | (c2 >> 2));
            }
            if (c3 !== PAD) {
                buffer.push(((c2 & 3) << 6) | c3);
            }
        }
        return buffer;
    }

    /** Bytes -> Base64. */
    function fromBytes(bytes) {
        var out = [];
        for (var i = 0; i < bytes.length; i += 3) {
            var b0 = bytes[i];
            var b1 = bytes[i + 1];
            var b2 = bytes[i + 2];
            out.push(ALPHABET.charAt(b0 >> 2));
            out.push(ALPHABET.charAt(((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)));
            out.push(b1 === undefined ? '=' : ALPHABET.charAt(((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)));
            out.push(b2 === undefined ? '=' : ALPHABET.charAt(b2 & 63));
        }
        return out.join('');
    }

    /** Bytes UTF-8 -> texto. Rechaza secuencias invalidas o truncadas. */
    function bytesToText(bytes) {
        var out = [];
        for (var i = 0; i < bytes.length;) {
            var b0 = bytes[i++];
            var code;
            var extra;

            if (b0 < 0x80) {
                code = b0;
                extra = 0;
            } else if ((b0 & 0xe0) === 0xc0) {
                code = b0 & 0x1f;
                extra = 1;
            } else if ((b0 & 0xf0) === 0xe0) {
                code = b0 & 0x0f;
                extra = 2;
            } else if ((b0 & 0xf8) === 0xf0) {
                code = b0 & 0x07;
                extra = 3;
            } else {
                throw invalid('invalid UTF-8 leading byte');
            }

            if (i + extra > bytes.length) {
                throw invalid('truncated UTF-8 sequence');
            }
            for (var j = 0; j < extra; j++) {
                var next = bytes[i++];
                if ((next & 0xc0) !== 0x80) {
                    throw invalid('invalid UTF-8 continuation byte');
                }
                code = (code << 6) | (next & 63);
            }

            if ((extra === 1 && code < 0x80) ||
                (extra === 2 && code < 0x800) ||
                (extra === 3 && code < 0x10000) ||
                code > 0x10ffff) {
                throw invalid('invalid UTF-8 code point');
            }

            if (code > 0xffff) {
                code -= 0x10000;
                out.push(String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff)));
            } else {
                out.push(String.fromCharCode(code));
            }
        }
        return out.join('');
    }

    var B64 = {
        version: VERSION,
        alphabet: ALPHABET,
        lookup: null,
        /** Compatibilidad: ya no se detecta IE; el camino es unico. */
        ie: false,
        ieo: false,

        encode: function (value) {
            return fromBytes(toUtf8(value));
        },

        decode: function (value) {
            return bytesToText(fromUtf8(value));
        },

        toUtf8: toUtf8,
        fromUtf8: fromUtf8,
        fromBytes: fromBytes,
        bytesToText: bytesToText,
    };

    global.B64 = B64;

}(typeof window !== 'undefined' ? window : this));
