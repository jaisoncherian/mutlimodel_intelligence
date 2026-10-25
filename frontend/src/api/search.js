/**
 * @file Search API module.
 */

import { client } from './client.js';

/**
 * Execute search query against chunks.
 * @param {Object} params
 * @param {string} params.query
 * @param {string[]} [params.doc_ids]
 * @param {number} [params.k]
 * @param {'hybrid'|'vector'|'keyword'} [params.mode]
 * @param {string[]} [params.types]
 * @param {boolean} [params.include_references]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<import('./types.js').SearchHit[]>}
 */
export async function search({ query, doc_ids, k, mode, types, include_references, signal }) {
  const queryParams = new URLSearchParams();
  queryParams.set('q', query);
  if (k) queryParams.set('k', String(k));
  if (mode) queryParams.set('mode', mode);
  if (doc_ids && doc_ids.length > 0) queryParams.set('doc_ids', doc_ids.join(','));
  if (types && types.length > 0) queryParams.set('types', types.join(','));
  if (include_references !== undefined) queryParams.set('include_references', String(include_references));

  return client.get(`/search?${queryParams.toString()}`, { signal });
}

/**
 * List chunks for a document.
 * @param {string} docId - Document UUID
 * @param {Object} [params]
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 * @param {number} [params.page]
 * @param {string} [params.type]
 * @param {RequestInit} [options]
 * @returns {Promise<any[]>}
 */
export async function listDocumentChunks(docId, params = {}, options = {}) {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.set('limit', String(params.limit));
  if (params.offset) queryParams.set('offset', String(params.offset));
  if (params.page) queryParams.set('page', String(params.page));
  if (params.type) queryParams.set('type', params.type);

  const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return client.get(`/documents/${docId}/chunks${qs}`, options);
}
