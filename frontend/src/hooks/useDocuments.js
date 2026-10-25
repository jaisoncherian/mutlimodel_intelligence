import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listDocuments,
  uploadDocuments,
  deleteDocument,
  reprocessDocument,
} from '../api/documents.js';

export const DOCUMENTS_QUERY_KEY = ['documents'];

/**
 * Custom hook to manage document listing, polling, selection scope,
 * multi-file upload with client validation, deletion, and reprocessing.
 */
export function useDocuments() {
  const queryClient = useQueryClient();
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const prevDocStatusesRef = useRef({});

  const feedbackTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // 1. Documents Query with conditional 3s polling ONLY while any document is processing
  const documentsQuery = useQuery({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: listDocuments,
    refetchInterval: (query) => {
      const data = query.state.data;
      const isAnyProcessing = Array.isArray(data) && data.some((doc) => doc.status === 'processing');
      return isAnyProcessing ? 3000 : false;
    },
  });

  const documents = useMemo(() => {
    const list = documentsQuery.data || [];
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
      const timeA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
      const timeB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [documentsQuery.data]);

  // 2. Manage selection: newly ready documents are selected by default
  useEffect(() => {
    if (!Array.isArray(documents) || documents.length === 0) return;

    const prevStatuses = prevDocStatusesRef.current;
    const newStatuses = {};
    const newlyReadyIds = [];

    documents.forEach((doc) => {
      newStatuses[doc.id] = doc.status;
      // If it wasn't tracked yet and is ready, or transitioned from processing -> ready
      if (doc.status === 'ready') {
        const wasProcessing = prevStatuses[doc.id] === 'processing';
        const isBrandNew = prevStatuses[doc.id] === undefined;
        if (wasProcessing || isBrandNew) {
          newlyReadyIds.push(doc.id);
        }
      }
    });

    prevDocStatusesRef.current = newStatuses;

    if (newlyReadyIds.length > 0) {
      setSelectedDocIds((prev) => {
        const set = new Set(prev);
        newlyReadyIds.forEach((id) => set.add(id));
        return Array.from(set);
      });
    }

    // Prune IDs that no longer exist or are no longer ready
    setSelectedDocIds((prev) => {
      const readyIdSet = new Set(documents.filter((d) => d.status === 'ready').map((d) => d.id));
      return prev.filter((id) => readyIdSet.has(id));
    });
  }, [documents]);

  // 3. Selection Handlers
  const toggleDoc = (id) => {
    const target = documents.find((d) => d.id === id);
    if (!target || target.status !== 'ready') return;

    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const readyDocs = documents.filter((d) => d.status === 'ready');
    const allReadySelected = readyDocs.length > 0 && readyDocs.every((d) => selectedDocIds.includes(d.id));

    if (allReadySelected) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(readyDocs.map((d) => d.id));
    }
  };

  const clearAll = () => {
    setSelectedDocIds([]);
  };

  // 4. Upload Mutation: validates, builds FormData with "files", sends through API without optimistic row insertion
  const uploadMutation = useMutation({
    mutationFn: async (files) => {
      const fileList = Array.from(files || []);
      const validFiles = [];
      const clientErrors = [];

      fileList.forEach((file) => {
        const isPdf =
          file.name?.toLowerCase().endsWith('.pdf') ||
          file.type === 'application/pdf';

        if (!isPdf) {
          clientErrors.push({
            filename: file.name,
            error: 'Only PDF files are accepted.',
          });
          return;
        }
        if (file.size > 25 * 1024 * 1024) {
          clientErrors.push({
            filename: file.name,
            error: 'File is too large (25 MB limit).',
          });
          return;
        }
        validFiles.push(file);
      });

      if (import.meta.env.DEV && clientErrors.length > 0) {
        console.warn('Browser validation rejected files:', clientErrors);
      }

      let serverResults = [];
      if (validFiles.length > 0) {
        // Send directly to backend through client.js (FormData with field name "files")
        serverResults = await uploadDocuments(validFiles);
        if (import.meta.env.DEV) {
          console.log('Upload response status: 202', serverResults);
        }
      }

      return [...clientErrors, ...serverResults];
    },
    onSuccess: (results) => {
      // Update document list cache immediately with accepted files from real API response
      const acceptedDocs = (Array.isArray(results) ? results : [])
        .filter((r) => r.document_id && !r.error)
        .map((r) => ({
          id: r.document_id,
          filename: r.filename,
          status: r.status || 'processing',
          page_count: null,
          chunk_count: null,
          uploaded_at: new Date().toISOString(),
        }));

      if (acceptedDocs.length > 0) {
        queryClient.setQueryData(DOCUMENTS_QUERY_KEY, (old) => {
          const prev = Array.isArray(old) ? old : [];
          const existingIds = new Set(prev.map((d) => d.id));
          const newEntries = acceptedDocs.filter((d) => !existingIds.has(d.id));
          return [...newEntries, ...prev];
        });
      }

      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
      setUploadFeedback(results);

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setUploadFeedback(null);
      }, 5000);
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
      try {
        if (import.meta.env.DEV) {
          console.error(
            `Upload failed with status ${err?.status || 'network error'}:`,
            err?.body || err?.message || err
          );
        }
      } catch {
        console.error('Upload failed:', err);
      }
      setUploadFeedback([
        {
          filename: 'Upload failed',
          error:
            err?.message ||
            (err?.status ? `Request failed with status ${err.status}` : 'Could not process upload.'),
        },
      ]);

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setUploadFeedback(null);
      }, 5000);
    },
  });

  // 5. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (docId) => deleteDocument(docId),
    onSuccess: (_, docId) => {
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      queryClient.setQueryData(DOCUMENTS_QUERY_KEY, (old) =>
        Array.isArray(old) ? old.filter((d) => d.id !== docId) : []
      );
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });

  // 6. Reprocess Mutation
  const reprocessMutation = useMutation({
    mutationFn: (docId) => reprocessDocument(docId),
    onSuccess: (_, docId) => {
      queryClient.setQueryData(DOCUMENTS_QUERY_KEY, (old) =>
        Array.isArray(old)
          ? old.map((d) => (d.id === docId ? { ...d, status: 'processing', error_message: null } : d))
          : []
      );
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });

  return {
    documents,
    isLoading: documentsQuery.isLoading,
    isError: documentsQuery.isError,
    error: documentsQuery.error,
    selectedDocIds,
    toggleDoc,
    selectAll,
    clearAll,
    uploadMutation,
    deleteMutation,
    reprocessMutation,
    uploadFeedback,
    clearUploadFeedback: () => setUploadFeedback(null),
  };
}
