import React from 'react';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Workspace from '../components/Workspace.jsx';
import documentsFixture from './fixtures/documents.json';
import answered from './fixtures/ask_answered.json';
import partial from './fixtures/ask_partial.json';
import insufficient from './fixtures/ask_insufficient_evidence.json';
import calculation from './fixtures/ask_calculation.json';
import calculationRemoved from './fixtures/ask_calculation_removed.json';
import vision from './fixtures/ask_vision.json';
import noEvidence from './fixtures/ask_no_evidence.json';
import pageFixture from './fixtures/document_page.json';
import pageImage from './fixtures/page_image.json';
import error400 from './fixtures/error_400.json';
import error503 from './fixtures/error_503.json';

let askBodies = [];
let deleteCalls = 0;

/** Registers POST /ask. Each reply is a fixture object or a function returning a Response. */
function replyWith(...replies) {
  let call = 0;
  server.use(
    http.post('/api/ask', async ({ request }) => {
      askBodies.push(await request.clone().json());
      const reply = replies[Math.min(call, replies.length - 1)];
      call += 1;
      return typeof reply === 'function' ? reply() : HttpResponse.json(reply);
    })
  );
}

/** A reply that stays pending until the test releases it. */
function heldReply(fixture) {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const reply = async () => {
    await gate;
    return HttpResponse.json(fixture);
  };
  return { reply, release };
}

const server = setupServer(
  http.get('/api/documents', () => HttpResponse.json(documentsFixture)),
  http.get('/api/conversations', () => HttpResponse.json([])),
  http.delete('/api/conversations/:id', () => {
    deleteCalls += 1;
    return HttpResponse.json({ deleted: true });
  }),
  // The evidence viewer asks for these whenever a citation is opened.
  http.get('/api/documents/:id/pages/:page', () => HttpResponse.json(pageFixture)),
  http.get('/api/documents/:id/pages/:page/image', () => HttpResponse.json(pageImage))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  askBodies = [];
  deleteCalls = 0;
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const readyIds = documentsFixture.filter((d) => d.status === 'ready').map((d) => d.id);

async function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Workspace onReturnToLanding={() => {}} />
    </QueryClientProvider>
  );
  await waitFor(() => expect(screen.getByText(/Scope: [1-9]/)).toBeInTheDocument());
}

const composer = () => screen.getByLabelText('Ask a question about the selected documents');
const sendButton = () => screen.getByRole('button', { name: 'Send question' });
const typeQuestion = (text) => fireEvent.change(composer(), { target: { value: text } });

async function ask(text = 'What was revenue?') {
  typeQuestion(text);
  fireEvent.click(sendButton());
}

async function renderAnswer(fixture) {
  replyWith(fixture);
  await renderWorkspace();
  await ask();
  return screen.findByRole('article', { name: 'Answer' });
}

describe('AnswerCard from real responses', () => {
  it('renders an answered response: badges, text, sources, latency, no missing callout', async () => {
    const card = await renderAnswer(answered);
    expect(within(card).getByTestId('status-badge')).toHaveTextContent('Answered');
    expect(within(card).getByTestId('reliability-badge')).toHaveTextContent(
      'High: passed all automated checks'
    );
    expect(within(card).getByTestId('answer-text')).toHaveTextContent(answered.answer);
    expect(within(card).getByRole('button', { name: /Open source S1/ })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Open source S3/ })).toBeInTheDocument();
    expect(within(card).getByTestId('latency')).toBeInTheDocument();
    expect(within(card).queryByText('What is missing')).not.toBeInTheDocument();
  });

  it('never shows the placeholder answer that used to be hardcoded', async () => {
    const card = await renderAnswer(answered);
    expect(card.textContent).not.toContain('33.89');
    expect(card.textContent).not.toContain('Calculations');
  });

  it('renders a partial response with chips and a What is missing callout', async () => {
    const card = await renderAnswer(partial);
    expect(within(card).getByTestId('status-badge')).toHaveTextContent('Partial');
    expect(within(card).getByTestId('reliability-badge')).toHaveTextContent('Low: parts were removed');
    expect(within(card).getByText('What is missing')).toBeInTheDocument();
    const answerText = within(card).getByTestId('answer-text');
    expect(within(answerText).getByRole('button', { name: 'Citation S1' })).toBeInTheDocument();
    expect(within(answerText).getByRole('button', { name: 'Citation S3' })).toBeInTheDocument();
    expect(answerText.textContent).not.toContain('(S1, S3)');
  });

  it('renders insufficient_evidence as calm and neutral, not as an error', async () => {
    const card = await renderAnswer(insufficient);
    const badge = within(card).getByTestId('status-badge');
    expect(badge).toHaveTextContent('Not enough evidence');
    expect(badge).toHaveAttribute('data-tone', 'neutral');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(within(card).queryByTestId('answer-text')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Copy answer/ })).not.toBeInTheDocument();
    expect(within(card).getByTestId('missing-text')).toHaveTextContent(insufficient.missing);
    // The backend says "high" for zero claims; that must not read as a rated answer.
    expect(within(card).queryByTestId('reliability-badge')).not.toBeInTheDocument();
  });

  it('handles the no-evidence response, which has no verification and no total time', async () => {
    const card = await renderAnswer(noEvidence);
    expect(within(card).getByTestId('status-badge')).toHaveTextContent('Not enough evidence');
    expect(within(card).getByTestId('answer-text')).toHaveTextContent(noEvidence.answer);
    expect(within(card).queryByTestId('reliability-badge')).not.toBeInTheDocument();
    expect(within(card).queryByTestId('latency')).not.toBeInTheDocument();
  });

  it.each([
    ['unchecked', 'Unchecked'],
    ['unverified', 'Checks unavailable'],
    ['medium', 'Medium: some checks are weak'],
  ])('shows the reliability label for confidence=%s', async (confidence, label) => {
    const card = await renderAnswer({
      ...answered,
      verification: { ...answered.verification, confidence },
    });
    expect(within(card).getByTestId('reliability-badge')).toHaveTextContent(label);
  });

  it('shows "Checks unavailable" for verification.state=error', async () => {
    const card = await renderAnswer({
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
    expect(within(card).getByTestId('reliability-badge')).toHaveTextContent('Checks unavailable');
  });

  it('renders the calculation table with source chips and the mono result', async () => {
    const card = await renderAnswer(calculation);
    expect(within(card).getByText('Subtract')).toBeInTheDocument();
    const table = within(card).getByRole('table');
    expect(within(table).getByText(/Q4 revenue/)).toBeInTheDocument();
    expect(within(table).getByText('167,900')).toHaveClass('font-mono');
    const result = within(card).getByTestId('calculation-result');
    expect(result).toHaveTextContent('42500 USD');
    expect(result).toHaveClass('font-mono');
    expect(within(card).getByText('Computed by code, not by the language model.')).toBeInTheDocument();
    expect(within(card).getAllByRole('button', { name: 'Citation S2' }).length).toBeGreaterThanOrEqual(2);
  });

  it('shows rejected calculations, removed claims and unmatched numbers as cautions', async () => {
    const card = await renderAnswer(calculationRemoved);
    expect(within(card).getByText('Calculations not used')).toBeInTheDocument();
    expect(card.textContent).toContain("Operand source 'c1' is not among the retrieved sources.");
    expect(within(card).getByText('Warnings')).toBeInTheDocument();
    expect(within(card).getByText('33.86%')).toBeInTheDocument();
    // Once under Warnings and once as a claim in the check details.
    expect(
      within(card).getAllByText(calculationRemoved.verification.removed_claims[0].text)
    ).toHaveLength(2);
  });

  it('shows the page image note when used_vision is true', async () => {
    const card = await renderAnswer(vision);
    expect(within(card).getByText('Analyzed page image')).toBeInTheDocument();
    expect(within(card).getByText('Values read from charts are approximate.')).toBeInTheDocument();
  });

  it('does not show the page image note when used_vision is false', async () => {
    const card = await renderAnswer(answered);
    expect(within(card).queryByText('Analyzed page image')).not.toBeInTheDocument();
  });

  it.each([
    ['answered', answered],
    ['partial', partial],
    ['insufficient', insufficient],
    ['calculation', calculation],
    ['calculation with removed claims', calculationRemoved],
    ['vision', vision],
    ['no evidence', noEvidence],
  ])('uses no forbidden word for the %s response', async (_name, fixture) => {
    const card = await renderAnswer(fixture);
    expect(card.textContent).not.toMatch(/\b(verified|proven|correct|guaranteed)\b/i);
  });

  it('copies the answer text', async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const card = await renderAnswer(answered);
    fireEvent.click(within(card).getByRole('button', { name: /Copy answer/ }));
    expect(await within(card).findByText('Copied')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(answered.answer);
    vi.unstubAllGlobals();
  });
});

describe('Citations', () => {
  it('a marker chip opens the evidence viewer on the matching citation', async () => {
    const card = await renderAnswer(partial);
    fireEvent.click(within(within(card).getByTestId('answer-text')).getByRole('button', { name: 'Citation S3' }));
    const s3 = partial.citations.find((c) => c.source_id === 'S3');
    const viewer = await screen.findByRole('complementary', { name: 'Evidence viewer' });
    expect(within(viewer).getByText(s3.filename)).toBeInTheDocument();
    expect(viewer.textContent).toContain(`[${s3.source_id}]`);
  });

  it('a Sources button opens the evidence viewer too', async () => {
    const card = await renderAnswer(answered);
    fireEvent.click(within(card).getByRole('button', { name: /Open source S1/ }));
    const viewer = await screen.findByRole('complementary', { name: 'Evidence viewer' });
    expect(viewer.textContent).toContain('[S1]');
  });

  it('keeps a marker with no matching citation as plain text', async () => {
    const card = await renderAnswer({ ...answered, answer: 'Revenue was high [S9].' });
    const answerText = within(card).getByTestId('answer-text');
    expect(answerText).toHaveTextContent('Revenue was high [S9].');
    expect(within(answerText).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Sending', () => {
  it('posts question, checked ready doc ids, and no conversation_id on the first send', async () => {
    await renderAnswer(answered);
    expect(askBodies).toHaveLength(1);
    expect(askBodies[0].question).toBe('What was revenue?');
    expect([...askBodies[0].doc_ids].sort()).toEqual([...readyIds].sort());
    expect(askBodies[0]).not.toHaveProperty('conversation_id');
  });

  it('sends the conversation_id from the first reply on the next send', async () => {
    replyWith(answered, partial);
    await renderWorkspace();
    await ask('First');
    await screen.findByRole('article', { name: 'Answer' });
    await ask('Second');
    await waitFor(() => expect(screen.getAllByRole('article', { name: 'Answer' })).toHaveLength(2));
    expect(askBodies[1].conversation_id).toBe(answered.conversation_id);
  });

  it('shows the user bubble and clears the composer straight away', async () => {
    const { reply, release } = heldReply(answered);
    replyWith(reply);
    await renderWorkspace();
    await ask('Hold on');
    expect(await screen.findByText('Hold on')).toBeInTheDocument();
    expect(composer()).toHaveValue('');
    release();
    await screen.findByRole('article', { name: 'Answer' });
  });

  it('shows the working state with an elapsed counter and no invented steps', async () => {
    const { reply, release } = heldReply(answered);
    replyWith(reply);
    await renderWorkspace();
    await ask();
    expect(await screen.findByText('Working on your question...')).toBeInTheDocument();
    expect(screen.getByTestId('elapsed-seconds')).toHaveTextContent('0 s');
    await waitFor(() => expect(screen.getByTestId('elapsed-seconds')).toHaveTextContent('1 s'), {
      timeout: 2500,
    });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    release();
    await screen.findByRole('article', { name: 'Answer' });
    expect(screen.queryByText('Working on your question...')).not.toBeInTheDocument();
  });

  it('blocks a second send while an answer is on its way', async () => {
    const { reply, release } = heldReply(answered);
    replyWith(reply);
    await renderWorkspace();
    await ask('First');
    typeQuestion('Second');
    expect(sendButton()).toBeDisabled();
    expect(screen.getByText('Waiting for the current answer.')).toBeInTheDocument();
    release();
    await screen.findByRole('article', { name: 'Answer' });
    expect(composer()).toHaveValue('Second');
    expect(sendButton()).toBeEnabled();
  });

  it('scrolls the thread to the newest message', async () => {
    const offsetTop = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(500);
    await renderAnswer(answered);
    await waitFor(() => expect(screen.getByTestId('chat-scroller').scrollTop).toBe(484));
    offsetTop.mockRestore();
  });

  it('keeps the thread scrollable inside its own container', async () => {
    await renderAnswer(answered);
    expect(screen.getByTestId('chat-scroller')).toHaveClass('min-h-0', 'overflow-y-auto');
  });
});

describe('Composer rules', () => {
  it('counts characters live', async () => {
    await renderWorkspace();
    typeQuestion('hello');
    expect(screen.getByTestId('composer-counter')).toHaveTextContent('5 / 1000');
  });

  it('allows exactly 1000 characters and blocks 1001 with a reason', async () => {
    await renderWorkspace();
    typeQuestion('a'.repeat(1000));
    expect(sendButton()).toBeEnabled();
    typeQuestion('a'.repeat(1001));
    expect(sendButton()).toBeDisabled();
    expect(screen.getByText('Shorten your question to 1000 characters or fewer.')).toBeInTheDocument();
  });

  it('blocks an empty or whitespace question with a reason', async () => {
    await renderWorkspace();
    expect(sendButton()).toBeDisabled();
    expect(screen.getByText('Type a question to send.')).toBeInTheDocument();
    typeQuestion('   \n  ');
    expect(sendButton()).toBeDisabled();
  });

  it('blocks sending when no ready document is checked, with a reason', async () => {
    server.use(
      http.get('/api/documents', () =>
        HttpResponse.json(documentsFixture.map((d) => ({ ...d, status: 'processing' })))
      )
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Workspace onReturnToLanding={() => {}} />
      </QueryClientProvider>
    );
    typeQuestion('Anything');
    await screen.findByText('Select at least one ready document.');
    expect(sendButton()).toBeDisabled();
  });

  it('Enter sends and Shift+Enter does not', async () => {
    replyWith(answered);
    await renderWorkspace();
    typeQuestion('Line one');
    fireEvent.keyDown(composer(), { key: 'Enter', shiftKey: true });
    expect(screen.queryByText('Working on your question...')).not.toBeInTheDocument();
    expect(askBodies).toHaveLength(0);
    fireEvent.keyDown(composer(), { key: 'Enter' });
    await screen.findByRole('article', { name: 'Answer' });
    expect(askBodies).toHaveLength(1);
  });

  it('Enter does nothing when the question is over the limit', async () => {
    replyWith(answered);
    await renderWorkspace();
    typeQuestion('a'.repeat(1001));
    fireEvent.keyDown(composer(), { key: 'Enter' });
    expect(screen.queryByText('Working on your question...')).not.toBeInTheDocument();
    expect(composer()).toHaveValue('a'.repeat(1001));
  });
});

describe('Errors', () => {
  const expectQuestionKept = (text) => expect(composer()).toHaveValue(text);

  it('400 shows the API message and no Retry', async () => {
    replyWith(() => HttpResponse.json(error400, { status: 400 }));
    await renderWorkspace();
    await ask('Bad');
    expect(await screen.findByRole('alert')).toHaveTextContent(error400.error);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expectQuestionKept('Bad');
  });

  it('404 for a missing conversation shows the API message', async () => {
    replyWith(() => HttpResponse.json({ error: 'Conversation not found.' }, { status: 404 }));
    await renderWorkspace();
    await ask('Gone');
    expect(await screen.findByRole('alert')).toHaveTextContent('Conversation not found.');
  });

  it('503 busy waits for a manual Retry, which then succeeds without a duplicate bubble', async () => {
    replyWith(() => HttpResponse.json(error503, { status: 503 }), answered);
    await renderWorkspace();
    await ask('Busy question');
    expect(await screen.findByRole('alert')).toHaveTextContent('The model is busy');
    expectQuestionKept('Busy question');

    // No automatic retry.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(askBodies).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('article', { name: 'Answer' });
    expect(askBodies).toHaveLength(2);
    expect(askBodies[1].question).toBe('Busy question');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByText('Busy question')).toHaveLength(1);
    expect(composer()).toHaveValue('');
  });

  it('503 from an unreachable Ollama says so', async () => {
    replyWith(() =>
      HttpResponse.json(
        { error: 'The AI model is currently unavailable. Please try again later.' },
        { status: 503 }
      )
    );
    await renderWorkspace();
    await ask('No model');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The local model did not respond');
    expect(alert).toHaveTextContent('Ollama');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expectQuestionKept('No model');
  });

  it('a network failure gets its own message', async () => {
    replyWith(() => HttpResponse.error());
    await renderWorkspace();
    await ask('Offline');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
    expectQuestionKept('Offline');
  });

  it('an empty 500 from the Vite proxy (backend down) gets a clear message', async () => {
    replyWith(() => new HttpResponse(null, { status: 500 }));
    await renderWorkspace();
    await ask('Proxy');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The server returned an error (500)');
    expect(alert).toHaveTextContent('backend');
    expectQuestionKept('Proxy');
  });

  it('a 200 with no usable body is reported, not rendered as an empty answer', async () => {
    replyWith(() => new HttpResponse('not json', { status: 200 }));
    await renderWorkspace();
    await ask('Odd');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Answer' })).not.toBeInTheDocument();
    expectQuestionKept('Odd');
  });

  it('Retry is blocked with a reason when no document is checked any more', async () => {
    replyWith(() => HttpResponse.json(error503, { status: 503 }));
    await renderWorkspace();
    await ask('Busy');
    await screen.findByRole('alert');
    const client = screen.getAllByRole('checkbox');
    client.forEach((box) => {
      if (box.checked && !box.disabled) fireEvent.click(box);
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled());
    expect(screen.getByText('Select at least one ready document to retry.')).toBeInTheDocument();
  });

  it('keeps text typed while waiting instead of overwriting it with the failed question', async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    replyWith(async () => {
      await gate;
      return HttpResponse.json(error503, { status: 503 });
    });
    await renderWorkspace();
    await ask('Original');
    typeQuestion('A newer thought');
    release();
    await screen.findByRole('alert');
    expect(composer()).toHaveValue('A newer thought');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(askBodies).toHaveLength(2));
    expect(askBodies[1].question).toBe('Original');
    expect(composer()).toHaveValue('A newer thought');
  });
});

describe('Cancel', () => {
  it('aborts the request, says so plainly, and returns the question to the composer', async () => {
    const { reply, release } = heldReply(answered);
    replyWith(reply);
    await renderWorkspace();
    await ask('Never mind');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Question cancelled')).toBeInTheDocument();
    expect(screen.getByText(/The server may still finish this request/)).toBeInTheDocument();
    expect(screen.queryByText('Working on your question...')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(composer()).toHaveValue('Never mind');

    // A reply that arrives after cancelling is ignored.
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('article', { name: 'Answer' })).not.toBeInTheDocument();
  });

  it('sending again after a cancel replaces the cancelled bubble', async () => {
    const { reply } = heldReply(answered);
    replyWith(reply, partial);
    await renderWorkspace();
    await ask('Again');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await screen.findByText('Question cancelled');
    fireEvent.click(sendButton());
    await screen.findByRole('article', { name: 'Answer' });
    expect(screen.getAllByText('Again')).toHaveLength(1);
    expect(screen.queryByText('Question cancelled')).not.toBeInTheDocument();
  });
});

describe('New chat', () => {
  const clickNewChat = () => fireEvent.click(screen.getByRole('button', { name: 'New chat' }));

  it('clears the thread and conversation_id, focuses the composer, deletes nothing', async () => {
    replyWith(answered, partial);
    await renderWorkspace();
    await ask('First');
    await screen.findByRole('article', { name: 'Answer' });

    clickNewChat();
    expect(screen.queryByRole('article', { name: 'Answer' })).not.toBeInTheDocument();
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(composer()).toHaveFocus();
    expect(deleteCalls).toBe(0);

    await ask('Second');
    await screen.findByRole('article', { name: 'Answer' });
    expect(askBodies[1]).not.toHaveProperty('conversation_id');
  });

  it('clears a failed question and its error', async () => {
    replyWith(() => HttpResponse.json(error503, { status: 503 }));
    await renderWorkspace();
    await ask('Failed');
    await screen.findByRole('alert');
    clickNewChat();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(composer()).toHaveValue('');
  });

  it('drops a request still in flight, and its late reply does not appear', async () => {
    const { reply, release } = heldReply(answered);
    replyWith(reply);
    await renderWorkspace();
    await ask('In flight');
    await screen.findByText('Working on your question...');
    clickNewChat();
    expect(screen.queryByText('Working on your question...')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Question cancelled')).not.toBeInTheDocument();
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('article', { name: 'Answer' })).not.toBeInTheDocument();
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('clears the evidence that belonged to the old thread', async () => {
    const card = await renderAnswer(answered);
    fireEvent.click(within(card).getByRole('button', { name: /Open source S1/ }));
    const viewer = () => screen.getByRole('complementary', { name: 'Evidence viewer' });
    expect(within(viewer()).getByTestId('cited-snippet')).toBeInTheDocument();
    clickNewChat();
    expect(within(viewer()).getByText('Click a citation to see the source page.')).toBeInTheDocument();
  });

  it('keeps the document selection', async () => {
    replyWith(answered);
    await renderWorkspace();
    const before = screen.getByText(/Scope:/).textContent;
    clickNewChat();
    expect(screen.getByText(/Scope:/).textContent).toBe(before);
  });
});
