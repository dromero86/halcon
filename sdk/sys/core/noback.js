/**
 * NoBack 2.0: bloqueo del boton "atras" y de Backspace en la ruta heredada.
 *
 * La version 1 sobreescribia `window.onload` y `window.onhashchange`, agregaba
 * `#` y `!` a `location.href` con timers de 50 ms y llamaba `stopPropagation()`
 * en **todos** los keydown. Esta version:
 *
 *  - usa `addEventListener` y no pisa handlers de la aplicacion;
 *  - normaliza el hash con `history.replaceState` y agrega un unico centinela
 *    con `pushState`, sin tocar `location.href` a mano;
 *  - solo previene Backspace fuera de campos editables y no corta el resto de
 *    los eventos de teclado;
 *  - escucha el evento `route` del helper para seguir la navegacion interna;
 *  - expone `window.HalconNoBack` con `install()` / `uninstall()`.
 *
 * Se mantiene el efecto observable historico: al cargar, la aplicacion queda en
 * `#!<ruta>` y el boton "atras" no la abandona.
 */
(function (global) {
    'use strict';

    if (global.__halconNoBackInstalled) {
        return;
    }

    var doc = global.document;
    if (!doc || !global.location) {
        return;
    }
    global.__halconNoBackInstalled = true;

    var VERSION = '2.0.0';
    var installed = false;
    var currentRoute = '';
    var unsubscribeRoute = null;
    var pendingInstall = null;

    var config = {
        blockBack: true,
        blockBackspace: true,
    };

    function getRoute() {
        var href = global.location.href || '';
        var index = href.indexOf('#!');
        return index > -1 ? href.slice(index + 2) : '';
    }

    function routeUrl(route) {
        return '#!' + route;
    }

    function replaceRoute(route) {
        try {
            if (global.history && typeof global.history.replaceState === 'function') {
                global.history.replaceState(null, '', routeUrl(route));
                return;
            }
        } catch (ex) {
            // file:// o contexto restringido: se usa el hash
        }
        global.location.hash = routeUrl(route);
    }

    function pushRoute(route) {
        try {
            if (global.history && typeof global.history.pushState === 'function') {
                global.history.pushState(null, '', routeUrl(route));
                return;
            }
        } catch (ex) {
            // file:// o contexto restringido: se usa el hash
        }
        global.location.hash = routeUrl(route);
    }

    function isEditable(target) {
        if (!target) {
            return false;
        }
        var tag = String(target.nodeName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            return true;
        }
        return target.isContentEditable === true;
    }

    function onKeydown(event) {
        if (!config.blockBackspace) {
            return;
        }
        var key = event.key;
        var code = event.keyCode || event.which;
        if ((key === 'Backspace' || code === 8) && !isEditable(event.target)) {
            if (typeof event.preventDefault === 'function') {
                event.preventDefault();
            } else {
                event.returnValue = false;
            }
        }
    }

    function onPopState() {
        if (!installed || !config.blockBack) {
            return;
        }
        if (getRoute() !== currentRoute) {
            pushRoute(currentRoute);
        }
    }

    function onHashChange() {
        if (!installed || !config.blockBack) {
            return;
        }
        if (getRoute() !== currentRoute) {
            replaceRoute(currentRoute);
        }
    }

    function onRoute(detail) {
        if (detail && typeof detail.module === 'string') {
            currentRoute = detail.module;
        }
    }

    function subscribeRoute() {
        if (global.__ && typeof global.__.on === 'function') {
            unsubscribeRoute = global.__.on('route', onRoute);
        }
    }

    function unsubscribe() {
        if (typeof unsubscribeRoute === 'function') {
            unsubscribeRoute();
            unsubscribeRoute = null;
        }
    }

    var api = {
        version: VERSION,
        config: config,

        getRoute: getRoute,
        route: function () {
            return currentRoute;
        },
        isInstalled: function () {
            return installed;
        },

        /**
         * Instala el bloqueo. Idempotente.
         * @param {{route?: string, blockBack?: boolean, blockBackspace?: boolean}} [options]
         */
        install: function (options) {
            if (installed) {
                return api;
            }
            if (pendingInstall) {
                doc.removeEventListener('DOMContentLoaded', pendingInstall);
                pendingInstall = null;
            }
            options = options || {};
            if (options.blockBack !== undefined) {
                config.blockBack = options.blockBack !== false;
            }
            if (options.blockBackspace !== undefined) {
                config.blockBackspace = options.blockBackspace !== false;
            }

            installed = true;
            currentRoute = options.route !== undefined ? String(options.route) : getRoute();

            replaceRoute(currentRoute);
            if (config.blockBack) {
                pushRoute(currentRoute);
            }

            doc.addEventListener('keydown', onKeydown, false);
            if (typeof global.addEventListener === 'function') {
                global.addEventListener('popstate', onPopState, false);
                global.addEventListener('hashchange', onHashChange, false);
            }
            subscribeRoute();
            return api;
        },

        /** Retira listeners y suscripcion. No revierte el historial. */
        uninstall: function () {
            if (pendingInstall) {
                doc.removeEventListener('DOMContentLoaded', pendingInstall);
                pendingInstall = null;
            }
            if (!installed) {
                return api;
            }
            doc.removeEventListener('keydown', onKeydown, false);
            if (typeof global.removeEventListener === 'function') {
                global.removeEventListener('popstate', onPopState, false);
                global.removeEventListener('hashchange', onHashChange, false);
            }
            unsubscribe();
            installed = false;
            return api;
        },
    };

    global.HalconNoBack = api;

    // La ruta heredada carga este script despues de DOMContentLoaded. Si se
    // carga antes, se espera al evento para no tocar el body a medio parsear.
    if (doc.readyState === 'loading') {
        pendingInstall = function () {
            pendingInstall = null;
            api.install();
        };
        doc.addEventListener('DOMContentLoaded', pendingInstall);
    } else {
        api.install();
    }

}(typeof window !== 'undefined' ? window : this));
