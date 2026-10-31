/**
 * @file Pure helpers that turn a real /ask response into what the answer card shows.
 */

const SOURCE_ID = '(?:S|IMG)\\d+';
const SEPARATOR = '\\s*(?:,|;|&|\\band\\b)\\s*';
const ID_LIST = `${SOURCE_ID}(?:${SEPARATOR}${SOURCE_ID})*`;

// The backend writes [S1] when it rebuilds an answer (verification.py:_rebuild_answer),
// and the model writes its own citations as (S1, S3) in real responses. Both are markers.
const MARKER_GROUP = new RegExp(`\\[\\s*${ID_LIST}\\s*\\]|\\(\\s*${ID_LIST}\\s*\\)`, 'g');
const ONE_ID = new RegExp(SOURCE_ID, 'g');

/**
 * @typedef {{type: 'text', text: string}
 *   | {type: 'citation', sourceId: string, citation: import('../api/types.js').AskCitation}} TextSegment
 */

/**
 * Splits text into plain runs and citation chips. A marker becomes a chip only
 * when its id matches a citation in the response; anything else stays plain text.
 *
 * @param {string|null|undefined} text
 * @param {Array<import('../api/types.js').AskCitation>} [citations]
 * @returns {TextSegment[]}
 */
export function parseCitationMarkers(text, citations = []) {
  if (!text) return [];
  const byId = new Map(citations.map((c) => [c.source_id, c]));
  const segments = [];

  const pushText = (value) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last?.type === 'text') last.text += value;
    else segments.push({ type: 'text', text: value });
  };

  let cursor = 0;
  for (const match of text.matchAll(MARKER_GROUP)) {
    const group = match[0];
    pushText(text.slice(cursor, match.index));
    cursor = match.index + group.length;

    const ids = group.match(ONE_ID);
    if (!ids.some((id) => byId.has(id))) {
      pushText(group);
      continue;
    }
    ids.forEach((id, index) => {
      if (byId.has(id)) {
        segments.push({ type: 'citation', sourceId: id, citation: byId.get(id) });
      } else {
        pushText(`${index > 0 ? ' ' : ''}[${id}]`);
      }
    });
  }
  pushText(text.slice(cursor));
  return segments;
}

/**
 * Fixed sentences written by the backend that use wording the UI must not show.
 * Only these exact strings are rewritten. Model text is left as the model wrote it.
 */
const BACKEND_WORDING = [
  // backend/app/services/verification.py
  [
    'Some statements could not be verified against the sources.',
    'Some statements did not pass the automated checks against the sources.',
  ],
  [
    'The answer could not be verified against the sources.',
    'The answer did not pass the automated checks against the sources.',
  ],
  [
    'The answer could not be verified. Please try again.',
    'The automated checks could not run on this answer. Please try again.',
  ],
  ['All claims were removed during verification.', 'All statements were removed by the automated checks.'],
  ['Verification error.', 'The automated checks could not run.'],
  // backend/app/services/calculator.py
  ['also verified in a text or table source.', 'also found in a text or table source.'],
];

/**
 * @param {string|null|undefined} text
 * @returns {string}
 */
export function cleanBackendWording(text) {
  if (!text) return '';
  return BACKEND_WORDING.reduce((out, [from, to]) => out.split(from).join(to), text);
}

const RELIABILITY = {
  high: { label: 'High: passed all automated checks', tone: 'ready' },
  medium: { label: 'Medium: some checks are weak', tone: 'caution' },
  low: { label: 'Low: parts were removed', tone: 'caution' },
  unchecked: { label: 'Unchecked', tone: 'neutral' },
  unverified: { label: 'Checks unavailable', tone: 'neutral' },
};

/**
 * Reliability badge for an answer, from verification.confidence only. Returns null
 * when there is nothing to rate:
 *  - the no-evidence paths in answering.py send no verification object at all;
 *  - the backend reports "high" on an empty refusal because zero claims trivially
 *    pass. A "High" badge on "not enough evidence" would rate an answer that does
 *    not exist.
 *
 * @param {import('../api/types.js').VerificationPayload|null|undefined} verification
 * @param {string} [status]
 * @returns {{label: string, tone: 'ready'|'caution'|'neutral'}|null}
 */
export function getReliability(verification, status) {
  if (!verification) return null;
  if (verification.state === 'error') return RELIABILITY.unverified;
  const noClaims = !verification.claims || verification.claims.length === 0;
  if (status === 'insufficient_evidence' && verification.confidence === 'high' && noClaims) {
    return null;
  }
  return RELIABILITY[verification.confidence] || null;
}

const STATUS = {
  answered: { label: 'Answered', tone: 'ready' },
  partial: { label: 'Partial', tone: 'caution' },
  insufficient_evidence: { label: 'Not enough evidence', tone: 'neutral' },
};

/**
 * @param {string} status
 * @returns {{label: string, tone: 'ready'|'caution'|'neutral'}}
 */
export function getStatusBadge(status) {
  return STATUS[status] || { label: String(status), tone: 'neutral' };
}

/**
 * "percent_change" -> "Percent change", "Q1_revenue" -> "Q1 revenue".
 * @param {string} name
 * @returns {string}
 */
export function humanizeName(name) {
  const spaced = String(name ?? '').replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Server time for an answer. answering.py's total_ms stops before the verification
 * pass, so the verification total is added. Null when the response has no total
 * (the no-evidence path only records retrieval_ms).
 *
 * @param {import('../api/types.js').AskResponse} response
 * @returns {string|null}
 */
export function formatLatency(response) {
  const answering = response?.timings_ms?.total_ms;
  if (typeof answering !== 'number') return null;
  const checks = response?.verification?.timings_ms?.total_ms;
  const totalMs = answering + (typeof checks === 'number' ? checks : 0);
  return `${(totalMs / 1000).toFixed(1)} s`;
}
