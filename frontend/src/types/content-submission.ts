/**
 * Content submissions as returned by the BrandGuard API (backend/app/schemas/submission.py).
 * These are real, server-side records. They are separate from the in-memory demo shape in
 * ./submission.ts, which other demo modules (reviews, analysis reports) still read.
 */
import type { ContentType } from '@/types/submission'

export type { ContentType }

/** Lifecycle: draft -> submitted -> processing -> ready_for_analysis, plus failed / cancelled. */
export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'processing'
  | 'ready_for_analysis'
  | 'failed'
  | 'cancelled'

export type AttachmentStatus = 'uploaded' | 'processing' | 'ready' | 'failed'

export interface ApiAttachment {
  id: string
  original_filename: string
  mime_type: string
  size_bytes: number
  status: AttachmentStatus
  text_length: number | null
  error_message: string | null
  created_at: string
}

export interface ApiSubmission {
  id: string
  submitted_by: string | null
  title: string
  content_type: ContentType | null
  campaign_name: string | null
  target_audience: string | null
  platform: string | null
  publishing_date: string | null
  status: SubmissionStatus
  error_message: string | null
  submitted_at: string | null
  processed_at: string | null
  analysis_text_length: number | null
  created_at: string
  updated_at: string
}

export interface ApiSubmissionDetail extends ApiSubmission {
  content_text: string
  reviewer_context: string | null
  attachments: ApiAttachment[]
}

export interface SubmissionListResponse {
  items: ApiSubmission[]
  total: number
  limit: number
  offset: number
}

/** The editable fields, as sent to POST/PATCH. Only these are ever sent: the server owns the rest. */
export interface SubmissionPayload {
  title: string
  content_type: ContentType | null
  content_text: string
  campaign_name: string | null
  target_audience: string | null
  platform: string | null
  publishing_date: string | null
  reviewer_context: string | null
}

export interface SubmissionListParams {
  limit: number
  offset: number
  status?: SubmissionStatus
  q?: string
  mine?: boolean
}

/** GET /api/v1/organisation/context */
export interface OrganisationContextResponse {
  organisation_id: string
  role: 'owner' | 'admin' | 'reviewer' | 'creator'
  permissions: string[]
}
