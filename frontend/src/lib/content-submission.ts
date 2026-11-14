import type {
  ApiAttachment,
  ApiSubmission,
  ApiSubmissionDetail,
  SubmissionPayload,
  SubmissionStatus,
} from '@/types/content-submission'
import type { SubmissionFormValues } from '@/types/submission'

/**
 * Honest labels: a submission only ever becomes "Ready for analysis". Nothing in this phase
 * analyses, scores or approves content, and the wording must never suggest otherwise.
 */
export const STATUS_META: Record<SubmissionStatus, { label: string; description: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  draft: { label: 'Draft', description: 'Not submitted yet. You can still edit it.', tone: 'neutral' },
  submitted: { label: 'Submitted', description: 'Received. Preparing the content for analysis.', tone: 'primary' },
  processing: { label: 'Processing', description: 'Preparing the content for analysis.', tone: 'primary' },
  ready_for_analysis: {
    label: 'Ready for analysis',
    description: 'Content is prepared. It has not been analysed, reviewed or approved.',
    tone: 'success',
  },
  failed: { label: 'Failed', description: 'The content could not be prepared. Reopen it to fix the problem.', tone: 'danger' },
  cancelled: { label: 'Cancelled', description: 'Withdrawn. It will not be analysed.', tone: 'neutral' },
}

export const STATUS_FILTERS: readonly { value: SubmissionStatus; label: string }[] = (
  Object.keys(STATUS_META) as SubmissionStatus[]
).map((value) => ({ value, label: STATUS_META[value].label }))

/** What the backend allows per state (it enforces these too; the UI only hides impossible actions). */
export const canEdit = (status: SubmissionStatus) => status === 'draft'
export const canCancel = (status: SubmissionStatus) =>
  status === 'draft' || status === 'submitted' || status === 'ready_for_analysis' || status === 'failed'
export const canReopen = (status: SubmissionStatus) => status === 'failed'
export const canDelete = (status: SubmissionStatus) =>
  status === 'draft' || status === 'failed' || status === 'cancelled'

export const ATTACHMENT_LABELS: Record<ApiAttachment['status'], string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  ready: 'Text extracted',
  failed: 'Could not be read',
}

export function isSubmission(value: ApiSubmission | null | undefined): value is ApiSubmission {
  return value !== null && value !== undefined
}

const orNull = (value: string): string | null => value.trim() || null

/** Form values -> the editable fields the API accepts (nothing server-owned is ever sent). */
export function toPayload(values: SubmissionFormValues): SubmissionPayload {
  return {
    title: values.title.trim(),
    content_type: values.contentType === '' ? null : values.contentType,
    content_text: values.contentText,
    campaign_name: orNull(values.campaignName),
    target_audience: orNull(values.targetAudience),
    platform: orNull(values.platform),
    publishing_date: values.publishingDate || null,
    reviewer_context: orNull(values.reviewerContext),
  }
}

export function detailToValues(detail: ApiSubmissionDetail): SubmissionFormValues {
  return {
    title: detail.title,
    contentType: detail.content_type ?? '',
    contentText: detail.content_text,
    campaignName: detail.campaign_name ?? '',
    targetAudience: detail.target_audience ?? '',
    platform: detail.platform ?? '',
    publishingDate: detail.publishing_date ?? '',
    reviewerContext: detail.reviewer_context ?? '',
  }
}

/** A short id for display ("4f9a1c2e"); the full id is never needed by the user. */
export const shortId = (id: string): string => id.slice(0, 8)
