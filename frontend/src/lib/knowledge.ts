import type { KnowledgeCategory, KnowledgeEntry, KnowledgeInput, KnowledgeStatus } from '@/types/knowledge'

export const CATEGORIES: readonly KnowledgeCategory[] = ['guidelines', 'facts', 'claims', 'terminology', 'assets']

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  guidelines: 'Brand Guidelines',
  facts: 'Approved Facts',
  claims: 'Approved Claims',
  terminology: 'Terminology',
  assets: 'Brand Assets',
}

export const SUBTYPES: Record<KnowledgeCategory, readonly string[]> = {
  guidelines: ['Brand identity', 'Mission and values', 'Tone of voice', 'Writing style', 'Visual identity'],
  facts: ['Product details', 'Pricing', 'Company information', 'Contact information', 'Product specifications'],
  claims: ['Performance claim', 'Security and compliance claim', 'Customer outcome claim', 'Sustainability claim'],
  terminology: ['Preferred term', 'Prohibited term', 'Alternative phrase', 'Capitalisation rule'],
  assets: ['Logo', 'Brand colours', 'Typography', 'Other resource'],
}

export const STATUSES: readonly KnowledgeStatus[] = ['approved', 'pending_review', 'draft', 'archived']

export const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  approved: 'Approved',
  pending_review: 'Pending Review',
  draft: 'Draft',
  archived: 'Archived',
}

/** Today as YYYY-MM-DD in the user's local time zone. */
export function todayISO(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function isExpired(entry: { validUntil: string | null }): boolean {
  return Boolean(entry.validUntil) && (entry.validUntil as string) < todayISO()
}

export type ApprovalField = 'source' | 'evidence' | 'validUntil'

export interface ApprovalBlocker {
  field: ApprovalField
  message: string
}

type Approvable = Pick<KnowledgeInput, 'category' | 'source' | 'evidence'> & { validUntil: string | null }

/**
 * Reasons an entry cannot be approved (or treated as authoritative).
 * Facts and claims need a source; claims also need supporting evidence;
 * nothing past its validity date can be approved.
 */
export function getApprovalBlockers(entry: Approvable): ApprovalBlocker[] {
  const blockers: ApprovalBlocker[] = []
  if ((entry.category === 'facts' || entry.category === 'claims') && !entry.source.trim()) {
    blockers.push({ field: 'source', message: 'Approved facts and claims need a source reference.' })
  }
  if (entry.category === 'claims' && !entry.evidence.trim()) {
    blockers.push({ field: 'evidence', message: 'A claim cannot be approved without supporting evidence.' })
  }
  if (isExpired(entry)) {
    blockers.push({ field: 'validUntil', message: 'The validity date has passed, so this cannot be approved.' })
  }
  return blockers
}

/** Only approved, in-date entries with the required evidence count as authoritative brand evidence. */
export function isAuthoritative(entry: KnowledgeEntry): boolean {
  return entry.status === 'approved' && getApprovalBlockers(entry).length === 0
}

export type FieldErrors = Partial<Record<keyof KnowledgeInput, string>>

export function validateKnowledge(input: KnowledgeInput): FieldErrors {
  const errors: FieldErrors = {}
  const title = input.title.trim()
  const description = input.description.trim()

  if (!title) errors.title = 'Enter a title.'
  else if (title.length < 3) errors.title = 'The title must be at least 3 characters.'
  else if (title.length > 120) errors.title = 'The title must be 120 characters or fewer.'

  if (!CATEGORIES.includes(input.category)) errors.category = 'Choose a category.'

  if (!input.subtype) errors.subtype = 'Choose a knowledge type.'
  else if (CATEGORIES.includes(input.category) && !SUBTYPES[input.category].includes(input.subtype)) {
    errors.subtype = 'Choose a type that belongs to this category.'
  }

  if (!description) errors.description = 'Enter the guideline, fact, claim or term text.'
  else if (description.length < 10) errors.description = 'Add a little more detail (at least 10 characters).'
  else if (description.length > 2000) errors.description = 'Keep this to 2,000 characters or fewer.'

  if (input.source.trim().length > 200) errors.source = 'Keep the source reference to 200 characters or fewer.'
  if (input.evidence.trim().length > 1000) errors.evidence = 'Keep the evidence to 1,000 characters or fewer.'

  if (input.validUntil) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(input.validUntil) && !Number.isNaN(new Date(input.validUntil).getTime())
    if (!valid) errors.validUntil = 'Enter a valid date.'
  }

  if (!STATUSES.includes(input.status)) errors.status = 'Choose a status.'

  if (input.status === 'approved') {
    const claimsOnly = input.category === 'claims'
    for (const blocker of getApprovalBlockers({
      category: input.category,
      source: input.source,
      evidence: claimsOnly ? input.evidence : '',
      validUntil: input.validUntil || null,
    })) {
      if (!errors[blocker.field]) errors[blocker.field] = blocker.message
    }
  }

  return errors
}
