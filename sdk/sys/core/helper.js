/**
 * Halcon helper 2.0
 *
 * Utilidades de aplicacion del nucleo heredado: URL/query, transporte HTTP,
 * storage, cookies, sesion, titulo, routing por hash, formato de formularios y
 * helpers de Webix. Es la capa que consumen `sdk/app`, `sdk/sys/plugins` y
 * `sdk/sys/widget`, a traves del global `__`.
 *
 * Objetivos de esta version:
 *
 *  1. Compatibilidad: script clasico ES5, sin build, sin `eval`, sin
 *     `document.write` y sin depender del platform del navegador. Conserva la
 *     superficie de
 *     `__` que usa el codigo heredado.
 *  2. Transporte unico: `GET`, `POST`, `PUT`, `PAYLOAD` y `request` comparten
 *     la misma implementacion. Usa Webix si esta disponible y, si no, XHR
 *     nativo; en ambos casos parsea JSON sin `eval`.
 *  3. Robustez: callbacks de error opcionales, JSON invalido controlado,
 *     storage con fallback (Webix -> localStorage/sessionStorage -> memoria),
 *     cookies con `SameSite`, y guards para Webix ausente.
 *  4. Seguridad: no se evalua texto como codigo, se codifican los query
 *     params, se marca `databot`/SQL como deprecado y no se inventa un
 *     resultado exitoso cuando el backend devuelve error.
 *
 * Contrato principal:
 *
 *   __.req(object[, options])        -> URL con query codificada y `rid`
 *   __.GET(object, cb[, onError])    -> cb(objeto JSON)
 *   __.POST(object, post, cb[, onError])
 *   __.PUT(object, post, cb[, onError])
 *   __.PAYLOAD(object, payload, cb[, onError]) -> cb(texto crudo)
 *   __.request(method, url, body, cb[, onError][, options])
 *   __.sendPost(object, post, viewback[, onError])
 *   __.storage.set/get/remove        -> local (Webix o localStorage)
 *   __.storage.session.set/get/remove
 *   __.environment()                 -> snapshot de dispositivo
 *   __.on/off/emit                   -> eventos internos (ej. `route`)
 *
 * No se carga en la ruta nueva (`source.json`); la ruta ESM usa
 * `sdk/compat/globals.js` y `sdk/compat/session-shim.js`. Este archivo es el
 * nucleo de la ruta heredada de Webix (`source-legacy.json`).
 */
(function (global) {
    'use strict';

    if (global.__halconHelperInstalled) {
        if (global.console && global.console.warn) {
            global.console.warn('[sys/core/helper] ya esta instalado: se ignora esta segunda carga');
        }
        return;
    }
    global.__halconHelperInstalled = true;

    /** Version del helper. */
    var VERSION = '2.0.0';

    /** Estado compartido. Se respeta si otro modulo ya lo creo. */
    var helper = (global.__ && typeof global.__ === 'object') ? global.__ : {};

    helper.firex = helper.firex || {};
    helper.templates = helper.templates || {};
    helper.current = helper.current || {};
    helper.struct = helper.struct || {};
    helper.show = helper.show || { current: 'content', old: '' };
    helper.context = helper.context || { current: 'option', old: '' };

    var hasOwn = Object.prototype.hasOwnProperty;
    var listeners = {};
    /** Memoria para cuando no hay Webix ni localStorage. */
    var memory = {};

    function isFunction(value) {
        return typeof value === 'function';
    }

    function isDate(value) {
        return Object.prototype.toString.call(value) === '[object Date]';
    }

    function isArray(value) {
        return Object.prototype.toString.call(value) === '[object Array]';
    }

    function warn(message, detail) {
        if (global.console && global.console.warn) {
            global.console.warn('[sys/core/helper] ' + message, detail === undefined ? '' : detail);
        }
    }

    function makeError(message, detail) {
        var err = new Error(message);
        if (detail) {
            for (var key in detail) {
                if (hasOwn.call(detail, key)) {
                    err[key] = detail[key];
                }
            }
        }
        return err;
    }

    function getWebix() {
        return global.webix || null;
    }

    function getApp() {
        return global.app || null;
    }

    function getUsr() {
        return global.usr || {};
    }

    function getLoader() {
        return global.__loader || null;
    }

    /** Resuelve una vista de Webix sin asumir que `$$` existe. */
    function getView(id) {
        if (isFunction(global.$$)) {
            return global.$$(id);
        }
        var webix = getWebix();
        if (webix && isFunction(webix.$$)) {
            return webix.$$(id);
        }
        return null;
    }

    function encode(value) {
        return encodeURIComponent(value === null || value === undefined ? '' : String(value));
    }

    /** Serializa un objeto a `k=v&k2=v2` con codificacion. */
    function serialize(object) {
        var parts = [];
        if (!object) {
            return '';
        }
        for (var key in object) {
            if (!hasOwn.call(object, key)) {
                continue;
            }
            var value = object[key];
            if (value === undefined || value === null) {
                continue;
            }
            if (isArray(value)) {
                for (var i = 0; i < value.length; i++) {
                    parts.push(encode(key) + '=' + encode(value[i]));
                }
            } else {
                parts.push(encode(key) + '=' + encode(value));
            }
        }
        return parts.join('&');
    }

    /** Base publica de la API: `base-url` del loader, o el `base` heredado. */
    function baseUrl() {
        var loader = getLoader();
        if (loader && isFunction(loader.base_url)) {
            return loader.base_url() || '';
        }
        if (loader && typeof loader.base === 'string') {
            return loader.base;
        }
        return api.base || '';
    }

    /** Base externa (CDN/otro host). En la practica suele estar vacia. */
    function extUrl() {
        var usr = getUsr();
        var loader = getLoader();
        if (usr && typeof usr.domain === 'string') {
            return usr.domain;
        }
        if (loader && typeof loader.domain === 'string') {
            return loader.domain;
        }
        return '';
    }

    /**
     * Arma la URL de la API. Mantiene el `rid` historico para evitar cache,
     * pero se puede apagar con `{ rid: false }` o `__.cacheBust = false`.
     */
    function req(object, options) {
        options = options || {};
        var base = baseUrl();
        var query = serialize(object);

        if (options.rid !== false && api.cacheBust !== false) {
            var rid = options.rid || (+new Date());
            query += (query ? '&' : '') + 'rid=' + rid;
        }

        if (!query) {
            return base;
        }
        if (!base) {
            return '?' + query;
        }
        var last = base.charAt(base.length - 1);
        var separator = last === '?' || last === '&' ? '' : (base.indexOf('?') > -1 ? '&' : '?');
        return base + separator + query;
    }

    /** JSON valido sin lanzar: el heredado devolvia boolean. */
    function isJsonString(value) {
        if (typeof value !== 'string' || value === '') {
            return false;
        }
        try {
            JSON.parse(value);
            return true;
        } catch (ex) {
            return false;
        }
    }

    /** Parseo tolerante: devuelve `null` si el texto no es JSON. */
    function parseJson(text) {
        if (typeof text !== 'string') {
            return text;
        }
        try {
            return JSON.parse(text);
        } catch (ex) {
            return null;
        }
    }

    function notify(type, text) {
        var webix = getWebix();
        if (webix && isFunction(webix.message)) {
            webix.message({ type: type, text: text });
            return;
        }
        if (type === 'error') {
            warn(text);
        } else if (global.console && global.console.info) {
            global.console.info('[sys/core/helper] ' + text);
        }
    }

    /** Emite un evento interno y otro en document si es posible. */
    function emit(name, detail) {
        var list = listeners[name] || [];
        for (var i = 0; i < list.length; i++) {
            try {
                list[i](detail);
            } catch (ex) {
                warn('listener ' + name, ex);
            }
        }
        if (!global.document || !isFunction(global.document.createEvent)) {
            return;
        }
        try {
            var event = global.document.createEvent('CustomEvent');
            event.initCustomEvent('halcon:helper:' + name, true, true, detail);
            global.document.dispatchEvent(event);
        } catch (ex2) {
            // sin CustomEvent: los listeners directos ya corrieron
        }
    }

    /* ---------------------------------------------------------------------
     * Transporte HTTP
     * ------------------------------------------------------------------- */

    /** Entrega el resultado segun el contrato de cada helper. */
    function deliver(text, options) {
        if (options.raw) {
            options.success(text);
            return;
        }
        if (isJsonString(text)) {
            options.success(JSON.parse(text));
            return;
        }
        var err = makeError('respuesta no JSON', { url: options.url, raw: text });
        if (options.failure) {
            options.failure(err);
            return;
        }
        if (options.nonJsonToSuccess) {
            // Compatibilidad con GET: el heredado entregaba un objeto error.
            options.success({ error: 'Content non json format', url: options.url, response: text });
            return;
        }
        warn('respuesta no JSON en ' + options.url, text);
    }

    function failureHandler(options, status) {
        if (options.failure) {
            options.failure(makeError('error HTTP ' + status, { url: options.url, status: status }));
        } else {
            warn('error HTTP ' + status + ' en ' + options.url);
        }
    }

    /** Fallback sin Webix: XHR nativo con form-urlencoded o JSON. */
    function xhrRequest(method, url, body, options) {
        var xhr;
        try {
            xhr = new global.XMLHttpRequest();
        } catch (ex) {
            if (options.failure) {
                options.failure(makeError('XMLHttpRequest no disponible', { url: url }));
            }
            return;
        }

        var settled = false;
        function done(err, text) {
            if (settled) {
                return;
            }
            settled = true;
            if (err) {
                if (options.failure) {
                    options.failure(err);
                } else {
                    warn(err.message, url);
                }
                return;
            }
            deliver(text, options);
        }

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }
            var status = xhr.status;
            if ((status >= 200 && status < 300) || (status === 0 && xhr.responseText)) {
                done(null, xhr.responseText);
            } else {
                done(makeError('error HTTP ' + status, { url: url, status: status }));
            }
        };
        xhr.onerror = function () {
            done(makeError('error de red', { url: url }));
        };
        xhr.ontimeout = function () {
            done(makeError('timeout', { url: url }));
        };

        if (options.timeout && 'timeout' in xhr) {
            xhr.timeout = options.timeout;
        }

        var payload = null;
        if (body !== undefined && body !== null && method !== 'GET') {
            if (typeof body === 'string' || (global.FormData && body instanceof global.FormData)) {
                payload = body;
            } else if (options.json) {
                payload = JSON.stringify(body);
            } else {
                payload = serialize(body);
            }
        }

        try {
            xhr.open(method, url, true);
            if (options.json && payload) {
                xhr.setRequestHeader('Content-Type', 'application/json');
            } else if (payload && method !== 'GET' && typeof payload === 'string') {
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            }
            if (api.withCredentials === true) {
                xhr.withCredentials = true;
            }
            xhr.send(payload);
        } catch (ex) {
            done(makeError('no se pudo enviar la solicitud: ' + ex.message, { url: url }));
        }
    }

    /** Usa Webix si esta; si no, cae al XHR nativo. */
    function webixRequest(method, url, body, options) {
        var webix = getWebix();
        if (!webix || !isFunction(webix.ajax)) {
            return false;
        }

        try {
            var ajax = webix.ajax();
            var result;

            if (method === 'GET') {
                result = ajax.get(url, {}, function (text) {
                    deliver(text, options);
                });
            } else {
                var target = ajax;
                if (options.json && isFunction(ajax.headers)) {
                    target = ajax.headers({ 'Content-type': 'application/json' });
                }
                var payload = options.json ? JSON.stringify(body) : body;
                result = target[method.toLowerCase()](url, payload, {
                    success: function (text) {
                        deliver(text, options);
                    },
                    error: function () {
                        failureHandler(options, 0);
                    },
                });
            }

            if (result && isFunction(result.fail)) {
                result.fail(function () {
                    failureHandler(options, 0);
                });
            }
            return true;
        } catch (ex) {
            warn('fallo Webix ajax: ' + ex.message, url);
            return false;
        }
    }

    /**
     * Punto unico de transporte.
     * @param {string} method GET|POST|PUT
     * @param {string} url URL completa (usar `req` para las de la API)
     * @param {*} body
     * @param {Function} success
     * @param {Function} [failure]
     * @param {{json?: boolean, raw?: boolean, nonJsonToSuccess?: boolean, timeout?: number}} [options]
     */
    function request(method, url, body, success, failure, options) {
        options = options || {};
        options.url = url;
        options.success = isFunction(success) ? success : function () {};
        options.failure = isFunction(failure) ? failure : null;
        options.timeout = options.timeout !== undefined ? options.timeout : api.timeout || 0;

        if (webixRequest(method, url, body, options)) {
            return;
        }
        xhrRequest(method, url, body, options);
    }

    /* ---------------------------------------------------------------------
     * API HTTP heredada
     * ------------------------------------------------------------------- */

    function get(resource, callback, onError) {
        request('GET', req(resource), null, callback, onError, { nonJsonToSuccess: true });
    }

    function post(resource, body, callback, onError) {
        request('POST', req(resource), body, callback, onError, {});
    }

    function put(resource, body, callback, onError) {
        request('PUT', req(resource), body, callback, onError, {});
    }

    function payload(resource, body, callback, onError) {
        request('POST', req(resource), body, callback, onError, { json: true, raw: true });
    }

    /** Envia un formulario y navega solo si el backend no devolvio error. */
    function sendPost(resource, body, viewback, onError) {
        post(resource, body, function (response) {
            var failed = response && (response.error || response.ok === false || response.status === false);
            if (failed) {
                notify('error', response.message || response.error || 'no se pudo actualizar');
                if (isFunction(onError)) {
                    onError(response);
                }
                return;
            }
            notify('success', 'actualizado correctamente');
            var app = getApp();
            if (viewback && app && isFunction(app.require)) {
                app.require(viewback);
            }
        }, function (err) {
            notify('error', 'no se pudo actualizar');
            if (isFunction(onError)) {
                onError(err);
            }
        });
    }

    /* ---------------------------------------------------------------------
     * Storage
     * ------------------------------------------------------------------- */

    function memoryStore() {
        return memory;
    }

    function webixStore(kind) {
        var webix = getWebix();
        if (webix && webix.storage && webix.storage[kind]) {
            return webix.storage[kind];
        }
        return null;
    }

    function browserStore(kind) {
        try {
            var store = kind === 'session' ? global.sessionStorage : global.localStorage;
            if (store) {
                return store;
            }
        } catch (ex) {
            // storage bloqueado por privacidad: se usa memoria
        }
        return null;
    }

    function makeStore(kind) {
        return {
            set: function (key, value) {
                var webix = webixStore(kind);
                if (webix) {
                    webix.put(key, value);
                    return value;
                }
                var store = browserStore(kind);
                if (store) {
                    try {
                        store.setItem(key, JSON.stringify(value));
                    } catch (ex) {
                        memory[key] = value;
                    }
                    return value;
                }
                memory[key] = value;
                return value;
            },
            get: function (key) {
                var webix = webixStore(kind);
                if (webix) {
                    return webix.get(key);
                }
                var store = browserStore(kind);
                if (store) {
                    try {
                        var raw = store.getItem(key);
                        if (raw === null) {
                            return null;
                        }
                        try {
                            return JSON.parse(raw);
                        } catch (parseError) {
                            return raw;
                        }
                    } catch (ex) {
                        return null;
                    }
                }
                return hasOwn.call(memory, key) ? memory[key] : null;
            },
            remove: function (key) {
                var webix = webixStore(kind);
                if (webix) {
                    if (isFunction(webix.remove)) {
                        webix.remove(key);
                    } else {
                        warn('el storage de Webix no soporta remove; no se borra la clave ' + key);
                    }
                    return;
                }
                var store = browserStore(kind);
                if (store) {
                    try {
                        store.removeItem(key);
                    } catch (ex) {
                        // sin storage: se limpia la memoria
                    }
                }
                delete memory[key];
            },
        };
    }

    /** Sesion guardada por `login.js` / `session.js`. */
    function getUser() {
        var usr = getUsr();
        var key = usr && usr.session && usr.session.key;
        if (!key) {
            return false;
        }
        var store = webixStore('session');
        if (store) {
            try {
                var value = store.get(key);
                return value === undefined || value === null ? false : value;
            } catch (ex) {
                return false;
            }
        }
        return storage.session.get(key) || false;
    }

    /* ---------------------------------------------------------------------
     * Formularios y vistas Webix
     * ------------------------------------------------------------------- */

    function pad(value) {
        return value < 10 ? '0' + value : '' + value;
    }

    function dateToStr(date) {
        var webix = getWebix();
        if (webix && webix.Date && isFunction(webix.Date.dateToStr)) {
            try {
                return webix.Date.dateToStr('%Y-%m-%d')(date);
            } catch (ex) {
                // sigue con el formateador local
            }
        }
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    /** Valores de un formulario Webix con fechas en `YYYY-MM-DD`. */
    function getFormPost(formId) {
        var view = getView(formId);
        if (!view || !isFunction(view.getValues)) {
            warn('getFormPost("' + formId + '"): la vista no existe o no tiene getValues');
            return {};
        }
        var values = view.getValues() || {};
        for (var key in values) {
            if (hasOwn.call(values, key) && isDate(values[key])) {
                values[key] = dateToStr(values[key]);
            }
        }
        return values;
    }

    /* ---------------------------------------------------------------------
     * UI / routing / cookies
     * ------------------------------------------------------------------- */

    function setTitle(title) {
        if (typeof global.document === 'undefined') {
            return;
        }
        var name = getUsr().name;
        if (!title) {
            global.document.title = name || global.document.title;
            return;
        }
        global.document.title = name ? title + ' - ' + name : title;
    }

    function setView(name) {
        if (name === api.show.current) {
            throw new Error('La pagina se invoco 2 veces: ' + name);
        }
        api.show.old = api.show.current;
        api.show.current = name;
    }

    function changeUri(module) {
        var uri = '#!' + module;
        var pushed = false;
        if (global.history && isFunction(global.history.pushState)) {
            try {
                global.history.pushState(null, null, uri);
                pushed = true;
            } catch (ex) {
                pushed = false;
            }
        }
        if (!pushed && global.location) {
            global.location.hash = uri;
        }
        emit('route', { module: module, uri: uri });
    }

    function setCookie(name, value, days, options) {
        if (!global.document) {
            return;
        }
        options = options || {};
        var parts = [name + '=' + encode(value)];
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            parts.push('expires=' + date.toUTCString());
        }
        parts.push('path=' + (options.path || '/'));
        if (options.sameSite !== false) {
            parts.push('SameSite=' + (options.sameSite || 'Lax'));
        }
        var secure = options.secure === true || (options.secure !== false && global.location && global.location.protocol === 'https:');
        if (secure) {
            parts.push('Secure');
        }
        global.document.cookie = parts.join('; ');
    }

    function remCookie(name, path) {
        if (!global.document) {
            return;
        }
        global.document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=' + (path || '/');
    }

    function environment() {
        var loader = getLoader();
        if (loader && isFunction(loader.environment)) {
            return loader.environment();
        }
        var nav = global.navigator || {};
        var width = global.innerWidth || 0;
        var touch = (nav.maxTouchPoints || 0) > 0 || ('ontouchstart' in global);
        return {
            width: width,
            height: global.innerHeight || 0,
            dpr: global.devicePixelRatio || 1,
            isTouch: touch,
            isMobile: touch,
            isDesktop: !touch,
            isIOS: /iP(hone|ad|od)/.test(nav.userAgent || ''),
            isOnline: nav.onLine !== false,
            breakpoint: width <= 640 ? 'sm' : (width <= 900 ? 'md' : 'lg'),
        };
    }

    /** Compatibilidad: antes usaba un regex de user-agent gigante. */
    function mobileAndTabletcheck() {
        var env = environment();
        return env.isTouch === true || env.isMobile === true;
    }

    /* ---------------------------------------------------------------------
     * Superficie publica `__`
     * ------------------------------------------------------------------- */

    /**
     * Registra una integracion opcional y la publica como `__.integrations[name]`.
     * Si `__[name]` esta libre, tambien la expone con ese nombre para el codigo
     * heredado (por ejemplo `__.firebase`).
     */
    function registerIntegration(name, implementation) {
        if (typeof name !== 'string' || name === '') {
            throw new TypeError('[sys/core/helper] registerIntegration: el nombre debe ser un string no vacio');
        }
        if (!implementation || (typeof implementation !== 'object' && !isFunction(implementation))) {
            throw new TypeError('[sys/core/helper] registerIntegration("' + name + '"): falta la implementacion');
        }
        api.integrations[name] = implementation;
        if (api[name] === undefined) {
            api[name] = implementation;
        }
        emit('integration', { name: name, implementation: implementation });
        return implementation;
    }

    /** Devuelve una integracion registrada, o `null`. */
    function getIntegration(name) {
        return api.integrations[name] || null;
    }


    var storage = makeStore('local');

    var api = {
        version: VERSION,

        firex: helper.firex,
        templates: helper.templates,
        current: helper.current,
        struct: helper.struct,
        show: helper.show,
        context: helper.context,

        // URL / transporte
        req: req,
        base_url: baseUrl,
        ext_url: extUrl,
        serialize: serialize,
        request: request,
        GET: get,
        POST: post,
        PUT: put,
        PAYLOAD: payload,
        sendPost: sendPost,
        ajax_native: function (url, callback, onError) {
            // Compatibilidad: el heredado entregaba el texto crudo.
            request('GET', url, null, callback, onError, { raw: true });
        },

        // Utilidades
        IsJsonString: isJsonString,
        parseJson: parseJson,
        addslashes: function (str) {
            return (str + '')
                .replace(/[\\"']/g, '\\$&')
                .replace(/\u0000/g, '\\0');
        },
        isNumber: function (value) {
            return !isNaN(parseFloat(value)) && isFinite(value);
        },
        defKey: function (key, defval) {
            var value = api.current[key];
            return value === undefined || value === null ? defval : value;
        },
        defAttr: function (key, dnil, attr) {
            var value = api.current[key];
            if (value === undefined || value === null) {
                return dnil;
            }
            return hasOwn.call(value, attr) ? value[attr] : dnil;
        },

        // Formularios / vistas
        getFormPost: getFormPost,
        dataFill: function (viewId, url) {
            var view = getView(viewId);
            if (!view) {
                warn('dataFill("' + viewId + '"): la vista no existe');
                return;
            }
            view.clearAll();
            view.load(req(url));
        },
        comboFill: function (viewId, json) {
            var view = getView(viewId);
            if (!view) {
                warn('comboFill("' + viewId + '"): la vista no existe');
                return;
            }
            view.define('options', json);
            view.refresh();
        },

        // UI / routing
        setTitle: setTitle,
        setView: setView,
        changeUri: changeUri,
        getRoute: function () {
            var href = global.location ? global.location.href : '';
            var parts = href.split('#!');
            return parts.length > 1 ? parts[1] : '';
        },

        // Sesion / storage / cookies
        get_user: getUser,
        storage: storage,
        setCookie: setCookie,
        remCookie: remCookie,

        // Entorno
        environment: environment,
        mobileAndTabletcheck: mobileAndTabletcheck,

        // Eventos
        on: function (name, callback) {
            if (!listeners[name]) {
                listeners[name] = [];
            }
            listeners[name].push(callback);
            return function () {
                api.off(name, callback);
            };
        },
        off: function (name, callback) {
            var list = listeners[name] || [];
            for (var i = list.length - 1; i >= 0; i--) {
                if (list[i] === callback) {
                    list.splice(i, 1);
                }
            }
        },
        emit: emit,

        // Punto de extension para integraciones (firebase, databot, etc.).
        integrations: (helper.integrations && typeof helper.integrations === 'object') ? helper.integrations : {},
        registerIntegration: registerIntegration,
        getIntegration: getIntegration,
    };

    // Compatibilidad: `storage.session` ademas de `storage` (local).
    api.storage.session = makeStore('session');
    api.storage.local = api.storage;

    // Conserva props que la aplicacion haya publicado antes de cargar helper.
    for (var extra in helper) {
        if (hasOwn.call(helper, extra) && !hasOwn.call(api, extra)) {
            api[extra] = helper[extra];
        }
    }

    // Estado mutable que el codigo heredado asigna directamente.
    if (api.session === undefined) {
        api.session = helper.session;
    }

    global.__ = api;

}(typeof window !== 'undefined' ? window : this));
