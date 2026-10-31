import React, { useEffect, useState } from 'react';
import Icon from '../Icon.jsx';

function formatElapsed(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const seconds = totalSeconds % 60;
  return `${Math.floor(totalSeconds / 60)} m ${String(seconds).padStart(2, '0')} s`;
}

/** Elapsed time only: the API reports no progress, so there is no estimate to give. */
function ProcessingNote({ since }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-2 pt-2 border-t border-border text-xs text-muted space-y-0.5">
      <p>Reading the pages. Large or scanned files take longer.</p>
      {since && (
        <p data-testid="processing-elapsed">
          <span className="font-mono">{formatElapsed(Math.max(0, Math.floor((now - since.startedAt) / 1000)))}</span>
          {since.fromPageOpen && ' since this page opened'}
        </p>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Array<import('../../api/types.js').DocumentSummary>} props.documents
 * @param {Record<string, {startedAt: number, fromPageOpen: boolean}>} [props.processingSince]
 * @param {string[]} props.selectedDocIds
 * @param {(id: string) => void} props.onToggleDoc
 * @param {() => void} props.onSelectAll
 * @param {() => void} props.onClearAll
 * @param {(id: string) => void} props.onDeleteDoc
 * @param {(id: string) => void} props.onReprocessDoc
 * @param {boolean} [props.isLoading]
 */
export default function DocumentList({
  documents = [],
  processingSince = {},
  selectedDocIds = [],
  onToggleDoc,
  onSelectAll,
  onClearAll,
  onDeleteDoc,
  onReprocessDoc,
  isLoading = false,
}) {
  const [docToDelete, setDocToDelete] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const checkedCount = selectedDocIds.length;
  const anyUnchecked = readyDocs.length > 0 && readyDocs.some((d) => !selectedDocIds.includes(d.id));

  const formatPages = (doc) => {
    if (doc.page_count === null || doc.page_count === undefined) return '';
    return `${doc.page_count} ${doc.page_count === 1 ? 'page' : 'pages'}`;
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'ready':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-chip-ready-bg text-chip-ready-text shrink-0 border border-border">
            Ready
          </span>
        );
      case 'processing':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-chip-processing-bg text-chip-processing-text shrink-0 border border-border">
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-chip-failed-bg text-chip-failed-text shrink-0 border border-border">
            Failed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-chip-neutral-bg text-chip-neutral-text shrink-0 border border-border">
            {status}
          </span>
        );
    }
  };

  const confirmDelete = () => {
    if (docToDelete && onDeleteDoc) {
      onDeleteDoc(docToDelete.id);
      setDocToDelete(null);
    }
  };

  return (
    <div className="space-y-2 pt-1">
      {/* Header with Search Scope count and Select all / Clear */}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-muted text-xs">
          Searching in {checkedCount} of {readyDocs.length} documents
        </span>
        {readyDocs.length > 0 && (
          <button
            type="button"
            onClick={anyUnchecked ? onSelectAll : onClearAll}
            className="h-9 px-2 rounded-lg text-accent-text font-medium text-xs hover:bg-surface-2 cursor-pointer transition-colors"
          >
            {anyUnchecked ? 'Select all' : 'Clear'}
          </button>
        )}
      </div>

      {/* Document List Rows or Clean Empty State */}
      {documents.length === 0 ? (
        <div className="text-center py-6 px-4 border border-dashed border-control rounded-lg bg-surface-2">
          <p className="text-xs text-muted">
            {isLoading ? 'Loading documents...' : 'No documents yet. Upload a PDF to start.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const isChecked = selectedDocIds.includes(doc.id);
            const isReady = doc.status === 'ready';
            const isMenuOpen = activeMenuId === doc.id;

            return (
              <div
                key={doc.id}
                className={`relative flex flex-col p-2 rounded-lg border transition-colors ${
                  !isReady
                    ? 'border-border bg-surface-2'
                    : 'border-border bg-surface hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center justify-between min-w-0">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!isReady}
                      onChange={() => onToggleDoc(doc.id)}
                      aria-label={`Select document ${doc.filename}`}
                      title={!isReady ? `Document is ${doc.status}` : 'Select document'}
                      className="w-4 h-4 text-accent-text rounded border-control accent-accent cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="truncate flex-1">
                      <p
                        className="font-mono text-xs font-semibold text-text truncate"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </p>
                      <p className="text-xs text-muted">{formatPages(doc)}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-2">
                    {getStatusChip(doc.status)}

                    {/* Per-document Actions Menu Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(isMenuOpen ? null : doc.id)}
                        aria-label={`Actions for ${doc.filename}`}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
                        title="Document options"
                      >
                        <Icon name="more" size={16} />
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute right-0 mt-1 w-32 bg-surface border border-border rounded-lg shadow-lg py-1 z-30 text-xs"
                          onMouseLeave={() => setActiveMenuId(null)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onReprocessDoc(doc.id);
                            }}
                            className="w-full h-9 text-left px-4 text-text hover:bg-surface-2 flex items-center space-x-2 cursor-pointer transition-colors"
                          >
                            <span>Reprocess</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setDocToDelete(doc);
                            }}
                            className="w-full h-9 text-left px-4 text-chip-failed-text hover:bg-chip-failed-bg flex items-center space-x-2 cursor-pointer transition-colors"
                          >
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {doc.status === 'processing' && <ProcessingNote since={processingSince[doc.id]} />}

                {/* Show error_message and inline Reprocess button if document failed */}
                {doc.status === 'failed' && (
                  <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs text-chip-failed-text">
                    <span className="truncate mr-2" title={doc.error_message || 'Processing failed'}>
                      {doc.error_message || 'Processing failed'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onReprocessDoc(doc.id)}
                      className="px-2 py-0.5 rounded bg-chip-failed-bg text-chip-failed-text border border-border font-medium shrink-0 cursor-pointer transition-colors"
                    >
                      Reprocess
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 bg-scrim flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl border border-border shadow-2xl p-4 max-w-sm w-full space-y-4 text-text">
            <h3 className="text-sm font-bold text-text">Delete Document</h3>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete <span className="font-mono font-semibold text-text">{docToDelete.filename}</span>? All extracted pages, tables, and indexed chunks will be permanently removed.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="h-9 px-4 text-xs font-medium text-muted hover:text-text rounded-lg hover:bg-surface-2 border border-border cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="h-9 px-4 text-xs font-medium bg-chip-failed-bg text-chip-failed-text border border-border rounded-lg cursor-pointer transition-colors"
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
