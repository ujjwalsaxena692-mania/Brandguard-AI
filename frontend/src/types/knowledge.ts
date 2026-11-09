export type KnowledgeCategory = 'guidelines' | 'facts' | 'claims' | 'terminology' | 'assets'

export type KnowledgeStatus = 'approved' | 'pending_review' | 'draft' | 'archived'

export interface KnowledgeEntry {
  id: string
  title: string
  category: KnowledgeCategory
  /** The "knowledge type" within the category, e.g. "Tone of voice" or "Pricing". */
  subtype: string
  /** Full guideline / fact / claim / term text. */
  description: string
  /** Where the knowledge comes from, so future AI analysis can cite it. */
  source: string
  /** Supporting evidence (claims only). */
  evidence: string
  status: KnowledgeStatus
  /** Validity / expiry date as YYYY-MM-DD, or null when it does not expire. */
  validUntil: string | null
  /** ISO timestamps. */
  createdAt: string
  updatedAt: string
  /** Set when the entry is approved; null otherwise. */
  approvedAt: string | null
}

/** The editable fields (what the Add / Edit form produces). */
export interface KnowledgeInput {
  title: string
  category: KnowledgeCategory
  subtype: string
  description: string
  source: string
  evidence: string
  status: KnowledgeStatus
  validUntil: string
}
