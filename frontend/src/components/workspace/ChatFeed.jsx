import React, { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import ChatMessage from './ChatMessage.jsx';

const SCROLL_TOP_GAP_PX = 16;

/** No step names: /ask does not report progress, so only elapsed time is real. */
function WorkingIndicator({ startedAt, onCancel }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  return (
    <div className="flex items-center justify-between gap-4 bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-4 min-w-0">
        <span role="status" className="text-sm text-text">
          Working on your question...
        </span>
        <span data-testid="elapsed-seconds" className="font-mono text-xs text-muted shrink-0">
          {elapsedSeconds} s
        </span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="h-9 px-4 shrink-0 rounded-lg border border-border bg-surface text-text hover:bg-surface-2 text-xs font-medium transition-colors cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}

function FailureNotice({ failure, onRetry, hasDocuments }) {
  const isCancel = failure.kind === 'cancelled';
  // Reopening a saved conversation does not depend on the document selection.
  const canRetryNow = Boolean(failure.openId) || hasDocuments;
  return (
    <div
      role={isCancel ? 'status' : 'alert'}
      className={`rounded-xl border border-border p-4 space-y-2 ${
        isCancel ? 'bg-chip-neutral-bg text-chip-neutral-text' : 'bg-chip-caution-bg text-chip-caution-text'
      }`}
    >
      <p className="text-sm font-semibold">{failure.title}</p>
      <p className="text-xs">{failure.message}</p>
      {failure.canRetry && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onRetry}
            disabled={!canRetryNow}
            className="h-9 px-4 rounded-lg border border-border bg-surface text-text hover:bg-surface-2 disabled:bg-surface-2 disabled:text-muted disabled:cursor-not-allowed text-xs font-medium transition-colors cursor-pointer"
          >
            Retry
          </button>
          {!canRetryNow && <span className="text-xs">Select at least one ready document to retry.</span>}
        </div>
      )}
    </div>
  );
}

/**
 * The scrolling thread. The composer sits below it, outside this container.
 *
 * @param {Object} props
 * @param {Array<import('../../hooks/useChat.js').ChatEntry>} props.messages
 * @param {{startedAt: number}|null} [props.pending]
 * @param {any} [props.failure]
 * @param {() => void} [props.onCancel]
 * @param {() => void} [props.onRetry]
 * @param {boolean} [props.hasDocuments] - at least one ready document is checked
 * @param {boolean} [props.isOpening] - a saved conversation is loading
 * @param {boolean} [props.isReopened] - the thread came from a saved conversation
 * @param {(citation: import('../../api/types.js').AskCitation) => void} [props.onCitationClick]
 */
export default function ChatFeed({
  messages = [],
  pending = null,
  failure = null,
  onCancel,
  onRetry,
  hasDocuments = true,
  isOpening = false,
  isReopened = false,
  onCitationClick,
}) {
  const scrollerRef = useRef(null);
  const columnRef = useRef(null);
  const isWorking = Boolean(pending);

  // Brings the top of the newest item into view, so a long answer opens at its
  // start. The browser clamps this at the bottom when the item is short.
  useEffect(() => {
    const newest = columnRef.current?.lastElementChild;
    if (scrollerRef.current && newest) {
      scrollerRef.current.scrollTop = newest.offsetTop - SCROLL_TOP_GAP_PX;
    }
  }, [messages.length, isWorking, failure]);

  if (messages.length === 0 && !pending && !failure && !isOpening) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center p-8 text-center text-muted space-y-2">
        <div className="w-12 h-12 rounded-full bg-accent-soft text-accent-text flex items-center justify-center mb-2 border border-accent-line">
          <Icon name="chat" size={20} />
        </div>
        <p className="text-sm font-semibold text-text">No messages yet</p>
        <p className="text-xs text-muted max-w-sm">
          Select one or more ready documents from the sidebar, then ask a question below.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      data-testid="chat-scroller"
      className="relative flex-1 min-h-0 overflow-y-auto custom-scroll p-4 sm:p-6"
    >
      <div ref={columnRef} className="max-w-[760px] mx-auto space-y-4">
        {isOpening && (
          <p role="status" className="text-sm text-muted text-center">
            Loading conversation...
          </p>
        )}
        {isReopened && (
          <p className="text-xs text-muted text-center">
            Saved conversation. Calculations and &quot;What is missing&quot; notes are not saved, so saved answers do
            not show them.
          </p>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} onCitationClick={onCitationClick} />
        ))}
        {pending && <WorkingIndicator startedAt={pending.startedAt} onCancel={onCancel} />}
        {failure && <FailureNotice failure={failure} onRetry={onRetry} hasDocuments={hasDocuments} />}
      </div>
    </div>
  );
}
