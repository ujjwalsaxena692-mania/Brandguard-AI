/**
 * CSV builders for the History and Analytics exports. Pure functions: the download itself lives in lib/csv.ts.
 */
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import { HISTORY_CATEGORY_LABELS } from '@/lib/history'
import { dateStamp, slugify, toCsv, type CsvValue } from '@/lib/csv'
import type { AnalyticsSnapshot, DataSource, HistoryEvent } from '@/types/insights'

export const ANALYTICS_CSV_HEADERS = ['metric', 'value', 'category', 'date_range', 'data_source'] as const

export const HISTORY_CSV_HEADERS = [
  'event_date_time',
  'event_title',
  'event_category',
  'content_title',
  'submission_id',
  'content_type',
  'user',
  'status',
  'data_source',
  'data_source_note',
] as const

/** Machine-friendly source token. A missing value is reported as unavailable, never as 0. */
function sourceToken(source: DataSource, value: number | null): string {
  return value === null ? 'unavailable' : source
}

export function analyticsRows(snapshot: AnalyticsSnapshot): CsvValue[][] {
  const range = snapshot.range.label
  const rows: CsvValue[][] = []

  for (const kpi of snapshot.kpis) rows.push([kpi.label, kpi.value, 'KPI', range, sourceToken(kpi.source, kpi.value)])

  for (const point of snapshot.trend.points) {
    rows.push(['Compliance score', point.score, `Compliance trend: ${point.title} (${point.at})`, range, point.source])
  }

  const distributions: [string, typeof snapshot.status][] = [
    ['Content count by status', snapshot.status],
    ['Issues by severity', snapshot.severity],
    ['Submissions by content type', snapshot.contentType],
    ['Review records by decision status', snapshot.reviewDecisions],
  ]
  for (const [metric, distribution] of distributions) {
    for (const item of distribution.data) rows.push([metric, item.value, item.label, range, distribution.source])
  }

  return rows
}

export function analyticsCsv(snapshot: AnalyticsSnapshot): string {
  return toCsv(ANALYTICS_CSV_HEADERS, analyticsRows(snapshot))
}

export function historyRows(events: readonly HistoryEvent[]): CsvValue[][] {
  return events.map((event) => [
    event.at,
    event.title,
    HISTORY_CATEGORY_LABELS[event.category],
    event.contentTitle,
    event.submissionId,
    event.contentType ? CONTENT_TYPE_LABELS[event.contentType] : '',
    event.user ?? '',
    event.status,
    event.origin,
    event.originNote ?? '',
  ])
}

export function historyCsv(events: readonly HistoryEvent[]): string {
  return toCsv(HISTORY_CSV_HEADERS, historyRows(events))
}

export function analyticsFileName(rangeLabel: string, now: Date = new Date()): string {
  return `brandguard-analytics-${slugify(rangeLabel) || 'report'}-${dateStamp(now)}.csv`
}

export function historyFileName(rangeLabel: string, now: Date = new Date()): string {
  return `brandguard-content-history-${slugify(rangeLabel) || 'export'}-${dateStamp(now)}.csv`
}

