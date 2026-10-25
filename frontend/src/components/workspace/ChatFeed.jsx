import React from 'react';
import ChatMessage from './ChatMessage.jsx';

/**
 * @param {Object} props
 * @param {Array<{ id: string|number, role: 'user'|'assistant', content: string }>} [props.messages]
 * @param {(sourceId: string) => void} [props.onCitationClick]
 */
export default function ChatFeed({ messages = [], onCitationClick }) {
  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-textSecondary space-y-2">
        <div className="w-12 h-12 rounded-full bg-brandLight text-brand flex items-center justify-center mb-2 border border-brandBorder">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <p className="text-sm font-semibold text-textPrimary">No messages yet</p>
        <p className="text-xs text-textSecondary max-w-sm">
          Select one or more ready documents from the sidebar, then ask a question below.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scroll p-4 sm:p-6 space-y-5">
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          role={msg.role}
          content={msg.content}
          onCitationClick={onCitationClick}
        />
      ))}
    </div>
  );
}
