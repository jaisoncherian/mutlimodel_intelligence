import React from 'react';

/*
 * Static pictures of the product for the landing page. They call no API. The values
 * come from real responses on the sample report (text_table.pdf), kept in
 * src/test/fixtures, and every picture is labelled as an illustration.
 */

const TABLE_HEADERS = ['Quarter', 'Revenue (USD)', 'Operating Cost (USD)', 'Units Produced'];
const TABLE_ROWS = [
  ['Q1 2025', '125,400', '83,200', '4,850'],
  ['Q2 2025', '138,750', '91,600', '5,120'],
  ['Q3 2025', '142,300', '94,150', '5,260'],
  ['Q4 2025', '167,900', '108,400', '5,940'],
];
const CITED_ROW = 'Q4 2025';

const SAMPLE_DOCUMENTS = [
  { name: 'text_table.pdf', kind: 'Text and tables' },
  { name: 'two_column.pdf', kind: 'Two columns' },
  { name: 'scan.pdf', kind: 'Scanned, OCR' },
];

const CHIP = 'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold';
const READY_CHIP = `${CHIP} bg-chip-ready-bg text-chip-ready-text`;

function PaneLabel({ children, className = '' }) {
  return <p className={`eyebrow m-0 ${className}`}>{children}</p>;
}

function CornerMarks() {
  const mark = 'absolute w-2 h-2 border-control';
  return (
    <>
      <span className={`${mark} top-3 left-3 border-t border-l`} />
      <span className={`${mark} top-3 right-3 border-t border-r`} />
      <span className={`${mark} bottom-3 left-3 border-b border-l`} />
      <span className={`${mark} bottom-3 right-3 border-b border-r`} />
    </>
  );
}

/** The three-pane picture under the hero: documents, answer, cited page. */
export function HeroPanel() {
  return (
    <figure className="m-0">
      <div className="bg-surface border border-border rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)_minmax(0,1.15fr)] shadow-2xl">
        <div className="hidden lg:flex flex-col border-r border-border">
          <div className="p-5 border-b border-border">
            <PaneLabel>Documents</PaneLabel>
          </div>
          <ul className="list-none m-0 p-5 space-y-5">
            {SAMPLE_DOCUMENTS.map((doc, index) => (
              <li key={doc.name} className="flex items-start gap-3">
                <span
                  className={`mt-1 w-2 h-2 rounded-full shrink-0 ${index === 0 ? 'bg-accent' : 'bg-control'}`}
                />
                <span className="min-w-0">
                  <span className="block font-mono text-xs text-text truncate">{doc.name}</span>
                  <span className="block text-xs text-muted mt-1">{doc.kind}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col min-w-0 lg:border-r border-border">
          <div className="p-5 border-b border-border flex items-center justify-between gap-4">
            <PaneLabel>Answer</PaneLabel>
            <span className={READY_CHIP}>Answered</span>
          </div>
          <div className="p-5 sm:p-6 space-y-5 flex-1">
            <p className="m-0 ml-auto w-fit max-w-full bg-surface-2 border border-border text-text text-sm px-4 py-2 rounded-xl">
              What was the revenue in Q4 2025?
            </p>
            <p className="m-0 font-display text-xl sm:text-2xl font-medium text-text tracking-tight">
              The revenue in Q4 2025 was $167,900.
              <span className="inline-flex align-middle ml-2 font-mono text-xs font-semibold bg-accent-soft text-accent-text px-2 py-0.5 rounded border border-accent-line">
                S1
              </span>
            </p>
            <div className="pt-4 border-t border-border space-y-2">
              <span className={READY_CHIP}>High: passed all automated checks</span>
              <p className="m-0 text-xs text-muted">
                Heuristic checks are signals, not proof. Open the source to confirm.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col min-w-0 border-t lg:border-t-0 border-border">
          <div className="p-5 border-b border-border flex items-center justify-between gap-4">
            <PaneLabel>Evidence</PaneLabel>
            <span className="font-mono text-xs text-muted truncate">text_table.pdf · p.3</span>
          </div>
          <div className="p-5 sm:p-6 dot-grid flex-1">
            <div className="bg-surface border border-border rounded-lg p-4 overflow-x-auto custom-scroll">
              <p className="m-0 mb-3 text-sm font-semibold text-text">Page 3: Quarterly Financial Table</p>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-muted">
                    {TABLE_HEADERS.map((header) => (
                      <th key={header} scope="col" className="font-medium pb-2 pr-3 align-bottom">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {TABLE_ROWS.map((row) => (
                    <tr
                      key={row[0]}
                      className={row[0] === CITED_ROW ? 'bg-accent-soft text-accent-text font-semibold' : 'text-text'}
                    >
                      {row.map((cell) => (
                        <td key={cell} className="py-2 pr-3 whitespace-nowrap border-t border-border first:pl-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="eyebrow mt-3">
        Illustration built from a real answer on the sample report. Not a live response.
      </figcaption>
    </figure>
  );
}

function FigureCard({ label, caption, children }) {
  return (
    <div className="border border-border rounded-xl p-5 bg-surface h-full flex flex-col">
      <p className="eyebrow m-0 mb-4">{label}</p>
      <div className="border border-border rounded-lg bg-bg dot-grid aspect-square flex items-center justify-center p-4">
        {children}
      </div>
      <p className="m-0 mt-4 text-sm text-muted">{caption}</p>
    </div>
  );
}

const SVG_TEXT = 'fill-muted font-mono';
const SVG_LINE = 'stroke-control';
const SVG_ACCENT = 'stroke-accent-text';

export function ReadFigure() {
  return (
    <FigureCard label="Fig 0.1 / Read" caption="Text, tables and scanned pages are extracted and numbered by page.">
      <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" className="w-full h-full">
        <rect x="35" y="15" width="130" height="170" rx="2" className={SVG_LINE} strokeWidth="0.75" />
        <path pathLength="1" d="M48 34H130" className={`draw-line ${SVG_LINE}`} strokeWidth="0.75" />
        <path pathLength="1" d="M48 44H152" className={`draw-line ${SVG_LINE}`} strokeWidth="0.75" />
        <path pathLength="1" d="M48 54H120" className={`draw-line ${SVG_LINE}`} strokeWidth="0.75" />
        <rect x="48" y="68" width="104" height="44" rx="1" className={SVG_ACCENT} strokeWidth="1" />
        <path d="M48 83H152M48 97H152M83 68V112M118 68V112" className={SVG_ACCENT} strokeWidth="0.4" />
        <path
          pathLength="1"
          d="M48 168L70 150L92 156L118 132L152 140"
          className={`draw-line ${SVG_ACCENT}`}
          strokeWidth="1"
        />
        <text x="48" y="28" fontSize="7" className={SVG_TEXT}>TEXT</text>
        <text x="48" y="124" fontSize="7" className={SVG_TEXT}>TABLE</text>
        <text x="130" y="176" fontSize="7" className={SVG_TEXT}>CHART</text>
      </svg>
    </FigureCard>
  );
}

export function RetrieveFigure() {
  return (
    <FigureCard label="Fig 0.2 / Retrieve" caption="Meaning-based and keyword search find the relevant evidence.">
      <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" className="w-full h-full">
        <path pathLength="1" d="M30 50C80 50 90 100 125 100" className={`draw-line ${SVG_ACCENT}`} strokeWidth="1" />
        <path pathLength="1" d="M30 150C80 150 90 100 125 100" className={`draw-line ${SVG_LINE}`} strokeWidth="1" />
        <circle cx="30" cy="50" r="5" className={SVG_ACCENT} strokeWidth="1" />
        <circle cx="30" cy="150" r="5" className={SVG_LINE} strokeWidth="1" />
        <circle cx="140" cy="100" r="15" className={SVG_ACCENT} strokeWidth="1" />
        <circle cx="140" cy="100" r="3" className="fill-accent-text" />
        <path pathLength="1" d="M155 100H188" className={`draw-line ${SVG_ACCENT}`} strokeWidth="1" />
        <text x="18" y="36" fontSize="7" className={SVG_TEXT}>MEANING</text>
        <text x="18" y="170" fontSize="7" className={SVG_TEXT}>KEYWORD</text>
        <text x="118" y="132" fontSize="7" className={SVG_TEXT}>EVIDENCE</text>
      </svg>
    </FigureCard>
  );
}

export function CheckFigure() {
  const rows = [
    { y: 50, label: 'CITATIONS' },
    { y: 100, label: 'NUMBERS' },
    { y: 150, label: 'COVERAGE' },
  ];
  return (
    <FigureCard label="Fig 0.3 / Check" caption="Citations and numbers are checked automatically, and calculations run in Python.">
      <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" className="w-full h-full">
        <path d="M60 25V175" className={SVG_LINE} strokeWidth="0.5" strokeDasharray="2 3" />
        {rows.map((row) => (
          <g key={row.label}>
            <rect x="46" y={row.y - 14} width="28" height="28" rx="2" className={SVG_ACCENT} strokeWidth="1" />
            <path pathLength="1" d={`M53 ${row.y}L58 ${row.y + 6}L68 ${row.y - 6}`} className={`draw-line ${SVG_ACCENT}`} strokeWidth="1.5" />
            <path d={`M74 ${row.y}H90`} className={SVG_LINE} strokeWidth="0.5" />
            <text x="94" y={row.y + 3} fontSize="8" className={SVG_TEXT}>{row.label}</text>
          </g>
        ))}
      </svg>
    </FigureCard>
  );
}

/** What each kind of page content goes through. Sourced from the backend pipeline. */
export function ContentTypesPanel() {
  const rows = [
    { type: 'Text', route: 'Extracted with PyMuPDF', icon: 'M20 18H100M20 34H150M20 50H80' },
    { type: 'Table', route: 'Stored as rows and columns', icon: 'M20 16H150V54H20ZM20 35H150M63 16V54M107 16V54' },
    { type: 'Scan', route: 'Read with Tesseract OCR', icon: 'M20 16H150V54H20ZM20 35H150' },
    { type: 'Chart', route: 'Page image sent to the vision model', icon: 'M20 52L55 30L85 40L120 16L150 26' },
  ];
  return (
    <figure className="m-0">
      <div className="relative bg-surface border border-border rounded-xl overflow-hidden p-6 sm:p-10 grid-lines">
        <CornerMarks />
        <p className="eyebrow m-0 mb-6">Page contents</p>
        <ul className="list-none m-0 p-0 space-y-3">
          {rows.map((row) => (
            <li key={row.type} className="flex items-center gap-4 p-3 bg-surface border border-border rounded-lg">
              <svg viewBox="0 0 170 70" fill="none" aria-hidden="true" className="w-16 sm:w-24 shrink-0">
                <path pathLength="1" d={row.icon} className={`draw-line ${SVG_ACCENT}`} strokeWidth="2" />
              </svg>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text">{row.type}</span>
                <span className="block text-xs text-muted mt-1">{row.route}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

/** A calculation and a flagged number from one real response on the sample report. */
export function CalculationPanel() {
  const operands = [
    { label: 'Q4 revenue', value: '167,900' },
    { label: 'Q1 revenue', value: '125,400' },
  ];
  return (
    <figure className="m-0">
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between gap-4">
          <p className="eyebrow m-0">Calculation</p>
          <span className="font-mono text-xs text-muted">Run in Python</span>
        </div>
        <div className="p-5 sm:p-8 grid-lines space-y-3">
          {operands.map((operand, index) => (
            <div key={operand.label} className="flex items-center justify-between gap-4 p-3 bg-surface border border-border rounded-lg">
              <span className="text-sm text-muted">
                {index === 1 && <span className="font-mono text-text mr-2">−</span>}
                {operand.label}
                <span className="ml-2 font-mono text-xs bg-accent-soft text-accent-text px-1 rounded border border-accent-line">
                  S2
                </span>
              </span>
              <span className="font-mono text-sm text-text">{operand.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 p-3 bg-accent-soft border border-accent-line rounded-lg">
            <span className="text-sm font-semibold text-accent-text">Result</span>
            <span className="font-mono text-base font-semibold text-accent-text">42,500 USD</span>
          </div>
        </div>
        <div className="p-5 border-t border-border space-y-2">
          <p className="eyebrow m-0">Numbers found in cited evidence</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${CHIP} bg-chip-caution-bg text-chip-caution-text`}>Not found</span>
            <span className="font-mono text-xs text-text">33.9%</span>
          </div>
          <p className="m-0 text-xs text-muted">
            The model wrote this percentage itself, so the check flagged it.
          </p>
        </div>
      </div>
      <figcaption className="eyebrow mt-3">Illustration built from a real response. Not a live response.</figcaption>
    </figure>
  );
}
