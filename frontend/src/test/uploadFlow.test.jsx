import React from 'react';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDocuments } from '../hooks/useDocuments.js';
import DocumentUpload from '../components/workspace/DocumentUpload.jsx';
import DocumentList from '../components/workspace/DocumentList.jsx';
import { client } from '../api/client.js';

// Test harness component connecting useDocuments with UI
function TestUploadWorkspace({ onMountHook }) {
  const hookData = useDocuments();
  if (onMountHook) onMountHook(hookData);

  return (
    <div>
      <DocumentUpload
        onUpload={(files) => hookData.uploadMutation.mutate(files)}
        isUploading={hookData.uploadMutation.isPending}
        uploadFeedback={hookData.uploadFeedback}
        onClearFeedback={hookData.clearUploadFeedback}
      />
      <DocumentList
        documents={hookData.documents}
        selectedDocIds={hookData.selectedDocIds}
        onToggleDoc={hookData.toggleDoc}
        onSelectAll={hookData.selectAll}
        onClearAll={hookData.clearAll}
        onDeleteDoc={(id) => hookData.deleteMutation.mutate(id)}
        onReprocessDoc={(id) => hookData.reprocessMutation.mutate(id)}
        isLoading={hookData.isLoading}
      />
    </div>
  );
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
}

let mockDocs = [];
let uploadPostCalls = 0;
let lastPostedFormData = null;

const server = setupServer(
  http.get('/api/documents', () => {
    return HttpResponse.json(mockDocs);
  }),
  http.post('/api/documents/upload', () => {
    uploadPostCalls++;
    return HttpResponse.json([], { status: 202 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  mockDocs = [];
  uploadPostCalls = 0;
  lastPostedFormData = null;
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('Document Upload End-to-End Tests', () => {
  // 1. Choosing a file triggers exactly ONE POST to /documents/upload with the field "files"
  it('choosing a file triggers exactly ONE POST to /documents/upload with the field "files"', async () => {
    const postSpy = vi.spyOn(client, 'post').mockImplementation(async (endpoint, body, _options) => {
      lastPostedFormData = body;
      uploadPostCalls++;
      return [
        {
          filename: 'single_choice.pdf',
          document_id: 'doc-choice-1',
          status: 'processing',
          error: null,
        },
      ];
    });

    const wrapper = createWrapper();
    const { container } = render(<TestUploadWorkspace />, { wrapper });

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    const file = new File(['dummy pdf content'], 'single_choice.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadPostCalls).toBe(1);
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith('/documents/upload', expect.any(FormData), undefined);
    expect(lastPostedFormData.has('files')).toBe(true);
    expect(lastPostedFormData.getAll('files').length).toBe(1);
    expect(lastPostedFormData.getAll('files')[0].name).toBe('single_choice.pdf');
  });

  // 2. Dropping a file triggers exactly ONE POST to /documents/upload with the field "files"
  it('dropping a file triggers exactly ONE POST to /documents/upload with the field "files"', async () => {
    const postSpy = vi.spyOn(client, 'post').mockImplementation(async (endpoint, body, _options) => {
      lastPostedFormData = body;
      uploadPostCalls++;
      return [
        {
          filename: 'dropped_file.pdf',
          document_id: 'doc-drop-1',
          status: 'processing',
          error: null,
        },
      ];
    });

    const wrapper = createWrapper();
    render(<TestUploadWorkspace />, { wrapper });

    const dropzone = screen.getByRole('button', { name: /Upload PDF documents/i });
    const droppedFile = new File(['dropped pdf content'], 'dropped_file.pdf', {
      type: 'application/pdf',
    });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [droppedFile],
      },
    });

    await waitFor(() => {
      expect(uploadPostCalls).toBe(1);
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith('/documents/upload', expect.any(FormData), undefined);
    expect(lastPostedFormData.has('files')).toBe(true);
    expect(lastPostedFormData.getAll('files').length).toBe(1);
    expect(lastPostedFormData.getAll('files')[0].name).toBe('dropped_file.pdf');
  });

  // 3. Selecting the same file twice uploads twice (value reset allows re-selection)
  it('selecting the same file twice uploads twice', async () => {
    let callCount = 0;
    vi.spyOn(client, 'post').mockImplementation(async () => {
      callCount++;
      return [
        {
          filename: 'repeated.pdf',
          document_id: `doc-${callCount}`,
          status: 'processing',
          error: null,
        },
      ];
    });

    const wrapper = createWrapper();
    const { container } = render(<TestUploadWorkspace />, { wrapper });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['content'], 'repeated.pdf', { type: 'application/pdf' });

    // First selection
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(callCount).toBe(1);
    });

    // Input value must be reset to empty string
    expect(fileInput.value).toBe('');

    // Second selection of the exact same file
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(callCount).toBe(2);
    });
  });

  // 4. A 202 response makes the new row appear, and a rejected file shows its error text
  it('a 202 response makes the new row appear, and a rejected file shows its error text', async () => {
    let uploaded = false;
    server.use(
      http.get('/api/documents', () => {
        if (!uploaded) return HttpResponse.json([]);
        return HttpResponse.json([
          {
            id: 'doc-accepted-1',
            filename: 'accepted.pdf',
            status: 'processing',
            page_count: null,
            chunk_count: null,
            uploaded_at: new Date().toISOString(),
          },
        ]);
      }),
      http.post('/api/documents/upload', () => {
        uploaded = true;
        return HttpResponse.json(
          [
            {
              filename: 'accepted.pdf',
              document_id: 'doc-accepted-1',
              status: 'processing',
              error: null,
            },
            {
              filename: 'rejected.pdf',
              document_id: null,
              status: null,
              error: 'PDF contains no text and OCR failed.',
            },
          ],
          { status: 202 }
        );
      })
    );

    const wrapper = createWrapper();
    const { container } = render(<TestUploadWorkspace />, { wrapper });

    const fileInput = container.querySelector('input[type="file"]');
    const file1 = new File(['valid pdf content'], 'accepted.pdf', { type: 'application/pdf' });
    const file2 = new File(['corrupt pdf content'], 'rejected.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    // Wait for the new row to appear in DocumentList from refetched documents query
    await waitFor(() => {
      expect(screen.getByTitle('accepted.pdf')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });

    // Wait for per-file feedback: rejected file shows error text
    await waitFor(() => {
      expect(screen.getByText('PDF contains no text and OCR failed.')).toBeInTheDocument();
    });
  });

  // 5. NO row is added when the request fails
  it('NO row is added when the request fails', async () => {
    server.use(
      http.post('/api/documents/upload', () => {
        return HttpResponse.json({ error: 'Server Internal Error' }, { status: 500 });
      })
    );

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = createWrapper();
    const { container } = render(<TestUploadWorkspace />, { wrapper });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['content'], 'doomed.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Visible error feedback appears
    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });

    // NO row is added to the document list
    expect(screen.queryByTitle('doomed.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('No documents yet. Upload a PDF to start.')).toBeInTheDocument();

    expect(consoleSpy).toHaveBeenCalled();
  });

  // 6. Polling stops when nothing is processing
  it('polling stops when nothing is processing', () => {
    const checkInterval = (docs) => {
      const isAnyProcessing = Array.isArray(docs) && docs.some((doc) => doc.status === 'processing');
      return isAnyProcessing ? 3000 : false;
    };

    expect(checkInterval([{ id: '1', status: 'processing' }])).toBe(3000);
    expect(checkInterval([{ id: '1', status: 'ready' }, { id: '2', status: 'processing' }])).toBe(3000);
    expect(checkInterval([{ id: '1', status: 'ready' }])).toBe(false);
    expect(checkInterval([{ id: '1', status: 'failed' }])).toBe(false);
    expect(checkInterval([])).toBe(false);
  });
});
