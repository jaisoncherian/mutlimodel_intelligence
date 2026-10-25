/**
 * @file Document API module.
 * Wraps document upload, retrieval, page extraction, image signing, and deletion.
 */

import { client } from './client.js';

/**
 * List all documents.
 * @param {RequestInit} [options]
 * @returns {Promise<import('./types.js').DocumentSummary[]>}
 */
export async function listDocuments(options) {
  return client.get('/documents', options);
}

/**
 * Get single document details.
 * @param {string} id - Document UUID
 * @param {RequestInit} [options]
 * @returns {Promise<import('./types.js').DocumentDetails>}
 */
export async function getDocument(id, options) {
  return client.get(`/documents/${id}`, options);
}

/**
 * Get structured page contents (text + tables).
 * @param {string} id - Document UUID
 * @param {number} pageNumber - 1-indexed page number
 * @param {RequestInit} [options]
 * @returns {Promise<import('./types.js').PageResponse>}
 */
export async function getDocumentPage(id, pageNumber, options) {
  return client.get(`/documents/${id}/pages/${pageNumber}`, options);
}

/**
 * Fetch signed image URL for a document page.
 * @param {string} id - Document UUID
 * @param {number} pageNumber - 1-indexed page number
 * @param {RequestInit} [options]
 * @returns {Promise<import('./types.js').PageImageResponse>}
 */
export async function getPageImage(id, pageNumber, options) {
  return client.get(`/documents/${id}/pages/${pageNumber}/image`, options);
}

/**
 * Delete a document and its stored artifacts.
 * @param {string} id - Document UUID
 * @param {RequestInit} [options]
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteDocument(id, options) {
  return client.delete(`/documents/${id}`, options);
}

/**
 * Reprocess an existing document.
 * @param {string} id - Document UUID
 * @param {RequestInit} [options]
 * @returns {Promise<{ document_id: string, status: string }>}
 */
export async function reprocessDocument(id, options) {
  return client.post(`/documents/${id}/reprocess`, null, options);
}

/**
 * Upload one or more PDF files.
 * @param {File[]|FileList} files
 * @param {RequestInit} [options]
 * @returns {Promise<import('./types.js').UploadResult[]>}
 */
export async function uploadDocuments(files, options) {
  const formData = new FormData();
  Array.from(files).forEach((file) => {
    formData.append('files', file);
  });

  return client.post('/documents/upload', formData, options);
}
