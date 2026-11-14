import { extensionOf, formatBytes } from '@/lib/files'
import { todayISO } from '@/lib/knowledge'
import type { ContentType, SubmissionFormValues } from '@/types/submission'

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

/** Only the formats the server can validate and read (same as the Knowledge Hub). */
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  pdf: 'PDF document',
  docx: 'Word document (DOCX)',
  txt: 'Plain text (TXT)',
}

export const FILE_ACCEPT = '.pdf,.docx,.txt'

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

/** Returns a message when the file cannot be added, otherwise null. */
export function validateFile(file: File, existing: readonly { name: string; size: number }[]): string | null {
  if (!(extensionOf(file.name) in ALLOWED_FILE_TYPES)) {
    return `“${file.name}” is not a supported type. Use PDF, DOCX or TXT.`
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

/**
 * Mirrors the server rules (which re-check everything): a title, a content type, and either at
 * least `contentMin` characters of text or at least one attached document to read.
 */
export function validateSubmission(values: SubmissionFormValues, attachmentCount: number): SubmissionErrors {
  const errors: SubmissionErrors = {}
  validateTitle(values, errors)

  if (!values.contentType) errors.contentType = 'Choose a content type.'

  const text = values.contentText.trim()
  if (values.contentText.length > LIMITS.contentMax) {
    errors.contentText = `The content is ${values.contentText.length.toLocaleString()} characters. The limit is ${LIMITS.contentMax.toLocaleString()}.`
  } else if (attachmentCount === 0) {
    if (!text) errors.contentText = 'Enter the content you want reviewed, or attach a document.'
    else if (text.length < LIMITS.contentMin) {
      errors.contentText = `Add a little more: at least ${LIMITS.contentMin} characters are needed for a meaningful review (currently ${text.length}).`
    }
  }

  validateOptional(values, errors)
  return errors
}

export function isFormDirty(values: SubmissionFormValues, attachmentCount: number): boolean {
  return attachmentCount > 0 || Object.values(values).some((value) => value.trim() !== '')
}
