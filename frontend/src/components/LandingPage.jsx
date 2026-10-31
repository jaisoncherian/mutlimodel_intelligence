import React from 'react';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { Parallax, Reveal } from './landing/Motion.jsx';
import {
  CalculationPanel,
  CheckFigure,
  ContentTypesPanel,
  HeroPanel,
  ReadFigure,
  RetrieveFigure,
} from './landing/Panels.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';

const REPOSITORY_URL = 'https://github.com/jaisoncherian/mutlimodel_intelligence';

const NAV = [
  ['how-it-works', 'How it works'],
  ['sources', 'Sources'],
  ['checks', 'Checks'],
  ['pipeline', 'Pipeline'],
];

const PIPELINE = [
  { title: 'Upload', desc: 'Add one or many PDFs.', tool: 'PDF' },
  { title: 'Read', desc: 'Extract text, tables and scans, page by page.', tool: 'PyMuPDF · Tesseract' },
  { title: 'Retrieve', desc: 'Search by meaning and by keyword.', tool: 'pgvector' },
  { title: 'Answer', desc: 'A local model writes from that evidence only.', tool: 'Ollama' },
  { title: 'Check', desc: 'Test citations and numbers, and run the math in code.', tool: 'Python' },
];

const CONTAINER = 'max-w-[1320px] mx-auto px-4 sm:px-8';
const SECTION = 'border-t border-border scroll-mt-20';
const BUTTON = 'h-12 px-6 rounded text-sm font-semibold inline-flex items-center justify-center gap-2 transition-opacity cursor-pointer no-underline';
const PRIMARY_BUTTON = `${BUTTON} bg-text text-bg hover:opacity-90`;
const SECONDARY_BUTTON = `${BUTTON} border border-control text-text hover:bg-surface-2`;
const LEAD = 'text-base sm:text-xl text-muted m-0 leading-relaxed';

function SplitHeading({ eyebrow, title, children }) {
  return (
    <div>
      <p className="eyebrow m-0 mb-4">{eyebrow}</p>
      <h2 className="font-display text-headline font-medium text-text m-0 mb-6">{title}</h2>
      <p className={LEAD}>{children}</p>
    </div>
  );
}

function ThemeToggle() {
  const { isDark, setTheme } = useTheme();
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className="w-11 h-11 rounded border border-border text-text hover:bg-surface-2 flex items-center justify-center transition-colors cursor-pointer"
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={16} />
    </button>
  );
}

export default function LandingPage({ onOpenWorkspace }) {
  const scrollTo = (id) => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    document.getElementById(id)?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col overflow-x-clip">
      <header className="sticky top-0 z-50 header-glass border-b border-border">
        <div className={`${CONTAINER} h-[72px] flex items-center justify-between gap-4`}>
          <Logo />
          <nav aria-label="Page sections" className="hidden md:flex items-center gap-6">
            {NAV.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id)}
                className="h-9 text-sm text-muted hover:text-text transition-colors cursor-pointer"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button type="button" onClick={onOpenWorkspace} className={`${PRIMARY_BUTTON} h-11 px-4`}>
              Open workspace
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <Parallax speed={0.12} aria-hidden="true" className="absolute inset-x-0 -top-40 -bottom-40 grid-lines" />
          <div className={`${CONTAINER} relative pt-16 sm:pt-28 pb-16 sm:pb-24`}>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 sm:mb-16">
              <div className="max-w-[920px]">
                <Reveal>
                  <h1 className="font-display text-hero font-medium text-text m-0 mb-6">
                    Answers that cite
                    <br />
                    the page they came from
                  </h1>
                </Reveal>
                <Reveal delay={120}>
                  <p className={`${LEAD} max-w-2xl mb-8`}>
                    DeepCite reads your reports, tables, charts and scanned PDFs, answers from what it finds, and
                    opens the exact page behind each citation.
                  </p>
                </Reveal>
                <Reveal delay={220} className="flex flex-wrap gap-3">
                  <button type="button" onClick={onOpenWorkspace} className={PRIMARY_BUTTON}>
                    Open workspace
                  </button>
                  <button type="button" onClick={() => scrollTo('how-it-works')} className={SECONDARY_BUTTON}>
                    See how it works
                  </button>
                </Reveal>
              </div>
              <Reveal delay={320} className="hidden lg:block pb-2">
                <button
                  type="button"
                  onClick={() => scrollTo('local')}
                  className="flex items-center gap-2 font-mono text-xs text-muted hover:text-text transition-colors cursor-pointer"
                >
                  Runs on a local model
                  <Icon name="arrow-right" size={16} />
                </button>
              </Reveal>
            </div>
            <Reveal variant="zoom" delay={200}>
              <HeroPanel />
            </Reveal>
          </div>
        </section>

        {/* Principle */}
        <section id="how-it-works" className={SECTION}>
          <div className={`${CONTAINER} py-20 sm:py-32`}>
            <Reveal>
              <h2 className="font-display text-headline font-medium text-text text-center m-0 mb-14 sm:mb-20 max-w-3xl mx-auto">
                Read the page. Find the evidence. Check the answer.
              </h2>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Reveal delay={0}>
                <ReadFigure />
              </Reveal>
              <Reveal delay={120}>
                <RetrieveFigure />
              </Reveal>
              <Reveal delay={240}>
                <CheckFigure />
              </Reveal>
            </div>
          </div>
        </section>

        {/* Sources */}
        <section id="sources" className={SECTION}>
          <div className={`${CONTAINER} py-20 sm:py-32 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center`}>
            <Reveal variant="left">
              <SplitHeading eyebrow="Sources" title="Open the source, not just the answer">
                Each citation opens the page it points to, whether that page holds text, a table, a chart or a scan.
                You read the evidence yourself, next to the answer.
              </SplitHeading>
            </Reveal>
            <Reveal variant="right">
              <Parallax speed={-0.04}>
                <ContentTypesPanel />
              </Parallax>
            </Reveal>
          </div>
        </section>

        {/* Checks */}
        <section id="checks" className={SECTION}>
          <div className={`${CONTAINER} py-20 sm:py-32 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center`}>
            <Reveal variant="left" className="order-2 lg:order-1">
              <Parallax speed={-0.04}>
                <CalculationPanel />
              </Parallax>
            </Reveal>
            <Reveal variant="right" className="order-1 lg:order-2">
              <SplitHeading eyebrow="Checks" title="Math done by code, numbers checked against the page">
                Calculations run in Python, not in the language model. Any number the model writes on its own is
                looked up in the cited evidence, and anything not found is flagged.
              </SplitHeading>
            </Reveal>
          </div>
        </section>

        {/* Pipeline */}
        <section id="pipeline" className={SECTION}>
          <div className={`${CONTAINER} py-20 sm:py-32`}>
            <Reveal>
              <p className="eyebrow m-0 mb-4">Pipeline</p>
              <h2 className="font-display text-headline font-medium text-text m-0 mb-14 sm:mb-20 max-w-3xl">
                Five steps from a PDF to an answer you can check
              </h2>
            </Reveal>
            <Reveal as="ol" className="list-none m-0 p-0 relative grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-6">
              <span aria-hidden="true" className="hidden md:block absolute top-[5px] inset-x-0 h-px bg-border" />
              <span aria-hidden="true" className="grow-line hidden md:block absolute top-[5px] inset-x-0 h-px bg-accent-text" />
              {PIPELINE.map((step, index) => (
                <li key={step.title} className="relative">
                  <span aria-hidden="true" className="block w-[11px] h-[11px] rotate-45 border border-accent-text bg-bg mb-6" />
                  <p className="eyebrow m-0 mb-2">Step {index + 1}</p>
                  <h3 className="font-display text-xl font-medium text-text m-0 mb-2">{step.title}</h3>
                  <p className="text-sm text-muted m-0 mb-4">{step.desc}</p>
                  <p className="font-mono text-xs text-muted m-0 pt-4 border-t border-border">{step.tool}</p>
                </li>
              ))}
            </Reveal>
          </div>
        </section>

        {/* Two statements, in place of the template's customer quotes */}
        <section id="local" className={SECTION}>
          <div className={`${CONTAINER} py-20 sm:py-32 grid grid-cols-1 lg:grid-cols-5 gap-6`}>
            <Reveal variant="left" className="lg:col-span-3">
              <div className="bg-block-a-bg text-block-a-text rounded-2xl p-8 sm:p-10 flex flex-col justify-between gap-16 h-full min-h-[360px] lg:min-h-[440px]">
                <div>
                  <h2 className="font-display text-2xl sm:text-headline font-medium m-0 mb-6">
                    When the documents don&apos;t say, it says so.
                  </h2>
                  <p className="text-base sm:text-xl m-0 max-w-2xl">
                    Questions the evidence can&apos;t support get &ldquo;not enough evidence&rdquo; and a note on what
                    is missing, instead of a guess.
                  </p>
                </div>
                <div>
                  <p className="font-mono text-sm m-0">
                    &ldquo;There is no information regarding Q5 or any year other than 2025.&rdquo;
                  </p>
                  <p className="text-sm m-0 mt-2">From a real response on the sample report</p>
                </div>
              </div>
            </Reveal>
            <Reveal variant="right" delay={120} className="lg:col-span-2">
              <div className="bg-block-b-bg text-block-b-text rounded-2xl p-8 sm:p-10 flex flex-col justify-between gap-16 h-full min-h-[360px] lg:min-h-[440px]">
                <h2 className="font-display text-2xl font-medium m-0">Your model. Your database.</h2>
                <p className="text-base m-0">
                  The language model runs locally through Ollama. Your PDFs and page images are stored in your own
                  Supabase project.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Final call to action */}
        <section className={`${SECTION} relative overflow-hidden`}>
          <Parallax speed={0.1} aria-hidden="true" className="absolute inset-x-0 -top-32 -bottom-32 grid-lines" />
          <div className={`${CONTAINER} relative py-24 sm:py-40 text-center`}>
            <Reveal variant="zoom">
              <h2 className="font-display text-hero font-medium text-text m-0 mb-10">
                Ask a document.
                <br />
                Open the page.
              </h2>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={onOpenWorkspace} className={PRIMARY_BUTTON}>
                  Open workspace
                </button>
                <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className={SECONDARY_BUTTON}>
                  View on GitHub
                  <Icon name="arrow-right" size={16} />
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="bg-surface border-t border-border">
        <div className={`${CONTAINER} py-10 flex flex-col md:flex-row md:items-center justify-between gap-6`}>
          <Logo />
          <p className="text-sm text-muted m-0">
            Built for learning. Answers are checked automatically, but always open the source to confirm.
          </p>
        </div>
      </footer>
    </div>
  );
}
