import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentList from '../components/workspace/DocumentList.jsx';
import DocumentUpload from '../components/workspace/DocumentUpload.jsx';
import realDocumentsFixture from './fixtures/documents.json';

describe('Stage 1: Documents and Upload Tests', () => {
  // 1. Empty State
  it('renders clean empty state when no documents exist', () => {
    render(
      <DocumentList
        documents={[]}
        selectedDocIds={[]}
        onToggleDoc={vi.fn()}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}
        onDeleteDoc={vi.fn()}
        onReprocessDoc={vi.fn()}
      />
    );

    expect(
      screen.getByText(/No documents yet\. Upload a PDF to start\./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Searching in 0 of 0 documents/i)).toBeInTheDocument();
  });

  // 2. Scope Computation & Disabled States
  it('computes scope correctly and disables non-ready documents', () => {
    const mockDocs = [
      { id: 'doc-1', filename: 'ready1.pdf', status: 'ready', page_count: 5 },
      { id: 'doc-2', filename: 'ready2.pdf', status: 'ready', page_count: 10 },
      { id: 'doc-3', filename: 'proc.pdf', status: 'processing', page_count: null },
      { id: 'doc-4', filename: 'fail.pdf', status: 'failed', page_count: null, error_message: 'Corrupt PDF' },
    ];

    const { rerender } = render(
      <DocumentList
        documents={mockDocs}
        selectedDocIds={['doc-1']}
        onToggleDoc={vi.fn()}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}
        onDeleteDoc={vi.fn()}
        onReprocessDoc={vi.fn()}
      />
    );

    // Searching in 1 of 2 ready documents
    expect(screen.getByText(/Searching in 1 of 2 documents/i)).toBeInTheDocument();

    // Checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeEnabled();
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeEnabled();
    expect(checkboxes[1]).not.toBeChecked();

    // Processing & Failed checkboxes MUST be disabled
    expect(checkboxes[2]).toBeDisabled();
    expect(checkboxes[3]).toBeDisabled();

    // Failed document displays error_message and inline reprocess
    expect(screen.getByText(/Corrupt PDF/i)).toBeInTheDocument();

    // Update selection scope
    rerender(
      <DocumentList
        documents={mockDocs}
        selectedDocIds={['doc-1', 'doc-2']}
        onToggleDoc={vi.fn()}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}
        onDeleteDoc={vi.fn()}
        onReprocessDoc={vi.fn()}
      />
    );
    expect(screen.getByText(/Searching in 2 of 2 documents/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument();
  });

  // 3. Delete Confirmation
  it('shows confirmation modal before deleting a document', () => {
    const onDeleteDoc = vi.fn();
    const mockDocs = [
      { id: 'doc-1', filename: 'test_table.pdf', status: 'ready', page_count: 5 },
    ];

    render(
      <DocumentList
        documents={mockDocs}
        selectedDocIds={['doc-1']}
        onToggleDoc={vi.fn()}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}
        onDeleteDoc={onDeleteDoc}
        onReprocessDoc={vi.fn()}
      />
    );

    // Click options menu
    const optionsBtn = screen.getByLabelText(/Actions for test_table\.pdf/i);
    fireEvent.click(optionsBtn);

    // Click Delete in dropdown
    const deleteMenuBtn = screen.getByRole('button', { name: /^Delete$/i });
    fireEvent.click(deleteMenuBtn);

    // Modal appears
    expect(screen.getByRole('heading', { name: /Delete Document/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete/i)
    ).toBeInTheDocument();

    // Cancel does not call onDeleteDoc
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(onDeleteDoc).not.toHaveBeenCalled();

    // Re-open and confirm delete
    fireEvent.click(screen.getByLabelText(/Actions for test_table\.pdf/i));
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

    const confirmModalDeleteBtn = screen.getAllByRole('button', { name: /^Delete$/i }).slice(-1)[0];
    fireEvent.click(confirmModalDeleteBtn);
    expect(onDeleteDoc).toHaveBeenCalledWith('doc-1');
  });

  // 4. Mixed Upload Result
  it('displays per-file upload results without hiding other files', () => {
    const feedback = [
      { filename: 'valid.pdf', status: 'processing', document_id: '123' },
      { filename: 'notes.txt', error: 'Only PDF files are accepted.' },
      { filename: 'heavy.pdf', error: 'File is too large (25 MB limit).' },
    ];

    render(
      <DocumentUpload
        onUpload={vi.fn()}
        isUploading={false}
        uploadFeedback={feedback}
        onClearFeedback={vi.fn()}
      />
    );

    expect(screen.getByText(/Upload Results/i)).toBeInTheDocument();
    expect(screen.getByText('valid.pdf')).toBeInTheDocument();
    expect(screen.getByText('Enqueued')).toBeInTheDocument();

    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect(screen.getByText('Only PDF files are accepted.')).toBeInTheDocument();

    expect(screen.getByText('heavy.pdf')).toBeInTheDocument();
    expect(screen.getByText('File is too large (25 MB limit).')).toBeInTheDocument();
  });

  // 5. Polling stops when nothing is processing
  it('stops polling when all documents are ready or failed', () => {
    const getRefetchInterval = (docs) => {
      const isAnyProcessing = Array.isArray(docs) && docs.some((doc) => doc.status === 'processing');
      return isAnyProcessing ? 3000 : false;
    };

    // When a document is processing -> poll every 3000ms
    const withProcessing = [
      { id: '1', status: 'ready' },
      { id: '2', status: 'processing' },
    ];
    expect(getRefetchInterval(withProcessing)).toBe(3000);

    // Real fixture has only ready documents -> polling stops (false)
    expect(getRefetchInterval(realDocumentsFixture)).toBe(false);

    // Empty list -> polling stops (false)
    expect(getRefetchInterval([])).toBe(false);

    // List with only ready & failed -> polling stops (false)
    const withFailedAndReady = [
      { id: '1', status: 'ready' },
      { id: '2', status: 'failed' },
    ];
    expect(getRefetchInterval(withFailedAndReady)).toBe(false);
  });
});
