/**
 * Integracion Firebase (opcional) para la ruta heredada.
 *
 * No forma parte del nucleo de `helper.js`: se carga solo cuando la aplicacion
 * la necesita, con el manifiesto o en runtime:
 *
 *   __loader.loadScript('sys/integrations/firebase.js');
 *
 * Requiere que la aplicacion publique `__.current.FIREBASE` con una API
 * compatible con `ref(key)` (push/on/remove). Si no esta configurado, las
 * operaciones avisan y no rompen.
 */
(function (global) {
    'use strict';

    if (global.__halconFirebaseIntegration) {
        return;
    }

    var api = global.__;
    if (!api || typeof api.registerIntegration !== 'function') {
        throw new Error('[integrations/firebase] falta cargar sdk/sys/core/helper.js primero');
    }
    global.__halconFirebaseIntegration = true;

    function warned() {
        if (global.console && global.console.warn) {
            global.console.warn('[integrations/firebase] no hay __.current.FIREBASE configurado; se ignora la operacion');
        }
    }

    function ref(key) {
        var firebase = api.current && api.current.FIREBASE;
        if (!firebase || typeof firebase.ref !== 'function') {
            warned();
            return null;
        }
        return firebase.ref(key);
    }

    var integration = {
        /** Referencia cruda de Firebase, o `null` si no esta configurado. */
        ref: ref,

        /** Agrega un item en `key`. */
        add: function (key, item) {
            var target = ref(key);
            if (target && typeof target.push === 'function') {
                target.push(item);
            }
        },

        /** Escucha `child_added`, elimina el nodo y entrega el valor. */
        on_write: function (key, callback) {
            var target = ref(key);
            if (!target || typeof target.on !== 'function' || typeof callback !== 'function') {
                return;
            }
            target.on('child_added', function (data) {
                if (typeof target.remove === 'function') {
                    target.remove();
                }
                callback(data.val());
            });
        },
    };

    api.registerIntegration('firebase', integration);

}(typeof window !== 'undefined' ? window : this));
