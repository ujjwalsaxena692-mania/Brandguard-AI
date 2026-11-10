import type { AnalysisClaim, AnalysisReport, ClaimClassification, ClaimSeverity, ComplianceStatus } from '@/types/analysis'

export const CLASSIFICATIONS: readonly ClaimClassification[] = ['supported', 'contradicted', 'unsupported']

export const CLASSIFICATION_LABELS: Record<ClaimClassification, string> = {
  supported: 'Supported',
  contradicted: 'Contradicted',
  unsupported: 'Unsupported',
}

export const CLASSIFICATION_DESCRIPTIONS: Record<ClaimClassification, string> = {
  supported: 'Backed by approved brand knowledge.',
  contradicted: 'Conflicts with approved brand knowledge and needs correction or a human decision.',
  unsupported:
    'No approved evidence was found. This does not mean the claim is false, only that it cannot be verified from approved knowledge.',
}

export const SEVERITIES: readonly ClaimSeverity[] = ['critical', 'high', 'medium', 'low']

export const SEVERITY_LABELS: Record<ClaimSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const SEVERITY_RANK: Record<ClaimSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  excellent: 'Excellent',
  needs_review: 'Needs Review',
  critical: 'Critical Issues',
}

/**
 * Score bands match the Dashboard (85+ / 60-84 / below 60), with two safeguards
 * so a high number never hides a serious problem: a critical contradiction
 * always means "Critical Issues", and a high-severity contradiction prevents "Excellent".
 */
export function getComplianceStatus(report: Pick<AnalysisReport, 'overallScore' | 'claims'>): ComplianceStatus {
  const contradicted = report.claims.filter((claim) => claim.classification === 'contradicted')
  if (report.overallScore < 60 || contradicted.some((claim) => claim.severity === 'critical')) return 'critical'
  if (report.overallScore >= 85 && !contradicted.some((claim) => claim.severity === 'high')) return 'excellent'
  return 'needs_review'
}

export function countClaims(claims: readonly AnalysisClaim[]): Record<ClaimClassification, number> {
  const counts: Record<ClaimClassification, number> = { supported: 0, contradicted: 0, unsupported: 0 }
  for (const claim of claims) counts[claim.classification] += 1
  return counts
}

export interface ClaimFilters {
  severity: 'all' | ClaimSeverity
  query: string
}

/** Applies the severity and search filters (not the classification tab). */
export function filterClaims(claims: readonly AnalysisClaim[], { severity, query }: ClaimFilters): AnalysisClaim[] {
  const term = query.trim().toLowerCase()
  return claims.filter(
    (claim) =>
      (severity === 'all' || claim.severity === severity) &&
      (term === '' ||
        `${claim.text} ${claim.explanation} ${claim.matched?.title ?? ''} ${claim.evidenceRef ?? ''}`.toLowerCase().includes(term)),
  )
}

/** Most severe first; original order is kept within a severity. */
export function sortBySeverity(claims: readonly AnalysisClaim[]): AnalysisClaim[] {
  return [...claims].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
}
