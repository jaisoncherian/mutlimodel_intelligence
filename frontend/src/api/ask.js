/**
 * @file Ask / Question answering API module.
 */

import { client } from './client.js';

/**
 * Ask a question against the selected documents.
 * @param {Object} params
 * @param {string} params.question - Question text (1-1000 chars)
 * @param {string[]} [params.doc_ids] - Optional document UUID list to restrict search
 * @param {string} [params.conversation_id] - Optional conversation UUID
 * @param {number} [params.k] - Optional top-k retrieval count (1-12)
 * @param {AbortSignal} [params.signal] - AbortController signal
 * @returns {Promise<import('./types.js').AskResponse>}
 */
export async function askQuestion({ question, doc_ids, conversation_id, k, signal }) {
  const body = {
    question,
    ...(doc_ids && doc_ids.length > 0 ? { doc_ids } : {}),
    ...(conversation_id ? { conversation_id } : {}),
    ...(k ? { k } : {}),
  };

  return client.post('/ask', body, { signal });
}
