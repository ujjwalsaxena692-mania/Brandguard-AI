/**
 * Content submission records.
 *
 * `ContentSubmission` is shaped so it can be sent to a backend as-is later.
 * Attachments are recorded as metadata only: file contents are never stored,
 * uploaded or read in the current frontend-only build.
 *
 * Note: this is separate from the provisional workflow `SubmissionStatus` in
 * ./index.ts. A submission here only ever becomes "submitted"; approval and
 * analysis states belong to later steps of the workflow.
 */
export type ContentType =
  | 'social_post'
  | 'ad_copy'
  | 'blog_post'
  | 'email_newsletter'
  | 'landing_page'
  | 'press_release'
  | 'product_description'
  | 'presentation'
  | 'other'

export type ContentSubmissionStatus = 'draft' | 'submitted'

export interface AttachmentMeta {
  name: string
  size: number
  mimeType: string
  extension: string
}

/** What the form edits. */
export interface SubmissionFormValues {
  title: string
  contentType: ContentType | ''
  contentText: string
  campaignName: string
  targetAudience: string
  platform: string
  /** YYYY-MM-DD, or empty. */
  publishingDate: string
  reviewerContext: string
}

/** An attachment in the form: `file` is null when only the metadata survived (a reopened draft). */
export interface FormAttachment {
  id: string
  meta: AttachmentMeta
  file: File | null
}

export interface SubmissionInput {
  values: SubmissionFormValues
  attachments: AttachmentMeta[]
}

export interface ContentSubmission extends Omit<SubmissionFormValues, 'contentType'> {
  id: string
  contentType: ContentType | null
  attachments: AttachmentMeta[]
  status: ContentSubmissionStatus
  /** ISO timestamps. */
  createdAt: string
  updatedAt: string
  submittedAt: string | null
}
