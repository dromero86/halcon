/**
 * store: almacenamiento con namespace, sobre localStorage o sessionStorage.
 *
 * Si el entorno no expone el storage (Node, modo privado con acceso bloqueado)
 * se usa un backend en memoria con la misma interfaz. Los valores se guardan
 * como JSON.
 */

const memoryBackends = new Map();

/** @param {string} kind */
function createMemoryStorage(kind) {
  const data = new Map();
  return {
    kind,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

/** @param {string} kind 'local' | 'session' */
function resolveBackend(kind) {
  const name = kind === 'session' ? 'sessionStorage' : 'localStorage';
  try {
    const candidate = globalThis[name];
    if (candidate && typeof candidate.getItem === 'function') {
      const probe = '__zorzal_probe__';
      candidate.setItem(probe, '1');
      candidate.removeItem(probe);
      return candidate;
    }
  } catch {
    // acceso bloqueado: se cae al backend en memoria
  }
  if (!memoryBackends.has(kind)) memoryBackends.set(kind, createMemoryStorage(kind));
  return memoryBackends.get(kind);
}

/**
 * @param {string} kind
 * @param {string} prefix
 * @returns {string[]}
 */
function namespacedKeys(kind, prefix) {
  const backend = resolveBackend(kind);
  const out = [];
  for (let index = 0; index < backend.length; index += 1) {
    const key = backend.key(index);
    if (typeof key === 'string' && key.startsWith(prefix)) out.push(key.slice(prefix.length));
  }
  return out;
}


/**
 * Crea un store con namespace.
 *
 * @param {'local'|'session'} [kind]
 * @param {string} [prefix]
 * @returns {{
 *   get: (key: string, fallback?: unknown) => unknown,
 *   set: (key: string, value: unknown) => unknown,
 *   has: (key: string) => boolean,
 *   remove: (key: string) => boolean,
 *   clear: () => void,
 *   keys: () => string[],
 *   kind: string,
 *   prefix: string
 * }}
 */
export function createStore(kind = 'local', prefix = 'z:') {
  if (kind !== 'local' && kind !== 'session') {
    throw new Error(`zorzal.store: tipo invalido "${kind}" (local o session)`);
  }
  const fullKey = (key) => `${prefix}${key}`;

  return {
    kind,
    prefix,
    /**
     * @param {string} key
     * @param {unknown} [fallback]
     */
    get(key, fallback = null) {
      try {
        const raw = resolveBackend(kind).getItem(fullKey(key));
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    /**
     * @param {string} key
     * @param {unknown} value
     */
    set(key, value) {
      resolveBackend(kind).setItem(fullKey(key), JSON.stringify(value));
      return value;
    },
    /** @param {string} key */
    has(key) {
      return resolveBackend(kind).getItem(fullKey(key)) !== null;
    },
    /** @param {string} key */
    remove(key) {
      resolveBackend(kind).removeItem(fullKey(key));
      return true;
    },
    clear() {
      const backend = resolveBackend(kind);
      for (const key of namespacedKeys(kind, prefix)) backend.removeItem(fullKey(key));
    },
    /** @returns {string[]} */
    keys() {
      return namespacedKeys(kind, prefix);
    },
  };
}

export const store = {
  local: createStore('local'),
  session: createStore('session'),
  create: createStore,
};

export default store;
