import React from 'react';
import Icon from './Icon.jsx';

const STEPS = [
  { title: 'Upload', desc: 'Add one or many PDFs.' },
  { title: 'Read', desc: 'Text, tables and scanned pages are extracted and numbered by page.' },
  { title: 'Retrieve', desc: 'Meaning-based and keyword search find the relevant evidence.' },
  { title: 'Answer', desc: 'A local language model writes the answer using only that evidence, and reads page images when a chart is needed.' },
  { title: 'Check', desc: 'Citations and numbers are checked automatically, and calculations run in Python.' },
];

const FEATURES = [
  { icon: 'document', title: 'Every answer shows its page', desc: 'Citations link to the exact page and section.' },
  { icon: 'code', title: 'Math done by code', desc: 'The language model never computes numbers; Python does.' },
  { icon: 'image', title: 'Charts read as images', desc: 'Visual content is analyzed from the page image.' },
  { icon: 'search', title: 'Honest about uncertainty', desc: 'Exact checks and heuristic signals are shown separately, and unsupported questions get "not enough evidence".' },
];

const STACK = ['React', 'JavaScript', 'Tailwind CSS', 'Flask', 'PostgreSQL', 'pgvector', 'Ollama', 'Tesseract', 'PyMuPDF'];

const SETUP = ['Clone the repository', 'Follow the setup guide in the README', 'Open the app in your browser'];

const PRIMARY_BUTTON =
  'h-11 px-6 rounded-lg bg-accent hover:bg-accent-hover text-on-accent text-sm font-medium inline-flex items-center justify-center transition-colors cursor-pointer';

const CITATION_MARK =
  'inline-flex items-center font-mono text-xs font-semibold bg-accent-soft text-accent-text px-1 rounded border border-accent-line mx-1';

function SectionHeading({ children }) {
  return <h2 className="text-2xl font-semibold text-text mb-8">{children}</h2>;
}

/** A static picture of an answer, labelled as such. It does not call the API. */
function AnswerIllustration() {
  return (
    <figure className="m-0">
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div className="flex justify-end">
          <p className="m-0 bg-accent text-on-accent text-sm font-medium px-4 py-2 rounded-xl">
            What was the revenue in Q4 2025?
          </p>
        </div>
        <div className="border border-border rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-border bg-chip-ready-bg text-chip-ready-text">
              Answered
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-border bg-chip-ready-bg text-chip-ready-text">
              High: passed all automated checks
            </span>
          </div>
          <p className="m-0 text-sm text-text leading-relaxed">
            The revenue in Q4 2025 was $167,900.<span className={CITATION_MARK}>[S1]</span>
          </p>
          <p className="m-0 text-xs text-muted">
            Sources: <span className="font-mono">text_table.pdf · p.3 · table</span>
          </p>
          <p className="m-0 text-xs text-muted">
            Heuristic checks are signals, not proof. Open the source to confirm.
          </p>
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-muted">
        Illustration of an answer from the sample report. Not a live response.
      </figcaption>
    </figure>
  );
}

export default function LandingPage({ onOpenWorkspace }) {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="h-16 max-w-[1140px] mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-accent text-on-accent flex items-center justify-center">
              <Icon name="book" size={20} />
            </span>
            <span className="text-base font-bold text-text">DocuLens AI</span>
          </div>
          <nav aria-label="Page sections" className="hidden md:flex items-center gap-2">
            {[
              ['how-it-works', 'How it works'],
              ['features', 'Features'],
              ['tech', 'Tech'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id)}
                className="h-9 px-4 rounded-lg text-sm font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
              >
                {label}
              </button>
            ))}
          </nav>
          <button type="button" onClick={onOpenWorkspace} className={PRIMARY_BUTTON}>
            Try it
          </button>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 border-b border-border">
          <div className="max-w-[1140px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-2xl sm:text-display font-bold text-text mb-4">
                Ask your documents. See the source.
              </h1>
              <p className="text-base text-muted mb-8">
                Upload reports, tables, charts and scanned pages. Get answers that point to the exact
                page they came from, with automated checks on every answer.
              </p>
              <button type="button" onClick={onOpenWorkspace} className={PRIMARY_BUTTON}>
                Try it
              </button>
            </div>
            <AnswerIllustration />
          </div>
        </section>

        <section id="how-it-works" className="py-16 border-b border-border bg-surface">
          <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
            <SectionHeading>How it works</SectionHeading>
            <ol className="grid grid-cols-1 md:grid-cols-5 gap-4 list-none p-0 m-0">
              {STEPS.map((step, index) => (
                <li key={step.title} className="bg-surface-2 border border-border rounded-xl p-4">
                  <span className="font-mono text-xs font-semibold text-muted">{index + 1}</span>
                  <h3 className="text-base font-semibold text-text mt-2 mb-2">{step.title}</h3>
                  <p className="text-sm text-muted m-0">{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="py-16 border-b border-border">
          <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
            <SectionHeading>What makes it different</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="bg-surface border border-border rounded-xl p-6">
                  <span className="w-9 h-9 rounded-lg bg-accent-soft text-accent-text flex items-center justify-center mb-4">
                    <Icon name={feature.icon} size={20} />
                  </span>
                  <h3 className="text-base font-semibold text-text mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted m-0">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="try-it" className="py-16 border-b border-border bg-surface">
          <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
            <SectionHeading>Run it on your own machine</SectionHeading>
            <p className="text-base text-muted mb-8 max-w-2xl">
              The language model runs locally through Ollama. Your PDFs and page images are stored in
              your own Supabase project.
            </p>
            <ol className="list-none p-0 m-0 mb-8 space-y-4">
              {SETUP.map((step, index) => (
                <li key={step} className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-accent text-on-accent flex items-center justify-center font-mono text-xs font-bold shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-text">{step}</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={onOpenWorkspace} className={PRIMARY_BUTTON}>
              Open the app
            </button>
          </div>
        </section>

        <section id="tech" className="py-16">
          <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
            <SectionHeading>Built with</SectionHeading>
            <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
              {STACK.map((tag) => (
                <li key={tag} className="text-sm px-4 py-2 bg-surface rounded-lg text-text border border-border">
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="bg-surface border-t border-border py-8">
        <p className="max-w-[1140px] mx-auto px-4 sm:px-6 text-sm text-muted m-0">
          Built for learning. Answers are checked automatically, but always open the source to confirm.
        </p>
      </footer>
    </div>
  );
}
