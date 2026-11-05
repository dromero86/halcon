/**
 * rules: validacion declarativa.
 *
 * Cada fabrica devuelve una funcion `(value) => string|null`; `null` significa
 * valido y un string es el mensaje de error. `check()` y `form()` agrupan.
 */

/** @param {unknown} value */
export function isEmpty(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * @param {(value: unknown) => string|null} validator
 * @param {string} [message]
 * @returns {(value: unknown) => string|null}
 */
function withMessage(validator, message) {
  if (!message) return validator;
  return (value) => {
    const result = validator(value);
    return result ? message : null;
  };
}

export const rules = {
  /** @param {string} [message] */
  required(message = 'Campo obligatorio') {
    return (value) => (isEmpty(value) ? message : null);
  },

  /**
   * @param {number} min
   * @param {string} [message]
   */
  minLength(min, message) {
    return withMessage(
      (value) => (String(value ?? '').length >= min ? null : `Minimo ${min} caracteres`),
      message
    );
  },

  /**
   * @param {number} max
   * @param {string} [message]
   */
  maxLength(max, message) {
    return withMessage(
      (value) => (String(value ?? '').length <= max ? null : `Maximo ${max} caracteres`),
      message
    );
  },

  /**
   * @param {RegExp} regexp
   * @param {string} [message]
   */
  pattern(regexp, message = 'Formato invalido') {
    return (value) => {
      if (isEmpty(value)) return null;
      const re = new RegExp(regexp.source, regexp.flags.replace('g', ''));
      return re.test(String(value)) ? null : message;
    };
  },

  /** @param {string} [message] */
  email(message = 'Email invalido') {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return (value) => (isEmpty(value) ? null : re.test(String(value)) ? null : message);
  },

  /** @param {string} [message] */
  number(message = 'Debe ser un numero') {
    return (value) => {
      if (isEmpty(value)) return null;
      return Number.isFinite(Number(value)) ? null : message;
    };
  },

  /**
   * @param {number} min
   * @param {number} max
   * @param {string} [message]
   */
  range(min, max, message) {
    return (value) => {
      if (isEmpty(value)) return null;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return message || 'Debe ser un numero';
      return numeric >= min && numeric <= max ? null : message || `Debe estar entre ${min} y ${max}`;
    };
  },

  /**
   * @param {unknown[]} allowed
   * @param {string} [message]
   */
  oneOf(allowed, message = 'Valor no permitido') {
    const set = new Set((allowed || []).map((item) => String(item)));
    return (value) => (isEmpty(value) ? null : set.has(String(value)) ? null : message);
  },

  /**
   * @param {number} size
   * @param {string} [message]
   */
  length(size, message) {
    return withMessage(
      (value) => (String(value ?? '').length === size ? null : `Debe tener ${size} caracteres`),
      message
    );
  },

  /**
   * Corre una lista de validadores.
   * @param {unknown} value
   * @param {Array<(value: unknown) => string|null>} validators
   * @returns {{ valid: boolean, errors: string[], error: string|null }}
   */
  check(value, validators = []) {
    const errors = [];
    for (const validator of validators) {
      if (typeof validator !== 'function') continue;
      const result = validator(value);
      if (result) errors.push(String(result));
    }
    return { valid: errors.length === 0, errors, error: errors[0] || null };
  },

  /**
   * Valida un objeto campo por campo.
   * @param {Record<string, unknown>} values
   * @param {Record<string, Array<(value: unknown) => string|null>>} schema
   * @returns {{ valid: boolean, errors: Record<string, string>, checks: Record<string, { valid: boolean, errors: string[] }> }}
   */
  form(values, schema = {}) {
    const errors = {};
    const checks = {};
    for (const [field, validators] of Object.entries(schema)) {
      const result = rules.check(values ? values[field] : undefined, validators || []);
      checks[field] = { valid: result.valid, errors: result.errors };
      if (!result.valid) errors[field] = result.error;
    }
    return { valid: Object.keys(errors).length === 0, errors, checks };
  },

  /**
   * Primer mensaje de error o null.
   * @param {unknown} value
   * @param {Array<(value: unknown) => string|null>} validators
   */
  first(value, validators = []) {
    const result = rules.check(value, validators);
    return result.error;
  },
};

export default rules;
