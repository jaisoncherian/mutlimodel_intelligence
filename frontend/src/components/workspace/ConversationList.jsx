import React, { useState } from 'react';
import Icon from '../Icon.jsx';

const formatDate = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/**
 * Saved conversations with a title filter, open, and delete with confirmation.
 *
 * @param {Object} props
 * @param {Array<import('../../api/types.js').ConversationSummary>} props.conversations
 * @param {boolean} [props.isLoading]
 * @param {boolean} [props.isError]
 * @param {() => void} [props.onRetry]
 * @param {string|null} [props.activeId]
 * @param {(id: string) => void} props.onOpen
 * @param {(id: string) => void} props.onDelete
 * @param {string|null} [props.deleteError]
 */
export default function ConversationList({
  conversations,
  isLoading = false,
  isError = false,
  onRetry,
  activeId = null,
  onOpen,
  onDelete,
  deleteError = null,
}) {
  const [filter, setFilter] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const term = filter.trim().toLowerCase();
  const visible = term
    ? conversations.filter((c) => (c.title || '').toLowerCase().includes(term))
    : conversations;

  const confirmDelete = () => {
    onDelete(toDelete.id);
    setToDelete(null);
  };

  return (
    <div className="space-y-2">
      {conversations.length > 0 && (
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by title"
          aria-label="Filter conversations by title"
          className="w-full h-9 px-2 text-xs rounded-lg border border-border bg-surface text-text placeholder-muted"
        />
      )}

      {deleteError && (
        <p role="alert" className="text-xs text-chip-failed-text">
          {deleteError}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-muted py-1">Loading conversations...</p>
      ) : isError ? (
        <div className="flex items-center justify-between gap-2 py-1">
          <p className="text-xs text-muted">Conversations could not be loaded.</p>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-xs font-medium text-accent-text hover:underline cursor-pointer rounded"
          >
            Retry
          </button>
        </div>
      ) : conversations.length === 0 ? (
        <p className="text-xs text-muted py-1">No saved conversations</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-muted py-1">No conversations match this filter</p>
      ) : (
        <ul className="space-y-1">
          {visible.map((conversation) => {
            const title = conversation.title || 'Untitled conversation';
            const isActive = conversation.id === activeId;
            return (
              <li
                key={conversation.id}
                className={`flex items-center gap-1 rounded-lg border transition-colors ${
                  isActive ? 'bg-accent-soft border-accent-line' : 'border-transparent hover:bg-surface-2'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(conversation.id)}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`Open conversation ${title}`}
                  title={title}
                  className="flex-1 min-w-0 h-9 flex items-center justify-between gap-2 px-2 text-left rounded-lg cursor-pointer"
                >
                  <span className={`text-xs truncate ${isActive ? 'font-semibold text-accent-text' : 'text-text'}`}>
                    {title}
                  </span>
                  <span className="text-xs text-muted shrink-0">{formatDate(conversation.created_at)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete({ id: conversation.id, title })}
                  aria-label={`Delete conversation ${title}`}
                  title="Delete conversation"
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {toDelete && (
        <div className="fixed inset-0 bg-scrim flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-conversation-title"
            className="bg-surface rounded-xl border border-border shadow-2xl p-4 max-w-sm w-full space-y-4 text-text"
          >
            <h3 id="delete-conversation-title" className="text-sm font-bold text-text">
              Delete conversation
            </h3>
            <p className="text-xs text-muted leading-relaxed break-words">
              Delete <span className="font-semibold text-text">{toDelete.title}</span> and all its messages?
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className="h-9 px-4 text-xs font-medium text-muted hover:text-text rounded-lg hover:bg-surface-2 border border-border cursor-pointer transition-colors"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="h-9 px-4 text-xs font-medium bg-chip-failed-bg text-chip-failed-text rounded-lg border border-border cursor-pointer transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
