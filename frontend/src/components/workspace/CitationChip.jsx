import React from 'react';

/**
 * @param {Object} props
 * @param {string} props.sourceId - Source identifier, e.g. "S1", "IMG1"
 * @param {() => void} [props.onClick]
 * @param {string} [props.title]
 * @param {string} [props.className]
 */
export default function CitationChip({
  sourceId,
  onClick,
  title = 'View citation evidence',
  className = '',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={`Citation ${sourceId}`}
      className={`inline-flex items-center font-mono text-xs font-semibold bg-accent-soft text-accent-text hover:border-accent px-1 py-0.5 rounded border border-accent-line mx-0.5 transition-colors cursor-pointer ${className}`}
    >
      [{sourceId}]
    </button>
  );
}
