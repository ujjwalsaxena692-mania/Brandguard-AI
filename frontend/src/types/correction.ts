import type { ClaimSeverity } from '@/types/analysis'
import type { ContentType } from '@/types/submission'

export type SuggestionCategory =
  | 'contradicted_claim'
  | 'unsupported_claim'
  | 'terminology'
  | 'tone_voice'
  | 'brand_guideline'
  | 'promotional_claim'

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected'

export type SuggestionFilter = 'all' | SuggestionStatus

/** The approved guideline or knowledge entry a suggestion is based on. */
export interface SuggestionGuideline {
  title: string
  /** e.g. "Terminology · Prohibited term". */
  category: string
  excerpt: string
}

export interface CorrectionSuggestion {
  id: string
  /** The analysis claim this relates to, when the suggestion came from a claim finding. */
  claimId: string | null
  category: SuggestionCategory
  severity: ClaimSeverity
  /** Exact text to find in the working content. Must be non-empty. */
  originalText: string
  /** Replacement text. An empty string means "remove the original text". */
  suggestedText: string
  /** One or two sentences shown on the card. */
  explanation: string
  /** Why applying this suggestion improves compliance (detail view). */
  whyItImproves: string
  guideline: SuggestionGuideline | null
  /** Source reference for the evidence, or null when there is none. */
  evidenceRef: string | null
}

/**
 * Everything the editor needs for one submission. A backend response should map
 * to this shape. `isDemo` is true for every record produced by the demo data layer;
 * suggestions are never generated for a user's own submissions.
 */
export interface CorrectionCase {
  id: string
  isDemo: boolean
  submissionId: string
  analysisReportId: string
  title: string
  contentType: ContentType
  /** The complete submitted content, with its original line breaks. */
  originalContent: string
  suggestions: CorrectionSuggestion[]
}

/** Frontend-only workflow marker. There is deliberately no approved state. */
export type WorkflowStatus = 'in_progress' | 'draft_saved' | 'ready_for_review'

/** One applied suggestion, kept so the most recent correction can be undone. */
export interface HistoryEntry {
  suggestionId: string
  textBefore: string
  textAfter: string
}

/** The working state of the editor for one case. Lives in memory only. */
export interface EditorSession {
  text: string
  statuses: Record<string, SuggestionStatus>
  /** Currently accepted suggestions, oldest first. */
  history: HistoryEntry[]
  workflow: WorkflowStatus
  /** ISO timestamps. */
  savedAt: string | null
  markedReadyAt: string | null
}

export type Applicability =
  | { state: 'applicable' }
  /** The original text is not in the working content (changed by another suggestion or by hand). */
  | { state: 'missing' }
  /** The original text appears more than once, so the target is unclear. */
  | { state: 'ambiguous'; count: number }

export type ActionResult = { ok: true; session: EditorSession } | { ok: false; message: string }

export type DiffHunk =
  | { type: 'equal'; text: string }
  | { type: 'removed'; text: string }
  | { type: 'inserted'; text: string }
  | { type: 'modified'; before: string; after: string }

export interface ChangeStats {
  inserted: number
  removed: number
  modified: number
  wordsAdded: number
  wordsRemoved: number
}
