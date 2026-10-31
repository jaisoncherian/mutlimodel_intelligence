/**
 * @file Converts stored rows from GET /conversations/<id>/messages into the shape
 * the live /ask response uses, so AnswerCard renders both.
 *
 * What the API stores differs from what /ask returns:
 *  - citations use page_number (live: page) and have no source_id or also_in;
 *  - status is at verification.answering.status, checks at verification.verification;
 *  - missing, calculations, rejected_calculations and unverified_numbers are not
 *    stored, and timings have no total_ms.
 */

const CLAIM_TEXT_COMPARE_CHARS = 200;

function sourceSortKey(id) {
  const isImage = id.startsWith('IMG');
  return [isImage ? 1 : 0, Number(id.slice(isImage ? 3 : 1)) || 0];
}

/**
 * Recovers each stored citation's source id, only when it can be proven.
 *
 * answering.py inserts citations sorted by source id, built from the sources of the
 * surviving claims plus any calculation operands. Calculations are not stored, so an
 * extra source would make the counts differ. When the counts match, the two lists
 * hold the same ids in the same order. Otherwise this returns null rather than guess,
 * because a wrong guess would open the wrong page.
 *
 * @param {Array<import('../api/types.js').StoredCitation>} citations
 * @param {import('../api/types.js').VerificationPayload|undefined} verification
 * @returns {string[]|null}
 */
export function recoverSourceIds(citations, verification) {
  const claims = verification?.claims;
  if (!claims?.length || citations.length === 0) return null;

  const removed = new Set((verification.removed_claims || []).map((c) => c.text));
  const ids = new Set();
  claims
    .filter((claim) => !removed.has(claim.text.slice(0, CLAIM_TEXT_COMPARE_CHARS)))
    .forEach((claim) => claim.sources.forEach((source) => ids.add(source)));

  const sorted = [...ids].sort((a, b) => {
    const [groupA, numberA] = sourceSortKey(a);
    const [groupB, numberB] = sourceSortKey(b);
    return groupA - groupB || numberA - numberB;
  });
  if (sorted.length !== citations.length) return null;

  const typesAgree = sorted.every(
    (id, index) => id.startsWith('IMG') === (citations[index].content_type === 'image')
  );
  return typesAgree ? sorted : null;
}

/**
 * @param {import('../api/types.js').StoredMessage} row
 * @returns {import('../api/types.js').AskResponse & {stored: true}}
 */
function storedAnswerToResponse(row) {
  const stored = row.verification || {};
  const verification = stored.verification?.confidence ? stored.verification : undefined;
  const citations = row.citations || [];
  const sourceIds = recoverSourceIds(citations, verification);

  return {
    stored: true,
    conversation_id: row.conversation_id,
    message_id: row.id,
    status: stored.answering?.status,
    answer: row.content,
    missing: null,
    citations: citations.map((citation, index) => ({
      citation_id: citation.id,
      source_id: sourceIds ? sourceIds[index] : null,
      doc_id: citation.doc_id,
      filename: citation.filename,
      also_in: [],
      page: citation.page_number,
      section: citation.section,
      content_type: citation.content_type,
      snippet: citation.snippet,
    })),
    calculations: [],
    rejected_calculations: [],
    used_vision: Boolean(row.used_vision),
    timings_ms: stored.answering?.timings_ms,
    verification,
  };
}

/**
 * @param {Array<import('../api/types.js').StoredMessage>} rows
 * @returns {Array<import('../hooks/useChat.js').ChatEntry>}
 */
export function storedRowsToEntries(rows) {
  return rows.map((row) =>
    row.role === 'user'
      ? { id: `stored-${row.id}`, role: 'user', content: row.content }
      : { id: `stored-${row.id}`, role: 'assistant', response: storedAnswerToResponse(row) }
  );
}
