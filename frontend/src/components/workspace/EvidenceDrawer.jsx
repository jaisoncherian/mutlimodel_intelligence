import React, { useState } from 'react';
import PageImageViewer from './PageImageViewer.jsx';

/**
 * @param {Object} props
 * @param {string} [props.filename]
 * @param {number} [props.currentPage]
 * @param {number} [props.totalPages]
 * @param {string} [props.contentType]
 * @param {string} [props.section]
 * @param {string} [props.activeCitation]
 * @param {string} [props.snippet]
 * @param {Array<any>} [props.tableRows]
 * @param {() => void} props.onClose
 */
export default function EvidenceDrawer({
  filename,
  currentPage: initialPage = 1,
  totalPages = 1,
  contentType = 'text',
  section,
  activeCitation,
  snippet,
  tableRows,
  onClose,
}) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  if (!activeCitation && !filename) {
    return (
      <aside className="w-full lg:w-[420px] lg:min-w-[420px] lg:max-w-[420px] h-full bg-surface border-l border-bordercol flex flex-col justify-between overflow-hidden shrink-0 transition-colors">
        <div className="h-[56px] min-h-[56px] border-b border-bordercol px-4 flex items-center justify-between bg-surface shrink-0">
          <span className="text-xs font-semibold text-textPrimary">Evidence Viewer</span>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close evidence viewer"
              className="text-xs font-medium text-textSecondary hover:text-textPrimary px-2 py-1 rounded hover:bg-surfaceSubtle transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-textSecondary space-y-2">
          <div className="w-10 h-10 rounded-full bg-surfaceSubtle text-textSecondary flex items-center justify-center mb-1 border border-bordercol">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-xs text-textSecondary">Click a citation to see the source page.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full lg:w-[420px] lg:min-w-[420px] lg:max-w-[420px] h-full bg-surface border-l border-bordercol flex flex-col justify-between overflow-hidden shrink-0 transition-colors">
      {/* Top Title */}
      <div className="h-[56px] min-h-[56px] border-b border-bordercol px-4 flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center space-x-2 truncate pr-2">
          <svg
            className="w-4 h-4 text-brand shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <span className="font-mono text-xs font-semibold text-textPrimary truncate">
            {filename}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close evidence viewer"
            className="text-xs font-medium text-textSecondary hover:text-textPrimary px-2 py-1 rounded hover:bg-surfaceSubtle transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
          >
            Close
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-bordercol bg-surfaceSecondary space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className="w-7 h-7 rounded border border-bordercol bg-surface flex items-center justify-center text-textSecondary hover:text-textPrimary hover:bg-surfaceSubtle transition-colors disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
              title="Previous page"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-mono text-xs text-textPrimary px-1 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className="w-7 h-7 rounded border border-bordercol bg-surface flex items-center justify-center text-textSecondary hover:text-textPrimary hover:bg-surfaceSubtle transition-colors disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
              title="Next page"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-brandLight text-brandText border border-brandBorder">
              {contentType}
            </span>
            <span className="font-mono text-xs text-textSecondary">100%</span>
            <button
              type="button"
              className="px-2 py-1 text-xs font-medium border border-bordercol bg-surface rounded hover:bg-surfaceSubtle text-textPrimary transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
            >
              Fit width
            </button>
          </div>
        </div>

        {section && (
          <div className="text-[11px] text-textSecondary truncate">
            Section: <span className="text-textPrimary font-medium">{section}</span>
          </div>
        )}
      </div>

      {/* Viewer Body */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4 bg-page">
        {tableRows ? (
          <PageImageViewer currentPage={currentPage} tableRows={tableRows} activeCitation={activeCitation} />
        ) : (
          <div className="bg-surface rounded-[6px] border border-borderSubtle p-4 shadow-sm text-xs text-textPrimary">
            <p className="font-semibold mb-1">Page {currentPage}</p>
            <p className="text-textSecondary">{snippet || 'Page content loaded from source citation.'}</p>
          </div>
        )}

        {snippet && (
          <div className="bg-surface rounded-[8px] border border-bordercol border-l-4 border-l-brand p-3 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-brand tracking-wider uppercase font-mono">
                CITED SNIPPET {activeCitation ? `· [${activeCitation}]` : ''}
              </span>
              <span className="text-[10px] text-textSecondary font-mono">p.{currentPage}</span>
            </div>

            <div className="bg-surfaceSecondary rounded p-2 border border-brandBorder font-mono text-[11px] text-textPrimary">
              {snippet}
            </div>

            {section && (
              <p className="text-[10px] text-textSecondary">
                Direct excerpt extracted from {section}
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
