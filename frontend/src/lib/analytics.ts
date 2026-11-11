/**
 * Brand Analytics: read-only metrics derived from the existing stores.
 *
 * Rules this module follows:
 * - Every number is counted or averaged from a real record in a store. Nothing is estimated, smoothed or filled in.
 * - A metric that cannot be calculated is `null`, never 0.
 * - Every metric carries the origin (demo / real) of the records behind it.
 * - An AI score is never treated as a review decision, and an unsupported claim is never treated as false.
 */
import { CATEGORY_LABELS as SUGGESTION_CATEGORY_LABELS } from '@/lib/correction'
import { SEVERITIES, SEVERITY_LABELS } from '@/lib/analysis'
import { isInRange, resolveRange, toTime } from '@/lib/date-range'
import { buildContentRecords, combineOrigins, STAGE_LABELS, STAGE_ORDER, type ContentRecord, type SourceData } from '@/lib/insights-source'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { AnalysisReport, ClaimSeverity } from '@/types/analysis'
import type { SuggestionCategory } from '@/types/correction'
import type {
  AnalyticsInsight,
  AnalyticsKpi,
  AnalyticsSnapshot,
  DataOrigin,
  DateRangeFilter,
  Distribution,
  DistributionDatum,
  TrendPoint,
} from '@/types/insights'
import type { ReviewStatus } from '@/types/review'

/** Fewest analyses needed before the module will describe a direction. */
export const MIN_TREND_ANALYSES = 3
/** Fewest items needed before "most common" is reported as a pattern. */
export const MIN_PATTERN_ITEMS = 2
/** A score must move by at least this many points before it is called up or down. */
const TREND_THRESHOLD = 5

const REVIEW_DECISION_LABELS: Record<ReviewStatus, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
  pending: 'Pending',
}
const REVIEW_DECISION_ORDER: readonly ReviewStatus[] = ['approved', 'rejected', 'changes_requested', 'pending']

export function isValidScore(score: unknown): score is number {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100
}

const origin = (report: AnalysisReport): DataOrigin => (report.isDemo ? 'demo' : 'real')

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Mean, or null for an empty list. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const round1 = (value: number) => Math.round(value * 10) / 10

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function makeDistribution(data: DistributionDatum[], origins: Iterable<DataOrigin>): Distribution {
  return { data, total: data.reduce((sum, item) => sum + item.value, 0), source: combineOrigins(origins) }
}

function countBy<T, K extends string>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return groups
}

/** The leading entries of a count list, including every tie. */
function leaders<K extends string>(counts: ReadonlyMap<K, number>): { keys: K[]; count: number } | null {
  let best = 0
  for (const value of counts.values()) best = Math.max(best, value)
  if (best === 0) return null
  return { keys: [...counts.entries()].filter(([, value]) => value === best).map(([key]) => key), count: best }
}

function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/** Describes the latest score against the average of the earlier ones. Null when there are too few analyses. */
export function describeScoreMovement(points: readonly TrendPoint[]): { direction: 'up' | 'down' | 'steady'; latest: number; earlierMean: number; earlierCount: number } | null {
  if (points.length < MIN_TREND_ANALYSES) return null
  const latest = points[points.length - 1].score
  const earlier = points.slice(0, -1).map((point) => point.score)
  const earlierMean = mean(earlier) as number
  const delta = latest - earlierMean
  const direction = delta >= TREND_THRESHOLD ? 'up' : delta <= -TREND_THRESHOLD ? 'down' : 'steady'
  return { direction, latest, earlierMean, earlierCount: earlier.length }
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export function computeAnalytics(data: SourceData, filter: DateRangeFilter, nowMs: number): AnalyticsSnapshot {
  const range = resolveRange(filter, nowMs)
  const bounded = range.from !== null || range.to !== null

  const allRecords = buildContentRecords(data)
  const records = allRecords.filter((record) => isInRange(record.date, range))
  const submitted = records.filter((record) => record.stage !== 'draft')
  const reviewed = records.filter((record) => record.review !== null)
  const reports = data.reports.filter((report) => isInRange(report.analysedAt, range))

  const undatedExcluded = bounded
    ? allRecords.filter((record) => record.date === null).length + data.reports.filter((report) => toTime(report.analysedAt) === null).length
    : 0

  // --- Compliance trend: one point per genuine analysis, in time order. Nothing is aggregated or interpolated.
  const trendPoints: TrendPoint[] = reports
    .filter((report) => isValidScore(report.overallScore) && toTime(report.analysedAt) !== null)
    .map((report) => ({
      id: report.id,
      title: report.title,
      at: report.analysedAt,
      time: toTime(report.analysedAt) as number,
      score: report.overallScore,
      source: origin(report),
    }))
    .sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))

  // --- KPIs
  const scores = reports.filter((report) => isValidScore(report.overallScore))
  const excludedScores = reports.length - scores.length
  const average = mean(scores.map((report) => report.overallScore))

  const reviewCount = (status: ReviewStatus) => reviewed.filter((record) => record.review?.status === status)
  const pending = reviewCount('pending')
  const approved = reviewCount('approved')
  const rejected = reviewCount('rejected')

  const countKpi = (id: AnalyticsKpi['id'], label: string, items: readonly ContentRecord[], note: string): AnalyticsKpi => ({
    id,
    label,
    value: items.length,
    display: String(items.length),
    source: combineOrigins(items.map((item) => item.origin)),
    note: items.length === 0 ? `No matching records in this period. ${note}` : note,
  })

  const kpis: AnalyticsKpi[] = [
    countKpi('total_submissions', 'Total submissions', submitted, 'Submitted content. Drafts are not counted.'),
    {
      id: 'analyses_completed',
      label: 'Analyses completed',
      value: reports.length,
      display: String(reports.length),
      source: combineOrigins(reports.map(origin)),
      note: reports.length === 0 ? 'No analysis results in this period.' : 'Analysis results available in the app. No analysis engine exists yet, so these are demo results.',
    },
    {
      id: 'average_score',
      label: 'Average compliance score',
      value: average === null ? null : round1(average),
      display: average === null ? '—' : `${round1(average)}%`,
      source: average === null ? 'none' : combineOrigins(scores.map(origin)),
      note:
        average === null
          ? 'Unavailable: there are no analysed records with a valid score in this period.'
          : `Mean of ${plural(scores.length, 'analysis score', 'analysis scores')}${excludedScores > 0 ? `; ${plural(excludedScores, 'record', 'records')} without a valid score left out` : ''}. An AI score is not a review decision.`,
    },
    countKpi('pending_reviews', 'Pending human reviews', pending, 'Items waiting for a human reviewer, as they stand now.'),
    countKpi('approved', 'Approved content', approved, 'Approved by a human reviewer. AI scores never approve content.'),
    countKpi('rejected', 'Rejected content', rejected, 'Rejected by a human reviewer.'),
  ]

  // --- Status distribution: only stages that have records.
  const byStage = countBy(records, (record) => record.stage)
  const statusData: DistributionDatum[] = STAGE_ORDER.flatMap((stage) => {
    const items = byStage.get(stage)
    return items && items.length > 0 ? [{ key: stage, label: STAGE_LABELS[stage], value: items.length }] : []
  })
  const status = makeDistribution(statusData, records.map((record) => record.origin))

  // --- Severity distribution: findings that are NOT "supported". Supported claims are not issues.
  const issues = reports.flatMap((report) =>
    report.claims.filter((claim) => claim.classification !== 'supported').map((claim) => ({ severity: claim.severity, report })),
  )
  const severityCounts = new Map<ClaimSeverity, number>(SEVERITIES.map((severity) => [severity, 0]))
  for (const issue of issues) severityCounts.set(issue.severity, (severityCounts.get(issue.severity) ?? 0) + 1)
  const severity = makeDistribution(
    SEVERITIES.map((key) => ({ key, label: SEVERITY_LABELS[key], value: severityCounts.get(key) ?? 0 })),
    issues.map((issue) => origin(issue.report)),
  )

  // --- Content type distribution: submitted content only, with a visible bucket for records with no type.
  const byType = countBy(submitted, (record) => record.contentType ?? 'unspecified')
  const typeData: DistributionDatum[] = [...byType.entries()]
    .map(([key, items]) => ({ key, label: key === 'unspecified' ? 'Not specified' : CONTENT_TYPE_LABELS[key], value: items.length }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
  const contentType = makeDistribution(typeData, submitted.map((record) => record.origin))

  // --- Review decision distribution: the current state of each review record.
  const reviewDecisions = makeDistribution(
    REVIEW_DECISION_ORDER.map((key) => ({ key, label: REVIEW_DECISION_LABELS[key], value: reviewCount(key).length })),
    reviewed.map((record) => record.origin),
  )

  // --- Insights
  const insights: AnalyticsInsight[] = []

  // 1. Most common issue category, from the correction suggestions for analyses in range.
  const reportIds = new Set(reports.map((report) => report.id))
  const suggestionCases = data.cases.filter((item) => reportIds.has(item.analysisReportId))
  const categoryCounts = new Map<SuggestionCategory, number>()
  for (const item of suggestionCases) {
    for (const suggestion of item.suggestions) categoryCounts.set(suggestion.category, (categoryCounts.get(suggestion.category) ?? 0) + 1)
  }
  const suggestionTotal = [...categoryCounts.values()].reduce((sum, value) => sum + value, 0)
  const categoryLead = leaders(categoryCounts)
  const categorySource = combineOrigins(suggestionCases.map((item) => (item.isDemo ? 'demo' : 'real')))
  insights.push(
    categoryLead && suggestionTotal >= MIN_PATTERN_ITEMS
      ? {
          id: 'issue_category',
          title: 'Most common issue category',
          text: `${joinLabels(categoryLead.keys.map((key) => SUGGESTION_CATEGORY_LABELS[key]))} ${categoryLead.keys.length > 1 ? 'are' : 'is'} the most common ${categoryLead.keys.length > 1 ? 'categories' : 'category'} of correction suggestion (${categoryLead.count} of ${suggestionTotal}${categoryLead.keys.length > 1 ? ' each' : ''}).`,
          unavailableReason: null,
          source: categorySource,
        }
      : {
          id: 'issue_category',
          title: 'Most common issue category',
          text: null,
          unavailableReason: `Needs at least ${MIN_PATTERN_ITEMS} correction suggestions in this period; there ${suggestionTotal === 1 ? 'is 1' : `are ${suggestionTotal}`}.`,
          source: 'none',
        },
  )

  // 2. Most frequently submitted content type.
  const typeCounts = new Map<string, number>(typeData.map((item) => [item.key, item.value]))
  const typeLead = leaders(typeCounts)
  insights.push(
    typeLead && contentType.total >= MIN_PATTERN_ITEMS
      ? {
          id: 'content_type',
          title: 'Most frequently submitted content type',
          text: `${joinLabels(typeLead.keys.map((key) => typeData.find((item) => item.key === key)?.label ?? key))} ${typeLead.keys.length > 1 ? 'are tied' : 'leads'} with ${plural(typeLead.count, 'submission', 'submissions')}${typeLead.keys.length > 1 ? ' each' : ''} out of ${contentType.total}.`,
          unavailableReason: null,
          source: contentType.source,
        }
      : {
          id: 'content_type',
          title: 'Most frequently submitted content type',
          text: null,
          unavailableReason: `Needs at least ${MIN_PATTERN_ITEMS} submissions in this period; there ${contentType.total === 1 ? 'is 1' : `are ${contentType.total}`}.`,
          source: 'none',
        },
  )

  // 3. Pending reviews, as they stand now.
  insights.push(
    reviewed.length === 0
      ? {
          id: 'pending_reviews',
          title: 'Pending human reviews',
          text: null,
          unavailableReason: 'There are no review records in this period.',
          source: 'none',
        }
      : {
          id: 'pending_reviews',
          title: 'Pending human reviews',
          text:
            pending.length === 0
              ? `No item is waiting for a human decision (${plural(reviewed.length, 'review record', 'review records')} in this period).`
              : `${plural(pending.length, 'item is', 'items are')} waiting for a human decision, out of ${plural(reviewed.length, 'review record', 'review records')} in this period.`,
          unavailableReason: null,
          source: combineOrigins(reviewed.map((record) => record.origin)),
        },
  )

  // 4. Recent compliance movement. Only described with enough analyses.
  const movement = describeScoreMovement(trendPoints)
  const trendSource = combineOrigins(trendPoints.map((point) => point.source))
  insights.push(
    movement
      ? {
          id: 'compliance_trend',
          title: 'Recent compliance trend',
          text: `The latest score (${movement.latest}) is ${movement.direction === 'steady' ? 'within 5 points of' : `${round1(Math.abs(movement.latest - movement.earlierMean))} points ${movement.direction === 'up' ? 'above' : 'below'}`} the average of the ${movement.earlierCount} earlier ${movement.earlierCount === 1 ? 'analysis' : 'analyses'} (${round1(movement.earlierMean)}). This compares ${plural(trendPoints.length, 'analysis', 'analyses')}; it is an observation, not a statistical trend.`,
          unavailableReason: null,
          source: trendSource,
        }
      : {
          id: 'compliance_trend',
          title: 'Recent compliance trend',
          text: null,
          unavailableReason: `Needs at least ${MIN_TREND_ANALYSES} analyses in this period to describe a direction; there ${trendPoints.length === 1 ? 'is 1' : `are ${trendPoints.length}`}.`,
          source: 'none',
        },
  )

  // 5. Most common severity among issues.
  const severityLead = leaders(severityCounts)
  insights.push(
    severityLead && issues.length >= MIN_PATTERN_ITEMS
      ? {
          id: 'severity',
          title: 'Most common issue severity',
          text: `${joinLabels(severityLead.keys.map((key) => SEVERITY_LABELS[key]))} ${severityLead.keys.length > 1 ? 'are tied' : 'is the most common severity'} with ${plural(severityLead.count, 'finding', 'findings')}${severityLead.keys.length > 1 ? ' each' : ''} out of ${issues.length}. Supported claims are not counted as issues.`,
          unavailableReason: null,
          source: severity.source,
        }
      : {
          id: 'severity',
          title: 'Most common issue severity',
          text: null,
          unavailableReason: `Needs at least ${MIN_PATTERN_ITEMS} contradicted or unsupported findings in this period; there ${issues.length === 1 ? 'is 1' : `are ${issues.length}`}.`,
          source: 'none',
        },
  )

  return {
    range,
    kpis,
    trend: { points: trendPoints, source: trendSource },
    status,
    severity,
    contentType,
    reviewDecisions,
    insights,
    coverage: { undatedExcluded, issueCount: issues.length },
    noRecords: allRecords.length === 0 && data.reports.length === 0,
  }
}
