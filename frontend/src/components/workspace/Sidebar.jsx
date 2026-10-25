import React from 'react';
import DocumentUpload from './DocumentUpload.jsx';
import DocumentList from './DocumentList.jsx';

/**
 * @param {Object} props
 * @param {boolean} props.isCollapsed
 * @param {() => void} props.onToggleCollapse
 * @param {Array<any>} props.documents
 * @param {string[]} props.selectedDocIds
 * @param {(id: string) => void} props.onToggleDoc
 * @param {() => void} props.onSelectAll
 * @param {() => void} props.onClearAll
 * @param {(id: string) => void} props.onDeleteDoc
 * @param {(id: string) => void} props.onReprocessDoc
 * @param {(files: FileList|File[]) => void} props.onUpload
 * @param {boolean} [props.isUploading]
 * @param {any} [props.uploadFeedback]
 * @param {() => void} [props.onClearFeedback]
 * @param {Array<any>} [props.conversations]
 * @param {() => void} [props.onNewChat]
 * @param {() => void} [props.onOpenSettings]
 * @param {boolean} [props.isLoadingDocs]
 */
export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  documents = [],
  selectedDocIds = [],
  onToggleDoc,
  onSelectAll,
  onClearAll,
  onDeleteDoc,
  onReprocessDoc,
  onUpload,
  isUploading = false,
  uploadFeedback = null,
  onClearFeedback,
  conversations = [],
  onNewChat,
  onOpenSettings,
  isLoadingDocs = false,
}) {
  const scrollContainerRef = React.useRef(null);

  React.useEffect(() => {
    if (uploadFeedback && uploadFeedback.length > 0) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [uploadFeedback]);

  if (isCollapsed) {
    return (
      <aside className="w-[60px] min-w-[60px] max-w-[60px] h-full bg-surface border-r border-bordercol flex flex-col items-center py-4 justify-between select-none z-10 shrink-0 transition-colors">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white shadow-sm">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="p-1.5 rounded-md text-textSecondary hover:bg-surfaceSubtle hover:text-textPrimary focus:outline-none focus:ring-2 focus:ring-brand transition-colors cursor-pointer"
            title="Expand sidebar"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNewChat}
            aria-label="New chat"
            className="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center hover:bg-brandHover focus:outline-none focus:ring-2 focus:ring-brand transition-colors cursor-pointer shadow-sm"
            title="New chat"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          className="p-2 rounded-md text-textSecondary hover:text-textPrimary hover:bg-surfaceSubtle focus:outline-none focus:ring-2 focus:ring-brand transition-colors cursor-pointer"
          title="Settings"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[300px] min-w-[300px] max-w-[300px] h-full bg-surface border-r border-bordercol flex flex-col justify-between select-none z-10 shrink-0 transition-colors">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4">
        {/* Header with Title and Collapse Button */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white shadow-sm">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-textPrimary">DocuLens AI</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="p-1.5 rounded-md text-textSecondary hover:bg-surfaceSubtle hover:text-textPrimary focus:outline-none focus:ring-2 focus:ring-brand transition-colors cursor-pointer"
            title="Collapse sidebar"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <button
          type="button"
          onClick={onNewChat}
          className="w-full h-[44px] bg-brand hover:bg-brandHover focus:outline-none focus:ring-2 focus:ring-brand text-white font-medium text-sm rounded-[8px] flex items-center justify-center space-x-2 shadow-sm transition-all duration-150 cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>New chat</span>
        </button>

        {/* DOCUMENTS Section */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-textSecondary uppercase font-sans">
              DOCUMENTS
            </span>
          </div>

          <DocumentUpload
            onUpload={onUpload}
            isUploading={isUploading}
            uploadFeedback={uploadFeedback}
            onClearFeedback={onClearFeedback}
          />

          <DocumentList
            documents={documents}
            selectedDocIds={selectedDocIds}
            onToggleDoc={onToggleDoc}
            onSelectAll={onSelectAll}
            onClearAll={onClearAll}
            onDeleteDoc={onDeleteDoc}
            onReprocessDoc={onReprocessDoc}
            isLoading={isLoadingDocs}
          />
        </div>

        {/* CONVERSATIONS Section */}
        <div className="space-y-2 pt-2 border-t border-bordercol">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-textSecondary uppercase font-sans">
              CONVERSATIONS
            </span>
          </div>
          {conversations.length === 0 ? (
            <p className="text-[11px] text-textMuted italic py-1">No saved conversations</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open conversation ${conv.title}`}
                  className={`p-2.5 rounded-[8px] cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-brand ${
                    conv.active
                      ? 'bg-brandLight border border-brandBorder'
                      : 'hover:bg-surfaceSubtle border border-transparent hover:border-bordercol'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-xs truncate ${
                        conv.active
                          ? 'font-semibold text-brand'
                          : 'font-medium text-textPrimary'
                      }`}
                    >
                      {conv.title}
                    </p>
                    <span
                      className={`text-[10px] font-medium shrink-0 ${
                        conv.active ? 'text-brand' : 'text-textSecondary'
                      }`}
                    >
                      {conv.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings Footer */}
      <div className="p-3 border-t border-bordercol bg-surface">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          className="w-full h-[44px] flex items-center justify-start space-x-2.5 px-3 rounded-[8px] text-textSecondary hover:text-textPrimary hover:bg-surfaceSubtle border border-transparent hover:border-bordercol focus:outline-none focus:ring-2 focus:ring-brand transition-all cursor-pointer"
        >
          <svg
            className="w-4 h-4 text-textSecondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-xs font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}
