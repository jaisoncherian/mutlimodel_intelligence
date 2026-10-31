import React, { useEffect, useRef, useState } from 'react';
import CitationChip from './CitationChip.jsx';
import VerificationDetails from './VerificationDetails.jsx';
import {
  cleanBackendWording,
  formatLatency,
  getReliability,
  getStatusBadge,
  humanizeName,
  parseCitationMarkers,
} from '../../utils/answerText.js';

const TONE_CLASSES = {
  ready: 'bg-chip-ready-bg text-chip-ready-text',
  caution: 'bg-chip-caution-bg text-chip-caution-text',
  neutral: 'bg-chip-neutral-bg text-chip-neutral-text',
};

function Badge({ tone, testId, children }) {
  return (
    <span
      data-testid={testId}
      data-tone={tone}
      className={`px-2 py-0.5 rounded-full text-xs font-semibold border border-border ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Text with its [S1] and (S1, S3) markers shown as chips. */
function CitedText({ text, citations, onCitationClick }) {
  return parseCitationMarkers(text, citations).map((segment, index) =>
    segment.type === 'text' ? (
      <React.Fragment key={index}>{segment.text}</React.Fragment>
    ) : (
      <CitationChip
        key={index}
        sourceId={segment.sourceId}
        onClick={() => onCitationClick?.(segment.citation)}
      />
    )
  );
}

function SourcesRow({ citations, onCitationClick }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-muted">Sources:</span>
      {citations.map((citation) => {
        const details = [`p.${citation.page}`, citation.content_type].filter(Boolean).join(' · ');
        return (
          <button
            key={citation.source_id || citation.citation_id}
            type="button"
            onClick={() => onCitationClick?.(citation)}
            title={citation.filename}
            aria-label={`Open source ${citation.source_id ? `${citation.source_id}: ` : ''}${citation.filename}, page ${citation.page}`}
            className="max-w-full h-9 flex items-center gap-2 font-mono text-xs font-medium px-2 rounded-lg border border-border bg-surface text-muted hover:bg-surface-2 hover:text-text transition-colors cursor-pointer"
          >
            {citation.source_id && (
              <span className="text-accent-text shrink-0">[{citation.source_id}]</span>
            )}
            <span className="truncate max-w-[220px]">{citation.filename}</span>
            <span className="shrink-0">· {details}</span>
          </button>
        );
      })}
    </div>
  );
}

function CalculationsBlock({ calculations, citations, onCitationClick }) {
  const citationFor = (sourceId) => citations.find((c) => c.source_id === sourceId);

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4 space-y-2">
      <span className="block text-xs font-semibold text-text">Calculations</span>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border border-border bg-surface">
          <thead className="bg-surface-2 text-muted font-semibold border-b border-border">
            <tr>
              <th scope="col" className="py-2 px-4">Operation</th>
              <th scope="col" className="py-2 px-4">Operands</th>
              <th scope="col" className="py-2 px-4">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-text">
            {calculations.map((calculation) => (
              <tr key={calculation.id}>
                <td className="py-2 px-4 align-top">{humanizeName(calculation.operation)}</td>
                <td className="py-2 px-4 align-top">
                  <ul className="space-y-1">
                    {calculation.operands.map((operand, index) => {
                      const citation = citationFor(operand.source);
                      return (
                        <li key={index}>
                          {humanizeName(operand.label)}:{' '}
                          <span className="font-mono">{operand.value_text}</span>{' '}
                          {citation ? (
                            <CitationChip
                              sourceId={operand.source}
                              onClick={() => onCitationClick?.(citation)}
                            />
                          ) : (
                            <span className="font-mono text-muted">{operand.source}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </td>
                <td data-testid="calculation-result" className="py-2 px-4 align-top font-mono font-bold">
                  {calculation.formatted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Computed by code, not by the language model.</p>
    </div>
  );
}

function RejectedCalculations({ rejected }) {
  return (
    <div className="rounded-lg border border-border bg-chip-caution-bg text-chip-caution-text p-4 space-y-2">
      <p className="text-xs font-semibold">Calculations not used</p>
      <ul className="space-y-1 text-xs">
        {rejected.map((item) => (
          <li key={item.id}>
            <span className="font-semibold">{humanizeName(item.operation)}:</span>{' '}
            {cleanBackendWording(item.reason)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Warnings({ unmatchedNumbers, removedClaims, uncoveredSentences }) {
  return (
    <div className="rounded-lg border border-border bg-chip-caution-bg text-chip-caution-text p-4 space-y-2 text-xs">
      <p className="font-semibold">Warnings</p>
      {unmatchedNumbers.length > 0 && (
        <p>
          Numbers not found in the sources or calculations:{' '}
          <span className="font-mono">{unmatchedNumbers.join(', ')}</span>
        </p>
      )}
      {removedClaims.length > 0 && (
        <div>
          <p>Removed by the automated checks:</p>
          <ul className="list-disc pl-4">
            {removedClaims.map((claim, index) => (
              <li key={index}>{claim.text}</li>
            ))}
          </ul>
        </div>
      )}
      {uncoveredSentences.length > 0 && (
        <div>
          <p>Sentences not covered by a cited statement:</p>
          <ul className="list-disc pl-4">
            {uncoveredSentences.map((sentence, index) => (
              <li key={index}>{sentence}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * One answer, rendered only from a real /ask response or a stored message
 * converted to the same shape (utils/storedMessages.js).
 *
 * @param {Object} props
 * @param {import('../../api/types.js').AskResponse & {stored?: boolean}} props.response
 * @param {(citation: import('../../api/types.js').AskCitation) => void} [props.onCitationClick]
 */
export default function AnswerCard({ response, onCitationClick }) {
  const {
    stored = false,
    status,
    answer,
    missing,
    citations = [],
    calculations = [],
    rejected_calculations: rejected = [],
    used_vision: usedVision = false,
    unverified_numbers: unmatchedNumbers = [],
    verification,
  } = response;

  const [copyState, setCopyState] = useState('idle');
  const copyTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const answerText = cleanBackendWording(answer);
  const missingText = cleanBackendWording(missing);
  const statusBadge = status ? getStatusBadge(status) : null;
  const reliability = getReliability(verification, status);
  const latency = formatLatency(response);
  const removedClaims = verification?.removed_claims || [];
  const uncoveredSentences = verification?.uncovered_sentences || [];
  const hasWarnings =
    unmatchedNumbers.length > 0 || removedClaims.length > 0 || uncoveredSentences.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answerText);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyState('idle'), 2000);
  };

  return (
    <article
      aria-label="Answer"
      className="w-full bg-surface rounded-xl border border-border p-6 space-y-4 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {statusBadge && (
            <Badge tone={statusBadge.tone} testId="status-badge">{statusBadge.label}</Badge>
          )}
          {reliability && (
            <Badge tone={reliability.tone} testId="reliability-badge">{reliability.label}</Badge>
          )}
        </div>
        {latency && (
          <span data-testid="latency" title="Server time for this answer" className="font-mono text-xs text-muted">
            {latency}
          </span>
        )}
      </div>

      {answerText && (
        <p data-testid="answer-text" className="text-sm text-text leading-relaxed whitespace-pre-wrap break-words">
          <CitedText text={answerText} citations={citations} onCitationClick={onCitationClick} />
        </p>
      )}

      {stored && !answerText && (
        <p className="text-sm text-muted">No answer text was saved for this question.</p>
      )}

      {status !== 'answered' && missingText && (
        <div className="rounded-lg border border-border bg-surface-2 p-4 space-y-1">
          <p className="text-xs font-semibold text-text">What is missing</p>
          <p data-testid="missing-text" className="text-sm text-muted leading-relaxed whitespace-pre-wrap break-words">
            <CitedText text={missingText} citations={citations} onCitationClick={onCitationClick} />
          </p>
        </div>
      )}

      {citations.length > 0 && <SourcesRow citations={citations} onCitationClick={onCitationClick} />}

      {/* Deleting a document also deletes its citations (database/schema.sql). */}
      {stored && answerText && citations.length === 0 && status !== 'insufficient_evidence' && (
        <p className="text-xs text-muted">
          Sources for this saved answer are no longer available. The documents may have been deleted.
        </p>
      )}

      {usedVision && (
        <div className="rounded-lg border border-border bg-surface-2 p-4 text-xs">
          <p className="font-semibold text-text">Analyzed page image</p>
          <p className="text-muted">Values read from charts are approximate.</p>
        </div>
      )}

      {calculations.length > 0 && (
        <CalculationsBlock
          calculations={calculations}
          citations={citations}
          onCitationClick={onCitationClick}
        />
      )}

      {rejected.length > 0 && <RejectedCalculations rejected={rejected} />}

      {hasWarnings && (
        <Warnings
          unmatchedNumbers={unmatchedNumbers}
          removedClaims={removedClaims}
          uncoveredSentences={uncoveredSentences}
        />
      )}

      {/* No badge means nothing was rated, so there are no details to show either. */}
      {reliability && <VerificationDetails verification={verification} />}

      {answerText && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy answer to clipboard"
            className="h-9 px-4 rounded-lg border border-border bg-surface text-muted hover:text-text hover:bg-surface-2 text-xs font-medium flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <span>
              {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy answer'}
            </span>
          </button>
        </div>
      )}
    </article>
  );
}
