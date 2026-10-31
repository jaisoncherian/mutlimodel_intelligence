import React from 'react';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { act, render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Workspace from '../components/Workspace.jsx';
import { recoverSourceIds, storedRowsToEntries } from '../utils/storedMessages.js';
import answered from './fixtures/ask_answered.json';
import calculationRemoved from './fixtures/ask_calculation_removed.json';
import noEvidence from './fixtures/ask_no_evidence.json';
import pageFixture from './fixtures/document_page.json';
import pageImage from './fixtures/page_image.json';
import conversationsFixture from './fixtures/conversations.json';
import storedInsufficient from './fixtures/conversation_messages.json';
import storedCalc from './fixtures/conversation_messages_calc.json';
import storedNoEvidence from './fixtures/conversation_messages_no_evidence.json';

const DOC_ID = answered.citations[0].doc_id;
const PAGE_COUNT = 5;
const documentsReply = [
  { id: DOC_ID, filename: answered.citations[0].filename, status: 'ready', page_count: PAGE_COUNT, chunk_count: 7, uploaded_at: '2026-10-21T12:48:41.685556Z' },
];

let imageCalls = [];
let imageReplies = [];
let pageReply = () => HttpResponse.json(pageFixture);
let deleted = [];
let messagesFor = {};

const server = setupServer(
  http.get('/api/documents', () => HttpResponse.json(documentsReply)),
  http.get('/api/conversations', () =>
    HttpResponse.json(conversationsFixture.filter((c) => !deleted.includes(c.id)))
  ),
  http.get('/api/conversations/:id/messages', ({ params }) => {
    const rows = messagesFor[params.id];
    return rows ? HttpResponse.json(rows) : HttpResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }),
  http.delete('/api/conversations/:id', ({ params }) => {
    deleted.push(params.id);
    return HttpResponse.json({ deleted: true });
  }),
  http.get('/api/documents/:id/pages/:page', () => pageReply()),
  http.get('/api/documents/:id/pages/:page/image', ({ params }) => {
    imageCalls.push(Number(params.page));
    const reply = imageReplies.shift();
    if (reply) return reply();
    return HttpResponse.json({ url: `${pageImage.url}&call=${imageCalls.length}` });
  }),
  http.post('/api/ask', () => HttpResponse.json(answered))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  imageCalls = [];
  imageReplies = [];
  pageReply = () => HttpResponse.json(pageFixture);
  deleted = [];
  messagesFor = {};
});
afterAll(() => server.close());

async function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Workspace onReturnToLanding={() => {}} />
    </QueryClientProvider>
  );
  await waitFor(() => expect(screen.getByText(/Scope: [1-9]/)).toBeInTheDocument());
}

function serveAnswer(fixture) {
  server.use(http.post('/api/ask', () => HttpResponse.json(fixture)));
}

async function renderAnswerCard(fixture = answered) {
  serveAnswer(fixture);
  await renderWorkspace();
  fireEvent.change(screen.getByLabelText('Ask a question about the selected documents'), {
    target: { value: 'What was revenue?' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  return screen.findByRole('article', { name: 'Answer' });
}

const viewer = () => screen.getByRole('complementary', { name: 'Evidence viewer' });
const openSource = (card, id) => fireEvent.click(within(card).getByRole('button', { name: new RegExp(`Open source ${id}`) }));

describe('Evidence viewer', () => {
  it('shows a calm empty state until a citation is clicked, and collapses', async () => {
    await renderWorkspace();
    expect(within(viewer()).getByText('Click a citation to see the source page.')).toBeInTheDocument();
    expect(imageCalls).toHaveLength(0);

    fireEvent.click(within(viewer()).getByRole('button', { name: 'Collapse evidence viewer' }));
    expect(screen.queryByRole('complementary', { name: 'Evidence viewer' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle evidence viewer' }));
    expect(viewer()).toBeInTheDocument();
  });

  it('a citation click opens the right file, page, section, type and snippet', async () => {
    const card = await renderAnswerCard();
    const s3 = answered.citations.find((c) => c.source_id === 'S3');
    openSource(card, 'S3');

    const pane = within(viewer());
    expect(pane.getByText(s3.filename)).toBeInTheDocument();
    expect(pane.getByTestId('page-indicator')).toHaveTextContent(`Page ${s3.page} of ${PAGE_COUNT}`);
    expect(pane.getByText(s3.content_type)).toBeInTheDocument();
    expect(pane.getByText(s3.section)).toBeInTheDocument();
    expect(pane.getByTestId('cited-snippet').textContent).toBe(s3.snippet);
    await waitFor(() => expect(imageCalls).toEqual([s3.page]));
  });

  it('an inline chip opens the citation it names', async () => {
    const card = await renderAnswerCard(calculationRemoved);
    const answerText = within(card).getByTestId('answer-text');
    fireEvent.click(within(answerText).getByRole('button', { name: 'Citation S2' }));
    const s2 = calculationRemoved.citations.find((c) => c.source_id === 'S2');
    expect(within(viewer()).getByTestId('page-indicator')).toHaveTextContent(`Page ${s2.page}`);
    await waitFor(() => expect(imageCalls).toEqual([s2.page]));
  });

  it('asks for a fresh signed URL on every click, and shows a skeleton while loading', async () => {
    const card = await renderAnswerCard();
    openSource(card, 'S1');
    expect(within(viewer()).getByRole('status', { name: 'Loading page image' })).toBeInTheDocument();
    const firstImage = await within(viewer()).findByRole('img', { hidden: true });
    fireEvent.load(firstImage);
    expect(within(viewer()).queryByRole('status', { name: 'Loading page image' })).not.toBeInTheDocument();

    openSource(card, 'S1');
    await waitFor(() => expect(imageCalls).toHaveLength(2));
    const secondImage = await within(viewer()).findByRole('img', { hidden: true });
    expect(secondImage.getAttribute('src')).not.toBe(firstImage.getAttribute('src'));
  });

  it('previous and next change the page and the image, within 1..N', async () => {
    const card = await renderAnswerCard();
    openSource(card, 'S1');
    const pane = within(viewer());
    await waitFor(() => expect(imageCalls).toEqual([3]));

    fireEvent.click(pane.getByRole('button', { name: 'Next page' }));
    expect(pane.getByTestId('page-indicator')).toHaveTextContent('Page 4 of 5');
    await waitFor(() => expect(imageCalls).toEqual([3, 4]));

    fireEvent.click(pane.getByRole('button', { name: 'Next page' }));
    expect(pane.getByRole('button', { name: 'Next page' })).toBeDisabled();

    fireEvent.click(pane.getByRole('button', { name: /Back to cited page 3/ }));
    expect(pane.getByTestId('page-indicator')).toHaveTextContent('Page 3 of 5');
    fireEvent.click(pane.getByRole('button', { name: 'Previous page' }));
    fireEvent.click(pane.getByRole('button', { name: 'Previous page' }));
    expect(pane.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('labels the cited details as the cited page once you move away', async () => {
    const card = await renderAnswerCard();
    const s1 = answered.citations.find((c) => c.source_id === 'S1');
    openSource(card, 'S1');
    const pane = within(viewer());
    fireEvent.click(pane.getByRole('button', { name: 'Next page' }));
    expect(pane.queryByText(s1.section)).not.toBeInTheDocument();
    expect(pane.getByTestId('cited-snippet')).toBeInTheDocument();
    expect(viewer().textContent).toContain(`from page ${s1.page}`);
  });

  it('zoom changes the image width, and Fit width restores it', async () => {
    const card = await renderAnswerCard();
    openSource(card, 'S1');
    const pane = within(viewer());
    const image = await pane.findByRole('img', { hidden: true });
    fireEvent.load(image);
    expect(image.style.width).toBe('100%');

    fireEvent.click(pane.getByRole('button', { name: 'Zoom in' }));
    expect(image.style.width).toBe('125%');
    expect(pane.getByTestId('zoom-level')).toHaveTextContent('125%');

    fireEvent.click(pane.getByRole('button', { name: 'Fit width' }));
    expect(image.style.width).toBe('100%');
  });
});

describe('Signed URL failure handling', () => {
  it('requests one new URL when the image fails, and shows it if that loads', async () => {
    const card = await renderAnswerCard();
    openSource(card, 'S1');
    const pane = within(viewer());
    fireEvent.error(await pane.findByRole('img', { hidden: true }));
    await waitFor(() => expect(imageCalls).toHaveLength(2));
    fireEvent.load(await pane.findByRole('img', { hidden: true }));
    expect(pane.queryByText('Page image unavailable')).not.toBeInTheDocument();
    expect(pane.getByRole('img').getAttribute('src')).toContain('call=2');
  });

  it('shows the unavailable state after the second failure, with no third request', async () => {
    const card = await renderAnswerCard();
    openSource(card, 'S1');
    const pane = within(viewer());
    fireEvent.error(await pane.findByRole('img', { hidden: true }));
    await waitFor(() => expect(imageCalls).toHaveLength(2));
    fireEvent.error(await pane.findByRole('img', { hidden: true }));
    expect(await pane.findByText('Page image unavailable')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(imageCalls).toHaveLength(2);
  });

  it('Retry starts over with a fresh URL and its own one retry', async () => {
    const card = await renderAnswerCard();
    openSource(card, 'S1');
    const pane = within(viewer());
    fireEvent.error(await pane.findByRole('img', { hidden: true }));
    await waitFor(() => expect(imageCalls).toHaveLength(2));
    fireEvent.error(await pane.findByRole('img', { hidden: true }));
    fireEvent.click(await pane.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(imageCalls).toHaveLength(3));
    fireEvent.load(await pane.findByRole('img', { hidden: true }));
    expect(pane.queryByText('Page image unavailable')).not.toBeInTheDocument();
  });

  it('shows the unavailable state when the endpoint itself returns the real 500', async () => {
    imageReplies = [() => HttpResponse.json({ error: 'Internal server error' }, { status: 500 })];
    const card = await renderAnswerCard();
    openSource(card, 'S1');
    expect(await within(viewer()).findByText('Page image unavailable')).toBeInTheDocument();
    expect(imageCalls).toHaveLength(1);
  });
});

describe('Extracted tables', () => {
  it('offers the tables view when the page has tables, and shows real cells', async () => {
    const card = await renderAnswerCard();
    openSource(card, 'S1');
    const pane = within(viewer());
    fireEvent.click(await pane.findByRole('tab', { name: 'Extracted tables' }));
    const table = pageFixture.tables[0];
    const rendered = pane.getByRole('table');
    expect(within(rendered).getByText(table.headers[1])).toBeInTheDocument();
    expect(within(rendered).getByText(table.rows[3][1])).toBeInTheDocument();
    expect(pane.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument();

    fireEvent.click(pane.getByRole('tab', { name: 'Page image' }));
    expect(pane.queryByRole('table')).not.toBeInTheDocument();
  });

  it('does not offer the view when the page has no tables', async () => {
    pageReply = () => HttpResponse.json({ ...pageFixture, tables: [] });
    const card = await renderAnswerCard();
    openSource(card, 'S1');
    await waitFor(() => expect(imageCalls).toHaveLength(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(within(viewer()).queryByRole('tab')).not.toBeInTheDocument();
  });

  it('still shows the page image when the page endpoint fails', async () => {
    pageReply = () => HttpResponse.json({ error: 'Page not found.' }, { status: 404 });
    const card = await renderAnswerCard();
    openSource(card, 'S1');
    expect(await within(viewer()).findByRole('img', { hidden: true })).toBeInTheDocument();
    expect(within(viewer()).queryByRole('tab')).not.toBeInTheDocument();
  });
});

describe('VerificationDetails from the real object', () => {
  it('groups checks by kind, with the heuristic group labelled "can be wrong"', async () => {
    const card = await renderAnswerCard();
    const exact = within(card).getByTestId('checks-exact');
    const heuristic = within(card).getByTestId('checks-heuristic');

    expect(exact).toHaveTextContent('Citations point to sources sent to the model');
    expect(exact).toHaveTextContent('Numbers found in cited evidence');
    expect(exact).toHaveTextContent('Answer sentences covered');
    expect(exact).not.toHaveTextContent('Statements overlap');

    expect(heuristic).toHaveTextContent('can be wrong');
    expect(heuristic).toHaveTextContent('Statements overlap their cited text');
    expect(heuristic).not.toHaveTextContent('Citations point');
    expect(card).toHaveTextContent('Heuristic checks are signals, not proof. Open the source to confirm.');
  });

  it('renders whatever the API sends rather than a fixed list', async () => {
    const onlyOne = answered.verification.checks.filter((c) => c.name === 'citation_validity');
    const card = await renderAnswerCard({
      ...answered,
      verification: {
        ...answered.verification,
        checks: [...onlyOne, { name: 'brand_new_check', kind: 'deterministic', passed: false, details: {} }],
      },
    });
    const exact = within(card).getByTestId('checks-exact');
    expect(exact).toHaveTextContent('Brand new check');
    expect(exact).toHaveTextContent('not passed');
    expect(exact).not.toHaveTextContent('Numbers found');
    expect(within(card).queryByTestId('checks-heuristic')).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent('Heuristic checks are signals');
  });

  it('lists failed numbers and per-claim signals from a real failing response', async () => {
    const card = await renderAnswerCard(calculationRemoved);
    const exact = within(card).getByTestId('checks-exact');
    const heuristic = within(card).getByTestId('checks-heuristic');
    const failedNumber = calculationRemoved.verification.checks
      .find((c) => c.name === 'number_grounding')
      .details.numbers.find((n) => !n.ok && !n.ignored_reason);
    expect(exact.textContent).toContain(failedNumber.text);
    expect(heuristic).toHaveTextContent('Unsupported');
    expect(heuristic).toHaveTextContent('word overlap');
  });

  it('shows only "Checks unavailable" for state=error', async () => {
    const card = await renderAnswerCard({
      ...answered,
      verification: {
        state: 'error',
        mode: 'both',
        confidence: 'unverified',
        checks: [],
        claims: [],
        numbers: [],
        uncovered_sentences: [],
        removed_claims: [],
        sources_sent: [],
        timings_ms: {},
        disclaimer: answered.verification.disclaimer,
        error_reason: 'verification_error',
      },
    });
    expect(within(card).getAllByText('Checks unavailable').length).toBeGreaterThan(0);
    expect(within(card).queryByText('Check details')).not.toBeInTheDocument();
    expect(within(card).queryByTestId('checks-exact')).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent(/signals, not proof/);
  });

  it('never shows the backend disclaimer or check note, which use forbidden words', async () => {
    const card = await renderAnswerCard();
    expect(card.textContent).not.toMatch(/\b(verified|proven|correct|guaranteed)\b/i);
  });

  it('shows no details on a no-evidence response', async () => {
    const card = await renderAnswerCard(noEvidence);
    expect(within(card).queryByText('Check details')).not.toBeInTheDocument();
  });
});

describe('Stored messages', () => {
  const assistantRow = (rows) => rows.find((r) => r.role === 'assistant');

  it('recovers source ids when the surviving claims match the citations exactly', () => {
    const row = assistantRow(storedCalc);
    expect(recoverSourceIds(row.citations, row.verification.verification)).toEqual(['S1', 'S2', 'S3']);
  });

  it('matches what the live response called those same citations', () => {
    const row = assistantRow(storedCalc);
    const recovered = storedRowsToEntries([row])[0].response.citations;
    calculationRemoved.citations.forEach((live, index) => {
      expect(recovered[index].source_id).toBe(live.source_id);
      expect(recovered[index].page).toBe(live.page);
      expect(recovered[index].content_type).toBe(live.content_type);
    });
  });

  it('refuses to guess when the counts differ', () => {
    const row = assistantRow(storedCalc);
    expect(recoverSourceIds(row.citations.slice(0, 2), row.verification.verification)).toBeNull();
  });

  it('refuses to guess when an image source would land on a text citation', () => {
    const row = assistantRow(storedCalc);
    const verification = {
      removed_claims: [],
      claims: [{ text: 'A', sources: ['S1'] }, { text: 'B', sources: ['S2'] }, { text: 'C', sources: ['IMG1'] }],
    };
    expect(recoverSourceIds(row.citations, verification)).toBeNull();
  });

  it('maps page_number to page and takes status from answering', () => {
    const { response } = storedRowsToEntries([assistantRow(storedCalc)])[0];
    expect(response.status).toBe('partial');
    expect(response.citations[0].page).toBe(assistantRow(storedCalc).citations[0].page_number);
    expect(response.verification.confidence).toBe('low');
    expect(response.calculations).toEqual([]);
    expect(response.missing).toBeNull();
  });

  it('treats a row without a verification block as unrated', () => {
    const { response } = storedRowsToEntries([assistantRow(storedNoEvidence)])[0];
    expect(response.status).toBe('insufficient_evidence');
    expect(response.verification).toBeUndefined();
  });
});

describe('Conversations', () => {
  const [first, second] = conversationsFixture;
  const openButton = (title) => screen.getAllByRole('button', { name: `Open conversation ${title}` })[0];

  it('lists real conversations from the API', async () => {
    await renderWorkspace();
    expect(await screen.findAllByRole('button', { name: /^Open conversation/ })).toHaveLength(conversationsFixture.length);
  });

  it('filters by title in the browser, with a message when nothing matches', async () => {
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    const input = screen.getByLabelText('Filter conversations by title');
    fireEvent.change(input, { target: { value: first.title.toUpperCase() } });
    const expected = conversationsFixture.filter((c) => c.title.toLowerCase() === first.title.toLowerCase() || c.title.toLowerCase().includes(first.title.toLowerCase()));
    expect(screen.getAllByRole('button', { name: /^Open conversation/ })).toHaveLength(expected.length);
    fireEvent.change(input, { target: { value: 'no conversation has this title' } });
    expect(screen.getByText('No conversations match this filter')).toBeInTheDocument();
  });

  it('opening one renders stored messages with the same AnswerCard and chips', async () => {
    messagesFor[first.id] = storedCalc;
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));

    const card = await screen.findByRole('article', { name: 'Answer' });
    expect(screen.getByText(storedCalc[0].content)).toBeInTheDocument();
    expect(within(card).getByTestId('status-badge')).toHaveTextContent('Partial');
    expect(within(card).getByTestId('reliability-badge')).toHaveTextContent('Low: parts were removed');
    expect(within(card).getByRole('button', { name: /Open source S2/ })).toBeInTheDocument();
    expect(within(within(card).getByTestId('answer-text')).getByRole('button', { name: 'Citation S3' })).toBeInTheDocument();
    expect(within(card).getByTestId('checks-exact')).toBeInTheDocument();
    expect(within(card).queryByTestId('latency')).not.toBeInTheDocument();
    expect(screen.getByText(/are not saved/)).toBeInTheDocument();
    expect(openButton(first.title)).toHaveAttribute('aria-current', 'true');
  });

  it('a stored citation opens the right page', async () => {
    messagesFor[first.id] = storedCalc;
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));
    const card = await screen.findByRole('article', { name: 'Answer' });
    fireEvent.click(within(card).getByRole('button', { name: /Open source S2/ }));
    const row = storedCalc.find((r) => r.role === 'assistant');
    await waitFor(() => expect(imageCalls).toEqual([row.citations[1].page_number]));
  });

  it('a stored citation with no recoverable id still opens from the Sources row, and its marker stays plain', async () => {
    const row = storedCalc.find((r) => r.role === 'assistant');
    messagesFor[first.id] = [
      storedCalc[0],
      { ...row, verification: { answering: row.verification.answering } },
    ];
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));
    const card = await screen.findByRole('article', { name: 'Answer' });
    const answerText = within(card).getByTestId('answer-text');
    expect(answerText.textContent).toContain('[S1]');
    expect(within(answerText).queryByRole('button')).not.toBeInTheDocument();
    fireEvent.click(within(card).getAllByRole('button', { name: /^Open source/ })[1]);
    await waitFor(() => expect(imageCalls).toEqual([row.citations[1].page_number]));
  });

  it('handles a stored refusal with empty text calmly', async () => {
    messagesFor[first.id] = storedInsufficient;
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));
    const card = await screen.findByRole('article', { name: 'Answer' });
    expect(within(card).getByTestId('status-badge')).toHaveTextContent('Not enough evidence');
    expect(within(card).getByText('No answer text was saved for this question.')).toBeInTheDocument();
    expect(within(card).queryByTestId('reliability-badge')).not.toBeInTheDocument();
  });

  it('says so when a saved answer has lost its sources', async () => {
    const row = storedCalc.find((r) => r.role === 'assistant');
    messagesFor[first.id] = [storedCalc[0], { ...row, citations: [] }];
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));
    const card = await screen.findByRole('article', { name: 'Answer' });
    expect(within(card).getByText(/Sources for this saved answer are no longer available/)).toBeInTheDocument();
    expect(within(card).queryByText('Sources:')).not.toBeInTheDocument();
  });

  it('does not show that note on a stored refusal, which never had sources', async () => {
    messagesFor[first.id] = storedNoEvidence;
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));
    const card = await screen.findByRole('article', { name: 'Answer' });
    expect(within(card).queryByText(/no longer available/)).not.toBeInTheDocument();
  });

  it('the next question continues the opened conversation', async () => {
    messagesFor[first.id] = storedCalc;
    let body = null;
    server.use(
      http.post('/api/ask', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(answered);
      })
    );
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));
    await screen.findByRole('article', { name: 'Answer' });
    fireEvent.change(screen.getByLabelText('Ask a question about the selected documents'), {
      target: { value: 'And then?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
    await waitFor(() => expect(screen.getAllByRole('article', { name: 'Answer' })).toHaveLength(2));
    expect(body.conversation_id).toBe(first.id);
  });

  it('shows an error with Retry when a conversation cannot be opened', async () => {
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not open this conversation');
    expect(alert).toHaveTextContent('Conversation not found.');

    messagesFor[first.id] = storedCalc;
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('article', { name: 'Answer' })).toBeInTheDocument();
  });

  it('the slower of two opens does not overwrite the newer one', async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`/api/conversations/${first.id}/messages`, async () => {
        await gate;
        return HttpResponse.json(storedInsufficient);
      })
    );
    messagesFor[second.id] = storedCalc;
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));
    fireEvent.click(openButton(second.title));
    await screen.findByRole('article', { name: 'Answer' });
    release();
    await new Promise((resolve) => setTimeout(resolve, 30));
    // Scoped to the thread: the sidebar also lists this question as a title.
    const thread = within(screen.getByTestId('chat-scroller'));
    expect(thread.getByText(storedCalc[0].content)).toBeInTheDocument();
    expect(thread.queryByText(storedInsufficient[0].content)).not.toBeInTheDocument();
  });

  it('delete asks first, and Keep it deletes nothing', async () => {
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(screen.getAllByRole('button', { name: `Delete conversation ${second.title}` })[0]);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(second.title);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it('confirming deletes on the server and removes the row', async () => {
    await renderWorkspace();
    const before = (await screen.findAllByRole('button', { name: /^Open conversation/ })).length;
    fireEvent.click(screen.getAllByRole('button', { name: `Delete conversation ${second.title}` })[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toEqual([second.id]));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Open conversation/ })).toHaveLength(before - 1)
    );
  });

  it('deleting the open conversation also clears the thread', async () => {
    messagesFor[first.id] = storedCalc;
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));
    await screen.findByRole('article', { name: 'Answer' });
    fireEvent.click(screen.getAllByRole('button', { name: `Delete conversation ${first.title}` })[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await screen.findByText('No messages yet');
    expect(screen.queryByRole('article', { name: 'Answer' })).not.toBeInTheDocument();
  });

  it('deleting another conversation leaves the open thread alone', async () => {
    messagesFor[first.id] = storedCalc;
    await renderWorkspace();
    await screen.findAllByRole('button', { name: /^Open conversation/ });
    fireEvent.click(openButton(first.title));
    await screen.findByRole('article', { name: 'Answer' });
    fireEvent.click(screen.getAllByRole('button', { name: `Delete conversation ${second.title}` })[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toEqual([second.id]));
    expect(screen.getByRole('article', { name: 'Answer' })).toBeInTheDocument();
  });

  it('a failed delete says so and keeps the row', async () => {
    server.use(
      http.delete('/api/conversations/:id', () => HttpResponse.json({ error: 'Internal server error' }, { status: 500 }))
    );
    await renderWorkspace();
    const before = (await screen.findAllByRole('button', { name: /^Open conversation/ })).length;
    fireEvent.click(screen.getAllByRole('button', { name: `Delete conversation ${second.title}` })[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/Could not delete the conversation/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Open conversation/ })).toHaveLength(before);
  });

  it('a new answer refreshes the conversation list', async () => {
    let listCalls = 0;
    server.use(
      http.get('/api/conversations', () => {
        listCalls += 1;
        return HttpResponse.json(conversationsFixture);
      })
    );
    await renderAnswerCard();
    await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2));
  });

  it('shows Retry when the list cannot be loaded', async () => {
    server.use(http.get('/api/conversations', () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    await renderWorkspace();
    expect(await screen.findByText('Conversations could not be loaded.')).toBeInTheDocument();
  });
});
