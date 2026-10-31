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
        <div className="max-w-[580px] bg-accent text-on-accent px-4 py-2 rounded-xl text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  return <AnswerCard response={message.response} onCitationClick={onCitationClick} />;
}
