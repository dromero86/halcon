/**
 * Waves 2.0: efecto ripple para la ruta heredada.
 *
 * API compatible:
 *
 *   waves.add({ css: 'btn', effect: 'waves-dark', after: fn });
 *   waves.clear();
 *   waves.service();   // idempotente
 *   waves.destroy();   // retira el listener
 *
 * Mejoras sobre la version 1:
 *  - no depende de `event.path` (solo Chrome); usa `composedPath()` o el
 *    recorrido de `parentNode`;
 *  - usa `clientX/clientY` con `getBoundingClientRect()` (la version 1 mezclaba
 *    `pageX/pageY` con coordenadas de viewport y el ripple quedaba corrido al
 *    hacer scroll);
 *  - construye el DOM con `createElement` en vez de `innerHTML`;
 *  - `service()` es idempotente y `destroy()` permite desmontarlo;
 *  - no recorre arrays con `for...in`.
 */
(function (global) {
    'use strict';

    if (global.__halconWavesInstalled) {
        return;
    }

    var doc = global.document;
    if (!doc) {
        return;
    }
    global.__halconWavesInstalled = true;

    var VERSION = '2.0.0';

    function Waves() {
        this.version = VERSION;
        this.selectors = [];
        this.duration = 1000;
        this._bound = null;
        this._target = null;
    }

    Waves.prototype.add = function (value) {
        if (!value || typeof value.css !== 'string' || value.css === '') {
            return null;
        }
        this.selectors.push(value);
        return value;
    };

    Waves.prototype.clear = function () {
        this.selectors = [];
    };

    Waves.prototype.setDomAttribute = function (element, key, value) {
        if (element && element.setAttribute) {
            element.setAttribute(key, value);
        }
    };

    /** Coordenadas del evento en el viewport, con fallback a pageX/pageY. */
    function pointFromEvent(event) {
        var x = event.clientX;
        var y = event.clientY;
        if (x === undefined || y === undefined) {
            x = (event.pageX || 0) - (global.pageXOffset || 0);
            y = (event.pageY || 0) - (global.pageYOffset || 0);
        }
        return { x: x, y: y };
    }

    /** Ruta del evento sin depender de `event.path`. */
    function eventPath(event) {
        if (typeof event.composedPath === 'function') {
            return event.composedPath();
        }
        if (event.path && event.path.length) {
            return event.path;
        }
        var path = [];
        var node = event.target;
        while (node) {
            path.push(node);
            node = node.parentNode;
        }
        return path;
    }

    Waves.prototype.add_wave_layer = function (point, box, selected) {
        var selector = this.selectors[selected];
        if (!selector) {
            return null;
        }

        var top = box.top !== undefined ? box.top : (box.y || 0);
        var left = box.left !== undefined ? box.left : (box.x || 0);
        var width = box.width !== undefined ? box.width : (box.right || 0) - left;
        var height = box.height !== undefined ? box.height : (box.bottom || 0) - top;
        var effect = selector.effect ? ' ' + selector.effect : '';

        var container = doc.createElement('div');
        container.className = 'waves-container';
        container.style.top = top + 'px';
        container.style.left = left + 'px';
        container.style.width = width + 'px';
        container.style.height = height + 'px';

        var inner = doc.createElement('div');
        inner.style.position = 'relative';
        inner.style.width = width + 'px';
        inner.style.height = height + 'px';
        inner.style.zIndex = '1';

        var wave = doc.createElement('div');
        wave.className = 'waves' + effect;
        wave.style.zIndex = '1';
        wave.style.position = 'absolute';
        wave.style.width = '5px';
        wave.style.height = '5px';
        wave.style.top = (point.y - top) + 'px';
        wave.style.left = (point.x - left) + 'px';

        inner.appendChild(wave);
        container.appendChild(inner);
        (doc.body || doc.documentElement).appendChild(container);

        var self = this;
        global.setTimeout(function () {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, this.duration);

        if (typeof selector.after === 'function') {
            selector.after();
        }

        return container;
    };

    Waves.prototype.mouse_event = function (event, selected) {
        var element = event.target && event.target.nodeType === 3 ? event.target.parentNode : event.target;
        if (!element || typeof element.getBoundingClientRect !== 'function') {
            return false;
        }
        this.add_wave_layer(pointFromEvent(event), element.getBoundingClientRect(), selected);
        return false;
    };

    Waves.prototype._handle = function (event) {
        var path = eventPath(event);
        for (var i = 0; i < path.length; i++) {
            var element = path[i];
            if (!element || !element.classList || typeof element.classList.contains !== 'function') {
                continue;
            }
            for (var j = 0; j < this.selectors.length; j++) {
                if (this.selectors[j] && element.classList.contains(this.selectors[j].css)) {
                    this.mouse_event(event, j);
                }
            }
        }
    };

    Waves.prototype.service = function () {
        if (this._bound) {
            return this;
        }
        var self = this;
        this._bound = function (event) {
            self._handle(event);
        };
        this._target = doc.body || doc;
        if (this._target && typeof this._target.addEventListener === 'function') {
            this._target.addEventListener('mouseup', this._bound, false);
        }
        return this;
    };

    Waves.prototype.destroy = function () {
        if (this._target && this._bound && typeof this._target.removeEventListener === 'function') {
            this._target.removeEventListener('mouseup', this._bound, false);
        }
        this._bound = null;
        this._target = null;
        return this;
    };

    var instance = new Waves();
    global.waves = instance;
    instance.service();

}(typeof window !== 'undefined' ? window : this));
