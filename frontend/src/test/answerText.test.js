import { describe, it, expect } from 'vitest';
import {
  cleanBackendWording,
  formatLatency,
  getReliability,
  humanizeName,
  parseCitationMarkers,
} from '../utils/answerText.js';
import answered from './fixtures/ask_answered.json';
import partial from './fixtures/ask_partial.json';
import calculationRemoved from './fixtures/ask_calculation_removed.json';
import noEvidence from './fixtures/ask_no_evidence.json';
import insufficient from './fixtures/ask_insufficient_evidence.json';

const S1 = { source_id: 'S1' };
const S3 = { source_id: 'S3' };
const IMG1 = { source_id: 'IMG1' };

/** Compact view of the segments: chips as {S1}, text as itself. */
const flatten = (segments) =>
  segments.map((s) => (s.type === 'citation' ? `{${s.sourceId}}` : s.text)).join('');

describe('parseCitationMarkers', () => {
  it('turns a [S#] marker into a chip that holds the matching citation', () => {
    const segments = parseCitationMarkers('Revenue rose [S1].', [S1]);
    expect(flatten(segments)).toBe('Revenue rose {S1}.');
    expect(segments[1].citation).toBe(S1);
  });

  it('handles [IMG#] markers', () => {
    expect(flatten(parseCitationMarkers('See the chart [IMG1].', [IMG1]))).toBe('See the chart {IMG1}.');
  });

  it('handles the "(S1, S3)" form the model writes in real answers', () => {
    const { answer, citations } = partial;
    expect(answer).toContain('(S1, S3)');
    expect(flatten(parseCitationMarkers(answer, citations))).toBe(
      'The revenue in Q1 2025 was $125,400 {S1}{S3}.'
    );
  });

  it('handles the "[S1] [S3]" form the backend writes when it rebuilds an answer', () => {
    const { answer, citations } = calculationRemoved;
    expect(flatten(parseCitationMarkers(answer, citations))).toBe(
      'Q4 2025 revenue was $167,900 and Q1 2025 revenue was $125,400. {S1} {S3} Revenue increased from Q1 to Q4. {S2}'
    );
  });

  it('leaves an unknown marker as plain text', () => {
    const segments = parseCitationMarkers('Unknown [S9] and (IMG4) here.', [S1]);
    expect(segments).toEqual([{ type: 'text', text: 'Unknown [S9] and (IMG4) here.' }]);
  });

  it('makes a chip only for the known ids in a mixed group', () => {
    expect(flatten(parseCitationMarkers('Mixed (S1, S9, S3).', [S1, S3]))).toBe('Mixed {S1} [S9]{S3}.');
  });

  it('does not treat ordinary brackets or words as markers', () => {
    const text = 'Plant S1 (see notes) [draft] S1 alone.';
    expect(parseCitationMarkers(text, [S1])).toEqual([{ type: 'text', text }]);
  });

  it('returns nothing for empty text', () => {
    expect(parseCitationMarkers('', [S1])).toEqual([]);
    expect(parseCitationMarkers(null, [S1])).toEqual([]);
  });
});

describe('getReliability', () => {
  const withConfidence = (confidence) => ({ ...answered.verification, confidence });

  it.each([
    ['high', 'High: passed all automated checks', 'ready'],
    ['medium', 'Medium: some checks are weak', 'caution'],
    ['low', 'Low: parts were removed', 'caution'],
    ['unchecked', 'Unchecked', 'neutral'],
    ['unverified', 'Checks unavailable', 'neutral'],
  ])('maps %s to its label', (confidence, label, tone) => {
    expect(getReliability(withConfidence(confidence), 'answered')).toEqual({ label, tone });
  });

  it('shows "Checks unavailable" for state=error whatever the confidence says', () => {
    const verification = { ...answered.verification, state: 'error', confidence: 'high' };
    expect(getReliability(verification, 'answered').label).toBe('Checks unavailable');
  });

  it('shows nothing when the response has no verification object', () => {
    expect(noEvidence.verification).toBeUndefined();
    expect(getReliability(noEvidence.verification, noEvidence.status)).toBeNull();
  });

  it('does not rate an empty refusal as High', () => {
    expect(insufficient.verification.confidence).toBe('high');
    expect(insufficient.verification.claims).toEqual([]);
    expect(getReliability(insufficient.verification, insufficient.status)).toBeNull();
  });

  it('still rates a refusal when its claims were checked and removed', () => {
    const verification = { ...insufficient.verification, confidence: 'low' };
    expect(getReliability(verification, 'insufficient_evidence').label).toBe('Low: parts were removed');
  });
});

describe('cleanBackendWording', () => {
  it('rewrites the fixed backend sentence seen in a real response', () => {
    expect(calculationRemoved.missing).toContain('verified');
    expect(cleanBackendWording(calculationRemoved.missing)).toBe(
      'Some statements did not pass the automated checks against the sources.'
    );
  });

  it('rewrites the calculator rejection sentence inside a longer reason', () => {
    const reason =
      "Operand '12' cited chart/image source 'IMG1'. Values read from a chart cannot be used in calculations unless also verified in a text or table source.";
    expect(cleanBackendWording(reason)).toContain('also found in a text or table source.');
  });

  it('leaves model text alone', () => {
    const modelText = 'The auditor verified the figures.';
    expect(cleanBackendWording(modelText)).toBe(modelText);
  });
});

describe('formatting helpers', () => {
  it('humanizes operation and operand names', () => {
    expect(humanizeName('percent_change')).toBe('Percent change');
    expect(humanizeName('Q4_revenue')).toBe('Q4 revenue');
  });

  it('adds verification time to the answering total', () => {
    const totalMs = answered.timings_ms.total_ms + answered.verification.timings_ms.total_ms;
    expect(formatLatency(answered)).toBe(`${(totalMs / 1000).toFixed(1)} s`);
  });

  it('shows no latency when the response has no total', () => {
    expect(noEvidence.timings_ms.total_ms).toBeUndefined();
    expect(formatLatency(noEvidence)).toBeNull();
  });
});
