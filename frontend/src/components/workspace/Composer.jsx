import React from 'react';
import Icon from '../Icon.jsx';
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
    <div className="p-4 bg-surface border-t border-border shrink-0 transition-colors">
      <div className="max-w-[760px] mx-auto space-y-2">
        <label htmlFor="question-composer" className="text-xs font-medium text-muted block">
          Ask a question about the selected documents
        </label>
        <div className="border border-control focus-within:border-accent focus-within:ring-1 focus-within:ring-accent rounded-lg bg-surface transition-colors">
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
            className="w-full block text-sm text-text placeholder-muted p-4 rounded-t-lg resize-none bg-transparent outline-none"
          />
          <div className="flex items-center justify-between gap-4 px-4 py-2 border-t border-border bg-surface-2 rounded-b-lg">
            <div className="flex items-center gap-4 min-w-0">
              <span
                data-testid="composer-counter"
                className={`font-mono text-xs shrink-0 ${
                  isOverLimit ? 'text-chip-failed-text font-bold' : 'text-muted'
                }`}
              >
                {value.length} / {MAX_QUESTION_CHARS}
              </span>
              <span id="composer-hint" className="text-xs text-muted">
                {blockedReason || 'Enter to send, Shift+Enter for a new line.'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={Boolean(blockedReason)}
              aria-label="Send question"
              className="h-9 px-4 shrink-0 bg-accent hover:bg-accent-hover text-on-accent disabled:bg-surface disabled:text-muted disabled:border disabled:border-border disabled:cursor-not-allowed font-medium text-sm rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Send</span>
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
