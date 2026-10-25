import React, { useState } from 'react';

/**
 * @param {Object} props
 * @param {(question: string) => void} [props.onSend]
 * @param {boolean} [props.disabled]
 */
export default function Composer({ onSend, disabled = false }) {
  const [inputText, setInputText] = useState('');

  const trimmed = inputText.trim();
  const isOverLimit = inputText.length > 1000;
  const isSendDisabled = disabled || !trimmed || isOverLimit;

  const handleSubmit = () => {
    if (isSendDisabled) return;
    if (onSend) {
      onSend(trimmed);
    }
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 bg-surface border-t border-bordercol shrink-0 transition-colors">
      <div className="max-w-4xl mx-auto space-y-1.5">
        <label
          htmlFor="question-composer"
          className="text-xs font-medium text-textSecondary block"
        >
          Ask a question about the selected documents
        </label>
        <div className="relative border border-bordercol focus-within:border-brand focus-within:ring-1 focus-within:ring-brand rounded-[8px] bg-surface transition-all">
          <textarea
            id="question-composer"
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="For example: What was revenue in Q4 2025?"
            aria-label="Ask a question about the selected documents"
            className="w-full text-xs text-textPrimary placeholder-textMuted p-2.5 rounded-[8px] focus:outline-none resize-none bg-transparent"
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-bordercol bg-surfaceSecondary rounded-b-[8px]">
            <span
              className={`font-mono text-[11px] ${
                isOverLimit ? 'text-red-500 font-bold' : 'text-textSecondary'
              }`}
            >
              {inputText.length} / 1000
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSendDisabled}
              aria-label="Send question"
              className="h-[36px] px-4 bg-brand hover:bg-brandHover disabled:bg-borderSubtle disabled:cursor-not-allowed text-white font-medium text-xs rounded-[8px] flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <span>Send</span>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
