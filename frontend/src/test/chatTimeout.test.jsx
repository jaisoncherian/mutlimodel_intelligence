import React from 'react';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Workspace from '../components/Workspace.jsx';
import documentsFixture from './fixtures/documents.json';
import answered from './fixtures/ask_answered.json';

// Only the wait is shortened; the message still comes from the real code path.
vi.mock('../api/ask.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ASK_TIMEOUT_MS: 50,
}));

const server = setupServer(
  http.get('/api/documents', () => HttpResponse.json(documentsFixture)),
  http.get('/api/conversations', () => HttpResponse.json([])),
  http.post('/api/ask', async () => {
    await delay(5000);
    return HttpResponse.json(answered);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('/ask timeout', () => {
  it('stops waiting, explains the timeout, offers Retry, and keeps the question', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Workspace onReturnToLanding={() => {}} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText(/Scope: [1-9]/)).toBeInTheDocument());

    const composer = screen.getByLabelText('Ask a question about the selected documents');
    fireEvent.change(composer, { target: { value: 'Slow question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No answer after 240 seconds');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('Working on your question...')).not.toBeInTheDocument();
    expect(composer).toHaveValue('Slow question');
  });
});
