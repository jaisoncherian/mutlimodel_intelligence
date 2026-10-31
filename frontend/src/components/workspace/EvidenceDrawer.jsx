import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDocumentPage } from '../../api/documents.js';
import Icon from '../Icon.jsx';
import PageImageViewer from './PageImageViewer.jsx';

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 25;
const FIT_WIDTH = 100;

const PANE_CLASSES =
  'fixed inset-0 z-20 lg:static lg:z-auto w-full lg:w-[420px] lg:min-w-[420px] lg:max-w-[420px] h-full bg-surface border-l border-border flex flex-col overflow-hidden shrink-0 transition-colors';

const TOOL_BUTTON =
  'h-9 min-w-9 px-2 rounded-lg border flex items-center justify-center text-xs font-medium disabled:bg-surface-2 disabled:text-muted disabled:cursor-not-allowed transition-colors cursor-pointer';

const TOOL_IDLE = 'border-border bg-surface text-muted hover:text-text hover:bg-surface-2';

function PaneHeader({ children, onClose }) {
  return (
    <div className="h-14 min-h-14 border-b border-border px-4 flex items-center justify-between gap-2 shrink-0">
      {children}
      <button
        type="button"
        onClick={onClose}
        aria-label="Collapse evidence viewer"
        className="shrink-0 h-9 px-2 flex items-center gap-2 rounded-lg text-xs font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <Icon name="chevrons-right" />
        <span>Collapse</span>
      </button>
    </div>
  );
}

function ExtractedTables({ tables }) {
  return (
    <div className="space-y-4">
      {tables.map((table) => (
        <div key={table.table_index} className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted font-semibold border-b border-border">
              <tr>
                {table.headers.map((header, index) => (
                  <th key={index} scope="col" className="py-2 px-2">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-text">
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-2 px-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/**
 * The source page for one citation.
 *
 * @param {Object} props
 * @param {import('../../api/types.js').AskCitation} props.citation
 * @param {number|null} [props.pageCount] - from the document record
 * @param {() => void} props.onClose
 */
function CitationEvidence({ citation, pageCount, onClose }) {
  const { doc_id: docId, filename, page: citedPage, section, content_type: contentType, snippet } = citation;
  const [page, setPage] = useState(citedPage);
  const [zoom, setZoom] = useState(FIT_WIDTH);
  const [view, setView] = useState('image');

  const pageQuery = useQuery({
    queryKey: ['document-page', docId, page],
    queryFn: ({ signal }) => getDocumentPage(docId, page, { signal }),
    retry: false,
  });
  const tables = pageQuery.data?.tables || [];
  const showTables = view === 'tables' && tables.length > 0;
  const isCitedPage = page === citedPage;

  return (
    <aside aria-label="Evidence viewer" className={PANE_CLASSES}>
      <PaneHeader onClose={onClose}>
        <span title={filename} className="font-mono text-xs font-semibold text-text truncate">
          {filename}
        </span>
      </PaneHeader>

      <div className="px-4 py-2 border-b border-border bg-surface-2 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              className={`${TOOL_BUTTON} ${TOOL_IDLE}`}
            >
              <Icon name="chevron-left" />
            </button>
            <span data-testid="page-indicator" className="font-mono text-xs text-text px-1 font-medium">
              {pageCount ? `Page ${page} of ${pageCount}` : `Page ${page}`}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!pageCount || page >= pageCount}
              aria-label="Next page"
              className={`${TOOL_BUTTON} ${TOOL_IDLE}`}
            >
              <Icon name="chevron-right" />
            </button>
          </div>

          {!showTables && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => z - ZOOM_STEP)}
                disabled={zoom <= ZOOM_MIN}
                aria-label="Zoom out"
                className={`${TOOL_BUTTON} ${TOOL_IDLE}`}
              >
                <Icon name="minus" />
              </button>
              <span data-testid="zoom-level" className="font-mono text-xs text-text w-10 text-center">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => z + ZOOM_STEP)}
                disabled={zoom >= ZOOM_MAX}
                aria-label="Zoom in"
                className={`${TOOL_BUTTON} ${TOOL_IDLE}`}
              >
                <Icon name="plus" />
              </button>
              <button type="button" onClick={() => setZoom(FIT_WIDTH)} className={`${TOOL_BUTTON} ${TOOL_IDLE}`}>
                Fit width
              </button>
            </div>
          )}
        </div>

        {isCitedPage ? (
          <div className="flex items-center gap-2 min-w-0">
            {contentType && (
              <span className="shrink-0 px-2 py-0.5 rounded text-xs bg-chip-neutral-bg text-chip-neutral-text border border-border">
                {contentType}
              </span>
            )}
            {section && (
              <span title={section} className="text-xs text-muted truncate">
                {section}
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPage(citedPage)}
            className="text-xs font-medium text-accent-text hover:underline cursor-pointer rounded"
          >
            Back to cited page {citedPage}
          </button>
        )}

        {tables.length > 0 && (
          <div role="tablist" aria-label="Page view" className="flex items-center gap-2">
            {[
              ['image', 'Page image'],
              ['tables', 'Extracted tables'],
            ].map(([value, label]) => {
              const isActive = (value === 'tables') === showTables;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setView(value)}
                  className={`${TOOL_BUTTON} ${isActive ? 'bg-accent-soft text-accent-text border-accent-line' : TOOL_IDLE}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scroll p-4 space-y-4">
        {showTables ? (
          <ExtractedTables tables={tables} />
        ) : (
          <PageImageViewer key={`${docId}-${page}`} docId={docId} page={page} filename={filename} zoom={zoom} />
        )}

        {snippet && (
          <div className="rounded-lg border border-border border-l-4 border-l-accent p-4 space-y-2">
            <p className="text-xs font-semibold text-text">
              Cited snippet{citation.source_id ? ' ' : ''}
              {citation.source_id && <span className="font-mono">[{citation.source_id}]</span>}
              {' from page '}
              <span className="font-mono">{citedPage}</span>
            </p>
            <p data-testid="cited-snippet" className="text-xs text-muted leading-relaxed whitespace-pre-wrap break-words">
              {snippet}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * The collapsible right pane. Calm and empty until a citation is opened.
 *
 * @param {Object} props
 * @param {import('../../api/types.js').AskCitation|null} [props.citation]
 * @param {number|null} [props.pageCount]
 * @param {() => void} props.onClose
 */
export default function EvidenceDrawer({ citation = null, pageCount = null, onClose }) {
  if (citation) {
    return <CitationEvidence citation={citation} pageCount={pageCount} onClose={onClose} />;
  }

  return (
    <aside aria-label="Evidence viewer" className={PANE_CLASSES}>
      <PaneHeader onClose={onClose}>
        <span className="text-xs font-semibold text-text">Evidence viewer</span>
      </PaneHeader>
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <p className="text-xs text-muted">Click a citation to see the source page.</p>
      </div>
    </aside>
  );
}
