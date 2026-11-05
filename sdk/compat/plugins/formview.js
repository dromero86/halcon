/**
 * Plugin `formview` portado a modulo ES sobre el shim de Zorzal.
 *
 * Origen: `sdk/sys/plugins/formview.js` (Webix + globales de la aplicacion).
 * El port conserva la estructura, los setters, los eventos (`formReady` y
 * `onFormSubmmited`) y el aviso de validacion del original.
 *
 * Diferencias de adaptacion (ver `sdk/compat/README.md`):
 *  - los handlers de boton usan cierres sobre la instancia en lugar de
 *    `this.config.root` / `this.config.go`, porque Zorzal invoca el click con
 *    el evento como argumento;
 *  - `enable()`/`disable()` no existen en el boton de Zorzal: se usa
 *    `set({ disabled })`;
 *  - `validate()` de Zorzal devuelve `true` o un objeto de errores, asi que el
 *    port compara con `true`;
 *  - `mobile_input` engancha el foco sobre los inputs de Zorzal (`.z-field`) y
 *    omite el scroll externo de la aplicacion si no esta.
 */

import { webix } from '../webix-shim.js';
import { __, app } from '../globals.js';

/**
 * Habilita o deshabilita una vista con la API del shim.
 * @param {any} view
 * @param {boolean} enabled
 */
function setEnabled(view, enabled) {
  if (!view) return;
  if (enabled && typeof view.enable === 'function') {
    view.enable();
    return;
  }
  if (!enabled && typeof view.disable === 'function') {
    view.disable();
    return;
  }
  if (typeof view.set === 'function') view.set({ disabled: !enabled });
}

/**
 * Resuelve un hijo del formulario por id, avisando si falta.
 * @param {string} id
 * @returns {any|null}
 */
function child(id) {
  const view = webix.$$(id);
  if (!view) console.warn(`[formview] no se encontro la vista "${id}"`);
  return view;
}

webix.protoUI(
  {
    name: 'formview',

    /**
     * @param {Record<string, any>} config
     */
    $init(config) {
      const that = this;
      const store = config.store;

      const default_back = function () {
        app.require(config.dataview);
      };

      config.type = 'space';
      config.css = 'form-view';
      config.rows = [
        {
          id: store + '_form',
          view: 'form',
          type: 'space',
          margin: 0,
          padding: 0,
          elements: [
            {
              view: 'toolbar',
              css: 'toolbar-interior',
              type: 'space',
              margin: 0,
              padding: 0,
              height: 70,
              cols: [
                {
                  view: 'button',
                  type: 'icon',
                  icon: 'chevron-left',
                  css: 'app_button',
                  width: 45,
                  align: 'center',
                  borderless: true,
                  click: config.back !== undefined ? config.back : default_back,
                },
                { id: store + '_title', view: 'label' },
                { id: store + '_extra', width: 1 },
                { id: store + '_fecha', width: 1 },
                {
                  id: store + '_btn',
                  view: 'button',
                  type: 'icon',
                  icon: 'save',
                  align: 'center',
                  css: 'app_button',
                  borderless: true,
                  disabled: true,
                  width: 56,
                  click() {
                    const form = webix.$$(store + '_form');
                    if (!form) {
                      console.warn(`[formview] no se encontro "${store}_form"`);
                      return;
                    }

                    const values = __.getFormPost(store + '_form');
                    const checked =
                      config.validate !== undefined && typeof form.validate === 'function'
                        ? form.validate() === true
                        : true;

                    if (!checked) {
                      webix.message({ type: 'error', text: '¡Error! Complete correctamente los campos' });
                      return;
                    }

                    that.callEvent('onFormSubmmited', [values]);
                    __.sendPost({ action: config.update }, values, config.dataview);
                  },
                },
              ],
            },
            ...(Array.isArray(config.elements) ? config.elements : []),
          ],
        },
      ];

      this.$ready.push(this.render);
    },

    render() {
      const that = this;

      setTimeout(function () {
        const store = that.store;

        if (__.current[store] !== undefined) {
          const form = child(store + '_form');
          const button = child(store + '_btn');
          const title = child(store + '_title');
          if (!form || !button || !title) return;

          title.setValue(that.title_set);
          __.setTitle(that.title_set);

          __.GET(that.source, function (data) {
            setEnabled(button, true);
            if (typeof form.setValues === 'function') form.setValues(data);
            that.mobile_input();
            that.callEvent('formReady', [that.$view, true]);
          });
          return;
        }

        if (store === undefined) return;

        const button = child(store + '_btn');
        const title = child(store + '_title');
        if (!button || !title) return;

        setEnabled(button, true);
        title.setValue(that.title_add);
        __.setTitle(that.title_add);
        that.mobile_input();
        that.callEvent('formReady', [that.$view, false]);
      }, 25);
    },

    mobile_input() {
      if (!__.mobileAndTabletcheck()) return;

      // El original consultaba el documento por clases de Webix; aca se acota
      // al subarbol de esta vista y a la clase del input de Zorzal.
      const root = this.$view;
      if (!root || typeof root.querySelectorAll !== 'function') return;
      const items = root.querySelectorAll('.z-field input');
      const scroller = () => document.querySelector('.focus-scroll');

      for (const item of items) {
        item.addEventListener('focus', function () {
          const box = this.closest('.z-field');
          if (box && !box.classList.contains('focus-input')) box.classList.add('focus-input');
          const container = scroller();
          if (container && !container.classList.contains('scroll-active')) container.classList.add('scroll-active');
        });

        item.addEventListener('blur', function () {
          const box = this.closest('.z-field');
          if (box && box.classList.contains('focus-input')) box.classList.remove('focus-input');
          const container = scroller();
          if (container && container.classList.contains('scroll-active')) container.classList.remove('scroll-active');
        });
      }
    },

    dataview_setter(value) {
      this.dataview = value;
    },
    update_setter(value) {
      this.update = value;
    },
    elements_setter(value) {
      this.elements = value;
    },
    store_setter(value) {
      this.store = value;
    },
    title_set_setter(value) {
      this.title_set = value;
    },
    title_add_setter(value) {
      this.title_add = value;
    },
    source_setter(value) {
      this.source = value;
    },
  },
  webix.ui.layout
);

export default 'formview';
