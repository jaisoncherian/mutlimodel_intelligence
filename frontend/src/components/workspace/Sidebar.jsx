import React from 'react';
import Icon from '../Icon.jsx';
import Logo from '../Logo.jsx';
import DocumentUpload from './DocumentUpload.jsx';
import DocumentList from './DocumentList.jsx';
import ConversationList from './ConversationList.jsx';

/**
 * @param {Object} props
 * @param {boolean} props.isCollapsed
 * @param {() => void} props.onToggleCollapse
 * @param {Array<any>} props.documents
 * @param {Record<string, {startedAt: number, fromPageOpen: boolean}>} [props.processingSince]
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
 * @param {Array<import('../../api/types.js').ConversationSummary>} [props.conversations]
 * @param {boolean} [props.isLoadingConversations]
 * @param {boolean} [props.isConversationsError]
 * @param {() => void} [props.onRetryConversations]
 * @param {string|null} [props.activeConversationId]
 * @param {(id: string) => void} [props.onOpenConversation]
 * @param {(id: string) => void} [props.onDeleteConversation]
 * @param {string|null} [props.deleteConversationError]
 * @param {() => void} [props.onNewChat]
 * @param {() => void} [props.onOpenSettings]
 * @param {boolean} [props.isLoadingDocs]
 */
export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  documents = [],
  processingSince = {},
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
  isLoadingConversations = false,
  isConversationsError = false,
  onRetryConversations,
  activeConversationId = null,
  onOpenConversation,
  onDeleteConversation,
  deleteConversationError = null,
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
      <aside className="w-[60px] min-w-[60px] max-w-[60px] h-full bg-surface border-r border-border flex flex-col items-center py-4 justify-between select-none z-10 shrink-0 transition-colors">
        <div className="flex flex-col items-center space-y-4">
          <Logo markOnly />
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text transition-colors cursor-pointer"
            title="Expand sidebar"
          >
            <Icon name="chevrons-right" size={16} />
          </button>
          <button
            type="button"
            onClick={onNewChat}
            aria-label="New chat"
            className="w-9 h-9 rounded-lg bg-accent text-on-accent flex items-center justify-center hover:bg-accent-hover transition-colors cursor-pointer"
            title="New chat"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          title="Settings"
        >
          <Icon name="settings" size={20} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[300px] min-w-[300px] max-w-[300px] h-full bg-surface border-r border-border flex flex-col justify-between select-none z-10 shrink-0 transition-colors">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4">
        {/* Header with Title and Collapse Button */}
        <div className="flex items-center justify-between pb-1">
          <Logo />
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text transition-colors cursor-pointer"
            title="Collapse sidebar"
          >
            <Icon name="chevrons-left" size={16} />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          type="button"
          onClick={onNewChat}
          className="w-full h-11 bg-accent hover:bg-accent-hover text-on-accent font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition-colors cursor-pointer"
        >
          <Icon name="plus" size={16} />
          <span>New chat</span>
        </button>

        {/* DOCUMENTS Section */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-muted uppercase">
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
            processingSince={processingSince}
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
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-muted uppercase">
              CONVERSATIONS
            </span>
          </div>
          <ConversationList
            conversations={conversations}
            isLoading={isLoadingConversations}
            isError={isConversationsError}
            onRetry={onRetryConversations}
            activeId={activeConversationId}
            onOpen={onOpenConversation}
            onDelete={onDeleteConversation}
            deleteError={deleteConversationError}
          />
        </div>
      </div>

      {/* Settings Footer */}
      <div className="p-4 border-t border-border bg-surface">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          className="w-full h-11 flex items-center justify-start space-x-2 px-4 rounded-lg text-muted hover:text-text hover:bg-surface-2 border border-transparent hover:border-border transition-colors cursor-pointer"
        >
          <Icon name="settings" size={16} className="text-muted" />
          <span className="text-xs font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}
