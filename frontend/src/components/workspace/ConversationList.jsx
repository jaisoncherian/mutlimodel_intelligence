import React, { useState } from 'react';

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
          className="w-full h-[36px] px-2.5 text-xs rounded-[8px] border border-bordercol bg-surface text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-brand"
        />
      )}

      {deleteError && (
        <p role="alert" className="text-xs text-chipFailedText">
          {deleteError}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-textSecondary py-1">Loading conversations...</p>
      ) : isError ? (
        <div className="flex items-center justify-between gap-2 py-1">
          <p className="text-xs text-textSecondary">Conversations could not be loaded.</p>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-xs font-medium text-brandText hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand rounded"
          >
            Retry
          </button>
        </div>
      ) : conversations.length === 0 ? (
        <p className="text-xs text-textSecondary py-1">No saved conversations</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-textSecondary py-1">No conversations match this filter</p>
      ) : (
        <ul className="space-y-1">
          {visible.map((conversation) => {
            const title = conversation.title || 'Untitled conversation';
            const isActive = conversation.id === activeId;
            return (
              <li
                key={conversation.id}
                className={`flex items-center gap-1 rounded-[8px] border transition-colors ${
                  isActive ? 'bg-brandLight border-brandBorder' : 'border-transparent hover:bg-surfaceSubtle'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(conversation.id)}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`Open conversation ${title}`}
                  title={title}
                  className="flex-1 min-w-0 flex items-center justify-between gap-2 p-2 text-left rounded-[8px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <span className={`text-xs truncate ${isActive ? 'font-semibold text-brandText' : 'text-textPrimary'}`}>
                    {title}
                  </span>
                  <span className="text-xs text-textSecondary shrink-0">{formatDate(conversation.created_at)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete({ id: conversation.id, title })}
                  aria-label={`Delete conversation ${title}`}
                  title="Delete conversation"
                  className="shrink-0 p-1.5 mr-0.5 rounded text-textSecondary hover:text-textPrimary hover:bg-surfaceSubtle cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {toDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-conversation-title"
            className="bg-surface rounded-xl border border-bordercol shadow-2xl p-5 max-w-sm w-full space-y-4 text-textPrimary"
          >
            <h3 id="delete-conversation-title" className="text-sm font-bold text-textPrimary">
              Delete conversation
            </h3>
            <p className="text-xs text-textSecondary leading-relaxed break-words">
              Delete <span className="font-semibold text-textPrimary">{toDelete.title}</span> and all its messages?
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className="h-[36px] px-3 text-xs font-medium text-textSecondary hover:text-textPrimary rounded-[8px] hover:bg-surfaceSubtle border border-bordercol cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="h-[36px] px-3 text-xs font-medium bg-chipFailedBg text-chipFailedText rounded-[8px] border border-bordercol cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
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
