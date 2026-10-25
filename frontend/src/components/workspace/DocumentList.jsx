import React, { useState } from 'react';

/**
 * @param {Object} props
 * @param {Array<import('../../api/types.js').DocumentSummary>} props.documents
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
    if (doc.status === 'processing') return 'Reading pages...';
    if (doc.page_count === null || doc.page_count === undefined) return '';
    return `${doc.page_count} ${doc.page_count === 1 ? 'page' : 'pages'}`;
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'ready':
        return (
          <span className="font-sans px-2 py-0.5 rounded-full text-[10px] font-medium bg-chipReadyBg text-chipReadyText shrink-0 border border-green-500/20">
            Ready
          </span>
        );
      case 'processing':
        return (
          <span className="font-sans px-2 py-0.5 rounded-full text-[10px] font-medium bg-chipProcessingBg text-chipProcessingText animate-pulse shrink-0 border border-indigo-500/20">
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="font-sans px-2 py-0.5 rounded-full text-[10px] font-medium bg-chipFailedBg text-chipFailedText shrink-0 border border-red-500/20">
            Failed
          </span>
        );
      default:
        return (
          <span className="font-sans px-2 py-0.5 rounded-full text-[10px] font-medium bg-chipNeutralBg text-chipNeutralText shrink-0 border border-bordercol">
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
    <div className="space-y-2.5 pt-1">
      {/* Header with Search Scope count and Select all / Clear */}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-textSecondary text-[11px]">
          Searching in {checkedCount} of {readyDocs.length} documents
        </span>
        {readyDocs.length > 0 && (
          <button
            type="button"
            onClick={anyUnchecked ? onSelectAll : onClearAll}
            className="text-brand hover:text-brandHover focus:outline-none focus:underline font-medium text-[11px] hover:underline cursor-pointer transition-colors"
          >
            {anyUnchecked ? 'Select all' : 'Clear'}
          </button>
        )}
      </div>

      {/* Document List Rows or Clean Empty State */}
      {documents.length === 0 ? (
        <div className="text-center py-6 px-3 border border-dashed border-borderSubtle rounded-[8px] bg-surfaceSecondary">
          <p className="text-xs text-textSecondary">
            {isLoading ? 'Loading documents...' : 'No documents yet. Upload a PDF to start.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {documents.map((doc) => {
            const isChecked = selectedDocIds.includes(doc.id);
            const isReady = doc.status === 'ready';
            const isMenuOpen = activeMenuId === doc.id;

            return (
              <div
                key={doc.id}
                className={`relative flex flex-col p-2 rounded-[8px] border transition-colors ${
                  !isReady
                    ? 'border-bordercol bg-surfaceSecondary opacity-90'
                    : 'border-bordercol bg-surface hover:bg-surfaceSubtle'
                }`}
              >
                <div className="flex items-center justify-between min-w-0">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!isReady}
                      onChange={() => onToggleDoc(doc.id)}
                      aria-label={`Select document ${doc.filename}`}
                      title={!isReady ? `Document is ${doc.status}` : 'Select document'}
                      className="w-4 h-4 text-brand rounded border-borderSubtle focus:ring-brand accent-brand cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="truncate flex-1">
                      <p
                        className="font-mono text-xs font-semibold text-textPrimary truncate"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </p>
                      <p className="text-[10px] text-textSecondary">{formatPages(doc)}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                    {getStatusChip(doc.status)}

                    {/* Per-document Actions Menu Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(isMenuOpen ? null : doc.id)}
                        aria-label={`Actions for ${doc.filename}`}
                        className="p-1 rounded text-textSecondary hover:text-textPrimary hover:bg-surfaceSubtle focus:outline-none focus:ring-2 focus:ring-brand transition-colors cursor-pointer"
                        title="Document options"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute right-0 mt-1 w-32 bg-surface border border-bordercol rounded-lg shadow-lg py-1 z-30 text-xs"
                          onMouseLeave={() => setActiveMenuId(null)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onReprocessDoc(doc.id);
                            }}
                            className="w-full text-left px-3 py-1.5 text-textPrimary hover:bg-surfaceSubtle flex items-center space-x-1.5 cursor-pointer transition-colors"
                          >
                            <span>Reprocess</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setDocToDelete(doc);
                            }}
                            className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-red-500/10 flex items-center space-x-1.5 cursor-pointer transition-colors"
                          >
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Show error_message and inline Reprocess button if document failed */}
                {doc.status === 'failed' && (
                  <div className="mt-2 pt-1.5 border-t border-red-500/20 flex items-center justify-between text-[11px] text-chipFailedText">
                    <span className="truncate mr-2 font-mono" title={doc.error_message || 'Processing failed'}>
                      {doc.error_message || 'Processing failed'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onReprocessDoc(doc.id)}
                      className="px-2 py-0.5 rounded bg-chipFailedBg hover:bg-red-500/20 text-chipFailedText font-medium shrink-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl border border-bordercol shadow-2xl p-5 max-w-sm w-full space-y-4 animate-scaleIn text-textPrimary">
            <h3 className="text-sm font-bold text-textPrimary">Delete Document</h3>
            <p className="text-xs text-textSecondary leading-relaxed">
              Are you sure you want to delete <span className="font-mono font-semibold text-textPrimary">{docToDelete.filename}</span>? All extracted pages, tables, and indexed chunks will be permanently removed.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-3 py-1.5 text-xs font-medium text-textSecondary hover:text-textPrimary rounded-[6px] hover:bg-surfaceSubtle border border-bordercol cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-[6px] shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
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
