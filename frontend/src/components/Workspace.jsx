import React, { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Sidebar from './workspace/Sidebar.jsx';
import ChatFeed from './workspace/ChatFeed.jsx';
import Composer from './workspace/Composer.jsx';
import EvidenceDrawer from './workspace/EvidenceDrawer.jsx';
import SettingsDialog from './workspace/SettingsDialog.jsx';
import { useDocuments } from '../hooks/useDocuments.js';
import { useChat } from '../hooks/useChat.js';
import { useConversations } from '../hooks/useConversations.js';

/**
 * Workspace master screen wired to real document management API.
 * Mock data has been completely purged; initial state is empty.
 *
 * @param {Object} props
 * @param {() => void} props.onReturnToLanding
 */
export default function Workspace({ onReturnToLanding }) {
  // On a phone the sidebar would leave no room for the chat.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.matchMedia?.('(max-width: 767px)').matches ?? false
  );
  // On a narrow screen the pane covers the chat, so it starts collapsed there.
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(
    () => window.matchMedia?.('(min-width: 1024px)').matches ?? true
  );
  // `opening` changes on every click, so clicking a citation always returns to its page.
  const [activeEvidence, setActiveEvidence] = useState({ citation: null, opening: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Real document management via useDocuments hook
  const {
    documents,
    isLoading: isLoadingDocs,
    processingSince,
    selectedDocIds,
    toggleDoc,
    selectAll,
    clearAll,
    uploadMutation,
    deleteMutation,
    reprocessMutation,
    uploadFeedback,
    clearUploadFeedback,
  } = useDocuments();

  const chat = useChat({ selectedDocIds });
  const composerRef = useRef(null);

  const clearEvidence = () => setActiveEvidence((prev) => ({ citation: null, opening: prev.opening + 1 }));

  const {
    conversations,
    isLoading: isLoadingConversations,
    isError: isConversationsError,
    refetch: refetchConversations,
    deleteMutation: deleteConversationMutation,
  } = useConversations({
    onDeleted: (id) => {
      if (id === chat.conversationId) {
        chat.reset();
        clearEvidence();
      }
    },
  });

  const handleCitationClick = (citation) => {
    setActiveEvidence((prev) => ({ citation, opening: prev.opening + 1 }));
    setIsEvidenceOpen(true);
  };

  const handleNewChat = () => {
    chat.reset();
    clearEvidence();
    composerRef.current?.focus();
  };

  const handleOpenConversation = (id) => {
    clearEvidence();
    chat.openConversation(id);
  };

  const threadTitle = chat.conversationId
    ? conversations.find((c) => c.id === chat.conversationId)?.title || 'Conversation'
    : 'New chat';
  const readyDocs = documents.filter((d) => d.status === 'ready');
  const checkedCount = selectedDocIds.length;
  const activeCitation = activeEvidence.citation;
  const activeDocument = documents.find((d) => d.id === activeCitation?.doc_id);
  const deleteError = deleteConversationMutation.error;
  const deleteErrorText =
    deleteError && deleteError.status !== 404
      ? `Could not delete the conversation. ${deleteError.message || ''}`.trim()
      : null;

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-row bg-bg text-text">
      {/* COLUMN 1: LEFT SIDEBAR */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        documents={documents}
        processingSince={processingSince}
        selectedDocIds={selectedDocIds}
        onToggleDoc={toggleDoc}
        onSelectAll={selectAll}
        onClearAll={clearAll}
        onDeleteDoc={(id) => deleteMutation.mutate(id)}
        onReprocessDoc={(id) => reprocessMutation.mutate(id)}
        onUpload={(files) => uploadMutation.mutate(files)}
        isUploading={uploadMutation.isPending}
        uploadFeedback={uploadFeedback}
        onClearFeedback={clearUploadFeedback}
        conversations={conversations}
        isLoadingConversations={isLoadingConversations}
        isConversationsError={isConversationsError}
        onRetryConversations={refetchConversations}
        activeConversationId={chat.conversationId}
        onOpenConversation={handleOpenConversation}
        onDeleteConversation={(id) => deleteConversationMutation.mutate(id)}
        deleteConversationError={deleteErrorText}
        onNewChat={handleNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isLoadingDocs={isLoadingDocs}
      />

      {/* COLUMN 2: CENTER CHAT & VERIFICATION DECK */}
      <main className="flex-1 flex flex-col h-full bg-surface min-w-0 overflow-hidden">
        {/* Header Bar */}
        <header className="h-14 min-h-14 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={onReturnToLanding}
              aria-label="Back to overview"
              className="h-9 flex items-center gap-2 px-2 rounded-lg border border-border hover:bg-surface-2 text-muted hover:text-text text-xs font-medium transition-colors cursor-pointer"
            >
              <Icon name="arrow-left" size={16} />
              <span className="hidden sm:inline">Overview</span>
            </button>
            <div className="h-4 w-[1px] bg-border hidden sm:block" />
            <h1 title={threadTitle} className="text-base font-semibold text-text truncate">
              {threadTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-block shrink-0 whitespace-nowrap px-2 py-1 rounded-full text-xs font-medium bg-chip-neutral-bg text-chip-neutral-text border border-border">
              Scope: {checkedCount} of {readyDocs.length} {readyDocs.length === 1 ? 'document' : 'documents'}
            </span>
            <button
              onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
              aria-label="Toggle evidence viewer"
              aria-expanded={isEvidenceOpen}
              className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                isEvidenceOpen
                  ? 'bg-accent-soft border-accent-line text-accent-text'
                  : 'bg-surface border-border text-muted'
              }`}
              title="Toggle Evidence Viewer"
            >
              <Icon name="document" size={16} />
            </button>
          </div>
        </header>

        {/* Scrolls inside its own container; the composer stays pinned below it */}
        <ChatFeed
          messages={chat.messages}
          pending={chat.pending}
          failure={chat.failure}
          onCancel={chat.cancel}
          onRetry={chat.retry}
          hasDocuments={checkedCount > 0}
          isOpening={chat.isOpening}
          isReopened={chat.isReopened}
          onCitationClick={handleCitationClick}
        />

        <Composer
          value={chat.draft}
          onChange={chat.setDraft}
          onSend={chat.send}
          hasDocuments={checkedCount > 0}
          isWaiting={Boolean(chat.pending) || chat.isOpening}
          inputRef={composerRef}
        />
      </main>

      {/* COLUMN 3: RIGHT EVIDENCE VIEWER */}
      {isEvidenceOpen && (
        <EvidenceDrawer
          key={activeEvidence.opening}
          citation={activeCitation}
          pageCount={activeDocument?.page_count}
          onClose={() => setIsEvidenceOpen(false)}
        />
      )}

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
