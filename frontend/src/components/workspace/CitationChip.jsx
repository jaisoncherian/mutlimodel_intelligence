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
      className={`inline-flex items-center font-mono text-xs font-semibold bg-chipCitationBg text-chipCitationText hover:bg-brandLight focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 px-1.5 py-0.5 rounded border border-chipCitationBorder mx-0.5 transition-colors cursor-pointer ${className}`}
    >
      [{sourceId}]
    </button>
  );
}
