import React from 'react';
import { MAX_QUESTION_CHARS } from '../../api/ask.js';

/**
 * @param {Object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {(question: string) => void} props.onSend
 * @param {boolean} props.hasDocuments - at least one ready document is checked
 * @param {boolean} [props.isWaiting] - an answer is on its way
 * @param {React.Ref<HTMLTextAreaElement>} [props.inputRef]
 */
export default function Composer({ value, onChange, onSend, hasDocuments, isWaiting = false, inputRef }) {
  const trimmed = value.trim();
  const isOverLimit = value.length > MAX_QUESTION_CHARS;

  let blockedReason = null;
  if (isWaiting) blockedReason = 'Waiting for the current answer.';
  else if (!hasDocuments) blockedReason = 'Select at least one ready document.';
  else if (isOverLimit) blockedReason = `Shorten your question to ${MAX_QUESTION_CHARS} characters or fewer.`;
  else if (!trimmed) blockedReason = 'Type a question to send.';

  const handleSubmit = () => {
    if (!blockedReason) onSend(trimmed);
  };

  const handleKeyDown = (e) => {
    // Enter while an input method is composing picks a candidate; it does not send.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 bg-surface border-t border-bordercol shrink-0 transition-colors">
      <div className="max-w-[760px] mx-auto space-y-1.5">
        <label htmlFor="question-composer" className="text-xs font-medium text-textSecondary block">
          Ask a question about the selected documents
        </label>
        <div className="border border-bordercol focus-within:border-brand focus-within:ring-1 focus-within:ring-brand rounded-[8px] bg-surface transition-all">
          <textarea
            id="question-composer"
            ref={inputRef}
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="For example: What was revenue in Q4 2025?"
            aria-describedby="composer-hint"
            aria-invalid={isOverLimit}
            className="w-full text-sm text-textPrimary placeholder-textMuted p-2.5 rounded-[8px] focus:outline-none resize-none bg-transparent"
          />
          <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-bordercol bg-surfaceSecondary rounded-b-[8px]">
            <div className="flex items-center gap-3 min-w-0">
              <span
                data-testid="composer-counter"
                className={`font-mono text-xs shrink-0 ${
                  isOverLimit ? 'text-chipFailedText font-bold' : 'text-textSecondary'
                }`}
              >
                {value.length} / {MAX_QUESTION_CHARS}
              </span>
              <span id="composer-hint" className="text-xs text-textSecondary truncate">
                {blockedReason || 'Enter to send, Shift+Enter for a new line.'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={Boolean(blockedReason)}
              aria-label="Send question"
              className="h-[36px] px-4 shrink-0 bg-brand hover:bg-brandHover disabled:bg-borderSubtle disabled:cursor-not-allowed text-white font-medium text-xs rounded-[8px] flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <span>Send</span>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
                aria-hidden="true"
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
