import React, { useState } from 'react';

export default function Workspace({ onReturnToLanding }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(true);
  const [activeCitation, setActiveCitation] = useState('S1');
  const [copied, setCopied] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [currentPage, setCurrentPage] = useState(3);

  const [documents, setDocuments] = useState([
    { id: '1', name: 'text_table.pdf', pages: '5 pages', status: 'Ready', checked: true },
    { id: '2', name: 'two_column.pdf', pages: '15 pages', status: 'Ready', checked: true },
    { id: '3', name: 'scan.pdf', pages: '1 page, OCR', status: 'Ready', checked: false },
    { id: '4', name: 'q3_report.pdf', pages: 'Reading pages', status: 'Processing', checked: false, disabled: true },
  ]);

  const [conversations, setConversations] = useState([
    { id: 'c1', title: 'Revenue growth Q1 to Q4', time: 'Today', active: true },
    { id: 'c2', title: 'Q4 revenue lookup', time: 'Yesterday', active: false },
  ]);

  const tableRows = [
    { quarter: 'Q1 2025', revenue: '125,400', cost: '83,200', units: '4,850', highlighted: true },
    { quarter: 'Q2 2025', revenue: '138,750', cost: '91,600', units: '5,120', highlighted: false },
    { quarter: 'Q3 2025', revenue: '142,300', cost: '94,150', units: '5,260', highlighted: false },
    { quarter: 'Q4 2025', revenue: '167,900', cost: '108,400', units: '5,940', highlighted: true },
  ];

  const handleToggleDoc = (id) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, checked: !d.checked } : d))
    );
  };

  const handleSelectAll = () => {
    const anyUnchecked = documents.some((d) => !d.disabled && !d.checked);
    setDocuments((prev) =>
      prev.map((d) => (d.disabled ? d : { ...d, checked: anyUnchecked }))
    );
  };

  const handleCopy = () => {
    const answer =
      'Revenue grew by 33.89% from Q1 2025 (125,400 USD) to Q4 2025 (167,900 USD) [S1]. Q4 2025 was also the highest-revenue quarter [S1].';
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCitationClick = (citationId) => {
    setActiveCitation(citationId);
    setIsEvidenceOpen(true);
  };

  const checkedCount = documents.filter((d) => d.checked).length;

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-row bg-[#F6F7FB] text-[#1F2433]">
      {/* ========================================== */}
      {/* COLUMN 1: LEFT SIDEBAR                     */}
      {/* ========================================== */}
      {isSidebarCollapsed ? (
        <aside className="w-[60px] min-w-[60px] max-w-[60px] h-full bg-white border-r border-[#E3E6EF] flex flex-col items-center py-4 justify-between select-none z-10 shrink-0">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-8 h-8 rounded-lg bg-[#4338CA] flex items-center justify-center text-white shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="p-1.5 rounded-md text-[#4B5368] hover:bg-[#EEF0F6] hover:text-[#1F2433] transition-colors cursor-pointer"
              title="Expand sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => {}}
              className="w-9 h-9 rounded-lg bg-[#4338CA] text-white flex items-center justify-center hover:bg-[#3730A3] transition-colors cursor-pointer"
              title="New chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <button
            className="p-2 rounded-md text-[#4B5368] hover:bg-[#F6F7FB] transition-colors cursor-pointer"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </aside>
      ) : (
        <aside className="w-[300px] min-w-[300px] max-w-[300px] h-full bg-white border-r border-[#E3E6EF] flex flex-col justify-between select-none z-10 shrink-0">
          <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4">
            {/* Logo and RetrievIQ with collapse button */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#4338CA] flex items-center justify-center text-white shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <span className="font-bold text-base tracking-tight text-[#1F2433]">RetrievIQ</span>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1.5 rounded-md text-[#4B5368] hover:bg-[#EEF0F6] hover:text-[#1F2433] transition-colors cursor-pointer"
                title="Collapse sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* New Chat Button */}
            <button
              onClick={() => {}}
              className="w-full h-[44px] bg-[#4338CA] hover:bg-[#3730A3] text-white font-medium text-sm rounded-[8px] flex items-center justify-center space-x-2 shadow-sm transition-all duration-150 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>New chat</span>
            </button>

            {/* DOCUMENTS Section */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-[#4B5368] uppercase font-sans">
                  DOCUMENTS
                </span>
              </div>

              {/* Upload Box */}
              <div className="border border-dashed border-[#CBD5E1] hover:border-[#4338CA] rounded-[12px] p-3 text-center bg-[#FAFAFC] hover:bg-[#F5F7FF] transition-all cursor-pointer group">
                <div className="flex justify-center mb-1 text-[#4338CA]">
                  <svg className="w-5 h-5 text-[#4338CA] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-[#1F2433]">Drop PDFs here or browse</p>
                <p className="text-[10px] text-[#4B5368] mt-0.5">PDF only, up to 25 MB each</p>
              </div>

              {/* Document count & select all */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[#4B5368] text-[11px]">
                  Searching in {checkedCount} of {documents.length} documents
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-[#4338CA] hover:text-[#3730A3] font-medium text-[11px] hover:underline cursor-pointer"
                >
                  Select all
                </button>
              </div>

              {/* Document List */}
              <div className="space-y-1.5">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between p-2 rounded-[8px] border transition-colors ${
                      doc.disabled
                        ? 'border-[#E3E6EF] bg-[#FBFBFE] opacity-80'
                        : 'border-[#E3E6EF] bg-white hover:bg-[#F9FAFC]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={doc.checked}
                        disabled={doc.disabled}
                        onChange={() => handleToggleDoc(doc.id)}
                        className="w-4 h-4 text-[#4338CA] rounded border-[#CBD5E1] focus:ring-[#4338CA] accent-[#4338CA] cursor-pointer disabled:cursor-not-allowed"
                      />
                      <div className="truncate">
                        <p className="font-mono text-xs font-semibold text-[#1F2433] truncate">
                          {doc.name}
                        </p>
                        <p className="text-[10px] text-[#4B5368]">{doc.pages}</p>
                      </div>
                    </div>
                    <span
                      className={`font-sans px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                        doc.status === 'Ready'
                          ? 'bg-[#DCFCE7] text-[#14532D]'
                          : 'bg-[#E0E7FF] text-[#312E81]'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CONVERSATIONS Section */}
            <div className="space-y-2 pt-2 border-t border-[#E3E6EF]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-[#4B5368] uppercase font-sans">
                  CONVERSATIONS
                </span>
              </div>
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-2.5 rounded-[8px] cursor-pointer transition-colors ${
                      conv.active
                        ? 'bg-[#EEF2FF] border border-[#C7D2FE]'
                        : 'hover:bg-[#F6F7FB] border border-transparent hover:border-[#E3E6EF]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs truncate ${
                          conv.active ? 'font-semibold text-[#312E81]' : 'font-medium text-[#1F2433]'
                        }`}
                      >
                        {conv.title}
                      </p>
                      <span
                        className={`text-[10px] font-medium shrink-0 ${
                          conv.active ? 'text-[#4338CA]' : 'text-[#4B5368]'
                        }`}
                      >
                        {conv.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="p-3 border-t border-[#E3E6EF] bg-white">
            <button className="w-full h-[44px] flex items-center justify-start space-x-2.5 px-3 rounded-[8px] text-[#4B5368] hover:text-[#1F2433] hover:bg-[#F6F7FB] border border-transparent hover:border-[#E3E6EF] transition-all cursor-pointer">
              <svg className="w-4 h-4 text-[#4B5368]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-medium">Settings</span>
            </button>
          </div>
        </aside>
      )}

      {/* ========================================== */}
      {/* COLUMN 2: CENTER CHAT & VERIFICATION DECK  */}
      {/* ========================================== */}
      <main className="flex-1 flex flex-col h-full bg-[#F6F7FB] min-w-0 overflow-hidden">
        {/* Center Header Bar */}
        <header className="h-[56px] min-h-[56px] bg-white border-b border-[#E3E6EF] px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={onReturnToLanding}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-[#E3E6EF] hover:border-[#CBD5E1] hover:bg-[#F6F7FB] text-[#4B5368] hover:text-[#1F2433] text-xs font-medium transition-colors cursor-pointer"
              title="Return to Landing Page"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Back to Overview</span>
            </button>
            <div className="h-4 w-[1px] bg-[#E3E6EF] hidden sm:block" />
            <h1 className="text-sm font-semibold text-[#1F2433] truncate">
              Revenue growth Q1 to Q4
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#EEF0F6] text-[#434A5E] border border-[#E3E6EF]">
              Scope: 2 documents
            </span>
            <button
              onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
              className={`p-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                isEvidenceOpen
                  ? 'bg-[#EEF2FF] border-[#C7D2FE] text-[#4338CA]'
                  : 'bg-white border-[#E3E6EF] text-[#4B5368]'
              }`}
              title="Toggle Evidence Viewer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Center Scrollable Feed Area */}
        <div className="flex-1 overflow-y-auto custom-scroll p-4 sm:p-6 space-y-5">
          {/* User Message Bubble */}
          <div className="flex justify-end">
            <div className="max-w-[580px] bg-[#4338CA] text-white px-4 py-3 rounded-[12px] shadow-sm text-sm font-medium leading-relaxed">
              By what percentage did revenue grow from Q1 to Q4?
            </div>
          </div>

          {/* Full-width White ANSWER CARD */}
          <div className="w-full bg-white rounded-[12px] border border-[#E3E6EF] p-5 space-y-4 shadow-sm">
            {/* Top Row of Chips */}
            <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#14532D]">
                  Answered
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DCFCE7] text-[#14532D] flex items-center space-x-1">
                  <svg className="w-3 h-3 text-[#14532D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>High: passed all automated checks</span>
                </span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowInfo(!showInfo)}
                    className="w-5 h-5 rounded-full border border-[#CBD5E1] text-[#4B5368] hover:text-[#1F2433] hover:border-[#94A3B8] flex items-center justify-center text-[11px] font-serif transition-colors cursor-pointer"
                    title="Verification check details"
                  >
                    i
                  </button>
                  {showInfo && (
                    <div className="absolute left-0 mt-2 w-64 p-3 bg-white border border-[#E3E6EF] rounded-xl shadow-lg text-[11px] text-[#4B5368] z-20">
                      <p className="font-semibold text-[#1F2433] mb-1">Evidentiary Rigor</p>
                      <p>Both deterministic code execution and neural chunk analysis passed with zero divergence flags.</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="font-mono text-xs text-[#4B5368]">
                7.4 s
              </div>
            </div>

            {/* Answer Text */}
            <div className="text-sm text-[#1F2433] leading-relaxed">
              Revenue grew by <span className="font-mono font-bold text-[#1F2433]">33.89%</span> from Q1 2025 (125,400 USD) to Q4 2025 (167,900 USD){' '}
              <button
                type="button"
                onClick={() => handleCitationClick('S1')}
                className="inline-flex items-center font-mono text-xs font-semibold bg-[#EEF2FF] text-[#3730A3] hover:bg-[#E0E7FF] px-1.5 py-0.5 rounded border border-[#C7D2FE] mx-0.5 transition-colors cursor-pointer"
                title="Jump to citation"
              >
                [S1]
              </button>
              . Q4 2025 was also the highest-revenue quarter{' '}
              <button
                type="button"
                onClick={() => handleCitationClick('S1')}
                className="inline-flex items-center font-mono text-xs font-semibold bg-[#EEF2FF] text-[#3730A3] hover:bg-[#E0E7FF] px-1.5 py-0.5 rounded border border-[#C7D2FE] mx-0.5 transition-colors cursor-pointer"
                title="Jump to citation"
              >
                [S1]
              </button>
              .
            </div>

            {/* Sources Row */}
            <div className="flex items-center space-x-2 pt-1 flex-wrap gap-y-1">
              <span className="text-xs font-medium text-[#4B5368]">Sources:</span>
              <button
                type="button"
                onClick={() => handleCitationClick('S1')}
                className="font-mono text-xs font-medium text-[#4338CA] bg-white border border-[#C7D2FE] hover:bg-[#EEF2FF] px-2.5 py-1 rounded-[6px] transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-[#4338CA]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>text_table.pdf · p.3 · table</span>
              </button>
              <button
                type="button"
                className="font-mono text-xs font-medium text-[#4B5368] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] px-2.5 py-1 rounded-[6px] transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-[#4B5368]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>text_table.pdf · p.3 · text</span>
              </button>
            </div>

            {/* CALCULATION Box */}
            <div className="rounded-[8px] border border-[#D5E2FB] bg-[#F7FAFF] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-[#3B82F6] uppercase font-sans">
                  CALCULATION
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#E3E6EF] rounded bg-white overflow-hidden">
                  <thead className="bg-[#F0F5FD] text-[#4B5368] font-semibold border-b border-[#E3E6EF]">
                    <tr>
                      <th className="py-1.5 px-3">Operation</th>
                      <th className="py-1.5 px-3">Operands</th>
                      <th className="py-1.5 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono divide-y divide-[#E3E6EF] text-[#1F2433]">
                    <tr>
                      <td className="py-1.5 px-3 font-sans text-xs">Percent change</td>
                      <td className="py-1.5 px-3 text-xs">
                        Q1: 125,400 <span className="text-[#4338CA] font-semibold">[S1]</span> → Q4: 167,900 <span className="text-[#4338CA] font-semibold">[S1]</span>
                      </td>
                      <td className="py-1.5 px-3 font-bold text-xs text-[#1F2433]">33.89%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-[#4B5368]">Computed by code, not by the language model.</p>
            </div>

            {/* Verification details */}
            <div className="rounded-[8px] border border-[#E3E6EF] bg-[#FAFAFC] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E3E6EF] pb-2">
                <span className="text-xs font-semibold text-[#1F2433]">Verification details</span>
                <span className="text-[11px] text-[#4B5368]">Automated verification suite</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* EXACT CHECKS */}
                <div className="space-y-2 md:border-r md:border-[#E3E6EF] md:pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-semibold text-[#1F2433] tracking-wide uppercase">
                      EXACT CHECKS
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EEF0F6] text-[#434A5E]">
                      deterministic
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#1F2433]">
                    {[
                      { l: 'Citations point to sources sent to the model:', s: 'passed' },
                      { l: 'Numbers found in cited evidence:', s: 'passed' },
                      { l: 'Calculation operands found in source:', s: 'passed' },
                      { l: 'Answer sentences covered by claims:', s: 'passed' },
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start justify-between">
                        <span className="text-[#4B5368]">{item.l}</span>
                        <span className="font-medium text-[#14532D] font-mono ml-2">{item.s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* SIGNALS */}
                <div className="space-y-2 md:pl-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-semibold text-[#1F2433] tracking-wide uppercase">
                      SIGNALS
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FEF3C7] text-[#78350F]">
                      heuristic, can be wrong
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#1F2433]">
                    {[
                      { l: 'Claim 1 overlaps its cited text:', s: 'strong' },
                      { l: 'Claim 2 overlaps its cited text:', s: 'strong' },
                      { l: 'Model check needed for borderline claims:', s: 'none' },
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start justify-between">
                        <span className="text-[#4B5368]">{item.l}</span>
                        <span className="font-medium text-[#1F2433] font-mono ml-2">{item.s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E3E6EF]">
                <p className="text-[11px] text-[#4B5368]">
                  Heuristic checks are signals, not proof. Open the source to confirm.
                </p>
              </div>
            </div>

            {/* Copy button */}
            <div className="pt-1 flex justify-start">
              <button
                type="button"
                onClick={handleCopy}
                className="h-8 px-3 rounded-[6px] border border-[#E3E6EF] hover:border-[#CBD5E1] bg-white text-[#4B5368] hover:text-[#1F2433] text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>{copied ? 'Copied!' : 'Copy answer'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="p-4 bg-white border-t border-[#E3E6EF] shrink-0">
          <div className="max-w-4xl mx-auto space-y-1.5">
            <label className="text-xs font-medium text-[#4B5368] block">
              Ask a question about the selected documents
            </label>
            <div className="relative border border-[#E3E6EF] focus-within:border-[#4338CA] rounded-[8px] bg-white transition-all">
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="For example: What was revenue in Q4 2025?"
                className="w-full text-xs text-[#1F2433] placeholder-[#94A3B8] p-2.5 rounded-[8px] focus:outline-none resize-none bg-transparent"
              />
              <div className="flex items-center justify-between px-3 py-2 border-t border-[#F1F3F9] bg-[#FAFAFC] rounded-b-[8px]">
                <span className="font-mono text-[11px] text-[#4B5368]">
                  {inputText.length} / 1000
                </span>
                <button
                  type="button"
                  className="h-[36px] px-4 bg-[#4338CA] hover:bg-[#3730A3] text-white font-medium text-xs rounded-[8px] flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <span>Send</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================== */}
      {/* COLUMN 3: RIGHT EVIDENCE VIEWER            */}
      {/* ========================================== */}
      {isEvidenceOpen && (
        <aside className="w-full lg:w-[420px] lg:min-w-[420px] lg:max-w-[420px] h-full bg-white border-l border-[#E3E6EF] flex flex-col justify-between overflow-hidden shrink-0">
          {/* Top Title */}
          <div className="h-[56px] min-h-[56px] border-b border-[#E3E6EF] px-4 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-[#4338CA]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="font-mono text-xs font-semibold text-[#1F2433]">text_table.pdf</span>
            </div>
            <button
              onClick={() => setIsEvidenceOpen(false)}
              className="text-xs font-medium text-[#4B5368] hover:text-[#1F2433] px-2 py-1 rounded hover:bg-[#F6F7FB] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-4 py-2.5 border-b border-[#E3E6EF] bg-[#FAFAFC] space-y-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="w-7 h-7 rounded border border-[#E3E6EF] bg-white flex items-center justify-center text-[#4B5368] hover:text-[#1F2433] hover:bg-[#F1F3F9] transition-colors disabled:opacity-40 cursor-pointer"
                  title="Previous page"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-mono text-xs text-[#1F2433] px-1 font-medium">
                  Page {currentPage} of 5
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(5, p + 1))}
                  disabled={currentPage >= 5}
                  className="w-7 h-7 rounded border border-[#E3E6EF] bg-white flex items-center justify-center text-[#4B5368] hover:text-[#1F2433] hover:bg-[#F1F3F9] transition-colors disabled:opacity-40 cursor-pointer"
                  title="Next page"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#E0E7FF] text-[#312E81]">
                  table
                </span>
                <span className="font-mono text-xs text-[#4B5368]">100%</span>
                <button className="px-2 py-1 text-xs font-medium border border-[#E3E6EF] bg-white rounded hover:bg-[#F1F3F9] text-[#1F2433] transition-colors cursor-pointer">
                  Fit width
                </button>
              </div>
            </div>

            <div className="text-[11px] text-[#4B5368]">
              Section: <span className="text-[#1F2433] font-medium">Quarterly Financial Table</span>
            </div>
          </div>

          {/* Viewer Body */}
          <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4 bg-[#F0F2F6]">
            {/* Rendered Document Page */}
            <div className="bg-white rounded-[6px] border border-[#CBD5E1] p-4 shadow-sm space-y-3">
              <div className="border-b border-[#E3E6EF] pb-2">
                <h3 className="text-xs font-bold text-[#1F2433]">Page 3 — Quarterly Financial Table</h3>
                <p className="text-[10px] text-[#4B5368] mt-0.5">Primary accounting transcript</p>
              </div>

              <div className="overflow-hidden border border-[#E3E6EF] rounded">
                <table className="w-full text-left text-[11px] divide-y divide-[#E3E6EF]">
                  <thead className="bg-[#F8FAFC] text-[#4B5368] font-semibold">
                    <tr>
                      <th className="py-1.5 px-2">Quarter</th>
                      <th className="py-1.5 px-2">Revenue (USD)</th>
                      <th className="py-1.5 px-2">Operating Cost (USD)</th>
                      <th className="py-1.5 px-2">Units Produced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E6EF] font-mono text-[#1F2433]">
                    {tableRows.map((row, idx) => {
                      const isHighlighted =
                        row.highlighted ||
                        (activeCitation === 'S1' && (row.quarter === 'Q1 2025' || row.quarter === 'Q4 2025'));
                      return (
                        <tr
                          key={idx}
                          className={isHighlighted ? 'highlight-row bg-[#EEF2FF]' : ''}
                        >
                          <td className={`py-1.5 px-2 ${isHighlighted ? 'font-semibold text-[#312E81]' : ''}`}>
                            {row.quarter}
                          </td>
                          <td className={`py-1.5 px-2 ${isHighlighted ? 'font-bold text-[#312E81]' : ''}`}>
                            {row.revenue}
                          </td>
                          <td className={`py-1.5 px-2 ${isHighlighted ? 'text-[#312E81]' : ''}`}>
                            {row.cost}
                          </td>
                          <td className={`py-1.5 px-2 ${isHighlighted ? 'text-[#312E81]' : ''}`}>
                            {row.units}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-[#F8FAFC] p-2 rounded border border-[#E3E6EF]">
                <p className="text-[10px] text-[#4B5368] leading-tight">
                  Table note: revenue and operating cost are in US dollars. The highest revenue occurred in Q4 2025.
                </p>
              </div>
            </div>

            {/* CITED SNIPPET */}
            <div className="bg-white rounded-[8px] border border-[#E3E6EF] border-l-4 border-l-[#4338CA] p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#4338CA] tracking-wider uppercase font-mono">
                  CITED SNIPPET · [S1]
                </span>
                <span className="text-[10px] text-[#4B5368] font-mono">p.3</span>
              </div>

              <div className="bg-[#F7FAFF] rounded p-2 border border-[#E0E7FF] font-mono text-[11px] text-[#1F2433] space-y-1">
                <div className="flex justify-between items-center text-[#312E81] font-medium">
                  <span>Q1 2025 | Rev: 125,400 USD | Cost: 83,200 USD | Units: 4,850</span>
                </div>
                <div className="flex justify-between items-center text-[#312E81] font-medium">
                  <span>Q4 2025 | Rev: 167,900 USD | Cost: 108,400 USD | Units: 5,940</span>
                </div>
              </div>

              <p className="text-[10px] text-[#4B5368]">
                Direct excerpt extracted from Quarterly Financial Table
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
