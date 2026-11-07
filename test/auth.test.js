/**
 * Pruebas del emulador y del modulo de sesion del SDK.
 *
 * Corren con el runner nativo (`node --test test/`), sin dependencias: el
 * emulador se levanta en un puerto libre y se cierra al final. Cada prueba crea
 * su propia sesion, asi que no comparten estado.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { start } from '../mock/server.mjs';
import { createSession } from '../sdk/src/auth/session.js';
import { createVerifier, challengeS256, randomString } from '../sdk/src/auth/pkce.js';

/** @type {{ url: string, close: () => Promise<void> }} */
let emulador;

before(async () => {
  emulador = await start({ port: 0 });
});

after(async () => {
  await emulador.close();
});

/**
 * POST JSON contra el emulador.
 * @param {string} ruta
 * @param {unknown} datos
 * @returns {Promise<{ status: number, cuerpo: any, cabeceras: Headers }>}
 */
async function post(ruta, datos) {
  const respuesta = await fetch(`${emulador.url}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  return { status: respuesta.status, cuerpo: await respuesta.json(), cabeceras: respuesta.headers };
}

/**
 * Espera los milisegundos indicados.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function esperar(ms) {
  return new Promise((aceptar) => setTimeout(aceptar, ms));
}

/**
 * Flujo OAuth manual: authorize y canje del code.
 * @param {string} usuario
 * @param {string} password
 * @param {{ verifier?: string }} [opciones]
 * @returns {Promise<{ autorizacion: any, canje: any, verifier: string }>}
 */
async function flujo(usuario, password, opciones = {}) {
  const verifier = opciones.verifier || createVerifier();
  const challenge = await challengeS256(verifier);
  const autorizacion = await post('/oauth/authorize', {
    usuario,
    password,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  const canje = await post('/oauth/token', {
    grant_type: 'authorization_code',
    code: autorizacion.cuerpo.code,
    code_verifier: verifier,
  });
  return { autorizacion, canje, verifier };
}

test('pkce: el challenge S256 coincide con el verificador', async () => {
  // Vector de RFC 7636, apendice B.
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.equal(
    await challengeS256(verifier),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );

  const propio = createVerifier();
  assert.match(propio, /^[A-Za-z0-9\-_]{43,128}$/);
  assert.notEqual(await challengeS256(propio), propio);

  const tres = randomString(3);
  assert.equal(tres.length, 3);
  assert.match(tres, /^[A-Za-z0-9\-_]{3}$/);
});

test('login correcto deja la sesion autenticada', async () => {
  const sesion = createSession({ baseUrl: emulador.url });
  const estados = [];
  const baja = sesion.subscribe((estado) => estados.push(estado));

  try {
    const estado = await sesion.login({ user: 'admin', password: 'admin123' });
    assert.equal(estado.status, 'authenticated');
    assert.equal(estado.user, 'admin');
    assert.deepEqual(estado.roles, ['admin']);
    assert.ok(estado.expiresAt > Date.now());

    assert.equal(estados[0].status, 'anonymous');
    assert.equal(estados.at(-1).status, 'authenticated');

    const perfil = await sesion.fetch('/api/me');
    assert.equal(perfil.status, 200);
    assert.deepEqual(await perfil.json(), {
      usuario: 'admin',
      nombre: 'Ana Admin',
      roles: ['admin'],
    });
  } finally {
    baja();
    sesion.dispose();
  }
});

test('password incorrecta devuelve 401 y deja la sesion anonima', async () => {
  const sesion = createSession({ baseUrl: emulador.url });
  try {
    await assert.rejects(
      () => sesion.login({ user: 'admin', password: 'no-es-la-clave' }),
      (fallo) => {
        assert.equal(fallo.status, 401);
        assert.equal(fallo.code, 'invalid_credentials');
        return true;
      },
    );
    const estado = sesion.state();
    assert.equal(estado.status, 'anonymous');
    assert.equal(estado.user, null);
    assert.deepEqual(estado.roles, []);
  } finally {
    sesion.dispose();
  }
});

test('code_verifier incorrecto se rechaza', async () => {
  const verifier = createVerifier();
  const challenge = await challengeS256(verifier);
  const autorizacion = await post('/oauth/authorize', {
    usuario: 'admin',
    password: 'admin123',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  assert.equal(autorizacion.status, 200);
  assert.equal(autorizacion.cuerpo.code_challenge_method, 'S256');

  const canje = await post('/oauth/token', {
    grant_type: 'authorization_code',
    code: autorizacion.cuerpo.code,
    code_verifier: createVerifier(),
  });
  assert.equal(canje.status, 400);
  assert.equal(canje.cuerpo.error.code, 'invalid_grant');

  // El code no se consumio con el intento fallido y sigue sirviendo una vez.
  const bueno = await post('/oauth/token', {
    grant_type: 'authorization_code',
    code: autorizacion.cuerpo.code,
    code_verifier: verifier,
  });
  assert.equal(bueno.status, 200);
  assert.equal(bueno.cuerpo.expires_in, 2);
  assert.ok(bueno.cuerpo.access_token);
  assert.ok(bueno.cuerpo.refresh_token);

  const repetido = await post('/oauth/token', {
    grant_type: 'authorization_code',
    code: autorizacion.cuerpo.code,
    code_verifier: verifier,
  });
  assert.equal(repetido.status, 400);
  assert.equal(repetido.cuerpo.error.code, 'invalid_grant');
});

test('el token vencido se refresca solo y el pedido sigue', async () => {
  const sesion = createSession({ baseUrl: emulador.url });
  try {
    const inicial = await sesion.login({ user: 'admin', password: 'admin123' });

    await esperar(Math.max(0, inicial.expiresAt - Date.now()) + 150);

    const respuesta = await sesion.fetch('/api/clientes');
    assert.equal(respuesta.status, 200);

    const refrescado = sesion.state();
    assert.equal(refrescado.status, 'authenticated');
    assert.ok(refrescado.expiresAt > inicial.expiresAt);
  } finally {
    sesion.dispose();
  }
});

test('un refresh revocado deja la sesion anonima y sin reintentos', async () => {
  const emitidos = [];
  const refrescos = [];
  const fetchEspia = async (url, opciones) => {
    const respuesta = await fetch(url, opciones);
    if (String(url).includes('/oauth/token')) {
      const copia = await respuesta.clone().json().catch(() => null);
      if (copia && copia.refresh_token) refrescos.push(copia.refresh_token);
    }
    return respuesta;
  };

  const sesion = createSession({ baseUrl: emulador.url, fetchImpl: fetchEspia });
  sesion.subscribe((estado) => emitidos.push(estado.status));

  try {
    await sesion.login({ user: 'admin', password: 'admin123' });
    assert.ok(refrescos.length >= 1);

    const revocacion = await post('/oauth/revoke', {
      token: refrescos.at(-1),
      token_type_hint: 'refresh_token',
    });
    assert.equal(revocacion.status, 200);
    assert.equal(revocacion.cuerpo.revoked, true);

    const renovado = await sesion.refresh();
    assert.equal(renovado, false);
    assert.equal(sesion.state().status, 'anonymous');
    assert.equal(emitidos.at(-1), 'anonymous');

    const respuesta = await sesion.fetch('/api/me');
    assert.equal(respuesta.status, 401);
    assert.equal(emitidos.filter((estado) => estado === 'authenticated').length, 1);
  } finally {
    sesion.dispose();
  }
});

test('POST con rol lector da 403 y GET de clientes devuelve seis', async () => {
  const sesion = createSession({ baseUrl: emulador.url });
  try {
    await sesion.login({ user: 'lector', password: 'lector123' });
    assert.deepEqual(sesion.state().roles, ['lector']);

    const listado = await sesion.fetch('/api/clientes');
    assert.equal(listado.status, 200);
    const cuerpo = await listado.json();
    assert.equal(cuerpo.total, 6);
    assert.equal(cuerpo.clientes.length, 6);
    assert.equal(cuerpo.clientes[0].cliente, 'Perez Juan');

    const alta = await sesion.fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apellido: 'Nuevo', nombre: 'Cliente' }),
    });
    assert.equal(alta.status, 403);
    const error = await alta.json();
    assert.equal(error.error.code, 'forbidden');
    assert.equal(typeof error.error.message, 'string');
  } finally {
    sesion.dispose();
  }
});

test('admin puede dar de alta un cliente', async () => {
  // Instancia propia: el alta suma una fila y no debe alterar los conteos de
  // las demas pruebas.
  const propio = await start({ port: 0 });
  const sesion = createSession({ baseUrl: propio.url });
  try {
    await sesion.login({ user: 'admin', password: 'admin123' });
    const alta = await sesion.fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apellido: 'Lopez', nombre: 'Sofia', doc: '30123456' }),
    });
    assert.equal(alta.status, 201);
    const { cliente } = await alta.json();
    assert.equal(cliente.cliente, 'Lopez Sofia');

    const listado = await sesion.fetch('/api/clientes');
    assert.equal((await listado.json()).total, 7);
  } finally {
    sesion.dispose();
    await propio.close();
  }
});

test('logout limpia el estado y revoca el refresh', async () => {
  const estados = [];
  const sesion = createSession({ baseUrl: emulador.url });
  sesion.subscribe((estado) => estados.push(estado.status));

  await sesion.login({ user: 'admin', password: 'admin123' });
  await sesion.logout();

  const estado = sesion.state();
  assert.equal(estado.status, 'anonymous');
  assert.equal(estado.user, null);
  assert.deepEqual(estado.roles, []);
  assert.equal(estado.expiresAt, 0);
  assert.equal(estados.at(-1), 'anonymous');

  const respuesta = await sesion.fetch('/api/me');
  assert.equal(respuesta.status, 401);
  sesion.dispose();
});

test('sin token la API responde 401 con la forma de error y CORS', async () => {
  const respuesta = await fetch(`${emulador.url}/api/clientes`);
  assert.equal(respuesta.status, 401);
  assert.equal(respuesta.headers.get('access-control-allow-origin'), '*');

  const cuerpo = await respuesta.json();
  assert.deepEqual(Object.keys(cuerpo), ['error']);
  assert.equal(cuerpo.error.code, 'unauthorized');
  assert.equal(typeof cuerpo.error.message, 'string');

  const preflight = await fetch(`${emulador.url}/api/clientes`, {
    method: 'OPTIONS',
    headers: { 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods') || '', /POST/);
  assert.match(preflight.headers.get('access-control-allow-headers') || '', /Authorization/);
});

test('la rotacion del refresh revoca el anterior', async () => {
  const { canje } = await flujo('admin', 'admin123');
  const primero = canje.cuerpo;

  const rotado = await post('/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: primero.refresh_token,
  });
  assert.equal(rotado.status, 200);
  assert.notEqual(rotado.cuerpo.refresh_token, primero.refresh_token);
  assert.notEqual(rotado.cuerpo.access_token, primero.access_token);
  assert.equal(rotado.cuerpo.expires_in, 2);

  const viejo = await post('/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: primero.refresh_token,
  });
  assert.equal(viejo.status, 400);
  assert.equal(viejo.cuerpo.error.code, 'invalid_grant');

  const revocado = await post('/oauth/revoke', { token: rotado.cuerpo.refresh_token });
  assert.equal(revocado.status, 200);
  const despues = await post('/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: rotado.cuerpo.refresh_token,
  });
  assert.equal(despues.status, 400);
});
