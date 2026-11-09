import { extensionOf, formatBytes } from '@/lib/files'
import { todayISO } from '@/lib/knowledge'
import type {
  AttachmentMeta,
  ContentSubmission,
  ContentType,
  FormAttachment,
  SubmissionFormValues,
} from '@/types/submission'

export const CONTENT_TYPES: readonly { value: ContentType; label: string }[] = [
  { value: 'social_post', label: 'Social Media Post' },
  { value: 'ad_copy', label: 'Advertisement Copy' },
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'email_newsletter', label: 'Email / Newsletter' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'press_release', label: 'Press Release' },
  { value: 'product_description', label: 'Product Description' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'other', label: 'Other' },
]

export const CONTENT_TYPE_LABELS = Object.fromEntries(
  CONTENT_TYPES.map((type) => [type.value, type.label]),
) as Record<ContentType, string>

export const PLATFORMS: readonly string[] = [
  'Company website',
  'Blog',
  'LinkedIn',
  'Instagram',
  'Facebook',
  'X (Twitter)',
  'YouTube',
  'Email',
  'Paid advertising',
  'Print',
  'Event or presentation',
  'Other',
]

export const LIMITS = {
  titleMin: 3,
  titleMax: 120,
  contentMin: 20,
  contentMax: 20000,
  campaignMax: 100,
  audienceMax: 150,
  contextMax: 1000,
  fileMaxBytes: 10 * 1024 * 1024,
  maxFiles: 5,
} as const

export const ALLOWED_FILE_TYPES: Record<string, string> = {
  pdf: 'PDF document',
  docx: 'Word document (DOCX)',
  txt: 'Plain text (TXT)',
  png: 'PNG image',
  jpg: 'JPEG image',
  jpeg: 'JPEG image',
}

export const FILE_ACCEPT = '.pdf,.docx,.txt,.png,.jpg,.jpeg'

export const EMPTY_VALUES: SubmissionFormValues = {
  title: '',
  contentType: '',
  contentText: '',
  campaignName: '',
  targetAudience: '',
  platform: '',
  publishingDate: '',
  reviewerContext: '',
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function toAttachmentMeta(file: File): AttachmentMeta {
  const extension = extensionOf(file.name)
  return { name: file.name, size: file.size, mimeType: file.type || 'unknown', extension }
}

/** Returns a message when the file cannot be added, otherwise null. */
export function validateFile(file: File, existing: readonly { name: string; size: number }[]): string | null {
  if (!(extensionOf(file.name) in ALLOWED_FILE_TYPES)) {
    return `“${file.name}” is not a supported type. Use PDF, DOCX, TXT, PNG or JPG.`
  }
  if (file.size === 0) return `“${file.name}” is empty.`
  if (file.size > LIMITS.fileMaxBytes) {
    return `“${file.name}” is ${formatBytes(file.size)}. The maximum is ${formatBytes(LIMITS.fileMaxBytes)} per file.`
  }
  if (existing.some((item) => item.name === file.name && item.size === file.size)) {
    return `“${file.name}” is already selected.`
  }
  if (existing.length >= LIMITS.maxFiles) return `You can attach up to ${LIMITS.maxFiles} files.`
  return null
}

export type SubmissionErrors = Partial<Record<keyof SubmissionFormValues | 'attachments', string>>

function validateOptional(values: SubmissionFormValues, errors: SubmissionErrors) {
  if (values.campaignName.trim().length > LIMITS.campaignMax) {
    errors.campaignName = `Keep the campaign name to ${LIMITS.campaignMax} characters or fewer.`
  }
  if (values.targetAudience.trim().length > LIMITS.audienceMax) {
    errors.targetAudience = `Keep the target audience to ${LIMITS.audienceMax} characters or fewer.`
  }
  if (values.reviewerContext.trim().length > LIMITS.contextMax) {
    errors.reviewerContext = `Keep the additional context to ${LIMITS.contextMax} characters or fewer.`
  }
  if (values.publishingDate) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(values.publishingDate) && !Number.isNaN(new Date(values.publishingDate).getTime())
    if (!valid) errors.publishingDate = 'Enter a valid date.'
    else if (values.publishingDate < todayISO()) errors.publishingDate = 'Choose today or a future date.'
  }
}

function validateTitle(values: SubmissionFormValues, errors: SubmissionErrors) {
  const title = values.title.trim()
  if (!title) errors.title = 'Enter a content title.'
  else if (title.length < LIMITS.titleMin) errors.title = `The title must be at least ${LIMITS.titleMin} characters.`
  else if (title.length > LIMITS.titleMax) errors.title = `The title must be ${LIMITS.titleMax} characters or fewer.`
}

/** A draft only needs a title (so it can be found later) and valid optional fields. */
export function validateDraft(values: SubmissionFormValues): SubmissionErrors {
  const errors: SubmissionErrors = {}
  validateTitle(values, errors)
  validateOptional(values, errors)
  if (values.contentText.length > LIMITS.contentMax) {
    errors.contentText = `The content is over the ${LIMITS.contentMax.toLocaleString()}-character limit.`
  }
  return errors
}

export function validateSubmission(values: SubmissionFormValues, attachments: readonly FormAttachment[]): SubmissionErrors {
  const errors: SubmissionErrors = {}
  validateTitle(values, errors)

  if (!values.contentType) errors.contentType = 'Choose a content type.'

  const text = values.contentText.trim()
  if (!text) errors.contentText = 'Enter the content you want reviewed.'
  else if (text.length < LIMITS.contentMin) {
    errors.contentText = `Add a little more: at least ${LIMITS.contentMin} characters are needed for a meaningful review (currently ${text.length}).`
  } else if (values.contentText.length > LIMITS.contentMax) {
    errors.contentText = `The content is ${values.contentText.length.toLocaleString()} characters. The limit is ${LIMITS.contentMax.toLocaleString()}.`
  }

  validateOptional(values, errors)

  const missing = attachments.filter((attachment) => attachment.file === null)
  if (missing.length > 0) {
    errors.attachments = `Re-attach or remove ${missing.map((item) => `“${item.meta.name}”`).join(', ')} before submitting. Files are not kept in saved drafts.`
  }
  return errors
}

export function isFormDirty(values: SubmissionFormValues, attachmentCount: number): boolean {
  return attachmentCount > 0 || Object.values(values).some((value) => value.trim() !== '')
}

export function submissionStatusLabel(status: ContentSubmission['status']): string {
  return status === 'submitted' ? 'Submitted — awaiting analysis' : 'Draft'
}
