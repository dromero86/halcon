/**
 * Emulador de la API JSON de Halcon.
 *
 * Servidor HTTP nativo (`node:http`), sin dependencias, con OAuth simulado y
 * datos estaticos en `mock/data/`. Sirve para probar el modulo de sesion del
 * SDK mientras el backend real no esta en el repositorio; no es el backend
 * definitivo (ver `docs/2026-11-07-api-json.md`).
 *
 * Uso como modulo:
 *
 *   import { start } from './mock/server.mjs';
 *   const server = await start({ port: 0 });
 *   // server.url, server.close()
 *
 * Uso directo (levanta en 7071):
 *
 *   node mock/server.mjs
 *
 * Estado: en memoria y por instancia. Cada `start()` arranca con codigos y
 * tokens vacios y con los clientes de `mock/data/clientes.json`, asi que dos
 * instancias no comparten sesiones.
 *
 * Tokens: el access token vence a los 2 segundos (`ttlMs`). El refresh rota en
 * cada uso: el par anterior queda revocado en el mismo acto.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directorio de este archivo. */
const AQUI = dirname(fileURLToPath(import.meta.url));

/** Puerto por defecto al ejecutar el archivo directamente. */
const PUERTO_POR_DEFECTO = 7071;

/** Vida del access token, en milisegundos. */
const TTL_POR_DEFECTO = 2000;

/** Vida de un code de autorizacion, en milisegundos. */
const TTL_CODE = 60000;

/** Vida de un refresh token, en milisegundos. */
const TTL_REFRESH = 8 * 60 * 60 * 1000;

/** Tamano maximo del cuerpo de una peticion. */
const LIMITE_CUERPO = 64 * 1024;

/**
 * Lee un JSON de `mock/data`.
 * @param {string} nombre
 * @returns {any}
 */
function leerDatos(nombre) {
  return JSON.parse(readFileSync(join(AQUI, 'data', nombre), 'utf8'));
}

/**
 * Respuesta con la forma de error de la API.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {string} code
 * @param {string} message
 */
function error(res, status, code, message) {
  responder(res, status, { error: { code, message } });
}

/**
 * Respuesta JSON con CORS.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} cuerpo
 * @param {Record<string, string>} [extra]
 */
function responder(res, status, cuerpo, extra = {}) {
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    ...extra,
  });
  res.end(texto);
}

/**
 * Lee y parsea el cuerpo JSON de una peticion.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<Record<string, any>>}
 */
async function cuerpo(req) {
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > LIMITE_CUERPO) {
      const excedido = new Error('cuerpo demasiado grande');
      excedido.status = 413;
      excedido.code = 'payload_too_large';
      throw excedido;
    }
    partes.push(parte);
  }
  if (total === 0) return {};
  const texto = Buffer.concat(partes).toString('utf8');
  try {
    const datos = JSON.parse(texto);
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      const invalido = new Error('el cuerpo debe ser un objeto JSON');
      invalido.status = 400;
      invalido.code = 'invalid_request';
      throw invalido;
    }
    return datos;
  } catch (fallo) {
    if (fallo.status) throw fallo;
    const invalido = new Error('el cuerpo no es JSON valido');
    invalido.status = 400;
    invalido.code = 'invalid_request';
    throw invalido;
  }
}

/**
 * Texto recortado; cualquier valor ausente queda como cadena vacia.
 * @param {unknown} valor
 * @returns {string}
 */
function texto(valor) {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
}

/**
 * Token opaco.
 * @returns {string}
 */
function token() {
  return randomBytes(24).toString('base64url');
}

/**
 * Comparacion en tiempo constante de dos cadenas.
 * @param {string} uno
 * @param {string} otro
 * @returns {boolean}
 */
function iguales(uno, otro) {
  const a = Buffer.from(String(uno));
  const b = Buffer.from(String(otro));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Challenge S256 de un verificador PKCE.
 * @param {string} verificador
 * @returns {string}
 */
function challengeS256(verificador) {
  return createHash('sha256').update(String(verificador)).digest('base64url');
}

/**
 * Crea el estado en memoria de una instancia del emulador.
 * @param {number} ttlMs
 * @returns {{
 *   usuarios: any[],
 *   clientes: any[],
 *   codes: Map<string, { userId: number, challenge: string, expiresAt: number }>,
 *   access: Map<string, { userId: number, expiresAt: number }>,
 *   refresh: Map<string, { userId: number, expiresAt: number }>,
 *   ttlMs: number,
 *   proximoId: number,
 * }}
 */
function crearEstado(ttlMs) {
  const clientes = leerDatos('clientes.json').clientes.map((cliente) => ({ ...cliente }));
  return {
    usuarios: leerDatos('usuarios.json').usuarios,
    clientes,
    codes: new Map(),
    access: new Map(),
    refresh: new Map(),
    ttlMs,
    proximoId: clientes.reduce((maximo, cliente) => Math.max(maximo, Number(cliente.id) || 0), 0) + 1,
  };
}

/**
 * Usuario por nombre.
 * @param {{ usuarios: any[] }} estado
 * @param {string} nombre
 * @returns {any|null}
 */
function buscarUsuario(estado, nombre) {
  const buscado = texto(nombre).toLowerCase();
  return estado.usuarios.find((usuario) => usuario.usuario.toLowerCase() === buscado) || null;
}

/**
 * Resuelve el portador del header `Authorization`.
 * @param {import('node:http').IncomingMessage} req
 * @param {{ access: Map<string, { userId: number, expiresAt: number }> }} estado
 * @returns {{ usuario: any } | { error: string, message: string } | null}
 */
function autenticar(req, estado) {
  const cabecera = texto(req.headers.authorization);
  if (cabecera === '') return null;
  const [esquema, valor] = cabecera.split(/\s+/, 2);
  if (texto(esquema).toLowerCase() !== 'bearer' || !valor) {
    return { error: 'invalid_token', message: 'el header Authorization debe ser "Bearer <token>"' };
  }
  const registro = estado.access.get(valor);
  if (!registro) {
    return { error: 'invalid_token', message: 'access token desconocido o revocado' };
  }
  if (registro.expiresAt <= Date.now()) {
    estado.access.delete(valor);
    return { error: 'token_expired', message: 'access token vencido: refrescalo' };
  }
  const usuario = estado.usuarios.find((candidato) => candidato.id === registro.userId);
  if (!usuario) {
    return { error: 'invalid_token', message: 'el access token apunta a un usuario inexistente' };
  }
  return { usuario };
}

/**
 * Emite un par de tokens nuevo para un usuario.
 * @param {any} estado
 * @param {number} userId
 * @returns {{ access_token: string, refresh_token: string, token_type: string, expires_in: number }}
 */
function emitirTokens(estado, userId) {
  const accessToken = token();
  const refreshToken = token();
  estado.access.set(accessToken, { userId, expiresAt: Date.now() + estado.ttlMs });
  estado.refresh.set(refreshToken, { userId, expiresAt: Date.now() + TTL_REFRESH });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: Math.round(estado.ttlMs / 1000),
  };
}

/**
 * `POST /oauth/authorize`: usuario y password a cambio de un code de un solo uso.
 * @param {any} estado
 * @param {Record<string, any>} datos
 * @returns {{ status: number, cuerpo: any }}
 */
function autorizar(estado, datos) {
  const nombre = texto(datos.usuario ?? datos.user);
  const password = texto(datos.password);
  if (nombre === '' || password === '') {
    return {
      status: 400,
      cuerpo: { error: { code: 'invalid_request', message: 'faltan usuario o password' } },
    };
  }
  const usuario = buscarUsuario(estado, nombre);
  if (!usuario || !iguales(usuario.password, password)) {
    return {
      status: 401,
      cuerpo: { error: { code: 'invalid_credentials', message: 'usuario o password incorrectos' } },
    };
  }
  const challenge = texto(datos.code_challenge);
  const metodo = texto(datos.code_challenge_method) || 'S256';
  if (challenge === '') {
    return {
      status: 400,
      cuerpo: { error: { code: 'invalid_request', message: 'falta code_challenge' } },
    };
  }
  if (metodo !== 'S256') {
    return {
      status: 400,
      cuerpo: {
        error: { code: 'invalid_request', message: 'solo se admite code_challenge_method S256' },
      },
    };
  }
  const code = token();
  estado.codes.set(code, { userId: usuario.id, challenge, expiresAt: Date.now() + TTL_CODE });
  return {
    status: 200,
    cuerpo: { code, expires_in: Math.round(TTL_CODE / 1000), code_challenge_method: 'S256' },
  };
}

/**
 * `POST /oauth/token`: canje del code o rotacion del refresh.
 * @param {any} estado
 * @param {Record<string, any>} datos
 * @returns {{ status: number, cuerpo: any }}
 */
function canjear(estado, datos) {
  const grant = texto(datos.grant_type);
  if (grant === 'authorization_code') {
    const code = texto(datos.code);
    if (code === '') {
      return {
        status: 400,
        cuerpo: { error: { code: 'invalid_request', message: 'falta code' } },
      };
    }
    const registro = estado.codes.get(code);
    if (!registro) {
      return {
        status: 400,
        cuerpo: { error: { code: 'invalid_grant', message: 'code desconocido, usado o vencido' } },
      };
    }
    if (registro.expiresAt <= Date.now()) {
      estado.codes.delete(code);
      return {
        status: 400,
        cuerpo: { error: { code: 'invalid_grant', message: 'code vencido' } },
      };
    }
    const verificador = texto(datos.code_verifier);
    if (verificador === '' || !iguales(challengeS256(verificador), registro.challenge)) {
      return {
        status: 400,
        cuerpo: { error: { code: 'invalid_grant', message: 'code_verifier no coincide' } },
      };
    }
    estado.codes.delete(code);
    const usuario = estado.usuarios.find((candidato) => candidato.id === registro.userId);
    if (!usuario) {
      return {
        status: 400,
        cuerpo: { error: { code: 'invalid_grant', message: 'el code apunta a un usuario inexistente' } },
      };
    }
    return { status: 200, cuerpo: emitirTokens(estado, usuario.id) };
  }

  if (grant === 'refresh_token') {
    const refreshToken = texto(datos.refresh_token);
    const registro = refreshToken === '' ? null : estado.refresh.get(refreshToken);
    if (!registro) {
      return {
        status: 400,
        cuerpo: { error: { code: 'invalid_grant', message: 'refresh token desconocido o revocado' } },
      };
    }
    if (registro.expiresAt <= Date.now()) {
      estado.refresh.delete(refreshToken);
      return {
        status: 400,
        cuerpo: { error: { code: 'invalid_grant', message: 'refresh token vencido' } },
      };
    }
    const usuario = estado.usuarios.find((candidato) => candidato.id === registro.userId);
    if (!usuario) {
      return {
        status: 400,
        cuerpo: { error: { code: 'invalid_grant', message: 'el refresh apunta a un usuario inexistente' } },
      };
    }
    estado.refresh.delete(refreshToken);
    return { status: 200, cuerpo: emitirTokens(estado, usuario.id) };
  }

  return {
    status: 400,
    cuerpo: {
      error: {
        code: 'unsupported_grant_type',
        message: 'grant_type admitido: authorization_code o refresh_token',
      },
    },
  };
}

/**
 * `POST /oauth/revoke`: revoca un refresh (y el access si se pasa uno).
 * @param {any} estado
 * @param {Record<string, any>} datos
 * @returns {{ status: number, cuerpo: any }}
 */
function revocar(estado, datos) {
  const valor = texto(datos.token);
  if (valor === '') {
    return {
      status: 400,
      cuerpo: { error: { code: 'invalid_request', message: 'falta token' } },
    };
  }
  const eraRefresh = estado.refresh.delete(valor);
  const eraAccess = estado.access.delete(valor);
  return { status: 200, cuerpo: { revoked: eraRefresh || eraAccess } };
}

/**
 * `POST /api/clientes`: alta con rol admin.
 * @param {any} estado
 * @param {Record<string, any>} datos
 * @returns {{ status: number, cuerpo: any }}
 */
function altaCliente(estado, datos) {
  const apellido = texto(datos.apellido);
  const nombre = texto(datos.nombre);
  if (apellido === '' || nombre === '') {
    return {
      status: 400,
      cuerpo: { error: { code: 'invalid_request', message: 'faltan apellido y nombre' } },
    };
  }
  const idCobrador = texto(datos.id_cobrador) || '1';
  const cliente = {
    id: estado.proximoId,
    apellido,
    nombre,
    cliente: `${apellido} ${nombre}`,
    addr: texto(datos.addr),
    doc: texto(datos.doc),
    tel: texto(datos.tel),
    fingreso: texto(datos.fingreso) || new Date().toISOString().slice(0, 10),
    saldo: Number.isFinite(Number(datos.saldo)) ? Number(datos.saldo) : 0,
    id_cobrador: idCobrador,
    cobrador: texto(datos.cobrador),
  };
  estado.proximoId += 1;
  estado.clientes.push(cliente);
  return { status: 201, cuerpo: { cliente } };
}

/**
 * Atiende una peticion.
 * @param {any} estado
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function atender(estado, req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const ruta = url.pathname.replace(/\/+$/, '') || '/';
  const metodo = (req.method || 'GET').toUpperCase();

  if (metodo === 'OPTIONS') {
    responder(res, 204);
    return;
  }

  if (ruta === '/oauth/authorize' && metodo === 'POST') {
    const resultado = autorizar(estado, await cuerpo(req));
    responder(res, resultado.status, resultado.cuerpo);
    return;
  }

  if (ruta === '/oauth/token' && metodo === 'POST') {
    const resultado = canjear(estado, await cuerpo(req));
    responder(res, resultado.status, resultado.cuerpo);
    return;
  }

  if (ruta === '/oauth/revoke' && metodo === 'POST') {
    const resultado = revocar(estado, await cuerpo(req));
    responder(res, resultado.status, resultado.cuerpo);
    return;
  }

  const sesion = autenticar(req, estado);
  const protegida = ruta === '/api/me' || ruta === '/api/clientes';
  if (protegida) {
    if (sesion === null) {
      error(res, 401, 'unauthorized', 'falta el access token');
      return;
    }
    if (sesion.error) {
      error(res, 401, sesion.error, sesion.message);
      return;
    }
  }

  if (ruta === '/api/me' && metodo === 'GET') {
    responder(res, 200, {
      usuario: sesion.usuario.usuario,
      nombre: sesion.usuario.nombre,
      roles: sesion.usuario.roles,
    });
    return;
  }

  if (ruta === '/api/clientes' && metodo === 'GET') {
    responder(res, 200, { clientes: estado.clientes, total: estado.clientes.length });
    return;
  }

  if (ruta === '/api/clientes' && metodo === 'POST') {
    if (!sesion.usuario.roles.includes('admin')) {
      error(res, 403, 'forbidden', 'el alta de clientes requiere rol admin');
      return;
    }
    const resultado = altaCliente(estado, await cuerpo(req));
    responder(res, resultado.status, resultado.cuerpo);
    return;
  }

  if (ruta === '/api/me' || ruta === '/api/clientes') {
    error(res, 405, 'method_not_allowed', `metodo no admitido en ${ruta}`);
    return;
  }

  error(res, 404, 'not_found', `ruta no encontrada: ${ruta}`);
}

/**
 * Levanta el emulador.
 *
 * @param {{ port?: number, host?: string, ttlMs?: number }} [opciones]
 * @returns {Promise<{ url: string, port: number, close: () => Promise<void> }>}
 */
export async function start(opciones = {}) {
  const puerto = opciones.port === undefined ? PUERTO_POR_DEFECTO : Number(opciones.port);
  const host = opciones.host || '127.0.0.1';
  const ttlMs = opciones.ttlMs === undefined ? TTL_POR_DEFECTO : Number(opciones.ttlMs);
  const estado = crearEstado(ttlMs);

  const server = createServer((req, res) => {
    atender(estado, req, res).catch((fallo) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      const status = Number(fallo && fallo.status) || 500;
      const code = (fallo && fallo.code) || 'internal_error';
      const message = status === 500 ? 'error interno del emulador' : String(fallo.message);
      error(res, status, code, message);
    });
  });

  await new Promise((aceptar, rechazar) => {
    server.once('error', rechazar);
    server.listen(puerto, host, () => {
      server.removeListener('error', rechazar);
      aceptar();
    });
  });

  const direccion = server.address();
  const puertoReal = typeof direccion === 'object' && direccion ? direccion.port : puerto;
  return {
    url: `http://127.0.0.1:${puertoReal}`,
    port: puertoReal,
    close: () =>
      new Promise((aceptar, rechazar) => {
        server.close((fallo) => (fallo ? rechazar(fallo) : aceptar()));
        server.closeAllConnections();
      }),
  };
}

const esEntrada =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (esEntrada) {
  const puerto = Number(process.env.MOCK_PORT || PUERTO_POR_DEFECTO);
  const host = process.env.MOCK_HOST || '127.0.0.1';
  start({ port: puerto, host }).then((emulador) => {
    process.stdout.write(
      `emulador: escuchando en ${emulador.url} (oauth simulado, tokens de ${TTL_POR_DEFECTO / 1000}s)\n`,
    );
    const cerrar = () => emulador.close().then(() => process.exit(0));
    process.on('SIGINT', cerrar);
    process.on('SIGTERM', cerrar);
  });
}
