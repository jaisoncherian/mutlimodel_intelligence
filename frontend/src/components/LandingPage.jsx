import React, { useState } from 'react';

export default function LandingPage({ onOpenWorkspace }) {
  const [activeFile, setActiveFile] = useState('text_table.pdf');
  const [citationFocus, setCitationFocus] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const handleScrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col text-on-surface transition-colors">
      {/* TOP NAVIGATION */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-bordercol/80 transition-all">
        <div className="h-20 max-w-[1140px] mx-auto px-gutter flex items-center justify-between">
          {/* Logo Mark */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 group text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-on-primary shadow-sm shadow-primary/20 ring-1 ring-primary-container/30 transition-transform group-hover:scale-[1.03]">
              <span className="material-symbols-outlined text-[20px]">document_scanner</span>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">
              DocuLens AI
            </span>
          </button>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-surface-container-low/70 p-1.5 rounded-xl border border-surface-container-high/60">
            <button
              onClick={() => handleScrollTo('how-it-works')}
              className="font-body-md text-body-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface transition-all px-3.5 py-1.5 rounded-lg cursor-pointer"
            >
              How it works
            </button>
            <button
              onClick={() => handleScrollTo('features')}
              className="font-body-md text-body-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface transition-all px-3.5 py-1.5 rounded-lg cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => handleScrollTo('tech')}
              className="font-body-md text-body-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface transition-all px-3.5 py-1.5 rounded-lg cursor-pointer"
            >
              Tech
            </button>
          </nav>

          {/* Right Actions: GitHub link & Try it button */}
          <div className="flex items-center gap-4">
            <a
              className="text-body-md text-on-surface-variant hover:text-on-surface font-medium transition-colors px-2 py-1"
              href="[GITHUB URL]"
              target="_blank"
              rel="noreferrer"
            >
              [GITHUB URL]
            </a>
            <button
              onClick={onOpenWorkspace}
              className="h-10 px-5 rounded-xl bg-primary-container text-on-primary font-headline-sm text-body-sm inline-flex items-center justify-center hover:bg-primary transition-all duration-150 shadow-sm shadow-primary-container/25 hover:shadow-md cursor-pointer"
            >
              Try it
            </button>
          </div>
        </div>
      </header>

      {/* MAIN WRAPPER */}
      <main className="w-full pt-20 bg-page flex-1">
        <div className="flex flex-col w-full text-on-surface">
          {/* HERO SECTION */}
          <section className="w-full relative overflow-hidden py-16 lg:py-24 border-b border-surface-container-high/60">
            {/* Ambient platform glowing gradients */}
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary-container/5 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute bottom-10 left-10 w-[420px] h-[420px] bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10" />

            <div className="max-w-[1140px] mx-auto px-gutter grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column */}
              <div className="lg:col-span-5 flex flex-col items-start">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-surface-container-high shadow-xs mb-6">
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
                  <span className="font-mono-sm text-[11px] font-semibold tracking-wider text-primary-container uppercase">
                    Multimodal document intelligence
                  </span>
                </div>

                <h1 className="font-display-hero text-headline-lg lg:text-display-hero text-on-surface tracking-tight mb-5 font-bold">
                  Ask your documents. See the proof.
                </h1>

                <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 leading-relaxed">
                  Upload reports, tables, charts and scanned pages. Get answers that point to the
                  exact page they came from, with automated checks on every answer.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 w-full sm:w-auto">
                  <button
                    onClick={onOpenWorkspace}
                    className="h-12 px-7 rounded-xl bg-primary-container text-on-primary font-headline-sm text-body-md inline-flex items-center justify-center hover:bg-primary transition-all duration-150 shadow-md shadow-primary-container/20 hover:scale-[1.01] cursor-pointer"
                  >
                    Try it
                  </button>
                  <button
                    onClick={() => handleScrollTo('demo-video')}
                    className="h-12 px-7 rounded-xl bg-white text-on-surface font-headline-sm text-body-md inline-flex items-center justify-center border border-surface-container-high hover:border-outline-variant hover:bg-surface-container-low transition-all duration-150 shadow-xs cursor-pointer"
                  >
                    Watch the demo
                  </button>
                </div>
              </div>

              {/* Right Column: Framed Analytics Workspace Mockup */}
              <div className="lg:col-span-7">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary-container/20 to-secondary/20 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition duration-500" />
                  <div className="relative w-full rounded-2xl bg-[#0f1422] border border-[#232b45] shadow-2xl overflow-hidden flex flex-col text-slate-200">
                    {/* Header Bar */}
                    <div className="h-11 bg-[#151b2e] border-b border-[#232b45] px-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#ff5f56]/80 inline-block" />
                        <span className="w-3 h-3 rounded-full bg-[#ffbd2e]/80 inline-block" />
                        <span className="w-3 h-3 rounded-full bg-[#27c93f]/80 inline-block" />
                        <div className="h-3.5 w-[1px] bg-[#232b45] mx-1" />
                        <span className="font-mono-code text-[11px] text-slate-400">
                          workspace / doculens-session
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#1c243c] border border-[#2c3756]">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-mono-code text-[11px] text-emerald-400 font-medium">
                          ready
                        </span>
                      </div>
                    </div>

                    {/* Panels */}
                    <div className="grid grid-cols-12 min-h-[390px] divide-x divide-[#232b45] bg-[#0c101d]">
                      {/* Left Pane: Documents Sidebar */}
                      <div className="col-span-3 bg-[#111628]/70 p-3 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between px-2 py-1">
                          <span className="font-mono-code text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                            Documents
                          </span>
                          <span className="text-[10px] font-mono-code text-indigo-400 bg-indigo-500/10 px-1.5 rounded">
                            Loaded
                          </span>
                        </div>
                        {['text_table.pdf', 'two_column.pdf', 'scan.pdf'].map((fname, idx) => {
                          const isSel = activeFile === fname;
                          return (
                            <button
                              key={fname}
                              type="button"
                              onClick={() => setActiveFile(fname)}
                              className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                                isSel
                                  ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-200'
                                  : 'text-slate-400 hover:bg-[#182038] hover:text-slate-200'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px] text-indigo-400">
                                {idx === 0 ? 'description' : idx === 1 ? 'view_column' : 'scanner'}
                              </span>
                              <span className="font-mono-code text-[11px] truncate font-medium">
                                {fname}
                              </span>
                            </button>
                          );
                        })}
                        <div className="mt-auto p-2 rounded-lg bg-[#151c30] border border-[#232c49] text-[10px] font-mono-code text-slate-400 flex items-center justify-between">
                          <span>Status</span>
                          <span className="text-emerald-400">Ready</span>
                        </div>
                      </div>

                      {/* Center Pane: Conversational Stream */}
                      <div className="col-span-5 p-4 flex flex-col justify-between bg-[#0e1322] relative">
                        <div className="flex flex-col gap-3.5">
                          <div className="flex justify-end">
                            <div className="bg-[#1e2744] text-slate-100 border border-[#2e3b63] px-3.5 py-2 rounded-xl rounded-tr-xs shadow-sm max-w-[90%]">
                              <p className="font-body-sm text-[12px] leading-tight font-medium">
                                What was the revenue growth?
                              </p>
                            </div>
                          </div>
                          <div className="bg-[#141a2e] border border-[#283354] p-3.5 rounded-xl flex flex-col gap-2.5 shadow-sm">
                            <div className="flex items-center justify-between border-b border-[#222b47] pb-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded bg-indigo-600/30 flex items-center justify-center text-indigo-400">
                                  <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                                </div>
                                <span className="font-mono-code text-[11px] text-indigo-300 font-medium">
                                  DocuLens Engine
                                </span>
                              </div>
                              <span className="font-mono-code text-[10px] text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                                Checked
                              </span>
                            </div>
                            <p className="font-body-sm text-[12px] text-slate-200 leading-relaxed">
                              Revenue increased from Q1 to Q4 as reported in the financial summary table{' '}
                              <button
                                type="button"
                                onClick={() => setCitationFocus(!citationFocus)}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono-code text-[10px] ml-1 font-semibold cursor-pointer ${
                                  citationFocus
                                    ? 'text-indigo-200 bg-indigo-600/50 border border-indigo-400'
                                    : 'text-indigo-300 bg-indigo-600/30 border border-indigo-500/40'
                                }`}
                              >
                                [S1]
                              </button>
                              .
                            </p>
                            <div className="pt-2 border-t border-[#222b47] flex items-center gap-1.5 text-slate-400">
                              <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
                              <span className="font-mono-code text-[10px] text-slate-300">
                                Deterministic code check: Calculated by code.
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 h-9 bg-[#151c30] border border-[#263152] rounded-lg px-3 flex items-center justify-between text-slate-400 shadow-inner">
                          <span className="font-body-sm text-[11px] text-slate-400">Ask about {activeFile}...</span>
                          <div className="w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center">
                            <span className="material-symbols-outlined text-[13px]">arrow_upward</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Pane: Evidence Inspector */}
                      <div className="col-span-4 bg-[#111628]/90 p-3 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between pb-1 border-b border-[#232b45]">
                          <span className="font-mono-code text-[11px] text-slate-400">Source: Page Table</span>
                          <span className="font-mono-code text-[10px] text-indigo-300 bg-indigo-600/30 border border-indigo-500/40 px-2 py-0.5 rounded-full font-medium">
                            [S1] Focus
                          </span>
                        </div>
                        <div className="flex-1 bg-[#161c32] border border-[#273252] p-2.5 rounded-xl shadow-inner flex flex-col gap-2 text-[10px]">
                          <div className="font-mono-code text-slate-400 pb-1 text-[10px] flex items-center justify-between">
                            <span>Table: Financial Performance</span>
                            <span className="material-symbols-outlined text-[12px] text-slate-500">open_in_full</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 font-mono-code text-slate-400 font-medium py-1 bg-[#1e2642] px-1.5 rounded text-[10px]">
                            <span>Quarter</span>
                            <span>Revenue</span>
                            <span>Operating Cost</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 font-mono-code py-1 px-1.5 text-slate-400">
                            <span>Q1</span>
                            <span>Recorded</span>
                            <span>Recorded</span>
                          </div>
                          <div
                            className={`grid grid-cols-3 gap-1 font-mono-code py-1.5 px-1.5 rounded font-semibold transition-all ${
                              citationFocus
                                ? 'bg-indigo-600/35 border border-indigo-400 text-emerald-300'
                                : 'bg-indigo-600/25 border border-indigo-500/40 text-emerald-300'
                            }`}
                          >
                            <span>Q4</span>
                            <span>Recorded</span>
                            <span>Recorded</span>
                          </div>
                          <div className="mt-auto pt-2 bg-indigo-950/50 border border-indigo-800/40 p-2 rounded-lg text-indigo-200 text-[9px] font-mono-code flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px] text-indigo-400">description</span>
                            <span>Source snippet linked to citation</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS SECTION */}
          <section className="w-full bg-white py-20 lg:py-28 border-b border-surface-container-high/60 relative" id="how-it-works">
            <div className="max-w-[1140px] mx-auto px-gutter flex flex-col">
              <div className="max-w-xl mb-14">
                <span className="font-mono-sm text-[11px] font-semibold uppercase tracking-wider text-secondary bg-secondary/10 px-3 py-1 rounded-full">
                  Architecture
                </span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mt-3 mb-3 font-semibold">
                  How it works
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  An end-to-end local document processing pipeline engineered for traceability and verifiability.
                </p>
              </div>

              {/* 5-Step Pipeline */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
                {[
                  { step: '01', title: 'Upload', desc: 'Add one or many PDFs.', icon: 'upload_file' },
                  { step: '02', title: 'Read', desc: 'Text, tables and scanned pages are extracted and numbered by page.', icon: 'description' },
                  { step: '03', title: 'Retrieve', desc: 'Meaning-based and keyword search find the relevant evidence.', icon: 'search' },
                  { step: '04', title: 'Answer', desc: 'A local language model writes the answer using only that evidence, and reads page images when a chart is needed.', icon: 'chat_bubble_outline' },
                  { step: '05', title: 'Check', desc: 'Citations and numbers are checked automatically, and calculations run in Python.', icon: 'check_circle', completed: true },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`group relative bg-[#f9fafc] hover:bg-white p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                      s.completed
                        ? 'border-surface-container-high/80 hover:border-secondary/40 hover:shadow-xl hover:shadow-secondary/10'
                        : 'border-surface-container-high/80 hover:border-primary-container/40 hover:shadow-xl hover:shadow-primary-container/5'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <div
                          className={`w-11 h-11 rounded-xl bg-white flex items-center justify-center border border-surface-container-high transition-colors shadow-xs ${
                            s.completed
                              ? 'text-secondary group-hover:bg-secondary group-hover:text-white'
                              : 'text-primary-container group-hover:bg-primary-container group-hover:text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[22px]">{s.icon}</span>
                        </div>
                        <span
                          className={`font-mono-code text-[12px] font-bold text-outline-variant transition-colors ${
                            s.completed ? 'group-hover:text-secondary' : 'group-hover:text-primary-container'
                          }`}
                        >
                          {s.step}
                        </span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-semibold">
                        {s.title}
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        {s.desc}
                      </p>
                    </div>

                    {s.completed ? (
                      <div className="hidden md:flex items-center gap-1 mt-6 text-secondary font-mono-code text-xs font-semibold">
                        <span>Completed</span>
                        <span className="material-symbols-outlined text-[16px]">done_all</span>
                      </div>
                    ) : (
                      <div className="hidden md:flex items-center gap-1 mt-6 text-outline-variant group-hover:text-primary-container transition-colors text-xs font-mono-code font-medium">
                        <span>Next</span>
                        <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                          arrow_forward
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* WHAT MAKES IT DIFFERENT SECTION */}
          <section className="w-full bg-[#f8f9fd] py-20 lg:py-28 border-b border-surface-container-high/60" id="features">
            <div className="max-w-[1140px] mx-auto px-gutter">
              <div className="max-w-xl mb-14">
                <span className="font-mono-sm text-[11px] font-semibold uppercase tracking-wider text-primary-container bg-primary-container/10 px-3 py-1 rounded-full">
                  Design Principles
                </span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mt-3 font-semibold">
                  What makes it different
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    id: 'c1',
                    tag: 'citation_link',
                    icon: 'find_in_page',
                    title: 'Every answer shows its page',
                    desc: 'citations link to the exact page and section.',
                    footerIcon: 'pin_drop',
                    footerText: 'Exact source mapping enabled',
                  },
                  {
                    id: 'c2',
                    tag: 'python_runtime',
                    icon: 'terminal',
                    title: 'Math done by code',
                    desc: 'the language model never computes numbers; Python does.',
                    footerIcon: 'calculate',
                    footerText: 'calc: exec(ast_parser_node)',
                    color: 'secondary',
                  },
                  {
                    id: 'c3',
                    tag: 'vision_vlm',
                    icon: 'pie_chart',
                    title: 'Charts read as images',
                    desc: 'visual content is analyzed from the page image.',
                    footerIcon: 'image_search',
                    footerText: 'Raster pixel analysis active',
                  },
                  {
                    id: 'c4',
                    tag: 'null_safety',
                    icon: 'format_image_left',
                    title: 'Honest about uncertainty',
                    desc: 'exact checks and heuristic signals are shown separately, and unsupported questions get "not enough evidence".',
                    footerIcon: 'info',
                    footerText: 'Signals isolated',
                    badge: 'strict-fallback',
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-8 rounded-2xl border border-surface-container-high/80 hover:border-primary-container/40 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div
                          className={`w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center ${
                            item.color === 'secondary' ? 'text-secondary' : 'text-primary-container'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
                        </div>
                        <span className="font-mono-code text-[11px] font-medium bg-surface-container-low border border-surface-container-high text-on-surface-variant px-3 py-1 rounded-full">
                          {item.tag}
                        </span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-semibold">
                        {item.title}
                      </h3>
                      <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                        {item.desc}
                      </p>
                    </div>

                    <div className="mt-8 pt-4 border-t border-surface-container-high/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`material-symbols-outlined text-[17px] ${
                            item.color === 'secondary'
                              ? 'text-secondary'
                              : item.badge
                              ? 'text-tertiary'
                              : 'text-primary-container'
                          }`}
                        >
                          {item.footerIcon}
                        </span>
                        <span className="font-mono-code text-[12px] text-on-surface-variant">
                          {item.footerText}
                        </span>
                      </div>
                      {item.badge && (
                        <span className="font-mono-code text-[10px] bg-surface-container-high px-2.5 py-1 rounded-full text-on-surface-variant font-medium">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* TRY IT SECTION */}
          <section className="w-full bg-white py-20 lg:py-28 border-b border-surface-container-high/60" id="try-it">
            <div className="max-w-[1140px] mx-auto px-gutter">
              <div className="bg-[#f8f9fe] border border-surface-container-high rounded-3xl p-8 lg:p-12 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                  <div className="lg:col-span-6 flex flex-col">
                    <h2 className="font-headline-md text-headline-md text-on-surface font-bold mb-3">
                      Run it on your own machine
                    </h2>
                    <p className="font-body-md text-body-md text-on-surface-variant mb-8 leading-relaxed">
                      DocuLens AI runs locally, so your documents never leave your computer.
                    </p>

                    <div className="flex flex-col gap-5 mb-8">
                      {['Clone the repository', 'Follow the setup guide in the README', 'Open the app in your browser'].map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3.5">
                          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-mono-code text-[12px] font-bold shadow-xs shrink-0">
                            {idx + 1}
                          </div>
                          <span className="font-body-md text-body-md text-on-surface font-medium">
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3.5">
                      <a
                        className="h-12 px-6 rounded-xl bg-white text-on-surface font-headline-sm text-body-md inline-flex items-center gap-2 border border-surface-container-high hover:border-outline-variant hover:bg-surface-container-low transition-all duration-150 shadow-xs cursor-pointer"
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="material-symbols-outlined text-[20px]">code</span>
                        <span>View on GitHub</span>
                      </a>
                      <button
                        type="button"
                        onClick={onOpenWorkspace}
                        className="h-12 px-7 rounded-xl bg-primary-container text-on-primary font-headline-sm text-body-md inline-flex items-center hover:bg-primary transition-all duration-150 shadow-sm shadow-primary-container/20 cursor-pointer"
                      >
                        Open the app
                      </button>
                    </div>
                  </div>

                  {/* 16:9 Video Demo Player */}
                  <div className="lg:col-span-6" id="demo-video">
                    <div
                      onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                      className="aspect-video bg-[#0d1220] rounded-2xl border border-[#222a44] flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer shadow-xl transition-all hover:border-indigo-500/50"
                    >
                      <div className="absolute inset-0 dark-dot-grid opacity-35" />
                      <div className="absolute w-48 h-48 bg-primary-container/20 rounded-full blur-2xl pointer-events-none" />
                      <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-md border border-white/15 px-3 py-1 rounded-full font-mono-code text-[11px] text-white">
                        {isVideoPlaying ? 'Demo Walkthrough' : 'Walkthrough overview'}
                      </div>
                      <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="h-16 w-16 rounded-full bg-white text-primary-container flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-primary-fixed transition-all duration-300">
                          <span className="material-symbols-outlined text-[32px] ml-1">
                            {isVideoPlaying ? 'pause' : 'play_arrow'}
                          </span>
                        </div>
                        <span className="font-body-sm text-[13px] font-medium text-slate-200 group-hover:text-white transition-colors">
                          {isVideoPlaying ? 'Interactive walkthrough playing' : 'Watch the walkthrough'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* BUILT WITH SECTION */}
          <section className="w-full bg-[#f8f9fd] py-16" id="tech">
            <div className="max-w-[1140px] mx-auto px-gutter flex flex-col items-start">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-[20px] text-primary-container">
                  layers
                </span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Built with
                </h2>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {[
                  'React',
                  'JavaScript',
                  'Tailwind CSS',
                  'Flask',
                  'PostgreSQL',
                  'pgvector',
                  'Ollama',
                  'Tesseract',
                  'PyMuPDF',
                ].map((tag) => (
                  <span
                    key={tag}
                    className="font-mono-sm text-[12px] px-4 py-2 bg-white rounded-xl text-on-surface border border-surface-container-high/90 shadow-xs hover:border-primary-container/40 transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="w-full bg-white border-t border-surface-container-high/80 py-12">
            <div className="max-w-[1140px] mx-auto px-gutter flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex flex-col gap-1.5 max-w-xl">
                <span className="font-body-md text-body-md text-on-surface font-semibold tracking-tight">
                  DocuLens AI by [YOUR NAME] — evidentiary multimodal document intelligence workspace
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Built for learning. Answers are checked automatically, but always open the source to confirm.
                </p>
              </div>
              <div className="flex items-center gap-6">
                <a
                  className="font-body-sm text-body-sm font-medium text-primary-container hover:text-primary transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-surface-container-low"
                  href="[GITHUB URL]"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="material-symbols-outlined text-[18px]">code</span>
                  <span>[GITHUB URL]</span>
                </a>
                <a
                  className="font-body-sm text-body-sm font-medium text-primary-container hover:text-primary transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-surface-container-low"
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="material-symbols-outlined text-[18px]">link</span>
                  <span>LinkedIn</span>
                </a>
              </div>
            </div>
          </footer>

          <footer className="w-full bg-[#f8f9fd] border-t border-surface-container-high/60">
            <div className="max-w-[1140px] mx-auto px-gutter py-12">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shadow-xs">
                    <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                  </div>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
                    DocuLens AI
                  </span>
                </div>
                <nav className="flex flex-wrap items-center gap-6">
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="transition-colors text-primary font-headline-sm text-body-sm cursor-pointer"
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => handleScrollTo('how-it-works')}
                    className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  >
                    How it works
                  </button>
                  <button
                    onClick={() => handleScrollTo('features')}
                    className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  >
                    Features
                  </button>
                  <button
                    onClick={() => handleScrollTo('tech')}
                    className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  >
                    Tech
                  </button>
                  <a
                    className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                    href="[GITHUB URL]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    [GITHUB URL]
                  </a>
                </nav>
              </div>

              <div className="mt-8 pt-8 border-t border-surface-container-high/70 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="font-mono-code text-[11px] text-on-surface-variant">
                  © 2025 DocuLens AI by [YOUR NAME]. Evidentiary document intelligence workspace.
                </p>
                <div className="flex items-center gap-2 font-mono-code text-[11px] text-on-surface-variant bg-white px-3 py-1 rounded-full border border-surface-container-high">
                  <span className="inline-block w-2 h-2 rounded-full bg-secondary" />
                  <span>automated-checks</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
