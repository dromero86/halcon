/**
 * Halcon loader 3.0
 *
 * Carga progresiva de una aplicacion a partir de un manifiesto JSON. El
 * manifiesto declara que recursos necesita la pagina y en que orden; el loader
 * los inserta, controla el cache, ajusta el viewport y expone un registro
 * minimo de modulos (`app.define` / `app.require`) para el codigo heredado.
 *
 * Objetivos de esta version, en orden:
 *
 *  1. Compatibilidad: se ejecuta como script clasico (ES5), sin build, sin
 *     `eval`, sin `document.write` y sin depender del platform del navegador.
 *     Acepta el manifiesto v1 (array) y el v2 (objeto con `resources`).
 *  2. Carga dinamica: `load`, `loadScript`, `loadStyle`, `loadModule` y
 *     `preload` se pueden usar en cualquier momento, no solo al arrancar.
 *  3. Cache explicito: `versioned`, `immutable`, `reload` y `no-store` con un
 *     unico sello por arranque (nunca `Date.now()` por recurso).
 *  4. Viewport y entorno: viewport seguro por omision (sin `user-scalable=no`),
 *     deteccion por `matchMedia` / `maxTouchPoints` y observacion de cambios.
 *  5. Resiliencia: timeout, reintentos, deduplicacion, single-flight,
 *     dependencias y aislamiento de fallos por recurso.
 *
 * Contrato publico:
 *
 *   __loader.boot(manifiesto?)        -> Promise<resultado> (o callback en `done`)
 *   __loader.load(tipo, url, opciones) -> Promise
 *   __loader.loadScript(url, opciones)
 *   __loader.loadStyle(url, opciones)
 *   __loader.preload(urls, opciones)
 *   __loader.loadModule(url, opciones) -> carga un ESM (sin namespace)
 *   __loader.environment()             -> snapshot de dispositivo/viewport
 *   __loader.watchEnvironment(fn)      -> unsubscribe
 *   __loader.on / off / once           -> eventos del ciclo de carga
 *   app.define(nombre, factory)        -> registro sincrono
 *   app.require(nombre[, cb])          -> valor si esta definido; si no, carga
 *   app.import(nombre[, cb])           -> Promise<valor>
 *
 * El manifiesto v2 tiene esta forma:
 *
 *   {
 *     "version": "2",
 *     "base": "./sdk/",
 *     "cache": { "policy": "versioned", "version": "auto" },
 *     "viewport": { "width": "device-width", "initialScale": 1 },
 *     "parallel": false,
 *     "clean": false,
 *     "resources": [
 *       { "id": "tema", "type": "css", "url": "compat/theme.css" },
 *       { "id": "app", "type": "module", "url": "app/main.js", "deps": ["tema"] }
 *     ]
 *   }
 *
 * El esquema completo esta en `sdk/config/loader.schema.json`.
 */
(function (global) {
    'use strict';

    var doc = global.document;

    if (!doc) {
        return;
    }

    if (global.__halconLoaderInstalled) {
        warn('[sys/core/loader] ya esta instalado: se ignora esta segunda carga');
        return;
    }
    global.__halconLoaderInstalled = true;

    /** Version del loader (no la de la aplicacion). */
    var VERSION = '3.0.0';

    /** Tipos aceptados en el manifiesto, con sus alias. */
    var TYPE_ALIASES = {
        script: 'script',
        js: 'script',
        module: 'module',
        esm: 'module',
        link: 'css',
        css: 'css',
        style: 'css',
        json: 'json',
        icon: 'icon',
        template: 'template',
        image: 'image',
        img: 'image',
        preload: 'preload',
        prefetch: 'prefetch',
        modulepreload: 'modulepreload'
    };

    /** Configuracion efectiva. Se completa con los atributos del <script>. */
    var config = {
        project: './sdk/',
        base: '',
        version: '',
        manifestUrl: '',
        cachePolicy: 'versioned',
        cleanup: false,
        parallel: false,
        concurrency: 6,
        timeout: 20000,
        retries: 1,
        log: false,
        nonce: '',
        viewport: true,
        mobileWebApp: true,
        themeColor: '',
        strict: false,
        requireForce: false,
        autorefresh: false,
        dynamicRequire: true
    };

    /** Estado de una corrida. */
    var state = {
        booted: false,
        booting: null,
        starting: false,
        finalized: false,
        manifest: null,
        result: null,
        loaded: {},
        pending: {},
        requirePending: {},
        fails: [],
        errors: [],
        after: [],
        stamp: '',
        progress: { total: 0, done: 0, current: '' },
        listeners: {}
    };

    /** Registro de modulos sincrono (compatibilidad con app.define). */
    var modulos = {};
    var counter = {};
    var loadedScripts = {};

    /** Sello unico por arranque: evita generar una URL distinta por solicitud. */
    var hash = function () {
        return +(+new Date());
    };

    var hasOwn = Object.prototype.hasOwnProperty;

    function noop() {}

    function isFunction(value) {
        return typeof value === 'function';
    }

    function isArray(value) {
        return Object.prototype.toString.call(value) === '[object Array]';
    }

    function warn(message) {
        if (global.console && global.console.warn) {
            global.console.warn(message);
        }
    }

    function error(message, detail) {
        if (global.console && global.console.error) {
            global.console.error(message, detail === undefined ? '' : detail);
        }
    }

    /** Ejecuta en el proximo tick: conserva el contrato asincrono de v2. */
    function defer(fn) {
        if (isFunction(fn)) {
            setTimeout(fn, 0);
        }
    }

    /** Envuelve un callback para que se ejecute una sola vez. */
    function once(fn) {
        var called = false;
        return function () {
            if (called) {
                return;
            }
            called = true;
            fn.apply(null, arguments);
        };
    }

    function number(value, fallback) {
        var n = parseInt(value, 10);
        return isNaN(n) ? fallback : n;
    }

    function head() {
        return doc.head || doc.getElementsByTagName('head')[0] || doc.documentElement;
    }

    function setAttr(el, key, value) {
        if (value !== undefined && value !== null && value !== '') {
            el.setAttribute(key, String(value));
        }
    }

    /** Busca un <meta> por nombre sin depender de querySelector. */
    function findMeta(name) {
        var list = doc.getElementsByTagName('meta');
        for (var i = 0; i < list.length; i++) {
            if (list[i].getAttribute('name') === name) {
                return list[i];
            }
        }
        return null;
    }

    function findCharset() {
        var list = doc.getElementsByTagName('meta');
        for (var i = 0; i < list.length; i++) {
            if (list[i].getAttribute('charset')) {
                return list[i];
            }
        }
        return null;
    }

    /** Es una URL absoluta, protocolo-relativa o de raiz. */
    function isAbsolute(url) {
        return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.charAt(0) === '/';
    }

    /** Resuelve una ruta del manifiesto contra `project-path`. */
    function resolveUrl(url) {
        var value = String(url == null ? '' : url);
        if (isAbsolute(value)) {
            return value;
        }
        var project = config.project || '';
        if (project && project.charAt(project.length - 1) !== '/') {
            project += '/';
        }
        return project + value;
    }

    /** Nombre de modulo heredado: `sys/core/helper.js` -> `sys.core.helper`. */
    function getModule(url) {
        var value = String(url == null ? '' : url).split('#')[0].split('?')[0];
        var project = config.project || '';
        if (project && value.indexOf(project) === 0) {
            value = value.slice(project.length);
        } else if (value.indexOf('./') === 0) {
            value = value.slice(2);
        }
        value = value.replace(/^\/+/, '');
        value = value.replace(/\.(js|mjs|css|json|html?|svg|png|jpe?g|gif|webp|ico|woff2?|ttf)$/i, '');
        var parts = value.split('/');
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] && parts[i] !== '.') {
                out.push(parts[i]);
            }
        }
        return out.join('.');
    }

    /** Sello de cache del arranque actual. */
    function bootStamp() {
        if (!state.stamp) {
            state.stamp = String(hash());
        }
        return state.stamp;
    }

    /**
     * Aplica la politica de cache a una URL.
     *
     * - `versioned`: agrega `v=<version>` solo si hay version conocida.
     * - `immutable` / `none`: no toca la URL.
     * - `reload` / `false`: agrega un sello unico del arranque.
     * - `legacy`: respeta el booleano del manifiesto v1 (`cache:false` recarga).
     */
    function cacheUrl(url, spec) {
        var policy = spec && spec.cache !== undefined ? spec.cache : config.cachePolicy;
        var token = null;
        var value = String(url == null ? '' : url);
        var cut = value.indexOf('#');
        var tail = cut > -1 ? value.slice(cut) : '';

        if (cut > -1) {
            value = value.slice(0, cut);
        }

        if (policy === false || policy === 'reload' || policy === 'no-store' || policy === 'dev') {
            token = '_h=' + bootStamp();
        } else if (policy === 'legacy') {
            token = spec && spec.cache === false ? '_h=' + bootStamp() : null;
        } else if (policy === true || policy === 'versioned' || policy === 'default') {
            token = config.version ? 'v=' + encodeURIComponent(config.version) : null;
        } else if (policy === 'immutable' || policy === 'none') {
            token = null;
        } else if (typeof policy === 'string') {
            token = policy.indexOf('=') > -1 ? policy : null;
        }

        if (!token) {
            return value + tail;
        }
        return value + (value.indexOf('?') > -1 ? '&' : '?') + token + tail;
    }

    /**
     * Normaliza una entrada del manifiesto (v1 o v2).
     * @param {*} raw
     * @param {number} index
     * @returns {object}
     */
    function normalizeResource(raw, index) {
        var item = typeof raw === 'string' ? { url: raw } : (raw || {});
        var type = item.type || item.tag || guessType(item.url);
        type = TYPE_ALIASES[String(type || '').toLowerCase()] || 'script';
        if (item.module === true && type === 'script') {
            type = 'module';
        }
        var id = item.id || getModule(item.url);
        if (!id) {
            id = 'recurso-' + index;
        }
        return {
            id: String(id),
            type: type,
            url: item.url,
            cache: item.cache,
            media: item.media || '',
            condition: item.condition || item.when || '',
            deps: isArray(item.deps) ? item.deps.slice() : [],
            optional: item.optional === true,
            retry: number(item.retry, config.retries),
            timeout: number(item.timeout, config.timeout),
            integrity: item.integrity || '',
            crossorigin: item.crossorigin || '',
            referrerpolicy: item.referrerpolicy || '',
            fetchpriority: item.fetchpriority || '',
            nonce: item.nonce || config.nonce,
            fallback: item.fallback || '',
            as: item.as || '',
            raw: item
        };
    }

    /** Infiere el tipo por extension cuando el manifiesto no lo declara. */
    function guessType(url) {
        var value = String(url || '').split('?')[0].split('#')[0].toLowerCase();
        if (/\.css$/.test(value)) {
            return 'css';
        }
        if (/\.json$/.test(value)) {
            return 'json';
        }
        if (/\.(png|jpe?g|gif|webp|svg|ico)$/.test(value)) {
            return 'image';
        }
        return 'script';
    }

    /**
     * Acepta el manifiesto v1 (array) y el v2 (objeto).
     * @param {*} raw
     * @returns {object}
     */
    function normalizeManifest(raw) {
        var manifest;
        if (isArray(raw)) {
            manifest = {
                version: '1',
                legacy: true,
                base: config.project,
                cache: { policy: 'legacy' },
                viewport: null,
                parallel: false,
                clean: false,
                strict: false,
                concurrency: 1,
                resources: raw
            };
        } else {
            var source = raw || {};
            var cache = source.cache;
            manifest = {
                version: String(source.version || '2'),
                legacy: false,
                base: source.base || config.project,
                cache: {
                    policy: 'versioned',
                    version: 'auto'
                },
                viewport: source.viewport,
                parallel: source.parallel === true,
                clean: source.clean === true || source.cleanup === true,
                strict: source.strict === true,
                concurrency: number(source.concurrency, config.concurrency),
                resources: []
            };
            if (cache === false) {
                manifest.cache.policy = 'none';
            } else if (cache === true) {
                manifest.cache.policy = 'versioned';
            } else if (cache && typeof cache === 'object') {
                manifest.cache.policy = cache.policy || 'versioned';
                manifest.cache.version = cache.version || 'auto';
            }
            source = source.resources || source.source || [];
            manifest.resources = isArray(source) ? source : [];
        }

        if (manifest.base && typeof manifest.base === 'string') {
            config.project = manifest.base;
        }
        if (manifest.cache && manifest.cache.policy) {
            config.cachePolicy = manifest.cache.policy;
        }
        if (manifest.cache && manifest.cache.version && manifest.cache.version !== 'auto') {
            config.version = String(manifest.cache.version);
        }
        if (manifest.concurrency > 0) {
            config.concurrency = manifest.concurrency;
        }
        config.strict = config.strict === true || manifest.strict === true;
        config.cleanup = config.cleanup === true || manifest.clean === true;
        if (manifest.parallel === false) {
            config.parallel = false;
        }

        var resources = [];
        for (var i = 0; i < manifest.resources.length; i++) {
            resources.push(normalizeResource(manifest.resources[i], i));
        }
        manifest.resources = resources;
        return manifest;
    }

    /** Emite un evento en document y window, sin romper en navegadores viejos. */
    function emit(name, detail) {
        var list = state.listeners[name] || [];
        for (var i = 0; i < list.length; i++) {
            try {
                list[i](detail);
            } catch (ex) {
                error('[sys/core/loader] listener ' + name, ex);
            }
        }
        if (!isFunction(doc.createEvent)) {
            return;
        }
        var event;
        try {
            event = doc.createEvent('CustomEvent');
            event.initCustomEvent('halcon:' + name, true, true, detail);
        } catch (ex) {
            return;
        }
        try {
            doc.dispatchEvent(event);
        } catch (ex2) {
            // el navegador no admite el evento: el listener directo ya corrio
        }
    }

    /** Vista previa del entorno: sin user-agent sniffing salvo el quirk de iOS. */
    function environment() {
        var nav = global.navigator || {};
        var width = global.innerWidth || (doc.documentElement && doc.documentElement.clientWidth) || 0;
        var height = global.innerHeight || (doc.documentElement && doc.documentElement.clientHeight) || 0;
        var touch = (nav.maxTouchPoints || 0) > 0 || ('ontouchstart' in global);
        var coarse = matches('(pointer: coarse)');
        var mobile = touch && (coarse || width <= 900);
        var ua = nav.userAgent || '';
        var ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1);

        return {
            width: width,
            height: height,
            dpr: global.devicePixelRatio || 1,
            orientation: width >= height ? 'landscape' : 'portrait',
            isTouch: touch,
            isMobile: mobile,
            isDesktop: !mobile,
            isIOS: ios,
            isOnline: nav.onLine !== false,
            reducedMotion: matches('(prefers-reduced-motion: reduce)'),
            colorScheme: matches('(prefers-color-scheme: dark)') ? 'dark' : 'light',
            language: nav.language || nav.userLanguage || '',
            breakpoint: width <= 640 ? 'sm' : (width <= 900 ? 'md' : 'lg')
        };
    }

    /** `matchMedia` con fallback para navegadores sin soporte. */
    function matches(query) {
        if (!isFunction(global.matchMedia)) {
            return false;
        }
        try {
            return global.matchMedia(query).matches === true;
        } catch (ex) {
            return false;
        }
    }

    /** Evalua `condition` de un recurso. */
    function matchesCondition(condition) {
        if (!condition) {
            return true;
        }
        if (isArray(condition)) {
            for (var i = 0; i < condition.length; i++) {
                if (matchesCondition(condition[i])) {
                    return true;
                }
            }
            return false;
        }
        if (typeof condition === 'object') {
            return matchesCondition(condition.media || '');
        }
        var value = String(condition);
        var env = environment();
        if (value === 'mobile') {
            return env.isMobile;
        }
        if (value === 'desktop') {
            return !env.isMobile;
        }
        if (value === 'touch') {
            return env.isTouch;
        }
        if (value === 'dark') {
            return env.colorScheme === 'dark';
        }
        if (value === 'light') {
            return env.colorScheme === 'light';
        }
        if (value === 'reduced-motion') {
            return env.reducedMotion;
        }
        return matches(value);
    }

    /** XHR con timeout, sin el hack de iPhone que ignoraba el status. */
    function ajax(url, ok, fail, options) {
        options = options || {};
        var xhr;
        try {
            xhr = new global.XMLHttpRequest();
        } catch (ex) {
            fail(ex);
            return null;
        }

        var settled = false;
        function done(err, text) {
            if (settled) {
                return;
            }
            settled = true;
            if (err) {
                fail(err);
            } else {
                ok(text);
            }
        }

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }
            var status = xhr.status;
            var text = xhr.responseText;
            if ((status >= 200 && status < 300) || (status === 0 && text)) {
                done(null, text);
            } else {
                done(new Error('HTTP ' + status));
            }
        };
        xhr.onerror = function () {
            done(new Error('error de red'));
        };
        xhr.ontimeout = function () {
            done(new Error('timeout'));
        };
        if (options.timeout && 'timeout' in xhr) {
            xhr.timeout = options.timeout;
        }
        try {
            xhr.open('GET', url, true);
            xhr.send();
        } catch (ex) {
            done(ex);
            return null;
        }
        return xhr;
    }

    /* ---------------------------------------------------------------------
     * Carga de recursos
     * ------------------------------------------------------------------- */

    /** Aplica atributos comunes (integridad, CORS, nonce, prioridad). */
    function applyCommon(el, spec) {
        setAttr(el, 'integrity', spec.integrity);
        setAttr(el, 'crossorigin', spec.crossorigin);
        setAttr(el, 'referrerpolicy', spec.referrerpolicy);
        setAttr(el, 'fetchpriority', spec.fetchpriority);
        setAttr(el, 'nonce', spec.nonce);
        if (spec.nonce) {
            el.nonce = spec.nonce;
        }
        setAttr(el, 'data-halcon-id', spec.id);
        setAttr(el, 'data-halcon-type', spec.type);
    }

    /** Crea un elemento y resuelve cuando el navegador lo termina de cargar. */
    function loadElement(spec, resolved, finish) {
        var el;
        var settled = once(finish);
        var timer = null;

        function ok() {
            if (timer) {
                clearTimeout(timer);
            }
            settled(null, el);
        }

        function fail(reason) {
            if (timer) {
                clearTimeout(timer);
            }
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
            settled(new Error(reason || ('no se pudo cargar ' + resolved)), el);
        }

        if (spec.type === 'css') {
            el = doc.createElement('link');
            el.rel = 'stylesheet';
            el.href = cacheUrl(resolved, spec);
            setAttr(el, 'media', spec.media);
            applyCommon(el, spec);
            el.onload = ok;
            el.onerror = function () {
                fail('CSS');
            };
            if (el.readyState) {
                el.onreadystatechange = function () {
                    if (el.readyState === 'loaded' || el.readyState === 'complete') {
                        el.onreadystatechange = null;
                        ok();
                    }
                };
            }
        } else if (spec.type === 'script' || spec.type === 'module') {
            el = doc.createElement('script');
            if (spec.type === 'module') {
                el.type = 'module';
            } else {
                el.type = 'text/javascript';
                el.async = false;
            }
            el.src = cacheUrl(resolved, spec);
            applyCommon(el, spec);
            el.onload = ok;
            el.onerror = function () {
                fail('script');
            };
            if (el.readyState) {
                el.onreadystatechange = function () {
                    if (el.readyState === 'loaded' || el.readyState === 'complete') {
                        el.onreadystatechange = null;
                        ok();
                    }
                };
            }
        } else if (spec.type === 'preload' || spec.type === 'prefetch' || spec.type === 'modulepreload') {
            el = doc.createElement('link');
            el.rel = spec.type === 'prefetch' ? 'prefetch' : spec.type;
            el.href = cacheUrl(resolved, spec);
            if (spec.type === 'preload') {
                setAttr(el, 'as', spec.as || inferAs(resolved));
            }
            setAttr(el, 'media', spec.media);
            applyCommon(el, spec);
            head().appendChild(el);
            // Las pistas no bloquean el arranque: se dan por resueltas al vuelo.
            defer(function () {
                settled(null, el);
            });
            return;
        } else if (spec.type === 'icon') {
            el = doc.createElement('link');
            el.rel = 'shortcut icon';
            el.href = cacheUrl(resolved, spec);
            applyCommon(el, spec);
            removeIcons();
            head().appendChild(el);
            defer(function () {
                settled(null, el);
            });
            return;
        } else {
            settled(new Error('tipo no soportado: ' + spec.type));
            return;
        }

        if (spec.timeout > 0) {
            timer = setTimeout(function () {
                timer = null;
                fail('timeout');
            }, spec.timeout);
        }

        head().appendChild(el);
    }

    function inferAs(url) {
        var value = String(url || '').split('?')[0].toLowerCase();
        if (/\.css$/.test(value)) {
            return 'style';
        }
        if (/\.js$|\.mjs$/.test(value)) {
            return 'script';
        }
        if (/\.(png|jpe?g|gif|webp|svg|ico)$/.test(value)) {
            return 'image';
        }
        if (/\.(woff2?|ttf|otf)$/.test(value)) {
            return 'font';
        }
        return 'fetch';
    }

    /** Un solo favicon a la vez: el anterior se retira. */
    function removeIcons() {
        var list = doc.getElementsByTagName('link');
        for (var i = list.length - 1; i >= 0; i--) {
            var rel = list[i].getAttribute('rel') || '';
            if (rel.indexOf('icon') > -1 && list[i].getAttribute('data-halcon-type') === 'icon') {
                list[i].parentNode.removeChild(list[i]);
            }
        }
    }

    /** Carga un recurso y notifica `done(error)`. Deduplica por tipo + URL. */
    function loadOne(spec, done) {
        done = isFunction(done) ? done : noop;

        if (!spec || !spec.url) {
            defer(function () {
                done(new Error('recurso sin url'));
            });
            return;
        }

        if (!matchesCondition(spec.condition)) {
            defer(function () {
                done(null, 'omitido');
            });
            return;
        }

        var resolved = resolveUrl(spec.url);
        var key = spec.type + '|' + resolved;

        if (state.loaded[key]) {
            defer(function () {
                done(null, state.loaded[key].element);
            });
            return;
        }
        if (state.pending[key]) {
            state.pending[key].push(done);
            return;
        }
        state.pending[key] = [done];

        attempt(spec, resolved, key, 0);
    }

    /** Intenta cargar; reintenta hasta `spec.retry` veces. */
    function attempt(spec, resolved, key, intento) {
        var finish = once(function (err, element) {
            if (err && intento < spec.retry) {
                setTimeout(function () {
                    attempt(spec, resolved, key, intento + 1);
                }, 100 * (intento + 1));
                return;
            }

            var callbacks = state.pending[key] || [];
            delete state.pending[key];

            if (err) {
                if (!spec.optional) {
                    state.fails.push(spec.url);
                    state.errors.push({ url: spec.url, id: spec.id, message: err.message });
                    error('[sys/core/loader] no se pudo cargar ' + spec.url + ': se omite y se sigue');
                }
            } else {
                state.loaded[key] = { spec: spec, element: element };
            }

            for (var i = 0; i < callbacks.length; i++) {
                try {
                    callbacks[i](err || null, element);
                } catch (ex) {
                    error('[sys/core/loader] callback de ' + spec.url, ex);
                }
            }
        });

        if (spec.type === 'json' || spec.type === 'template') {
            ajax(cacheUrl(resolved, spec), function (text) {
                if (spec.type === 'json') {
                    var data;
                    try {
                        data = JSON.parse(text);
                    } catch (ex) {
                        finish(new Error('JSON invalido: ' + ex.message));
                        return;
                    }
                    var target = global.usr || (global.usr = {});
                    for (var key in data) {
                        if (hasOwn.call(data, key)) {
                            target[key] = data[key];
                        }
                    }
                } else {
                    var util = global.__ || (global.__ = {});
                    util.templates = util.templates || {};
                    util.templates[getModule(spec.url)] = text;
                }
                finish(null, null);
            }, function (err) {
                finish(err);
            }, { timeout: spec.timeout });
            return;
        }

        if (spec.type === 'image') {
            var image = new global.Image();
            var settled = once(function (err) {
                if (err && image) {
                    image.onload = null;
                    image.onerror = null;
                }
                finish(err, image);
            });
            image.onload = function () {
                settled(null);
            };
            image.onerror = function () {
                settled(new Error('imagen'));
            };
            image.src = cacheUrl(resolved, spec);
            if (spec.timeout > 0) {
                setTimeout(function () {
                    settled(new Error('timeout'));
                }, spec.timeout);
            }
            return;
        }

        if (spec.type === 'module' && !supportsModules() && spec.fallback) {
            var fallback = normalizeResource({ type: 'script', url: spec.fallback, cache: spec.cache }, 0);
            loadOne(fallback, function (err) {
                finish(err, null);
            });
            return;
        }

        loadElement(spec, resolved, finish);
    }

    /** Soporte nativo de modulos ES. */
    function supportsModules() {
        if (!global.HTMLScriptElement) {
            return false;
        }
        try {
            var el = doc.createElement('script');
            return 'noModule' in el;
        } catch (ex) {
            return false;
        }
    }

    /* ---------------------------------------------------------------------
     * Planificacion: serie (compatibilidad) o grafo (paralelo con deps)
     * ------------------------------------------------------------------- */

    function progress(done, total, current) {
        state.progress = {
            total: total,
            done: done,
            current: current || '',
            percent: total > 0 ? Math.round((done * 100) / total) : 100
        };
        if (api) {
            api.loaded = Object.keys(state.loaded).length;
        }
        emit('progress', state.progress);
    }

    function scheduleSeries(list, done) {
        var index = 0;
        var total = list.length;
        var completed = 0;

        function next() {
            if (index >= list.length) {
                done();
                return;
            }
            var spec = list[index++];
            progress(completed, total, spec.url);
            loadOne(spec, function (err) {
                completed++;
                progress(completed, total, spec.url);
                if (err && config.strict && !spec.optional) {
                    done(err);
                    return;
                }
                next();
            });
        }

        next();
    }

    function scheduleGraph(list, done, concurrency) {
        var nodes = [];
        var byId = {};
        var running = 0;
        var pending = 0;
        var finished = false;
        var aborted = false;

        for (var i = 0; i < list.length; i++) {
            var spec = list[i];
            var node = {
                spec: spec,
                id: spec.id,
                deps: [],
                status: 'pending'
            };
            if (byId[node.id]) {
                node.id = node.id + '-' + i;
            }
            byId[node.id] = node;
            nodes.push(node);
            pending++;
        }

        for (var j = 0; j < nodes.length; j++) {
            for (var k = 0; k < nodes[j].spec.deps.length; k++) {
                var dep = nodes[j].spec.deps[k];
                if (byId[dep]) {
                    nodes[j].deps.push(byId[dep]);
                } else {
                    warn('[sys/core/loader] dependencia desconocida "' + dep + '" en "' + nodes[j].id + '"');
                }
            }
        }

        function finish() {
            if (finished) {
                return;
            }
            finished = true;
            done();
        }

        function ready(node) {
            for (var i = 0; i < node.deps.length; i++) {
                if (node.deps[i].status === 'pending' || node.deps[i].status === 'loading') {
                    return false;
                }
            }
            return true;
        }

        function settle(node, err) {
            running--;
            pending--;
            node.status = err && !node.spec.optional ? 'failed' : 'done';
            if (err && config.strict && !node.spec.optional) {
                aborted = true;
            }
            progress(nodes.length - pending, nodes.length, node.spec.url);
            pump();
        }

        function pump() {
            if (finished) {
                return;
            }
            if (aborted) {
                if (running === 0) {
                    finished = true;
                    done(new Error('arranque cortado por un recurso obligatorio'));
                }
                return;
            }
            if (pending === 0) {
                finish();
                return;
            }

            var launched = true;
            while (running < concurrency && launched) {
                launched = false;
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    if (node.status === 'pending' && ready(node)) {
                        node.status = 'loading';
                        running++;
                        launched = true;
                        loadOne(node.spec, function (current) {
                            return function (err) {
                                settle(current, err);
                            };
                        }(node));
                        if (running >= concurrency) {
                            break;
                        }
                    }
                }
            }

            if (pending > 0 && running === 0) {
                // Ciclo de dependencias: se resuelve en orden para no colgar.
                warn('[sys/core/loader] ciclo de dependencias: se carga el resto en orden');
                for (var j = 0; j < nodes.length; j++) {
                    if (nodes[j].status === 'pending') {
                        nodes[j].status = 'loading';
                        running++;
                        loadOne(nodes[j].spec, function (current) {
                            return function (err) {
                                settle(current, err);
                            };
                        }(nodes[j]));
                    }
                }
            }
        }

        pump();
    }

    /* ---------------------------------------------------------------------
     * Viewport, piel de carga y avisos
     * ------------------------------------------------------------------- */

    /** Contenido de viewport seguro por omision (sin desactivar el zoom). */
    function buildViewport(value) {
        if (value === true || value === null || value === undefined) {
            return 'width=device-width, initial-scale=1';
        }
        if (typeof value === 'string') {
            return value;
        }
        var parts = [];
        parts.push('width=' + (value.width || 'device-width'));
        if (value.initialScale !== undefined && value.initialScale !== null) {
            parts.push('initial-scale=' + value.initialScale);
        }
        if (value.maximumScale !== undefined && value.maximumScale !== null) {
            parts.push('maximum-scale=' + value.maximumScale);
        }
        if (value.minimumScale !== undefined && value.minimumScale !== null) {
            parts.push('minimum-scale=' + value.minimumScale);
        }
        if (value.userScalable !== undefined && value.userScalable !== null) {
            parts.push('user-scalable=' + (value.userScalable ? 'yes' : 'no'));
        }
        if (value.fit) {
            parts.push('viewport-fit=' + value.fit);
        }
        return parts.join(', ');
    }

    /**
     * Fija el viewport. Se conserva la firma heredada
     * `set_view_port(initial, maximum, minimum)`; para no romper la
     * accesibilidad, `basis()` ya no pasa maximos ni minimos.
     */
    function setViewport(initial, maximum, minimum) {
        var content = ['width=device-width'];
        if (initial !== undefined && initial !== null && initial !== '') {
            content.push('initial-scale=' + initial);
        }
        if (maximum !== undefined && maximum !== null && maximum !== '') {
            content.push('maximum-scale=' + maximum);
        }
        if (minimum !== undefined && minimum !== null && minimum !== '') {
            content.push('minimum-scale=' + minimum);
        }
        var meta = findMeta('viewport');
        if (!meta) {
            meta = doc.createElement('meta');
            meta.setAttribute('name', 'viewport');
            head().appendChild(meta);
        }
        meta.setAttribute('content', content.join(', '));
        return content.join(', ');
    }

    /** Aplica el viewport del manifiesto sin pisar uno ya declarado por la pagina. */
    function applyViewport(value) {
        if (value === false || config.viewport === false) {
            var list = doc.getElementsByTagName('meta');
            for (var i = list.length - 1; i >= 0; i--) {
                if (list[i].getAttribute('data-halcon-viewport') === 'true' && list[i].parentNode) {
                    list[i].parentNode.removeChild(list[i]);
                }
            }
            return;
        }
        var existing = findMeta('viewport');
        var content = buildViewport(value === undefined ? true : value);
        if (existing) {
            // Si la pagina ya declaro su viewport y el manifiesto no pide uno
            // explicito, se respeta el de la pagina.
            if (value === undefined) {
                return;
            }
            existing.setAttribute('content', content);
            return;
        }
        var meta = doc.createElement('meta');
        meta.setAttribute('name', 'viewport');
        meta.setAttribute('content', content);
        meta.setAttribute('data-halcon-viewport', 'true');
        head().appendChild(meta);
    }

    function skinCss() {
        var rule = String(api.cssLoader || '');
        var project = config.base || config.project || '';
        rule = rule.split('#url#').join(project);
        return 'html.halcon-booting,body.halcon-booting{' + rule + '}' +
            '.halcon-notice{position:fixed;top:0;right:0;bottom:0;left:0;display:flex;' +
            'align-items:center;justify-content:center;background:#1C2B2D;color:#fff;' +
            'font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
            'text-align:center;padding:24px;z-index:2147483647}' +
            '.halcon-notice a{color:#7fd1c8}';
    }

    function ensureSkin() {
        if (doc.getElementById('halcon-loader-skin')) {
            return;
        }
        var style = doc.createElement('style');
        style.id = 'halcon-loader-skin';
        setAttr(style, 'nonce', config.nonce);
        if (config.nonce) {
            style.nonce = config.nonce;
        }
        style.appendChild(doc.createTextNode(skinCss()));
        head().appendChild(style);
    }

    function toggleBootClass(on) {
        var html = doc.documentElement;
        var body = doc.body;
        toggleClass(html, 'halcon-booting', on);
        toggleClass(body, 'halcon-booting', on);
    }

    function toggleClass(el, name, on) {
        if (!el) {
            return;
        }
        var current = ' ' + (el.className || '') + ' ';
        var has = current.indexOf(' ' + name + ' ') > -1;
        if (on && !has) {
            el.className = (el.className ? el.className + ' ' : '') + name;
        } else if (!on && has) {
            el.className = current.split(' ' + name + ' ').join(' ').replace(/^\s+|\s+$/g, '');
        }
    }

    function clearChildren(el) {
        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }
    }

    /** Aviso en pagina: reemplaza el `document.write` de la version anterior. */
    function showNotice(message, action) {
        ensureSkin();
        var host = doc.body || doc.documentElement;
        var box = doc.getElementById('halcon-loader-notice');
        if (!box) {
            box = doc.createElement('div');
            box.id = 'halcon-loader-notice';
            box.className = 'halcon-notice';
            host.appendChild(box);
        }
        clearChildren(box);
        var text = doc.createElement('div');
        text.appendChild(doc.createTextNode(message));
        box.appendChild(text);
        if (action) {
            var link = doc.createElement('a');
            link.href = '#';
            link.appendChild(doc.createTextNode('Volver a comprobar'));
            link.onclick = function (event) {
                if (event && event.preventDefault) {
                    event.preventDefault();
                }
                global.location.reload();
                return false;
            };
            var p = doc.createElement('p');
            p.appendChild(link);
            box.appendChild(p);
        }
    }

    function hideNotice() {
        var box = doc.getElementById('halcon-loader-notice');
        if (box && box.parentNode) {
            box.parentNode.removeChild(box);
        }
    }

    /* ---------------------------------------------------------------------
     * Ciclo de arranque
     * ------------------------------------------------------------------- */

    function readScriptConfig() {
        var script = doc.currentScript;
        if (!script) {
            var list = doc.getElementsByTagName('script');
            for (var i = list.length - 1; i >= 0; i--) {
                if (list[i].getAttribute && (list[i].getAttribute('bootin') || list[i].getAttribute('data-bootin'))) {
                    script = list[i];
                    break;
                }
            }
        }
        if (!script || !script.getAttribute) {
            return;
        }

        var get = function (name) {
            return script.getAttribute(name) || '';
        };

        var bootin = get('bootin') || get('data-bootin');
        if (bootin) {
            config.manifestUrl = bootin;
        }
        var project = get('project-path') || get('data-project');
        if (project) {
            config.project = project;
        }
        var base = get('base-url') || get('data-base');
        if (base) {
            config.base = base;
        }
        var version = get('data-version') || get('version');
        if (version && version.indexOf('{') === -1) {
            config.version = version;
        }
        var nonce = get('data-nonce') || get('nonce');
        if (nonce) {
            config.nonce = nonce;
        }
        if (get('data-log') === 'true') {
            config.log = true;
        }
        if (get('data-clean') === 'true') {
            config.cleanup = true;
        }
        if (get('data-parallel') === 'true') {
            config.parallel = true;
        }
        if (get('data-strict') === 'true') {
            config.strict = true;
        }
        if (get('data-timeout')) {
            config.timeout = number(get('data-timeout'), config.timeout);
        }
        if (get('data-retries')) {
            config.retries = number(get('data-retries'), config.retries);
        }
        if (get('data-viewport') === 'off' || get('data-viewport') === 'false') {
            config.viewport = false;
        }
        if (get('data-theme-color')) {
            config.themeColor = get('data-theme-color');
        }
        config.autoload = get('data-autoload') !== 'false' && get('autoload') !== 'false';

        if (api) {
            api.base = config.base;
            api._project_url = config.project;
        }
    }

    /** Metadatos base, viewport y piel de carga. Idempotente. */
    function basis(manifest) {
        if (!findCharset()) {
            var charset = doc.createElement('meta');
            charset.setAttribute('charset', 'UTF-8');
            head().appendChild(charset);
        }

        if (config.mobileWebApp && !findMeta('apple-mobile-web-app-capable')) {
            var apple = doc.createElement('meta');
            apple.setAttribute('name', 'apple-mobile-web-app-capable');
            apple.setAttribute('content', 'yes');
            head().appendChild(apple);
        }

        if (config.themeColor && !findMeta('theme-color')) {
            var theme = doc.createElement('meta');
            theme.setAttribute('name', 'theme-color');
            theme.setAttribute('content', config.themeColor);
            head().appendChild(theme);
        }

        applyViewport(manifest ? manifest.viewport : undefined);
        ensureSkin();
        toggleBootClass(true);
    }

    function clearSkin() {
        toggleBootClass(false);
        hideNotice();
    }

    function finalize(result) {
        if (state.finalized) {
            return;
        }
        state.finalized = true;
        state.booted = true;
        state.result = result || { ok: state.errors.length === 0 };
        state.end = Date.now();
        api.end = state.end;
        api.is_ready = true;
        api.loaded = Object.keys(state.loaded).length;
        clearSkin();

        if (config.cleanup && doc.body) {
            clearChildren(doc.body);
        }

        var callbacks = state.after.slice();
        state.after.length = 0;
        for (var i = 0; i < callbacks.length; i++) {
            try {
                callbacks[i](state.result);
            } catch (ex) {
                error('[sys/core/loader] app.run', ex);
            }
        }

        if (isFunction(api.afterloadfn)) {
            try {
                api.afterloadfn(state.result);
            } catch (ex) {
                error('[sys/core/loader] afterloadfn', ex);
            }
        }

        // Se emite despues de los callbacks: quien escuche `ready` ya tiene la
        // aplicacion montada.
        emit('ready', state.result);
    }

    /**
     * Arranca la aplicacion.
     * @param {string} [manifestUrl]
     * @param {{done?: Function}} [options]
     * @returns {Promise|undefined}
     */
    function boot(manifestUrl, options) {
        options = options || {};

        if (manifestUrl) {
            config.manifestUrl = manifestUrl;
        }

        if (state.booted) {
            if (isFunction(options.done)) {
                options.done(state.result);
            }
            return promiseFor(state.result);
        }

        if (state.booting) {
            if (isFunction(options.done)) {
                state.booting.then(options.done);
            }
            return state.booting;
        }

        var url = config.manifestUrl;
        if (!url) {
            var missing = { ok: false, error: 'sin manifiesto (bootin)' };
            finalize(missing);
            showNotice('La aplicacion no tiene manifiesto de recursos.');
            if (isFunction(options.done)) {
                options.done(missing);
            }
            return promiseFor(missing);
        }

        if (url.indexOf('{') > -1) {
            var unresolved = { ok: false, error: 'bootin sin resolver: ' + url };
            error('[sys/core/loader] ' + unresolved.error + ' (¿se sirvio el HTML sin reemplazar {url}?)');
            finalize(unresolved);
            showNotice('El backend no resolvio la URL del manifiesto.');
            if (isFunction(options.done)) {
                options.done(unresolved);
            }
            return promiseFor(unresolved);
        }

        state.start = Date.now();
        api.start = state.start;
        state.is_ready = doc.readyState !== 'loading';
        if (state.is_ready) {
            api.is_ready = true;
        }
        state.fails.length = 0;
        state.errors.length = 0;

        var work = function (resolve) {
            basis(null);
            ajax(url, function (text) {
                var raw;
                try {
                    raw = JSON.parse(text);
                } catch (ex) {
                    var parseError = { ok: false, error: 'manifiesto JSON invalido: ' + ex.message };
                    error('[sys/core/loader] ' + parseError.error);
                    finalize(parseError);
                    showNotice('El manifiesto de recursos no es JSON valido.');
                    resolve(parseError);
                    return;
                }

                var manifest = normalizeManifest(raw);
                state.manifest = manifest;
                api.source = manifest.resources;
                basis(manifest);

                progress(0, manifest.resources.length, '');

                var done = function (err) {
                    var result = {
                        ok: !err && state.errors.length === 0,
                        duration: Date.now() - state.start,
                        loaded: Object.keys(state.loaded).length,
                        failed: state.errors.slice(),
                        manifest: manifest.version
                    };
                    if (err) {
                        result.error = err.message;
                    }
                    finalize(result);
                    resolve(result);
                };

                if (manifest.parallel) {
                    scheduleGraph(manifest.resources, done, manifest.concurrency || config.concurrency);
                } else {
                    scheduleSeries(manifest.resources, done);
                }
            }, function (err) {
                var result = { ok: false, error: 'no se pudo leer el manifiesto: ' + err.message };
                error('[sys/core/loader] ' + result.error);
                finalize(result);
                showNotice('No se pudieron cargar los recursos de la aplicacion.', true);
                resolve(result);
            }, { timeout: config.timeout });
        };

        if (isFunction(global.Promise)) {
            state.booting = new global.Promise(function (resolve) {
                work(resolve);
            });
            if (isFunction(options.done)) {
                state.booting.then(options.done);
            }
            return state.booting;
        }

        work(function (result) {
            if (isFunction(options.done)) {
                options.done(result);
            }
        });
        return undefined;
    }

    /** Promise ya resuelta, o `undefined` si el entorno no tiene Promise. */
    function promiseFor(value) {
        if (!isFunction(global.Promise)) {
            return undefined;
        }
        return global.Promise.resolve(value);
    }

    /** Espera a DOMContentLoaded, o corre ya si el documento esta listo. */
    function ready(callback) {
        if (doc.readyState === 'loading') {
            doc.addEventListener('DOMContentLoaded', function handler() {
                doc.removeEventListener('DOMContentLoaded', handler);
                state.is_ready = true;
                api.is_ready = true;
                callback();
            });
        } else {
            state.is_ready = true;
            api.is_ready = true;
            defer(callback);
        }
    }

    /** Arranque automatico disparado por el propio <script>. */
    function autoload() {
        readScriptConfig();

        if (config.autoload === false) {
            return;
        }
        if (!config.manifestUrl) {
            // Sin `bootin` el loader queda disponible como API, sin arrancar.
            return;
        }

        ready(function () {
            if (state.starting) {
                return;
            }
            state.starting = true;

            if (global.navigator && global.navigator.onLine === false) {
                log('sys.core.loader', 'navigator.onLine = false: se intenta igual');
            }

            boot(config.manifestUrl);
        });
    }

    /* ---------------------------------------------------------------------
     * API publica
     * ------------------------------------------------------------------- */

    function log(file, message) {
        if (config.log || (api && api.log_internal === true)) {
            if (global.console && global.console.log) {
                global.console.log('[sys/core/loader]', file, message);
            }
        }
    }

    function projectUrl() {
        return config.project;
    }

    function baseUrl() {
        return config.base;
    }

    function getHash() {
        var uri = global.location ? global.location.href : '';
        var parts = uri.split('#!');
        return parts.length > 1 ? parts[1] : '';
    }

    /** Carga de bajo nivel con la firma heredada. */
    function load(tag, url, cache, callback, asModule) {
        var spec = normalizeResource({
            tag: tag,
            url: url,
            cache: cache,
            module: asModule === true
        }, 0);
        state.loadedCount = (state.loadedCount || 0) + 1;
        state.stack = state.stack || [];
        state.stack.push(url);
        state.current = url;
        api.stack.push(url);
        api.current = url;
        api.loaded = (api.loaded || 0) + 1;
        loadOne(spec, function () {
            if (isFunction(callback)) {
                callback();
            }
        });
    }

    function loadResource(type, url, options, callback) {
        if (isFunction(options)) {
            callback = options;
            options = {};
        }
        options = options || {};
        var raw = {};
        for (var key in options) {
            if (hasOwn.call(options, key)) {
                raw[key] = options[key];
            }
        }
        raw.type = type;
        raw.url = url;
        var spec = normalizeResource(raw, 0);

        if (isFunction(callback)) {
            loadOne(spec, function (err, element) {
                callback(err || null, element);
            });
            return undefined;
        }

        if (!isFunction(global.Promise)) {
            var fallback = {};
            loadOne(spec, function (err) {
                fallback.ok = !err;
                fallback.error = err;
            });
            return promiseFor(fallback);
        }

        return new global.Promise(function (resolve, reject) {
            loadOne(spec, function (err, element) {
                if (err) {
                    reject(err);
                } else {
                    resolve(element);
                }
            });
        });
    }

    /**
     * Carga un modulo ESM como `<script type="module">`. No devuelve el
     * namespace: eso requiere `import()` nativo, que el codigo de aplicacion
     * puede usar directamente porque el loader se mantiene en ES5 (y un
     * `import()` literal romperia el parseo en navegadores viejos).
     */
    function loadModule(url, options, callback) {
        return loadResource('module', url, options, callback);
    }

    /** Carga un lote de recursos y devuelve Promise (o callback). */
    function preload(urls, options, callback) {
        if (isFunction(options)) {
            callback = options;
            options = {};
        }
        options = options || {};
        var type = options.type || 'preload';
        var list = isArray(urls) ? urls : [urls];
        var remaining = list.length;
        var errors = [];
        var resolvePromise = null;

        var finish = function () {
            var result = { ok: errors.length === 0, errors: errors };
            if (isFunction(callback)) {
                callback(errors.length ? errors[0] : null, result);
            }
            if (resolvePromise) {
                resolvePromise(result);
            }
        };

        if (remaining === 0) {
            defer(finish);
            return promiseFor({ ok: true, errors: [] });
        }

        if (isFunction(global.Promise) && !isFunction(callback)) {
            return new global.Promise(function (resolve) {
                resolvePromise = resolve;
                for (var i = 0; i < list.length; i++) {
                    loadOne(normalizeResource({ type: type, url: list[i], cache: options.cache }, i), function (err) {
                        if (err) {
                            errors.push(err);
                        }
                        remaining--;
                        if (remaining === 0) {
                            finish();
                        }
                    });
                }
            });
        }

        for (var j = 0; j < list.length; j++) {
            loadOne(normalizeResource({ type: type, url: list[j], cache: options.cache }, j), function (err) {
                if (err) {
                    errors.push(err);
                }
                remaining--;
                if (remaining === 0) {
                    finish();
                }
            });
        }
        return undefined;
    }

    /** Quita del DOM un recurso cargado por el loader (por id o URL). */
    function unload(target) {
        var found = false;
        var list = doc.getElementsByTagName('*');
        for (var i = list.length - 1; i >= 0; i--) {
            var el = list[i];
            if (!el.getAttribute || el.getAttribute('data-halcon-id') !== target) {
                continue;
            }
            if (el.parentNode) {
                el.parentNode.removeChild(el);
                found = true;
            }
        }
        for (var key in state.loaded) {
            if (hasOwn.call(state.loaded, key)) {
                var entry = state.loaded[key];
                if (entry && entry.spec && (entry.spec.id === target || entry.spec.url === target)) {
                    delete state.loaded[key];
                }
            }
        }
        return found;
    }

    /* ---------------------------------------------------------------------
     * Registro de modulos (app.define / app.require)
     * ------------------------------------------------------------------- */

    function modulePath(name) {
        return String(name || '').split('.').join('/') + '.js';
    }

    function execute(name) {
        var factory = modulos[name];
        counter[name] = (counter[name] || 0) + 1;
        if (!isFunction(factory)) {
            return null;
        }
        try {
            return factory();
        } catch (ex) {
            error('[sys/core/loader] app.define("' + name + '") fallo al ejecutarse', ex);
            emit('error', { name: name, error: ex });
            return null;
        }
    }

    function finishRequire(name) {
        var callbacks = state.requirePending[name] || [];
        delete state.requirePending[name];
        var value = hasOwn.call(modulos, name) ? execute(name) : null;
        if (!hasOwn.call(modulos, name)) {
            warn('[sys/core/loader] app.require("' + name + '"): el script cargo pero no definio el modulo');
        }
        // Se conserva el contrato asincrono de v2: el callback nunca corre
        // dentro del mismo tick en que se pidio el modulo.
        defer(function () {
            for (var i = 0; i < callbacks.length; i++) {
                try {
                    callbacks[i](value);
                } catch (ex) {
                    error('[sys/core/loader] callback de app.require("' + name + '")', ex);
                }
            }
        });
    }

    /** Busca un <script> ya insertado para ese nombre. */
    function scriptFor(name) {
        if (loadedScripts[name]) {
            return loadedScripts[name];
        }
        var list = doc.getElementsByTagName('script');
        for (var i = 0; i < list.length; i++) {
            if (list[i].getAttribute('data-halcon-module') === name) {
                loadedScripts[name] = list[i];
                return list[i];
            }
        }
        return null;
    }

    function requireModule(name, callback, options) {
        options = options || {};
        var id = String(name == null ? '' : name);

        if (!id) {
            throw new TypeError('[sys/core/loader] app.require: el nombre debe ser un string no vacio');
        }

        api.process = true;
        api.view = id;

        if (hasOwn.call(modulos, id)) {
            var value = execute(id);
            if (isFunction(callback)) {
                // v2 cargaba por red: se conserva el contrato asincrono.
                defer(function () {
                    callback(value);
                });
                return undefined;
            }
            return value;
        }

        if (!config.dynamicRequire) {
            if (isFunction(callback)) {
                defer(function () {
                    callback(null);
                });
                return undefined;
            }
            return null;
        }

        if (state.requirePending[id]) {
            if (isFunction(callback)) {
                state.requirePending[id].push(callback);
            }
            return undefined;
        }

        state.requirePending[id] = isFunction(callback) ? [callback] : [];

        var url = options.url || modulePath(id);
        var existing = scriptFor(id);
        var autorefresh = options.reload === true || api.autorefresh === true || config.autorefresh === true;

        if (existing && !autorefresh) {
            finishRequire(id);
            return undefined;
        }
        if (existing && autorefresh && existing.parentNode) {
            existing.parentNode.removeChild(existing);
            delete loadedScripts[id];
        }

        var force = options.force === true || api.require_force === true || config.requireForce === true;
        var spec = normalizeResource({
            type: options.module === true ? 'module' : 'script',
            url: url,
            cache: options.cache !== undefined ? options.cache : !force
        }, 0);
        spec.id = 'require-' + id;

        loadOne(spec, function (err, element) {
            if (element && element.setAttribute) {
                element.setAttribute('data-halcon-module', id);
            }
            if (err) {
                warn('[sys/core/loader] app.require("' + id + '"): ' + err.message);
            }
            finishRequire(id);
        });

        return undefined;
    }

    function importModuleByName(name, callback) {
        if (!isFunction(global.Promise)) {
            return requireModule(name, callback);
        }
        return new global.Promise(function (resolve, reject) {
            if (hasOwn.call(modulos, name)) {
                resolve(execute(name));
                return;
            }
            requireModule(name, function (value) {
                if (!hasOwn.call(modulos, name)) {
                    reject(new Error('[sys/core/loader] app.import("' + name + '"): modulo no disponible'));
                    return;
                }
                resolve(value);
            });
        }).then(function (value) {
            if (isFunction(callback)) {
                callback(value);
            }
            return value;
        });
    }

    /** Objeto `app` compatible con la API heredada. */
    var app = {
        version: VERSION,

        log: function (message) {
            if (global.usr && global.usr.log === true) {
                if (global.console && global.console.log) {
                    global.console.log(message);
                }
            }
        },

        run: function (fn) {
            if (!isFunction(fn)) {
                return;
            }
            if (state.booted) {
                defer(function () {
                    fn(state.result);
                });
                return;
            }
            state.after.push(fn);
        },

        define: function (name, factory) {
            if (typeof name !== 'string' || name === '') {
                throw new TypeError('[sys/core/loader] app.define: el nombre debe ser un string no vacio');
            }
            if (!isFunction(factory)) {
                throw new TypeError('[sys/core/loader] app.define("' + name + '"): falta la funcion de definicion');
            }
            if (hasOwn.call(modulos, name)) {
                warn('[sys/core/loader] app.define("' + name + '"): reemplaza la definicion anterior');
            }
            modulos[name] = factory;
            counter[name] = counter[name] || 0;
            return factory;
        },

        require: function (name, callback, options) {
            return requireModule(name, callback, options);
        },

        isDefined: function (name) {
            return typeof name === 'string' && hasOwn.call(modulos, name);
        },

        undefine: function (name) {
            delete modulos[name];
            delete counter[name];
            delete loadedScripts[name];
            return true;
        },

        modules: function () {
            var list = [];
            for (var key in modulos) {
                if (hasOwn.call(modulos, key)) {
                    list.push(key);
                }
            }
            return list;
        },

        boot: function (manifestUrl, options) {
            return boot(manifestUrl, options);
        }
    };

    app['import'] = function (name, callback) {
        return importModuleByName(name, callback);
    };

    /** Superficie publica del loader. */
    var api = {
        version: VERSION,
        name: '',
        loaded: 0,
        stack: [],
        current: '',
        view: '',
        start: null,
        end: null,
        source: [],
        afterloadfn: noop,
        is_ready: false,
        fails: state.fails,
        process: false,
        base: '',
        stamp: 'refresh=' + hash(),
        force: true,
        modulos: modulos,
        counter: counter,
        _project_url: '',
        require_force: false,
        autorefresh: false,
        log_internal: false,
        cssLoader: 'overflow:hidden;border:0;margin:0;padding:0;box-sizing:border-box;' +
            'background-color:#1C2B2D;background-image:url("#url#sdk/ui/img/logo.png?id=1");' +
            'background-size:25%;background-attachment:fixed;height:100%;width:100%;' +
            'height:100vh;width:100vw;background-position:center center;' +
            'background-repeat:no-repeat;transition:all .5s ease;',

        // Compatibilidad
        hash: hash,
        log: log,
        project_url: projectUrl,
        base_url: baseUrl,
        setDomAttribute: setAttr,
        setSource: function (value) {
            api.source = value;
            state.manifest = null;
        },
        getModule: getModule,
        getHash: getHash,
        getModuleName: getModule,
        set_view_port: setViewport,
        basis: function () {
            basis(state.manifest);
        },
        ready: ready,
        finalize: finalize,
        autoload: autoload,
        boot: boot,
        load: load,
        stairs: function (value) {
            var list = isArray(value) ? value : [];
            var normalized = [];
            for (var i = 0; i < list.length; i++) {
                normalized.push(normalizeResource(list[i], i));
            }
            api.source = normalized;
            api.start = Date.now();
            var runnable = function () {
                scheduleSeries(normalized, function () {
                    api.end = Date.now();
                    finalize({ ok: state.errors.length === 0 });
                });
            };
            if (api.is_ready) {
                runnable();
            } else {
                ready(runnable);
            }
            return runnable;
        },

        // Carga dinamica
        loadResource: loadResource,
        loadScript: function (url, options, callback) {
            return loadResource('script', url, options, callback);
        },
        loadStyle: function (url, options, callback) {
            return loadResource('css', url, options, callback);
        },
        preload: preload,
        loadModule: loadModule,
        unload: unload,
        getModuleUrl: function (name) {
            return resolveUrl(modulePath(name));
        },

        // Entorno y eventos
        environment: environment,
        matches: matches,
        watchEnvironment: function (callback) {
            var queries = [
                '(pointer: coarse)',
                '(prefers-color-scheme: dark)',
                '(prefers-reduced-motion: reduce)',
                '(orientation: portrait)'
            ];
            var cleanups = [];
            var notify = function () {
                callback(environment());
            };
            for (var i = 0; i < queries.length; i++) {
                if (!isFunction(global.matchMedia)) {
                    break;
                }
                var mql = global.matchMedia(queries[i]);
                if (mql && isFunction(mql.addEventListener)) {
                    mql.addEventListener('change', notify);
                    cleanups.push(function (media) {
                        return function () {
                            media.removeEventListener('change', notify);
                        };
                    }(mql));
                } else if (mql && isFunction(mql.addListener)) {
                    mql.addListener(notify);
                    cleanups.push(function (media) {
                        return function () {
                            media.removeListener(notify);
                        };
                    }(mql));
                }
            }
            if (isFunction(global.addEventListener)) {
                global.addEventListener('resize', notify);
                cleanups.push(function () {
                    global.removeEventListener('resize', notify);
                });
            }
            return function () {
                for (var j = 0; j < cleanups.length; j++) {
                    cleanups[j]();
                }
            };
        },
        on: function (name, callback) {
            if (!state.listeners[name]) {
                state.listeners[name] = [];
            }
            state.listeners[name].push(callback);
            return function () {
                api.off(name, callback);
            };
        },
        off: function (name, callback) {
            var list = state.listeners[name] || [];
            for (var i = list.length - 1; i >= 0; i--) {
                if (list[i] === callback) {
                    list.splice(i, 1);
                }
            }
        },
        once: function (name, callback) {
            var off = api.on(name, function (detail) {
                off();
                callback(detail);
            });
            return off;
        },
        emit: emit,

        // Diagnostico
        config: config,
        state: state,
        progress: function () {
            return state.progress;
        },
        reload: function (name) {
            var existing = scriptFor(name);
            if (existing && existing.parentNode) {
                existing.parentNode.removeChild(existing);
            }
            delete loadedScripts[name];
            delete modulos[name];
            for (var key in state.loaded) {
                if (hasOwn.call(state.loaded, key)) {
                    var entry = state.loaded[key];
                    if (entry && entry.spec && entry.spec.id === 'require-' + name) {
                        delete state.loaded[key];
                    }
                }
            }
            return importModuleByName(name);
        },
        reset: function () {
            for (var key in modulos) {
                if (hasOwn.call(modulos, key)) {
                    delete modulos[key];
                }
            }
            for (var name in state.loaded) {
                if (hasOwn.call(state.loaded, name)) {
                    delete state.loaded[name];
                }
            }
            state.fails.length = 0;
            state.errors.length = 0;
            state.after.length = 0;
            state.listeners = {};
            state.stamp = '';
            state.booted = false;
            state.finalized = false;
            state.booting = null;
            state.starting = false;
            state.result = null;
            state.progress = { total: 0, done: 0, current: '' };
            loadedScripts = {};
            api.is_ready = false;
            api.loaded = 0;
            api.end = null;
        }
    };

    // Compatibilidad con la deteccion de dispositivo heredada. No se usa para
    // decidir cargas: es solo una ayuda para codigo de aplicacion.
    api.iphoneDevice = function () {
        var env = environment();
        return env.isIOS && env.isTouch;
    };
    api.pcDevice = function () {
        return !environment().isTouch;
    };
    api.ajax_native = function (url, callback, onerror) {
        return ajax(url, callback, function (err) {
            log('sys.core.loader', 'ajax: ' + err.message + ' ' + url);
            if (isFunction(onerror)) {
                onerror();
            }
        }, { timeout: config.timeout });
    };

    // `usr` existe aun cuando el manifiesto no traiga un json.
    if (!global.usr) {
        global.usr = {};
    }

    global.__loader = api;
    global.app = app;

    // El sello del manifiesto se toma del propio script si el backend lo agrego.
    autoload();

}(typeof window !== 'undefined' ? window : this));
