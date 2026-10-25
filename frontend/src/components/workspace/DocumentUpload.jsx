import React, { useRef, useState } from 'react';

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
        className={`border border-dashed rounded-[12px] p-3 text-center transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-brand ${
          isDragOver
            ? 'border-brand bg-brandLight'
            : 'border-borderSubtle hover:border-brand bg-surfaceSecondary hover:bg-brandLight'
        } ${isUploading ? 'opacity-60 cursor-wait' : ''}`}
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
        <div className="flex justify-center mb-1 text-brand">
          {isUploading ? (
            <svg
              className="w-5 h-5 text-brand animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-brand group-hover:scale-110 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          )}
        </div>
        <p className="text-xs font-medium text-textPrimary">
          {isUploading ? 'Uploading files...' : 'Drop PDFs here or browse'}
        </p>
        <p className="text-[10px] text-textSecondary mt-0.5">PDF only, up to 25 MB each</p>
      </div>

      {/* Per-file Upload Feedback Callout */}
      {uploadFeedback && uploadFeedback.length > 0 && (
        <div
          role="region"
          aria-live="polite"
          aria-atomic="true"
          className="p-2.5 rounded-[8px] bg-surfaceSecondary border border-bordercol text-xs space-y-1.5 animate-fadeIn"
        >
          <div className="flex items-center justify-between font-medium text-textPrimary">
            <span>Upload Results</span>
            {onClearFeedback && (
              <button
                type="button"
                onClick={onClearFeedback}
                aria-label="Dismiss upload feedback"
                className="text-textSecondary hover:text-textPrimary text-[11px] font-sans transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto custom-scroll">
            {uploadFeedback.map((res, idx) => (
              <div
                key={idx}
                className={`flex items-start justify-between text-[11px] p-1.5 rounded ${
                  res.error
                    ? 'bg-chipFailedBg text-chipFailedText border border-red-500/30'
                    : 'bg-chipReadyBg text-chipReadyText border border-green-500/30'
                }`}
              >
                <span className="font-mono truncate mr-2">{res.filename}</span>
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
