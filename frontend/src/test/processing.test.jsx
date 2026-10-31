import React from 'react';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDocuments } from '../hooks/useDocuments.js';
import DocumentUpload from '../components/workspace/DocumentUpload.jsx';
import DocumentList from '../components/workspace/DocumentList.jsx';

const MESSAGE = 'Reading the pages. Large or scanned files take longer.';
const OLD_UPLOAD = '2026-10-01T10:00:00.000000Z';
const row = (status, extra = {}) => ({
  id: 'doc-1',
  filename: 'report.pdf',
  status,
  page_count: status === 'ready' ? 5 : null,
  chunk_count: status === 'ready' ? 7 : null,
  uploaded_at: OLD_UPLOAD,
  ...extra,
});

let docs = [];
let listCalls = 0;

const server = setupServer(
  http.get('/api/documents', () => {
    listCalls += 1;
    return HttpResponse.json(docs);
  }),
  http.post('/api/documents/upload', () => {
    docs = [row('processing')];
    return HttpResponse.json(
      [{ filename: 'report.pdf', document_id: 'doc-1', status: 'processing', error: null }],
      { status: 202 }
    );
  }),
  http.post('/api/documents/:id/reprocess', ({ params }) => {
    docs = [row('processing')];
    return HttpResponse.json({ document_id: params.id, status: 'processing' }, { status: 202 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  docs = [];
  listCalls = 0;
});
afterAll(() => server.close());

/** The real hook wired to the real components, so polling here is not a copy of the logic. */
function Harness() {
  const hook = useDocuments();
  return (
    <div>
      <DocumentUpload
        onUpload={(files) => hook.uploadMutation.mutate(files)}
        isUploading={hook.uploadMutation.isPending}
        uploadFeedback={hook.uploadFeedback}
        onClearFeedback={hook.clearUploadFeedback}
      />
      <DocumentList
        documents={hook.documents}
        processingSince={hook.processingSince}
        selectedDocIds={hook.selectedDocIds}
        onToggleDoc={hook.toggleDoc}
        onSelectAll={hook.selectAll}
        onClearAll={hook.clearAll}
        onDeleteDoc={(id) => hook.deleteMutation.mutate(id)}
        onReprocessDoc={(id) => hook.reprocessMutation.mutate(id)}
        isLoading={hook.isLoading}
      />
    </div>
  );
}

function renderHarness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );
}

async function upload(container) {
  const input = container.querySelector('input[type="file"]');
  const file = new File(['pdf'], 'report.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText('Processing');
}

// The per-second elapsed timer keeps ticking during these waits.
const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

const checkbox = () => screen.getByRole('checkbox', { name: 'Select document report.pdf' });

describe('Processing state with the real hook', () => {
  it('starts polling right after upload, every 3 s, and turns Ready without a reload', async () => {
    const { container } = renderHarness();
    await screen.findByText('No documents yet. Upload a PDF to start.');
    await upload(container);
    expect(checkbox()).toBeDisabled();

    const before = listCalls;
    await waitFor(() => expect(listCalls).toBeGreaterThan(before), { timeout: 3500 });
    const afterFirstPoll = listCalls;
    await wait(1500);
    expect(listCalls).toBe(afterFirstPoll); // not faster than the 3 s interval

    docs = [row('ready')];
    await screen.findByText('Ready', {}, { timeout: 3500 });
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByTestId('processing-elapsed')).not.toBeInTheDocument();
    expect(screen.getByText('5 pages')).toBeInTheDocument();
    await waitFor(() => expect(checkbox()).toBeChecked());

    const afterReady = listCalls;
    await wait(3500);
    expect(listCalls).toBe(afterReady); // polling has stopped
  }, 20000);

  it('keeps polling through a failed poll', async () => {
    const { container } = renderHarness();
    await screen.findByText('No documents yet. Upload a PDF to start.');
    await upload(container);
    server.use(http.get('/api/documents', () => HttpResponse.json({ error: 'x' }, { status: 500 }), { once: true }));
    await wait(3200);
    docs = [row('ready')];
    await screen.findByText('Ready', {}, { timeout: 4000 });
  }, 15000);

  it('shows the honest message and elapsed time from the upload, not uploaded_at', async () => {
    const { container } = renderHarness();
    await screen.findByText('No documents yet. Upload a PDF to start.');
    await upload(container);
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    const elapsed = screen.getByTestId('processing-elapsed');
    expect(elapsed).toHaveTextContent(/^0 s$/);
    await waitFor(() => expect(elapsed).toHaveTextContent(/^1 s$/), { timeout: 2500 });
  }, 10000);

  it('times a reprocess from the click, even though uploaded_at is weeks old', async () => {
    docs = [row('failed', { error_message: 'Document processing failed.' })];
    renderHarness();
    fireEvent.click(await screen.findByRole('button', { name: 'Reprocess' }));
    await screen.findByText(MESSAGE);
    expect(screen.getByTestId('processing-elapsed')).toHaveTextContent(/^0 s$/);
  });

  it('after a reload, counts from page open and says so', async () => {
    docs = [row('processing')];
    renderHarness();
    const elapsed = await screen.findByTestId('processing-elapsed');
    expect(elapsed).toHaveTextContent('0 s since this page opened');
  });

  it('shows failure, with no elapsed time, when processing fails', async () => {
    const { container } = renderHarness();
    await screen.findByText('No documents yet. Upload a PDF to start.');
    await upload(container);
    docs = [row('failed', { error_message: 'Document processing failed.' })];
    await screen.findByText('Failed', {}, { timeout: 3500 });
    expect(screen.queryByTestId('processing-elapsed')).not.toBeInTheDocument();
    expect(screen.getByText('Document processing failed.')).toBeInTheDocument();
  }, 10000);

  it('shows minutes for a long run, and gives no estimate or percentage', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    docs = [row('processing')];
    renderHarness();
    const elapsed = await screen.findByTestId('processing-elapsed');
    Date.now.mockReturnValue(1_000_000 + 125_000);
    await waitFor(() => expect(elapsed).toHaveTextContent('2 m 05 s'), { timeout: 2500 });
    const listRow = elapsed.closest('div').parentElement;
    expect(within(listRow).queryByText(/%|remaining|estimate/i)).not.toBeInTheDocument();
    vi.restoreAllMocks();
  }, 10000);
});
