/**
 * @file Ask / Question answering API module.
 */

import { client } from './client.js';

/** The backend rejects longer questions (backend/app/api/ask.py). */
export const MAX_QUESTION_CHARS = 1000;

/** The browser gives up on a single /ask request after this long. */
export const ASK_TIMEOUT_MS = 240000;

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

/**
 * @typedef {Object} AskFailure
 * @property {'cancelled'|'timeout'|'busy'|'unavailable'|'network'|'server'|'request'} kind
 * @property {string} title
 * @property {string} message
 * @property {boolean} canRetry
 */

/**
 * Turns a failed /ask call into what the thread shows.
 *
 * Both 503 cases come from backend/app/api/ask.py: the semaphore timeout says
 * "busy", while an unreachable or timed-out Ollama says "unavailable". The API
 * does not separate those last two, so neither does the message.
 *
 * @param {{status?: number, message?: string}} error - from client.js
 * @param {'cancel'|'timeout'|null} abortReason - why this tab aborted, if it did
 * @returns {AskFailure}
 */
export function describeAskFailure(error, abortReason = null) {
  // A cancelled /ask keeps running on the server and holds the model until it finishes.
  const stillRunning =
    'The server may still finish this request, so the model can stay busy for a while.';

  if (abortReason === 'cancel') {
    return {
      kind: 'cancelled',
      title: 'Question cancelled',
      message: `Your question is back in the box below. ${stillRunning}`,
      canRetry: false,
    };
  }
  if (abortReason === 'timeout') {
    return {
      kind: 'timeout',
      title: `No answer after ${ASK_TIMEOUT_MS / 1000} seconds`,
      message: `The request was stopped here. ${stillRunning}`,
      canRetry: true,
    };
  }

  const status = Number(error?.status) || 0;
  const apiMessage = error?.message || '';

  if (status === 503) {
    return /busy/i.test(apiMessage)
      ? {
          kind: 'busy',
          title: 'The model is busy',
          message: 'Another request is using the model. Retry when you are ready.',
          canRetry: true,
        }
      : {
          kind: 'unavailable',
          title: 'The local model did not respond',
          message: 'Ollama is unreachable or timed out. Check that it is running, then retry.',
          canRetry: true,
        };
  }
  if (status === 0) {
    return {
      kind: 'network',
      title: 'Could not reach the server',
      message: 'Check your connection and that the backend is running, then retry.',
      canRetry: true,
    };
  }
  if (status >= 500) {
    return {
      kind: 'server',
      title: `The server returned an error (${status})`,
      message: 'This can mean the backend is not running. Check it, then retry.',
      canRetry: true,
    };
  }
  return {
    kind: 'request',
    title: 'The question was not accepted',
    message: apiMessage || `Request failed with status ${status}.`,
    canRetry: false,
  };
}
