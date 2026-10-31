import React, { useRef, useState } from 'react';
import Icon from '../Icon.jsx';

/**
 * @param {Object} props
 * @param {(files: FileList|File[]) => void} props.onUpload
 * @param {boolean} [props.isUploading]
 * @param {Array<{ filename: string, status?: string, error?: string }>} [props.uploadFeedback]
 * @param {() => void} [props.onClearFeedback]
 */
export default function DocumentUpload({
  onUpload,
  isUploading = false,
  uploadFeedback = null,
  onClearFeedback,
}) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (fileList) => {
    if (isUploading) return;
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    onUpload(files);
  };

  const handleClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleChange = (e) => {
    const files = Array.from(e.target.files || []);
    // Reset the input value after every selection so the same file can be chosen twice
    e.target.value = '';
    handleFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isUploading) return;
    const files = Array.from(e.dataTransfer?.files || []);
    handleFiles(files);
  };

  return (
    <div className="space-y-2">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload PDF documents"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`border border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer group ${
          isDragOver
            ? 'border-accent bg-accent-soft'
            : 'border-control hover:border-accent bg-surface-2 hover:bg-accent-soft'
        } ${isUploading ? 'cursor-wait' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleChange}
          className="hidden"
          disabled={isUploading}
        />
        <div className="flex justify-center mb-1 text-accent-text">
          {isUploading ? (
            <Icon name="spinner" size={20} className="animate-spin" />
          ) : (
            <Icon name="upload" size={20} className="text-accent-text" />
          )}
        </div>
        <p className="text-xs font-medium text-text">
          {isUploading ? 'Uploading files...' : 'Drop PDFs here or browse'}
        </p>
        <p className="text-xs text-muted mt-0.5">PDF only, up to 25 MB each</p>
      </div>

      {/* Per-file Upload Feedback Callout */}
      {uploadFeedback && uploadFeedback.length > 0 && (
        <div
          role="region"
          aria-live="polite"
          aria-atomic="true"
          className="p-2 rounded-lg bg-surface-2 border border-border text-xs space-y-2"
        >
          <div className="flex items-center justify-between font-medium text-text">
            <span>Upload Results</span>
            {onClearFeedback && (
              <button
                type="button"
                onClick={onClearFeedback}
                aria-label="Dismiss upload feedback"
                className="text-muted hover:text-text text-xs transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto custom-scroll">
            {uploadFeedback.map((res, idx) => (
              <div
                key={idx}
                className={`flex items-start justify-between text-xs p-2 rounded ${
                  res.error
                    ? 'bg-chip-failed-bg text-chip-failed-text border border-border'
                    : 'bg-chip-ready-bg text-chip-ready-text border border-border'
                }`}
              >
                <span title={res.filename} className="font-mono truncate mr-2">{res.filename}</span>
                <span className="shrink-0 font-medium">
                  {res.error ? res.error : 'Enqueued'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
