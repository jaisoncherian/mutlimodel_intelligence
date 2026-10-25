/**
 * @file JSDoc type definitions derived strictly from real API responses.
 * Never invent fields: all properties mirror backend models and fixtures.
 */

/**
 * @typedef {Object} DocumentSummary
 * @property {string} id - UUID of document
 * @property {string} filename - original filename
 * @property {'ready'|'processing'|'failed'} status - current ingestion status
 * @property {number|null} [page_count] - total page count
 * @property {number|null} [chunk_count] - number of indexed chunks
 * @property {string|null} [uploaded_at] - ISO 8601 upload timestamp
 */

/**
 * @typedef {Object} DocumentDetails
 * @property {string} id - UUID of document
 * @property {string} filename - original filename
 * @property {'ready'|'processing'|'failed'} status - ingestion status
 * @property {number|null} [page_count]
 * @property {number|null} [chunk_count]
 * @property {string|null} [uploaded_at]
 * @property {string|null} [error_message] - error message if processing failed
 */

/**
 * @typedef {Object} UploadResult
 * @property {string} filename
 * @property {string|null} [document_id]
 * @property {string|null} [status]
 * @property {string|null} [error]
 */

/**
 * @typedef {Object} TableData
 * @property {number} table_index
 * @property {Array<string>} headers
 * @property {Array<Array<any>>} rows
 * @property {string|null} [markdown]
 */

/**
 * @typedef {Object} PageResponse
 * @property {number} page_number
 * @property {string|null} text
 * @property {string|null} extraction_method
 * @property {boolean} is_scanned
 * @property {number|null} ocr_confidence
 * @property {Array<TableData>} tables
 */

/**
 * @typedef {Object} PageImageResponse
 * @property {string} url - temporary signed URL for page PNG
 */

/**
 * @typedef {Object} ConversationSummary
 * @property {string} id - UUID
 * @property {string} title
 * @property {string|null} user_id
 * @property {string} created_at - ISO 8601 timestamp
 */

/**
 * @typedef {Object} StoredCitation
 * @property {number} id
 * @property {number} message_id
 * @property {string} doc_id
 * @property {string} filename
 * @property {number} page_number
 * @property {string|null} section
 * @property {string|null} snippet
 * @property {string|null} content_type
 */

/**
 * @typedef {Object} StoredMessage
 * @property {number} id
 * @property {string} conversation_id
 * @property {'user'|'assistant'} role
 * @property {string} content
 * @property {boolean} used_vision
 * @property {any} [verification]
 * @property {Array<StoredCitation>} citations
 * @property {string} created_at
 */

/**
 * @typedef {Object} AskCitation
 * @property {string} source_id - e.g. "S1", "IMG1"
 * @property {string} doc_id
 * @property {string} filename
 * @property {Array<string>} also_in
 * @property {number} page
 * @property {string|null} section
 * @property {string|null} content_type
 * @property {string} snippet
 */

/**
 * @typedef {Object} CalculationOperand
 * @property {string} label
 * @property {string} source
 * @property {string} value_text
 */

/**
 * @typedef {Object} Calculation
 * @property {string} id - e.g. "c1"
 * @property {string} operation
 * @property {Array<CalculationOperand>} operands
 * @property {number} result
 * @property {string} formatted
 * @property {string|null} [unit]
 */

/**
 * @typedef {Object} RejectedCalculation
 * @property {string} id
 * @property {string} operation
 * @property {string} reason
 */

/**
 * @typedef {Object} VerificationCheck
 * @property {string} name - "citation_validity" | "number_grounding" | "claim_support" | "answer_coverage"
 * @property {'deterministic'|'heuristic'} kind
 * @property {boolean} passed
 * @property {any} details
 */

/**
 * @typedef {Object} VerificationClaim
 * @property {number} [claim_index]
 * @property {string} text
 * @property {Array<string>} sources
 * @property {'supported'|'weak'|'unsupported'} support
 * @property {string|null} [method]
 * @property {number|null} [lexical_overlap]
 * @property {string|null} [llm_verdict]
 */

/**
 * @typedef {Object} VerificationNumber
 * @property {number|string} number
 * @property {string} raw
 * @property {number|null} [claim_index]
 * @property {string|null} [source_id]
 * @property {boolean} ok
 * @property {boolean} approximate
 * @property {string|null} [ignored_reason]
 */

/**
 * @typedef {Object} RemovedClaim
 * @property {string} text
 * @property {Array<string>} sources
 * @property {string} reason
 */

/**
 * @typedef {Object} VerificationPayload
 * @property {'ok'|'error'} state
 * @property {string} mode
 * @property {'high'|'medium'|'low'|'unchecked'|'unverified'} confidence
 * @property {Array<VerificationCheck>} checks
 * @property {Array<VerificationClaim>} claims
 * @property {Array<VerificationNumber>} numbers
 * @property {Array<string>} uncovered_sentences
 * @property {Array<RemovedClaim>} removed_claims
 * @property {Array<string>} sources_sent
 * @property {Record<string, number>} timings_ms
 * @property {string} disclaimer
 * @property {string|null} [error_reason]
 */

/**
 * @typedef {Object} AskResponse
 * @property {string} conversation_id
 * @property {number} message_id
 * @property {'answered'|'partial'|'insufficient_evidence'} status
 * @property {string} answer
 * @property {string|null} missing
 * @property {Array<AskCitation>} citations
 * @property {Array<Calculation>} calculations
 * @property {Array<RejectedCalculation>} rejected_calculations
 * @property {boolean} used_vision
 * @property {Record<string, number>} [timings_ms]
 * @property {Array<string>} [unverified_numbers]
 * @property {VerificationPayload} [verification]
 */

/**
 * @typedef {Object} SearchHitScores
 * @property {number|null} [rrf]
 * @property {number|null} [vector_similarity]
 * @property {number|null} [vector_rank]
 * @property {number|null} [keyword_rank]
 */

/**
 * @typedef {Object} SearchHit
 * @property {number} chunk_id
 * @property {string} doc_id
 * @property {string} filename
 * @property {number} page_number
 * @property {string|null} section
 * @property {string} content_type
 * @property {number|null} table_index
 * @property {string} text
 * @property {SearchHitScores} scores
 */

/**
 * @typedef {Object} NormalizedError
 * @property {number} status - HTTP status code (or 0 for network/abort errors)
 * @property {string} message - User-friendly error message from API or client
 */

export {};
