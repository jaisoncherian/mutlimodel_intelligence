import React, { useRef, useState } from 'react';
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-row bg-page text-textPrimary">
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
      <main className="flex-1 flex flex-col h-full bg-page min-w-0 overflow-hidden">
        {/* Header Bar */}
        <header className="h-[56px] min-h-[56px] bg-surface border-b border-bordercol px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={onReturnToLanding}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-bordercol hover:border-borderSubtle hover:bg-surfaceSubtle focus:outline-none focus:ring-2 focus:ring-brand text-textSecondary hover:text-textPrimary text-xs font-medium transition-colors cursor-pointer"
              title="Return to Overview"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Back to Overview</span>
            </button>
            <div className="h-4 w-[1px] bg-bordercol hidden sm:block" />
            <h1 className="text-sm font-semibold text-textPrimary truncate">
              DocuLens Workspace
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-chipNeutralBg text-chipNeutralText border border-bordercol">
              Scope: {checkedCount} of {readyDocs.length} {readyDocs.length === 1 ? 'document' : 'documents'}
            </span>
            <button
              onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
              aria-label="Toggle evidence viewer"
              aria-expanded={isEvidenceOpen}
              className={`p-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand ${
                isEvidenceOpen
                  ? 'bg-brandLight border-brandBorder text-brand'
                  : 'bg-surface border-bordercol text-textSecondary'
              }`}
              title="Toggle Evidence Viewer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
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
