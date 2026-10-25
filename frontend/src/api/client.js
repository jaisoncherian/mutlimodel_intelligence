/**
 * @file API client for DocuLens AI frontend.
 * Handles base URL, JSON headers, error normalization into {status, message},
 * AbortController signals, and an auth header hook point.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

/**
 * Hook point where an auth header can be attached later.
 * Currently returns empty headers since authentication is in a future phase.
 * @returns {Record<string, string>}
 */
export function getAuthHeaders() {
  return {};
}

/**
 * Normalizes any error into a standard `{ status, message }` object.
 * @param {any} error
 * @param {number} [fallbackStatus=0]
 * @returns {{ status: number, message: string }}
 */
export function normalizeError(error, fallbackStatus = 0) {
  if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
    return {
      status: Number(error.status) || fallbackStatus,
      message: String(error.message || 'An unexpected error occurred.'),
    };
  }

  if (
    error?.name === 'AbortError' ||
    (error?.name === 'DOMException' && error?.code === 20) ||
    error?.message?.toLowerCase().includes('aborted') ||
    error?.message?.toLowerCase().includes('abort')
  ) {
    return {
      status: 0,
      message: 'Request was cancelled.',
    };
  }

  if (error instanceof TypeError && error.message?.includes('fetch')) {
    return {
      status: 0,
      message: 'Network connection error. Could not connect to the server.',
    };
  }

  return {
    status: fallbackStatus,
    message: error?.message || 'An unexpected error occurred.',
  };
}

/**
 * Base fetch wrapper.
 * @param {string} endpoint - Path (e.g. '/documents')
 * @param {RequestInit} [options={}]
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  const isFormData =
    (typeof FormData !== 'undefined' && options.body instanceof FormData) ||
    options.body?.constructor?.name === 'FormData' ||
    (typeof options.body?.append === 'function' && typeof options.body?.entries === 'function');
  if (!isFormData && options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    throw normalizeError(err, 0);
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg =
      (data && typeof data === 'object' && (data.error || data.message)) ||
      response.statusText ||
      `Request failed with status ${response.status}`;
    throw {
      status: response.status,
      message: String(errorMsg),
    };
  }

  return data;
}

export const client = {
  get: (endpoint, options) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'POST', body }),
  delete: (endpoint, options) => apiRequest(endpoint, { ...options, method: 'DELETE' }),
};
