import type { ContentType } from '@/types/submission'

export type ClaimClassification = 'supported' | 'contradicted' | 'unsupported'

export type ClaimSeverity = 'critical' | 'high' | 'medium' | 'low'

export type ComplianceStatus = 'excellent' | 'needs_review' | 'critical'

/** The approved brand knowledge a claim was matched against. */
export interface MatchedKnowledge {
  title: string
  /** e.g. "Approved fact · Pricing". */
  category: string
  excerpt: string
}

export interface AnalysisClaim {
  id: string
  /** The claim exactly as it appears in the content. */
  text: string
  classification: ClaimClassification
  severity: ClaimSeverity
  /** One or two sentences shown on the claim card. */
  explanation: string
  /** Longer explanation shown in the detail view. */
  detail: string
  matched: MatchedKnowledge | null
  /** Source reference for the evidence, or null when none was found. */
  evidenceRef: string | null
  /** Contradicted claims: the part of `text` that conflicts (highlighted). */
  conflictingText?: string
  /** Unsupported claims: the evidence or approval that is missing. */
  missingEvidence?: string
  recommendedAction: string
}

/**
 * One analysis result for one submission. A backend response should map to this
 * shape. `isDemo` is true for every record produced by the demo data layer.
 */
export interface AnalysisReport {
  id: string
  isDemo: boolean
  submissionId: string
  title: string
  contentType: ContentType
  /** ISO timestamps. */
  submittedAt: string
  analysedAt: string
  /** 0-100. */
  overallScore: number
  claims: AnalysisClaim[]
  strongPoints: string[]
  risks: string[]
  nextSteps: string[]
}
