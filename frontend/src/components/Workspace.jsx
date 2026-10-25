import React, { useState } from 'react';
import Sidebar from './workspace/Sidebar.jsx';
import ChatFeed from './workspace/ChatFeed.jsx';
import Composer from './workspace/Composer.jsx';
import EvidenceDrawer from './workspace/EvidenceDrawer.jsx';
import SettingsDialog from './workspace/SettingsDialog.jsx';
import { useDocuments } from '../hooks/useDocuments.js';

/**
 * Workspace master screen wired to real document management API.
 * Mock data has been completely purged; initial state is empty.
 *
 * @param {Object} props
 * @param {() => void} props.onReturnToLanding
 */
export default function Workspace({ onReturnToLanding }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Real document management via useDocuments hook
  const {
    documents,
    isLoading: isLoadingDocs,
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

  // In Stage 1, thread starts completely empty (purged of mock data)
  const [messages] = useState([]);
  const [conversations] = useState([]);

  const handleCitationClick = (citation) => {
    setActiveEvidence(citation);
    setIsEvidenceOpen(true);
  };

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const checkedCount = selectedDocIds.length;

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-row bg-page text-textPrimary">
      {/* COLUMN 1: LEFT SIDEBAR */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        documents={documents}
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
        onNewChat={() => {}}
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
              aria-label="Toggle Evidence Viewer"
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

        {/* Center Scrollable Feed Area (Clean empty state until asked) */}
        <ChatFeed messages={messages} onCitationClick={handleCitationClick} />

        {/* Composer (disabled if no ready documents selected) */}
        <Composer
          onSend={() => {}}
          disabled={checkedCount === 0}
        />
      </main>

      {/* COLUMN 3: RIGHT EVIDENCE VIEWER */}
      {isEvidenceOpen && (
        <EvidenceDrawer
          filename={activeEvidence?.filename}
          currentPage={activeEvidence?.page}
          activeCitation={activeEvidence?.sourceId}
          snippet={activeEvidence?.snippet}
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
