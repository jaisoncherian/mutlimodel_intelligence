import React from 'react';
import { humanizeName } from '../../utils/answerText.js';

const CHECK_LABELS = {
  citation_validity: 'Citations point to sources sent to the model',
  number_grounding: 'Numbers found in cited evidence',
  answer_coverage: 'Answer sentences covered by cited statements',
  claim_support: 'Statements overlap their cited text',
};

const SUPPORT_LABELS = {
  supported: 'Supported',
  weak: 'Weak',
  unsupported: 'Unsupported',
  visual_unverifiable: 'Image only, no text check',
};

/** The parts of a check's `details` worth reading. `details.note` is deliberately skipped. */
function CheckFindings({ details }) {
  if (!details) return null;
  if (details.error) return <p className="text-xs text-muted">This check could not run.</p>;

  const numbers = details.numbers || [];
  const unmatched = numbers.filter((n) => !n.ok && !n.ignored_reason && !n.approximate);
  const approximate = numbers.filter((n) => n.approximate);
  const invalidIds = details.invalid_ids || [];
  const uncitedClaims = details.claims_without_valid_citation || [];
  const uncovered = details.uncovered_sentences || [];
  const claims = details.claims || [];

  return (
    <>
      {unmatched.length > 0 && (
        <p className="text-xs text-muted">
          Not found: <span className="font-mono">{unmatched.map((n) => n.text).join(', ')}</span>
        </p>
      )}
      {approximate.length > 0 && (
        <p className="text-xs text-muted">
          Approximate, read from an image:{' '}
          <span className="font-mono">{approximate.map((n) => n.text).join(', ')}</span>
        </p>
      )}
      {invalidIds.length > 0 && (
        <p className="text-xs text-muted">
          Unknown sources: <span className="font-mono">{invalidIds.join(', ')}</span>
        </p>
      )}
      {uncitedClaims.length > 0 && (
        <p className="text-xs text-muted">
          {uncitedClaims.length} {uncitedClaims.length === 1 ? 'statement has' : 'statements have'} no valid
          citation.
        </p>
      )}
      {uncovered.length > 0 && (
        <p className="text-xs text-muted">
          {uncovered.length} {uncovered.length === 1 ? 'sentence is' : 'sentences are'} not covered.
        </p>
      )}
      {claims.length > 0 && (
        <ul className="space-y-2">
          {claims.map((claim, index) => (
            <li key={index} className="text-xs text-muted">
              <span>{claim.text}</span>{' '}
              <span className="font-medium text-text">
                {SUPPORT_LABELS[claim.support] || humanizeName(claim.support)}
              </span>
              {claim.method !== 'none' && typeof claim.overlap === 'number' && (
                <span>
                  , word overlap <span className="font-mono">{claim.overlap.toFixed(2)}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CheckGroup({ title, tag, testId, checks }) {
  return (
    <section data-testid={testId} className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="text-xs font-semibold text-text">{title}</h4>
        <span className="px-2 py-0.5 rounded-full text-xs bg-chip-neutral-bg text-chip-neutral-text border border-border">
          {tag}
        </span>
      </div>
      <ul className="space-y-2">
        {checks.map((check) => (
          <li key={check.name} className="space-y-1">
            <div className="flex items-start justify-between gap-4 text-xs">
              <span className="text-text">{CHECK_LABELS[check.name] || humanizeName(check.name)}</span>
              <span
                className={`shrink-0 font-medium ${
                  check.passed ? 'text-chip-ready-text' : 'text-chip-caution-text'
                }`}
              >
                {check.details?.error ? 'did not run' : check.passed ? 'passed' : 'not passed'}
              </span>
            </div>
            <CheckFindings details={check.details} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The automated checks for one answer, always from the real verification object.
 * Exact checks and fallible heuristic signals are kept in separate groups.
 *
 * @param {Object} props
 * @param {import('../../api/types.js').VerificationPayload} props.verification
 */
export default function VerificationDetails({ verification }) {
  if (verification.state === 'error' || verification.confidence === 'unverified') {
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-4 text-xs text-muted">
        Checks unavailable
      </div>
    );
  }

  const checks = verification.checks || [];
  const exact = checks.filter((c) => c.kind === 'deterministic');
  const heuristic = checks.filter((c) => c.kind === 'heuristic');
  const other = checks.filter((c) => c.kind !== 'deterministic' && c.kind !== 'heuristic');

  return (
    <details className="rounded-lg border border-border bg-surface-2">
      <summary className="px-4 py-2 text-xs font-semibold text-text cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-accent">
        Check details
      </summary>
      <div className="px-4 pb-4 space-y-4">
        {checks.length === 0 && <p className="text-xs text-muted">No checks ran for this answer.</p>}
        {exact.length > 0 && (
          <CheckGroup title="Exact checks" tag="deterministic" testId="checks-exact" checks={exact} />
        )}
        {heuristic.length > 0 && (
          <CheckGroup title="Signals" tag="heuristic, can be wrong" testId="checks-heuristic" checks={heuristic} />
        )}
        {other.length > 0 && <CheckGroup title="Other checks" tag="unclassified" testId="checks-other" checks={other} />}
        {heuristic.length > 0 && (
          <p className="text-xs text-muted">
            Heuristic checks are signals, not proof. Open the source to confirm.
          </p>
        )}
      </div>
    </details>
  );
}
