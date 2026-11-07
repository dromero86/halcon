/**
 * Session 2.0 (`sys.core.session`)
 *
 * Mantiene el contrato de la version 1 (`session.on.login`, `check`, `logout`,
 * `check_interval`, `afterCheck`, `afterCheckInterval`) y corrige los problemas
 * que tenia:
 *
 *  - lee `usr.session` de forma perezosa (antes se congelaba al definir el
 *    modulo y una carrera dejaba `url_check`/`sess_key` en `undefined`);
 *  - un solo intervalo por sesion: cada login/check limpia el anterior;
 *  - usa `__.storage.session` (helper 2.0) con fallback a Webix;
 *  - `logout` limpia token e intervalo;
 *  - tolera `server`/`response` vacios y Webix ausente;
 *  - emite `session:state` y `session:message` en `__` para observers;
 *  - `location.reload()` queda configurable con `reloadOnExpire`.
 *
 * Se registra como `app.define('sys.core.session', ...)`, igual que antes.
 */
(function (global) {
    'use strict';

    var VERSION = '2.0.0';

    var DEFAULTS = {
        url_check: 'auth-online',
        sess_key: 'halcon.app.session',
        module_denied: 'sys.widget.login',
        module_pass: 'app.dashboard',
        timeout: 10000,
        intervalKey: 'xXcheckUserCheckXx',
        reloadOnExpire: true,
    };

    function noop() {}

    function warn(message, detail) {
        if (global.console && global.console.warn) {
            global.console.warn('[sys/core/session] ' + message, detail === undefined ? '' : detail);
        }
    }

    function getUsr() {
        return global.usr || {};
    }

    function getConfigSource() {
        var usr = getUsr();
        return usr.session && typeof usr.session === 'object' ? usr.session : {};
    }

    function sessionStorage() {
        var helper = global.__;
        if (helper && helper.storage && helper.storage.session) {
            var store = helper.storage.session;
            return {
                get: function (key) {
                    return store.get(key);
                },
                set: function (key, value) {
                    if (typeof store.remove === 'function') {
                        store.remove(key);
                    }
                    store.set(key, value);
                },
                remove: function (key) {
                    store.remove(key);
                },
            };
        }

        var webix = global.webix;
        if (webix && webix.storage && webix.storage.session) {
            var legacy = webix.storage.session;
            return {
                get: function (key) {
                    return legacy.get(key);
                },
                set: function (key, value) {
                    if (typeof legacy.remove === 'function') {
                        legacy.remove(key);
                    }
                    legacy.put(key, value);
                },
                remove: function (key) {
                    if (typeof legacy.remove === 'function') {
                        legacy.remove(key);
                    }
                },
            };
        }
        return null;
    }

    function notify(type, text) {
        if (global.webix && typeof global.webix.message === 'function') {
            global.webix.message({ type: type, text: text });
            return;
        }
        emit('session:message', { type: type, text: text });
        if (type === 'error') {
            warn(text);
        }
    }

    function emit(name, detail) {
        if (global.__ && typeof global.__.emit === 'function') {
            global.__.emit(name, detail);
        }
    }

    var session = {
        version: VERSION,
        isOnline: false,
        module: DEFAULTS.module_denied,
        callAfterCheck: true,
        postCallback: noop,
        config: {
            url_check: DEFAULTS.url_check,
            sess_key: DEFAULTS.sess_key,
            module_denied: DEFAULTS.module_denied,
            module_pass: DEFAULTS.module_pass,
            timeout: DEFAULTS.timeout,
            intervalKey: DEFAULTS.intervalKey,
            reloadOnExpire: DEFAULTS.reloadOnExpire,
        },
        on: {},
    };

    /** Relee `usr.session` sin pisar overrides hechos por la aplicacion. */
    function refreshConfig() {
        var source = getConfigSource();
        if (typeof source.check === 'string' && source.check !== '') {
            session.config.url_check = source.check;
        }
        if (typeof source.key === 'string' && source.key !== '') {
            session.config.sess_key = source.key;
        }
        if (source.timeout !== undefined && isFinite(source.timeout)) {
            session.config.timeout = Number(source.timeout);
        }
        if (typeof source.intervalKey === 'string' && source.intervalKey !== '') {
            session.config.intervalKey = source.intervalKey;
        }
        if (source.reloadOnExpire !== undefined) {
            session.config.reloadOnExpire = source.reloadOnExpire !== false;
        }
        return session.config;
    }

    function saveSession(data) {
        var store = sessionStorage();
        if (!store) {
            warn('no hay storage de sesion disponible');
            return false;
        }
        try {
            store.set(session.config.sess_key, data);
            return true;
        } catch (ex) {
            warn('no se pudo guardar la sesion', ex);
            return false;
        }
    }

    function removeSession() {
        var store = sessionStorage();
        if (!store) {
            return false;
        }
        try {
            store.remove(session.config.sess_key);
            return true;
        } catch (ex) {
            warn('no se pudo borrar la sesion', ex);
            return false;
        }
    }

    function currentStore() {
        return global.__ && global.__.current ? global.__.current : null;
    }

    function stopInterval() {
        var store = currentStore();
        if (!store) {
            return;
        }
        var id = store[session.config.intervalKey];
        if (id !== undefined && id !== null && id !== false) {
            try {
                global.clearInterval(id);
            } catch (ex) {
                warn('no se pudo limpiar el intervalo', ex);
            }
            delete store[session.config.intervalKey];
        }
    }

    function startInterval() {
        stopInterval();
        var store = currentStore();
        if (!store || !session.config.timeout || session.config.timeout <= 0) {
            return null;
        }
        var id = global.setInterval(function () {
            session.on.check_interval();
        }, session.config.timeout);
        store[session.config.intervalKey] = id;
        return id;
    }

    function emitState() {
        emit('session:state', {
            online: session.isOnline,
            module: session.module,
        });
    }

    function navigate() {
        if (!session.callAfterCheck) {
            return;
        }
        var app = global.app;
        if (app && typeof app.require === 'function') {
            app.require(session.module, session.postCallback);
        }
    }

    function goOffline(message) {
        session.isOnline = false;
        session.module = session.config.module_denied;
        stopInterval();
        if (message) {
            notify('error', message);
        }
        emitState();
        navigate();
    }

    session.on.logout = function () {
        refreshConfig();
        removeSession();
        goOffline('Desconectado del servidor');
    };

    session.on.login = function (server) {
        refreshConfig();
        server = server && typeof server === 'object' ? server : {};
        session.isOnline = !!server.status;

        if (!session.isOnline) {
            goOffline(server.message || 'No se pudo iniciar sesion');
            return session;
        }

        saveSession(server);
        session.module = typeof server.dashboard === 'string' && server.dashboard !== ''
            ? server.dashboard
            : session.config.module_pass;
        startInterval();
        emitState();
        navigate();
        return session;
    };

    session.on.check = function () {
        refreshConfig();
        if (!global.__ || typeof global.__.GET !== 'function') {
            warn('falta __.GET para verificar la sesion');
            return;
        }
        global.__.GET(
            { action: session.config.url_check },
            session.on.afterCheck,
            function (err) {
                session.on.afterCheck({ error: err && err.message ? err.message : 'error de red' });
            }
        );
    };

    session.on.afterCheck = function (response) {
        refreshConfig();
        response = response && typeof response === 'object' ? response : {};
        session.isOnline = !!response.status;

        if (!session.isOnline) {
            goOffline('Desconectado del servidor');
            return session;
        }

        saveSession(response);
        session.module = typeof response.dashboard === 'string' && response.dashboard !== ''
            ? response.dashboard
            : session.config.module_pass;
        startInterval();
        emitState();
        navigate();
        return session;
    };

    session.on.check_interval = function () {
        refreshConfig();
        if (!global.__ || typeof global.__.GET !== 'function') {
            return;
        }
        global.__.GET(
            { action: session.config.url_check },
            session.on.afterCheckInterval,
            function (err) {
                emit('session:error', {
                    message: err && err.message ? err.message : 'error de red',
                });
            }
        );
    };

    session.on.afterCheckInterval = function (response) {
        response = response && typeof response === 'object' ? response : {};
        if (response.error !== undefined && response.error !== null) {
            return;
        }

        var online = !!response.status;
        if (online) {
            return;
        }

        stopInterval();
        notify('error', 'Desconectado del servidor');
        session.isOnline = false;
        session.module = session.config.module_denied;
        emitState();

        if (session.config.reloadOnExpire !== false &&
            global.location && typeof global.location.reload === 'function') {
            global.location.reload();
            return;
        }
        navigate();
    };

    session.stop = stopInterval;
    session.refreshConfig = refreshConfig;

    if (!global.app || typeof global.app.define !== 'function') {
        throw new Error('[sys/core/session] falta app.define: cargar el loader de Halcon primero');
    }

    global.app.define('sys.core.session', function () {
        refreshConfig();
        return session;
    });

}(typeof window !== 'undefined' ? window : this));
