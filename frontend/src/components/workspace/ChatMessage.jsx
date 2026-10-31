import React from 'react';
import AnswerCard from './AnswerCard.jsx';

/**
 * @param {Object} props
 * @param {import('../../hooks/useChat.js').ChatEntry} props.message
 * @param {(citation: import('../../api/types.js').AskCitation) => void} [props.onCitationClick]
 */
export default function ChatMessage({ message, onCitationClick }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[580px] bg-brand text-white px-4 py-3 rounded-[12px] shadow-sm text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  return <AnswerCard response={message.response} onCitationClick={onCitationClick} />;
}
