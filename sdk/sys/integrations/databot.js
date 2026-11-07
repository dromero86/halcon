/**
 * Integracion `databot` (opcional) para la ruta heredada.
 *
 * `databot` manda SQL desde el cliente en un payload `{action:"databot"}`.
 * Esta deprecado como diseno: el SQL y los permisos deben vivir en el backend.
 * Se aisla aca para que `helper.js` no dependa de ese protocolo y para que las
 * aplicaciones nuevas no lo carguen.
 *
 * Uso:
 *
 *   __loader.loadScript('sys/integrations/databot.js');
 *   __.SQLCombo('cbCliente', { select: { from: 'clientes' } });
 *
 * Conserva los nombres historicos (`SQLCombo`, `SQLTable`, `query`, `query_combo`,
 * `query_list`) y ademas queda en `__.integrations.databot`.
 */
(function (global) {
    'use strict';

    if (global.__halconDatabotIntegration) {
        return;
    }

    var api = global.__;
    if (!api || typeof api.registerIntegration !== 'function' || typeof api.PAYLOAD !== 'function') {
        throw new Error('[integrations/databot] falta cargar sdk/sys/core/helper.js primero');
    }
    global.__halconDatabotIntegration = true;

    function warn(message) {
        if (global.console && global.console.warn) {
            global.console.warn('[integrations/databot] ' + message);
        }
    }

    function makeError(message, raw) {
        var err = new Error(message);
        err.raw = raw;
        return err;
    }

    function parse(response) {
        if (typeof api.parseJson === 'function') {
            return api.parseJson(response);
        }
        try {
            return JSON.parse(response);
        } catch (ex) {
            return null;
        }
    }

    function view(id) {
        if (typeof global.$$ === 'function') {
            return global.$$(id);
        }
        if (global.webix && typeof global.webix.$$ === 'function') {
            return global.webix.$$(id);
        }
        return null;
    }

    function updateCombo(viewId, response, onError) {
        var result = parse(response);
        var target = view(viewId);
        if (!result || !target) {
            if (typeof onError === 'function') {
                onError(makeError('respuesta databot invalida o vista inexistente', response));
            } else {
                warn('no se pudo actualizar la vista "' + viewId + '"');
            }
            return;
        }
        target.define('options', result.data);
        target.refresh();
    }

    function updateTable(viewId, response, onError) {
        var result = parse(response);
        var target = view(viewId);
        if (!result || !target) {
            if (typeof onError === 'function') {
                onError(makeError('respuesta databot invalida o vista inexistente', response));
            } else {
                warn('no se pudo actualizar la vista "' + viewId + '"');
            }
            return;
        }
        target.clearAll();
        target.parse(result.data);
    }

    var integration = {
        /** @deprecated usar un endpoint del backend en lugar de SQL cliente. */
        SQLCombo: function (webixId, query, onError) {
            api.PAYLOAD({ action: 'databot' }, query, function (response) {
                updateCombo(webixId, response, onError);
            }, onError);
        },

        /** @deprecated */
        SQLTable: function (webixId, query, onError) {
            api.PAYLOAD({ action: 'databot' }, query, function (response) {
                updateTable(webixId, response, onError);
            }, onError);
        },

        /** @deprecated */
        query: function (query, callback, onError) {
            api.PAYLOAD({ action: 'databot' }, query, function (response) {
                var result = parse(response);
                if (!result) {
                    if (typeof onError === 'function') {
                        onError(makeError('respuesta databot invalida', response));
                    }
                    return;
                }
                if (typeof callback === 'function') {
                    callback(result.data);
                }
            }, onError);
        },

        /** @deprecated */
        query_combo: function (viewId, query, onError) {
            api.PAYLOAD({ action: 'databot' }, query, function (response) {
                updateCombo(viewId, response, onError);
            }, onError);
        },

        /** @deprecated */
        query_list: function (viewId, query, onError) {
            api.PAYLOAD({ action: 'databot' }, query, function (response) {
                updateTable(viewId, response, onError);
            }, onError);
        },
    };

    api.registerIntegration('databot', integration);

    // Nombres historicos: el codigo heredado sigue llamando `__.SQLCombo`, etc.
    var aliases = ['SQLCombo', 'SQLTable', 'query', 'query_combo', 'query_list'];
    for (var i = 0; i < aliases.length; i++) {
        var name = aliases[i];
        if (api[name] === undefined) {
            api[name] = integration[name];
        }
    }

}(typeof window !== 'undefined' ? window : this));
