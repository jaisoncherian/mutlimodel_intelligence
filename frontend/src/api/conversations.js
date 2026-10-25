/**
 * @file Conversations API module.
 */

import { client } from './client.js';

/**
 * List all conversations, newest first.
 * @param {RequestInit} [options]
 * @returns {Promise<import('./types.js').ConversationSummary[]>}
 */
export async function listConversations(options) {
  return client.get('/conversations', options);
}

/**
 * Get messages and citations for a conversation.
 * @param {string} conversationId - Conversation UUID
 * @param {RequestInit} [options]
 * @returns {Promise<import('./types.js').StoredMessage[]>}
 */
export async function getConversationMessages(conversationId, options) {
  return client.get(`/conversations/${conversationId}/messages`, options);
}

/**
 * Delete a conversation.
 * @param {string} conversationId - Conversation UUID
 * @param {RequestInit} [options]
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteConversation(conversationId, options) {
  return client.delete(`/conversations/${conversationId}`, options);
}
