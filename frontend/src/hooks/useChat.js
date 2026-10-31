import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { askQuestion, describeAskFailure, ASK_TIMEOUT_MS } from '../api/ask.js';
import { getConversationMessages } from '../api/conversations.js';
import { storedRowsToEntries } from '../utils/storedMessages.js';
import { CONVERSATIONS_QUERY_KEY } from './useConversations.js';

/**
 * @typedef {{id: string, role: 'user', content: string}
 *   | {id: string, role: 'assistant', response: import('../api/types.js').AskResponse}} ChatEntry
 */

/**
 * Thread state for one conversation. /ask is a single slow request with no
 * streaming, so a turn is only ever pending, answered or failed.
 *
 * @param {Object} params
 * @param {string[]} params.selectedDocIds - checked ready documents
 */
export function useChat({ selectedDocIds }) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState(/** @type {ChatEntry[]} */ ([]));
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(/** @type {{startedAt: number}|null} */ (null));
  const [failure, setFailure] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isReopened, setIsReopened] = useState(false);

  const conversationIdRef = useRef(null);
  const nextIdRef = useRef(0);
  // The request this thread is still waiting for. Anything else that settles is stale.
  const activeRef = useRef(null);
  const newId = (prefix) => `${prefix}-${(nextIdRef.current += 1)}`;

  const rememberConversation = (id) => {
    conversationIdRef.current = id;
    setConversationId(id);
  };

  const stopActive = useCallback(() => {
    const active = activeRef.current;
    activeRef.current = null;
    if (active) {
      clearTimeout(active.timer);
      active.controller.abort();
    }
  }, []);

  // Leaving the workspace must not leave a request running against this thread.
  useEffect(() => stopActive, [stopActive]);

  const send = useCallback(
    async (rawQuestion) => {
      const question = rawQuestion.trim();
      if (!question || activeRef.current) return;

      const userEntryId = newId('user');
      // Sending again replaces the failed turn instead of repeating its bubble.
      setMessages((prev) => {
        const kept = failure ? prev.filter((m) => m.id !== failure.userEntryId) : prev;
        return [...kept, { id: userEntryId, role: 'user', content: question }];
      });
      setFailure(null);
      setDraft((current) => (current.trim() === question ? '' : current));
      setPending({ startedAt: Date.now() });

      const controller = new AbortController();
      const active = { controller, abortReason: null, timer: null };
      active.timer = setTimeout(() => {
        active.abortReason = 'timeout';
        controller.abort();
      }, ASK_TIMEOUT_MS);
      activeRef.current = active;

      const fail = (error) => {
        setFailure({
          ...describeAskFailure(error, active.abortReason),
          question,
          userEntryId,
        });
        // Keep anything typed while waiting; otherwise the question goes back in the box.
        setDraft((current) => (current.trim() ? current : question));
      };

      try {
        const response = await askQuestion({
          question,
          doc_ids: selectedDocIds,
          conversation_id: conversationIdRef.current,
          signal: controller.signal,
        });
        if (activeRef.current !== active) return;

        // client.js returns null when an abort lands while the body is being read.
        if (active.abortReason) {
          fail(null);
        } else if (!response || typeof response !== 'object' || !response.status) {
          fail({ status: 500, message: 'The server sent an unexpected response.' });
        } else {
          rememberConversation(response.conversation_id);
          setMessages((prev) => [...prev, { id: newId('answer'), role: 'assistant', response }]);
          queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
        }
      } catch (error) {
        if (activeRef.current !== active) return;
        fail(error);
      } finally {
        clearTimeout(active.timer);
        if (activeRef.current === active) {
          activeRef.current = null;
          setPending(null);
        }
      }
    },
    [selectedDocIds, failure, queryClient]
  );

  const cancel = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;
    active.abortReason = 'cancel';
    active.controller.abort();
  }, []);

  /** Loads a saved conversation; the next question continues it. */
  const openConversation = useCallback(
    async (id) => {
      stopActive();
      const controller = new AbortController();
      const active = { controller, abortReason: null, timer: null };
      activeRef.current = active;

      rememberConversation(null);
      setMessages([]);
      setPending(null);
      setFailure(null);
      setIsReopened(false);
      setIsOpening(true);

      try {
        const rows = await getConversationMessages(id, { signal: controller.signal });
        if (activeRef.current !== active) return;
        setMessages(storedRowsToEntries(rows));
        rememberConversation(id);
        setIsReopened(true);
      } catch (error) {
        if (activeRef.current !== active) return;
        setFailure({
          kind: 'open',
          title: 'Could not open this conversation',
          message: error?.message || 'The server did not return it.',
          canRetry: true,
          openId: id,
        });
      } finally {
        if (activeRef.current === active) {
          activeRef.current = null;
          setIsOpening(false);
        }
      }
    },
    [stopActive]
  );

  const retry = useCallback(() => {
    if (failure?.openId) openConversation(failure.openId);
    else if (failure) send(failure.question);
  }, [failure, send, openConversation]);

  /** Starts a fresh thread. Nothing on the server is deleted. */
  const reset = useCallback(() => {
    stopActive();
    rememberConversation(null);
    setMessages([]);
    setDraft('');
    setPending(null);
    setFailure(null);
    setIsOpening(false);
    setIsReopened(false);
  }, [stopActive]);

  return {
    messages,
    draft,
    setDraft,
    pending,
    failure,
    conversationId,
    isOpening,
    isReopened,
    send,
    cancel,
    retry,
    reset,
    openConversation,
  };
}
