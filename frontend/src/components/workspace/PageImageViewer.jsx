import React, { useEffect, useRef, useState } from 'react';
import { getPageImage } from '../../api/documents.js';

/**
 * One page image. The signed URL lasts 300 seconds, so it lives only in this
 * component: it is requested when the page is shown and never cached or saved.
 * Citations have no coordinates, so nothing on the page is highlighted.
 *
 * @param {Object} props
 * @param {string} props.docId
 * @param {number} props.page
 * @param {string} props.filename
 * @param {number} props.zoom - percent of the pane width
 */
export default function PageImageViewer({ docId, page, filename, zoom }) {
  const [phase, setPhase] = useState('loading'); // loading | shown | failed
  const [url, setUrl] = useState(null);
  const [requestNumber, setRequestNumber] = useState(0);
  const refreshedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setPhase('loading');
    setUrl(null);
    getPageImage(docId, page, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data?.url) setUrl(data.url);
        else setPhase('failed');
      })
      .catch(() => {
        if (!controller.signal.aborted) setPhase('failed');
      });
    return () => controller.abort();
  }, [docId, page, requestNumber]);

  const handleImageError = () => {
    // The usual cause is an expired URL, so one fresh URL is worth trying.
    if (refreshedRef.current) {
      setPhase('failed');
      return;
    }
    refreshedRef.current = true;
    setRequestNumber((n) => n + 1);
  };

  const handleRetry = () => {
    refreshedRef.current = false;
    setRequestNumber((n) => n + 1);
  };

  if (phase === 'failed') {
    return (
      <div className="rounded-[8px] border border-bordercol bg-surfaceSecondary p-6 text-center space-y-3">
        <p className="text-sm text-textPrimary">Page image unavailable</p>
        <button
          type="button"
          onClick={handleRetry}
          className="h-[36px] px-3 rounded-[8px] border border-bordercol bg-surface text-textPrimary hover:bg-surfaceSubtle text-xs font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-auto custom-scroll rounded-[6px] border border-bordercol">
      {phase === 'loading' && (
        <div
          role="status"
          aria-label="Loading page image"
          className="w-full aspect-[17/22] bg-surfaceSubtle animate-pulse"
        />
      )}
      {url && (
        <img
          key={url}
          src={url}
          alt={`Page ${page} of ${filename}`}
          onLoad={() => setPhase('shown')}
          onError={handleImageError}
          style={{ width: `${zoom}%` }}
          className={`max-w-none ${phase === 'shown' ? 'block' : 'hidden'}`}
        />
      )}
    </div>
  );
}
