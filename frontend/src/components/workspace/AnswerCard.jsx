import React, { useState } from 'react';
import CitationChip from './CitationChip.jsx';
import VerificationDetails from './VerificationDetails.jsx';

/**
 * @param {Object} props
 * @param {string} [props.status] - "answered" | "partial" | "insufficient_evidence"
 * @param {string} [props.confidence] - "high" | "medium" | "low" | "unchecked" | "unverified"
 * @param {string} [props.answerText]
 * @param {string} [props.latencyText] - e.g. "7.4 s"
 * @param {Array<{ label: string, onClick?: () => void }>} [props.sources]
 * @param {Array<any>} [props.calculations]
 * @param {(sourceId: string) => void} [props.onCitationClick]
 */
export default function AnswerCard({
  status = 'answered',
  confidence = 'high',
  answerText,
  latencyText = '7.4 s',
  sources,
  _calculations,
  onCitationClick,
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);

  const getReliabilityLabel = (conf) => {
    switch (conf) {
      case 'high':
        return 'High: passed all automated checks';
      case 'medium':
        return 'Medium: some checks are weak';
      case 'low':
        return 'Low: parts were removed';
      case 'unchecked':
        return 'Unchecked';
      case 'unverified':
      default:
        return 'Checks unavailable';
    }
  };

  const defaultAnswer =
    answerText ||
    'Revenue grew by 33.89% from Q1 2025 (125,400 USD) to Q4 2025 (167,900 USD) [S1]. Q4 2025 was also the highest-revenue quarter [S1].';

  const handleCopy = () => {
    navigator.clipboard.writeText(defaultAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const defaultSources = sources || [
    { label: 'text_table.pdf · p.3 · table', id: 'S1', active: true },
    { label: 'text_table.pdf · p.3 · text', id: 'S2', active: false },
  ];

  return (
    <div className="w-full bg-surface rounded-[12px] border border-bordercol p-5 space-y-4 shadow-sm transition-colors">
      {/* Top Row of Chips */}
      <div className="flex items-center justify-between border-b border-bordercol pb-3 flex-wrap gap-2">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          {status === 'insufficient_evidence' ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-chipNeutralBg text-chipNeutralText border border-bordercol">
              Not enough evidence
            </span>
          ) : status === 'partial' ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-chipCautionBg text-chipCautionText border border-yellow-500/20">
              Partial
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-chipReadyBg text-chipReadyText border border-green-500/20">
              Answered
            </span>
          )}

          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1 border ${
              confidence === 'high'
                ? 'bg-chipReadyBg text-chipReadyText border-green-500/20'
                : confidence === 'medium'
                ? 'bg-chipCautionBg text-chipCautionText border-yellow-500/20'
                : 'bg-chipNeutralBg text-chipNeutralText border-bordercol'
            }`}
          >
            {confidence === 'high' && (
              <svg
                className="w-3 h-3 text-chipReadyText"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span>{getReliabilityLabel(confidence)}</span>
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              aria-label="Verification info"
              className="w-5 h-5 rounded-full border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-textSecondary focus:outline-none focus:ring-2 focus:ring-brand flex items-center justify-center text-[11px] font-serif transition-colors cursor-pointer"
              title="Verification check details"
            >
              i
            </button>
            {showInfo && (
              <div className="absolute left-0 mt-2 w-64 p-3 bg-surface border border-bordercol rounded-xl shadow-lg text-[11px] text-textSecondary z-20">
                <p className="font-semibold text-textPrimary mb-1">Automated Checks</p>
                <p>
                  Deterministic checks inspect citations and numbers. Heuristic checks inspect claim
                  support.
                </p>
              </div>
            )}
          </div>
        </div>

        {latencyText && (
          <div className="font-mono text-xs text-textSecondary">{latencyText}</div>
        )}
      </div>

      {/* Answer Text with Citation Chips */}
      <div className="text-sm text-textPrimary leading-relaxed">
        Revenue grew by{' '}
        <span className="font-mono font-bold text-textPrimary">33.89%</span> from Q1 2025 (125,400 USD)
        to Q4 2025 (167,900 USD){' '}
        <CitationChip sourceId="S1" onClick={() => onCitationClick && onCitationClick('S1')} />. Q4
        2025 was also the highest-revenue quarter{' '}
        <CitationChip sourceId="S1" onClick={() => onCitationClick && onCitationClick('S1')} />.
      </div>

      {/* Sources Row */}
      <div className="flex items-center space-x-2 pt-1 flex-wrap gap-y-1">
        <span className="text-xs font-medium text-textSecondary">Sources:</span>
        {defaultSources.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onCitationClick && onCitationClick(s.id || 'S1')}
            className={`font-mono text-xs font-medium px-2.5 py-1 rounded-[6px] transition-colors flex items-center space-x-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand ${
              s.active
                ? 'text-brand bg-brandLight border border-brandBorder'
                : 'text-textSecondary bg-surface border border-bordercol hover:bg-surfaceSubtle'
            }`}
          >
            <svg
              className={`w-3.5 h-3.5 ${s.active ? 'text-brand' : 'text-textSecondary'}`}
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
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* CALCULATION Box */}
      <div className="rounded-[8px] border border-bordercol bg-surfaceSecondary p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-brand uppercase font-sans">
            CALCULATION
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-bordercol rounded bg-surface overflow-hidden">
            <thead className="bg-surfaceSubtle text-textSecondary font-semibold border-b border-bordercol">
              <tr>
                <th className="py-1.5 px-3">Operation</th>
                <th className="py-1.5 px-3">Operands</th>
                <th className="py-1.5 px-3">Result</th>
              </tr>
            </thead>
            <tbody className="font-mono divide-y divide-bordercol text-textPrimary">
              <tr>
                <td className="py-1.5 px-3 font-sans text-xs">Percent change</td>
                <td className="py-1.5 px-3 text-xs">
                  Q1: 125,400{' '}
                  <span className="text-brand font-semibold">
                    <CitationChip sourceId="S1" onClick={() => onCitationClick && onCitationClick('S1')} />
                  </span>{' '}
                  → Q4: 167,900{' '}
                  <span className="text-brand font-semibold">
                    <CitationChip sourceId="S1" onClick={() => onCitationClick && onCitationClick('S1')} />
                  </span>
                </td>
                <td className="py-1.5 px-3 font-bold text-xs text-textPrimary">33.89%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-textSecondary">
          Computed by code, not by the language model.
        </p>
      </div>

      {/* Verification Details */}
      <VerificationDetails />

      {/* Copy button */}
      <div className="pt-1 flex justify-start">
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy answer to clipboard"
          className="h-8 px-3 rounded-[6px] border border-bordercol hover:border-borderSubtle bg-surface text-textSecondary hover:text-textPrimary text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
            />
          </svg>
          <span>{copied ? 'Copied!' : 'Copy answer'}</span>
        </button>
      </div>
    </div>
  );
}
