/**
 * Plugin `formview` como kind de Zorzal.
 *
 * Conserva la estructura, los setters, los eventos (`formReady` y
 * `onFormSubmmited`), la validacion previa al guardado y `mobile_input`.
 *
 * El kind se registra con `define('formview', factory)` y arma un `layout`
 * vertical con un `form` de Zorzal: la toolbar interior (volver, titulo,
 * guardar) va como primer hijo del formulario y despues los campos de la prop
 * `elements`, que se declaran con la sintaxis de Zorzal (`kind`).
 *
 * API del plugin:
 *
 *  - props: `store`, `source`, `update`, `dataview`, `title_add`, `title_set`,
 *    `validate`, `elements`, `back`.
 *  - eventos: `formReady` (recibe `[elemento, esEdicion]`) y
 *    `onFormSubmmited` (recibe los valores del formulario).
 *  - metodos: `render()`, `mobile_input()`.
 *  - instancias expuestas: `form`, `title`, `save`.
 *
 * El guardado usa `form.validate()` y `form.getValues()` del widget de Zorzal;
 * el aviso de error sale por el servicio `toast`.
 */

import { create, define, toast } from '../../vendor/zorzal/zorzal-0.1.0.min.js';
import { __ } from '../../compat/globals.js';

/**
 * Habilita o deshabilita un widget por su prop `disabled`.
 * @param {any} view
 * @param {boolean} enabled
 */
function setEnabled(view, enabled) {
  if (!view || typeof view.set !== 'function') return;
  view.set({ disabled: !enabled });
}

define('formview', (ctx) => {
  const props = ctx.props;
  const store = props.store;

  const formId = `${store}_form`;
  const titleId = `${store}_title`;
  const saveId = `${store}_btn`;

  /**
   * Vuelve a la pantalla de datos: el callback de la prop `back` o
   * `props.openDataview`, igual que el original.
   */
  const back = () => {
    if (typeof props.back === 'function') return props.back();
    if (typeof props.openDataview === 'function') return props.openDataview();
    console.warn(`[formview] sin props.openDataview: no se vuelve a "${props.dataview}"`);
    return false;
  };

  const save = create({
    id: saveId,
    name: saveId,
    kind: 'button',
    icon: 'save',
    title: 'Guardar',
    disabled: true,
  });

  const title = create({ id: titleId, kind: 'label', text: '' });

  const interior = create({
    kind: 'toolbar',
    items: [
      create({ kind: 'button', icon: 'chevron-left', title: 'Volver', on: { click: back } }),
      title,
      create({ id: `${store}_extra`, kind: 'spacer', flex: true }),
      create({ id: `${store}_fecha`, kind: 'spacer' }),
      save,
    ],
  });
  interior.el.classList.add('toolbar-interior');

  const form = create({
    id: formId,
    kind: 'form',
    fields: [interior, ...(Array.isArray(props.elements) ? props.elements : [])],
    rules: props.rules,
  });

  const root = create({ kind: 'layout', orientation: 'vertical', children: [form] });

  /** Engancha el foco de los inputs al resaltado del campo en pantallas tactiles. */
  const mobileInput = () => {
    if (typeof __.mobileAndTabletcheck === 'function' && !__.mobileAndTabletcheck()) return;
    const host = root.el;
    if (!host || typeof host.querySelectorAll !== 'function') return;
    const doc = host.ownerDocument;
    if (!doc || typeof doc.querySelector !== 'function') return;
    const scroller = () => doc.querySelector('.focus-scroll');
    for (const item of host.querySelectorAll('.z-text input')) {
      item.addEventListener('focus', () => {
        const box = item.closest('.z-text');
        if (box && !box.classList.contains('focus-input')) box.classList.add('focus-input');
        const container = scroller();
        if (container && !container.classList.contains('scroll-active')) container.classList.add('scroll-active');
      });
      item.addEventListener('blur', () => {
        const box = item.closest('.z-text');
        if (box && box.classList.contains('focus-input')) box.classList.remove('focus-input');
        const container = scroller();
        if (container && container.classList.contains('scroll-active')) container.classList.remove('scroll-active');
      });
    }
  };

  /**
   * Carga la fila en edicion o prepara el alta, habilita el guardado y emite
   * `formReady`. Corre despues del montaje para que los handlers declarados en
   * el spec ya esten enganchados.
   */
  const render = () => {
    if (__.current[store] !== undefined) {
      title.setValue(props.title_set);
      __.setTitle(props.title_set);
      __.GET(props.source, (data) => {
        setEnabled(save, true);
        form.setValues(data || {});
        mobileInput();
        ctx.emit('formReady', [root.el, true]);
      });
      return;
    }

    setEnabled(save, true);
    title.setValue(props.title_add);
    __.setTitle(props.title_add);
    mobileInput();
    ctx.emit('formReady', [root.el, false]);
  };

  const submit = () => {
    if (form.validate() !== true) {
      toast('Complete correctamente los campos', { kind: 'error' });
      return false;
    }
    const values = form.getValues();
    ctx.emit('onFormSubmmited', values);
    __.sendPost({ action: props.update }, values, props.dataview);
    return true;
  };

  save.on('click', submit);
  queueMicrotask(render);

  return {
    el: root.el,
    update() {},
    destroy() {
      root.destroy();
    },
    api: {
      /** @returns {any} widget `form` de Zorzal */
      get form() {
        return form;
      },
      /** @returns {any} etiqueta del titulo */
      get title() {
        return title;
      },
      /** @returns {any} boton de guardado */
      get save() {
        return save;
      },
      render,
      mobile_input: mobileInput,
    },
  };
});

export default 'formview';
