import React from 'react';
import AnswerCard from './AnswerCard.jsx';

/**
 * @param {Object} props
 * @param {'user'|'assistant'} props.role
 * @param {string} props.content
 * @param {(sourceId: string) => void} [props.onCitationClick]
 */
export default function ChatMessage({ role, content, onCitationClick }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[580px] bg-brand text-white px-4 py-3 rounded-[12px] shadow-sm text-sm font-medium leading-relaxed">
          {content}
        </div>
      </div>
    );
  }

  return <AnswerCard answerText={content} onCitationClick={onCitationClick} />;
}
