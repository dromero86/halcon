/**
 * http: cliente minimo sobre fetch con JSON y errores uniformes.
 *
 * Toda falla (red, timeout, status no 2xx) se traduce a un `HttpError` con
 * `status`, `url`, `body` y `code`, de modo que quien llama maneja un solo tipo.
 */

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, url?: string, body?: unknown, code?: string, cause?: unknown }} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = details.status ?? 0;
    this.url = details.url ?? '';
    this.body = details.body ?? null;
    this.code = details.code || (this.status === 0 ? 'NETWORK' : 'HTTP');
    if (details.cause !== undefined) this.cause = details.cause;
  }

  /** @returns {boolean} */
  get isNetwork() {
    return this.code === 'NETWORK';
  }

  /** @returns {boolean} */
  get isTimeout() {
    return this.code === 'TIMEOUT';
  }
}

/**
 * @param {unknown} data
 * @returns {string}
 */
function messageFrom(data, fallback) {
  if (data && typeof data === 'object') {
    const candidate = data.message || data.error || data.detail;
    if (typeof candidate === 'string' && candidate) return candidate;
  }
  if (typeof data === 'string' && data.trim()) return data.trim();
  return fallback;
}

/**
 * @param {string} url
 * @param {{
 *   method?: string,
 *   body?: unknown,
 *   headers?: Record<string, string>,
 *   timeout?: number,
 *   signal?: AbortSignal,
 *   credentials?: RequestCredentials,
 *   raw?: boolean
 * }} [options]
 * @returns {Promise<any>}
 */
export async function request(url, options = {}) {
  if (typeof url !== 'string' || url === '') {
    throw new HttpError('http: url requerida', { code: 'INVALID' });
  }
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const init = { method, headers };

  if (options.body !== undefined) {
    if (typeof options.body === 'string' || options.body instanceof Uint8Array) {
      init.body = options.body;
    } else {
      init.body = JSON.stringify(options.body);
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }
  if (options.credentials) init.credentials = options.credentials;

  let controller = null;
  if (options.signal) {
    init.signal = options.signal;
  } else if (options.timeout && options.timeout > 0) {
    controller = new AbortController();
    init.signal = controller.signal;
  }

  let timer = null;
  const timeoutPromise =
    controller && options.timeout
      ? new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new HttpError(`http: tiempo agotado (${options.timeout}ms)`, { url, code: 'TIMEOUT' }));
          }, options.timeout);
        })
      : null;

  let response;
  try {
    response = timeoutPromise ? await Promise.race([fetch(url, init), timeoutPromise]) : await fetch(url, init);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(`http: fallo de red (${error?.message || error})`, {
      url,
      code: 'NETWORK',
      cause: error,
    });
  } finally {
    if (timer !== null) clearTimeout(timer);
  }

  const text = await response.text();
  let data = null;
  if (text !== '') {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new HttpError(messageFrom(data, `http: ${response.status} ${response.statusText || ''}`.trim()), {
      status: response.status,
      url,
      body: data,
      code: 'HTTP',
    });
  }

  if (options.raw) {
    return { data, status: response.status, headers: response.headers, response };
  }
  return data;
}

/**
 * @param {string} url
 * @param {Record<string, string>} [params]
 */
function withQuery(url, params) {
  if (!params) return url;
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  if (!query) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}

export const http = {
  request,
  HttpError,
  /**
   * @param {string} url
   * @param {Record<string, string>} [params]
   * @param {object} [options]
   */
  get(url, params, options = {}) {
    return request(withQuery(url, params), { ...options, method: 'GET' });
  },
  /**
   * @param {string} url
   * @param {unknown} [body]
   * @param {object} [options]
   */
  post(url, body, options = {}) {
    return request(url, { ...options, method: 'POST', body });
  },
  /**
   * @param {string} url
   * @param {unknown} [body]
   * @param {object} [options]
   */
  put(url, body, options = {}) {
    return request(url, { ...options, method: 'PUT', body });
  },
  /**
   * @param {string} url
   * @param {unknown} [body]
   * @param {object} [options]
   */
  patch(url, body, options = {}) {
    return request(url, { ...options, method: 'PATCH', body });
  },
  /**
   * @param {string} url
   * @param {object} [options]
   */
  del(url, options = {}) {
    return request(url, { ...options, method: 'DELETE' });
  },
};

export default http;
