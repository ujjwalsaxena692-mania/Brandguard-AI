/**
 * Unit tests for Content History and Brand Analytics (pure logic only, no React).
 * Run: see tests/README.md. Uses node:test, so no dependency is added to the project.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getDemoAnalysisReports } from '@/data/demo/analysis'
import { getDemoCorrectionCases } from '@/data/demo/corrections'
import { getDemoReviewRecords } from '@/data/demo/reviews'
import { getDemoSubmissions } from '@/data/demo/submissions'
import { computeAnalytics, describeScoreMovement, isValidScore } from '@/lib/analytics'
import { escapeCsvField, toCsv } from '@/lib/csv'
import { isInRange, parseLocalDate, resolveRange } from '@/lib/date-range'
import { buildHistoryEvents, DEFAULT_HISTORY_FILTERS, filterHistoryEvents, groupByDay } from '@/lib/history'
import { analyticsCsv, analyticsRows, historyCsv } from '@/lib/insights-export'
import { buildContentRecords, type SourceData } from '@/lib/insights-source'
import { applyDecision } from '@/lib/review'
import { createSession, markReadyForReview } from '@/lib/correction'
import type { DateRangeFilter } from '@/types/insights'
import type { ContentSubmission } from '@/types/submission'

const ALL: DateRangeFilter = { preset: 'all', customFrom: '', customTo: '' }
const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000

const demoSubs = getDemoSubmissions()
const demoIds = new Set(demoSubs.map((s) => s.id))

function source(overrides: Partial<SourceData> = {}): SourceData {
  return {
    submissions: demoSubs,
    demoSubmissionIds: demoIds,
    reports: getDemoAnalysisReports(),
    cases: getDemoCorrectionCases(),
    sessions: {},
    reviews: getDemoReviewRecords(),
    ...overrides,
  }
}

const empty = (): SourceData => source({ submissions: [], reports: [], cases: [], reviews: [] })

function realSubmission(id: string, patch: Partial<ContentSubmission> = {}): ContentSubmission {
  const at = new Date(NOW - 1000).toISOString()
  return {
    id,
    title: 'My real post',
    contentType: 'blog_post',
    contentText: 'Some content that is long enough.',
    campaignName: '',
    targetAudience: '',
    platform: '',
    publishingDate: '',
    reviewerContext: '',
    attachments: [],
    status: 'submitted',
    createdAt: at,
    updatedAt: at,
    submittedAt: at,
    ...patch,
  }
}

const kpi = (snapshot: ReturnType<typeof computeAnalytics>, id: string) => {
  const found = snapshot.kpis.find((item) => item.id === id)
  assert.ok(found, `missing KPI ${id}`)
  return found
}

describe('analytics calculations (demo data, all time)', () => {
  const s = computeAnalytics(source(), ALL, NOW)

  it('counts submitted content only: 3 submitted seeds + 3 demo reports, no drafts', () => {
    assert.equal(kpi(s, 'total_submissions').value, 6)
  })
  it('counts the 3 demo analyses', () => assert.equal(kpi(s, 'analyses_completed').value, 3))
  it('averages the real scores (91, 72, 48 -> 70.3)', () => assert.equal(kpi(s, 'average_score').value, 70.3))
  it('counts review states from the review store', () => {
    assert.equal(kpi(s, 'pending_reviews').value, 2)
    assert.equal(kpi(s, 'approved').value, 0)
    assert.equal(kpi(s, 'rejected').value, 0)
  })
  it('labels every KPI with demo origin when only demo records contribute', () => {
    for (const id of ['total_submissions', 'analyses_completed', 'average_score', 'pending_reviews']) assert.equal(kpi(s, id).source, 'demo')
  })
  it('gives zero-count KPIs source "none"', () => assert.equal(kpi(s, 'approved').source, 'none'))
  it('draws exactly one trend point per analysis, oldest first, with the true scores', () => {
    assert.deepEqual(s.trend.points.map((p) => p.score), [91, 72, 48])
    assert.ok(s.trend.points[0].time < s.trend.points[1].time && s.trend.points[1].time < s.trend.points[2].time)
  })
  it('status distribution only lists stages that have records', () => {
    assert.deepEqual(s.status.data.map((d) => [d.key, d.value]), [
      ['draft', 2],
      ['submitted', 3],
      ['under_review', 2],
      ['changes_requested', 1],
    ])
  })
  it('severity counts only contradicted/unsupported findings', () => {
    const all = getDemoAnalysisReports().flatMap((r) => r.claims)
    const issues = all.filter((c) => c.classification !== 'supported')
    assert.equal(s.coverage.issueCount, issues.length)
    assert.equal(s.severity.total, issues.length)
    for (const d of s.severity.data) assert.equal(d.value, issues.filter((c) => c.severity === d.key).length)
  })
  it('content type distribution counts submitted content by type', () => {
    const byKey = Object.fromEntries(s.contentType.data.map((d) => [d.key, d.value]))
    assert.deepEqual(byKey, { email_newsletter: 2, press_release: 1, ad_copy: 1, blog_post: 1, social_post: 1 })
  })
  it('review decision distribution matches the review store', () => {
    assert.deepEqual(Object.fromEntries(s.reviewDecisions.data.map((d) => [d.key, d.value])), {
      approved: 0,
      rejected: 0,
      changes_requested: 1,
      pending: 2,
    })
  })
})

describe('score validation and trend wording', () => {
  it('rejects invalid scores', () => {
    for (const bad of [NaN, Infinity, -1, 101, '90', null, undefined]) assert.equal(isValidScore(bad), false)
    for (const good of [0, 55.5, 100]) assert.equal(isValidScore(good), true)
  })
  it('excludes invalid scores from the average and says so', () => {
    const reports = getDemoAnalysisReports()
    reports[0] = { ...reports[0], overallScore: NaN }
    const s = computeAnalytics(source({ reports }), ALL, NOW)
    assert.equal(kpi(s, 'average_score').value, 60) // (72 + 48) / 2
    assert.match(kpi(s, 'average_score').note, /left out/)
    assert.equal(s.trend.points.length, 2)
  })
  it('average is unavailable (null), not 0, with no analyses', () => {
    const s = computeAnalytics(empty(), ALL, NOW)
    assert.equal(kpi(s, 'average_score').value, null)
    assert.equal(kpi(s, 'average_score').display, '—')
    assert.equal(kpi(s, 'average_score').source, 'none')
  })
  it('does not describe a trend with fewer than 3 analyses', () => {
    const [a, b] = getDemoAnalysisReports()
    const s = computeAnalytics(source({ reports: [a, b], cases: [], reviews: [] }), ALL, NOW)
    const insight = s.insights.find((i) => i.id === 'compliance_trend')
    assert.equal(insight?.text, null)
    assert.match(insight?.unavailableReason ?? '', /at least 3/)
  })
  it('describes a decline with 3 analyses and calls it an observation', () => {
    const s = computeAnalytics(source(), ALL, NOW)
    const insight = s.insights.find((i) => i.id === 'compliance_trend')
    assert.match(insight?.text ?? '', /below/)
    assert.match(insight?.text ?? '', /not a statistical trend/)
  })
  it('classifies steady, up and down', () => {
    const pt = (score: number, time: number) => ({ id: String(time), title: 't', at: '', time, score, source: 'demo' as const })
    assert.equal(describeScoreMovement([pt(80, 1), pt(82, 2), pt(81, 3)])?.direction, 'steady')
    assert.equal(describeScoreMovement([pt(50, 1), pt(52, 2), pt(70, 3)])?.direction, 'up')
    assert.equal(describeScoreMovement([pt(90, 1), pt(88, 2), pt(60, 3)])?.direction, 'down')
    assert.equal(describeScoreMovement([pt(90, 1), pt(60, 2)]), null)
  })
})

describe('date-range filtering', () => {
  it('presets have a lower bound only', () => {
    const r = resolveRange({ ...ALL, preset: 'last_7' }, NOW)
    assert.equal(r.from, NOW - 7 * DAY)
    assert.equal(r.to, null)
  })
  it('last 7 days keeps the 3 demo analyses and the recent seeds, and drops the 7-day-old seed', () => {
    // Resolve a moment after the demo data was generated, as the live page does: the seed submitted exactly
    // 7 days before load (SUB-2026-0038) is then just outside the window.
    const s = computeAnalytics(source(), { ...ALL, preset: 'last_7' }, NOW + 5000)
    assert.equal(kpi(s, 'analyses_completed').value, 3)
    assert.equal(kpi(s, 'total_submissions').value, 5)
    assert.equal(kpi(s, 'total_submissions').source, 'demo')
  })
  it('a narrow range drops older records consistently across KPIs, charts and insights', () => {
    const s = computeAnalytics(source(), { preset: 'custom', customFrom: toDay(NOW - 1 * DAY), customTo: toDay(NOW) }, NOW)
    // reports analysed 1d - 25min ago and 5h ago are in range; the 3d one is not
    assert.equal(kpi(s, 'analyses_completed').value, 2)
    assert.deepEqual(s.trend.points.map((p) => p.score), [72, 48])
    assert.equal(kpi(s, 'average_score').value, 60)
    assert.equal(s.insights.find((i) => i.id === 'compliance_trend')?.text, null)
  })
  it('custom range covers the whole end day', () => {
    const r = resolveRange({ preset: 'custom', customFrom: '2026-11-01', customTo: '2026-11-03' }, NOW)
    assert.equal(r.error, null)
    assert.equal(isInRange(new Date(2026, 10, 3, 23, 59, 59).toISOString(), r), true)
    assert.equal(isInRange(new Date(2026, 10, 4, 0, 0, 1).toISOString(), r), false)
    assert.equal(isInRange(new Date(2026, 10, 1, 0, 0, 0).toISOString(), r), true)
  })
  it('incomplete or reversed custom ranges are not applied and report an error', () => {
    for (const range of [
      { preset: 'custom' as const, customFrom: '', customTo: '2026-11-03' },
      { preset: 'custom' as const, customFrom: '2026-11-05', customTo: '2026-11-03' },
      { preset: 'custom' as const, customFrom: '2026-02-30', customTo: '2026-03-01' },
    ]) {
      const r = resolveRange(range, NOW)
      assert.ok(r.error)
      assert.equal(r.from, null)
      assert.equal(r.to, null)
    }
  })
  it('parseLocalDate rejects impossible dates', () => {
    assert.equal(parseLocalDate('2026-02-30'), null)
    assert.equal(parseLocalDate('nope'), null)
    assert.ok(parseLocalDate('2026-02-28'))
  })
  it('records without a usable date are excluded from a bounded range and counted', () => {
    const bad = realSubmission('SUB-2026-0100', { submittedAt: 'not a date', createdAt: 'also bad' })
    const s = computeAnalytics(source({ submissions: [...demoSubs, bad] }), { ...ALL, preset: 'last_30' }, NOW)
    assert.equal(s.coverage.undatedExcluded, 1)
    assert.equal(computeAnalytics(source({ submissions: [...demoSubs, bad] }), ALL, NOW).coverage.undatedExcluded, 0)
  })
})

function toDay(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('demo versus real separation', () => {
  it('a submission created in the session is "real"; seeds and demo reports are "demo"', () => {
    const real = realSubmission('SUB-2026-0043')
    const records = buildContentRecords(source({ submissions: [real, ...demoSubs] }))
    assert.equal(records.find((r) => r.submissionId === 'SUB-2026-0043')?.origin, 'real')
    assert.equal(records.find((r) => r.submissionId === 'SUB-2026-0040')?.origin, 'demo')
    assert.equal(records.find((r) => r.submissionId === 'SUB-DEMO-0101')?.origin, 'demo')
  })
  it('a real submission counts as a submission but never gets a score, analysis or review state', () => {
    const real = realSubmission('SUB-2026-0043')
    const s = computeAnalytics(source({ submissions: [real, ...demoSubs] }), ALL, NOW)
    assert.equal(kpi(s, 'total_submissions').value, 7)
    assert.equal(kpi(s, 'total_submissions').source, 'mixed')
    assert.equal(kpi(s, 'analyses_completed').value, 3)
    assert.equal(kpi(s, 'average_score').value, 70.3)
    assert.equal(kpi(s, 'average_score').source, 'demo')
    assert.equal(kpi(s, 'pending_reviews').value, 2)
    const rec = buildContentRecords(source({ submissions: [real, ...demoSubs] })).find((r) => r.submissionId === 'SUB-2026-0043')
    assert.equal(rec?.report, null)
    assert.equal(rec?.review, null)
    assert.equal(rec?.stage, 'submitted')
  })
  it('real submissions never produce analysis, correction or review events', () => {
    const real = realSubmission('SUB-2026-0043')
    const events = buildHistoryEvents(source({ submissions: [real, ...demoSubs] }))
    const forReal = events.filter((e) => e.submissionId === 'SUB-2026-0043')
    assert.deepEqual(forReal.map((e) => e.kind), ['content_submitted'])
    assert.equal(forReal[0].origin, 'real')
  })
  it('only-real data reports source "real"', () => {
    const s = computeAnalytics(source({ submissions: [realSubmission('SUB-2026-0043')], reports: [], cases: [], reviews: [] }), ALL, NOW)
    assert.equal(kpi(s, 'total_submissions').source, 'real')
  })
})

describe('history events', () => {
  const events = buildHistoryEvents(source())
  it('builds submission, analysis and review events from timestamps that exist', () => {
    const kinds = new Set(events.map((e) => e.kind))
    assert.ok(kinds.has('content_submitted'))
    assert.ok(kinds.has('analysis_completed'))
    assert.ok(kinds.has('review_kept_pending'))
    assert.ok(kinds.has('review_changes_requested'))
  })
  it('creates no event for drafts, un-decided review items, or correction suggestions', () => {
    assert.equal(events.filter((e) => e.submissionId === 'SUB-2026-0042' || e.submissionId === 'SUB-2026-0041').length, 0)
    assert.equal(events.some((e) => e.kind === 'ready_for_review'), false)
    assert.equal(events.filter((e) => e.category === 'review').length, 2) // only the two sample history entries
  })
  it('every event has a valid timestamp and a unique ID', () => {
    for (const e of events) assert.ok(!Number.isNaN(Date.parse(e.at)), e.id)
    assert.equal(new Set(events.map((e) => e.id)).size, events.length)
  })
  it('marks demo events and sample review entries', () => {
    assert.ok(events.every((e) => e.origin === 'demo'))
    assert.match(events.find((e) => e.kind === 'review_kept_pending')?.originNote ?? '', /not a real decision/)
  })
  it('emits "ready for review" only when the editor recorded a time', () => {
    const c = getDemoCorrectionCases()[0]
    const ready = markReadyForReview(createSession(c), new Date(NOW).toISOString())
    assert.ok(ready.ok)
    if (!ready.ok) return
    const withReady = buildHistoryEvents(source({ cases: [c], sessions: { [c.id]: ready.session } }))
    const ev = withReady.find((e) => e.kind === 'ready_for_review')
    assert.ok(ev)
    assert.equal(ev.at, new Date(NOW).toISOString())
    assert.equal(ev.user, null)
    const notReady = buildHistoryEvents(source({ cases: [c], sessions: { [c.id]: createSession(c) } }))
    assert.equal(notReady.some((e) => e.kind === 'ready_for_review'), false)
  })
  it('a decision recorded in the session appears as a new event and updates analytics', () => {
    const reviews = getDemoReviewRecords()
    const target = reviews[0]
    const result = applyDecision(target, { reviewId: target.id, decision: 'approve', comment: '', reviewer: 'Test Reviewer', expectedStatus: 'pending' }, new Date(NOW).toISOString())
    assert.ok(result.ok)
    if (!result.ok) return
    const next = [result.record, ...reviews.slice(1)]
    const before = computeAnalytics(source(), ALL, NOW)
    const after = computeAnalytics(source({ reviews: next }), ALL, NOW)
    assert.equal(kpi(before, 'approved').value, 0)
    assert.equal(kpi(after, 'approved').value, 1)
    assert.equal(kpi(after, 'pending_reviews').value, 1)
    const ev = buildHistoryEvents(source({ reviews: next })).find((e) => e.kind === 'review_approved')
    assert.ok(ev)
    assert.equal(ev.user, 'Test Reviewer')
    assert.equal(ev.origin, 'demo') // demo item
    assert.match(ev.originNote ?? '', /demo item/)
  })
})

describe('history search, filters and sorting', () => {
  const events = buildHistoryEvents(source())
  const run = (patch: Partial<typeof DEFAULT_HISTORY_FILTERS>) => filterHistoryEvents(events, { ...DEFAULT_HISTORY_FILTERS, ...patch }, NOW)

  it('sorts newest first by default and oldest first on request', () => {
    const newest = run({}).map((e) => Date.parse(e.at))
    assert.deepEqual(newest, [...newest].sort((a, b) => b - a))
    const oldest = run({ sort: 'oldest' }).map((e) => Date.parse(e.at))
    assert.deepEqual(oldest, [...oldest].sort((a, b) => a - b))
  })
  it('searches by content title, case-insensitively', () => {
    const hits = run({ query: 'holiday offer' })
    assert.ok(hits.length > 0)
    assert.ok(hits.every((e) => e.contentTitle === 'Holiday Offer Carousel'))
  })
  it('searches by submission ID', () => {
    const hits = run({ query: 'sub-demo-0102' })
    assert.ok(hits.length > 0)
    assert.ok(hits.every((e) => e.submissionId === 'SUB-DEMO-0102'))
  })
  it('returns nothing for a non-matching search', () => assert.equal(run({ query: 'zzzz-not-here' }).length, 0))
  it('filters by category', () => {
    const hits = run({ category: 'analysis' })
    assert.equal(hits.length, 3)
    assert.ok(hits.every((e) => e.category === 'analysis'))
  })
  it('filters by content type', () => {
    const hits = run({ contentType: 'social_post' })
    assert.ok(hits.length > 0)
    assert.ok(hits.every((e) => e.contentType === 'social_post'))
  })
  it('filters by date range', () => {
    const recent = run({ range: { preset: 'custom', customFrom: toDay(NOW), customTo: toDay(NOW) } })
    assert.ok(recent.every((e) => toDay(Date.parse(e.at)) === toDay(NOW)))
    assert.ok(recent.length < events.length)
  })
  it('combines filters with AND', () => {
    const hits = run({ category: 'analysis', contentType: 'blog_post' })
    assert.equal(hits.length, 1)
  })
  it('groups events by local day, preserving order', () => {
    const groups = groupByDay(run({}))
    assert.equal(groups.reduce((n, g) => n + g.events.length, 0), events.length)
    const days = groups.map((g) => g.day)
    assert.deepEqual(days, [...days].sort().reverse())
  })
})

describe('CSV escaping and export', () => {
  it('escapes commas, quotes and newlines', () => {
    assert.equal(escapeCsvField('plain'), 'plain')
    assert.equal(escapeCsvField('a,b'), '"a,b"')
    assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""')
    assert.equal(escapeCsvField('line1\nline2'), '"line1\nline2"')
    assert.equal(escapeCsvField('line1\r\nline2'), '"line1\r\nline2"')
    assert.equal(escapeCsvField(null), '')
    assert.equal(escapeCsvField(undefined), '')
    assert.equal(escapeCsvField(0), '0')
    assert.equal(escapeCsvField(-5), '-5')
    assert.equal(escapeCsvField(NaN), '')
    assert.equal(escapeCsvField(true), 'true')
  })
  it('neutralises spreadsheet formulas in text', () => {
    for (const text of ['=SUM(A1)', '+1', '-1+2', '@cmd']) assert.equal(escapeCsvField(text), `'${text}`)
  })
  it('round-trips through a strict RFC 4180 parser', () => {
    const rows = [
      ['a,b', 'say "hi"', 'x\ny'],
      ['', '1', 'ünï'],
    ]
    const csv = toCsv(['h1', 'h2', 'h3'], rows)
    assert.deepEqual(parseCsv(csv), [['h1', 'h2', 'h3'], ...rows])
  })
  it('history CSV has the documented columns and one row per event, and survives awkward titles', () => {
    const base = buildHistoryEvents(source())[0]
    const tricky = { ...base, contentTitle: 'He said, "50% off"\nnow', user: null }
    const csv = historyCsv([tricky, base])
    const parsed = parseCsv(csv)
    assert.equal(parsed.length, 3)
    assert.deepEqual(parsed[0], ['event_date_time', 'event_title', 'event_category', 'content_title', 'submission_id', 'content_type', 'user', 'status', 'data_source', 'data_source_note'])
    assert.equal(parsed[1][3], 'He said, "50% off"\nnow')
    assert.equal(parsed[1][6], '')
    assert.ok(parsed.every((row) => row.length === 10))
  })
  it('history CSV with no events is just the header', () => {
    assert.equal(parseCsv(historyCsv([])).length, 1)
  })
  it('analytics CSV carries metric, value, category, date range and data source', () => {
    const s = computeAnalytics(source(), { ...ALL, preset: 'last_30' }, NOW)
    const parsed = parseCsv(analyticsCsv(s))
    assert.deepEqual(parsed[0], ['metric', 'value', 'category', 'date_range', 'data_source'])
    assert.ok(parsed.every((row) => row.length === 5))
    assert.ok(parsed.slice(1).every((row) => row[3] === 'Last 30 days'))
    const avg = parsed.find((row) => row[0] === 'Average compliance score')
    assert.deepEqual(avg, ['Average compliance score', '70.3', 'KPI', 'Last 30 days', 'demo'])
    assert.equal(parsed.filter((row) => row[0] === 'Compliance score').length, 3)
  })
  it('analytics CSV reports an unavailable metric as empty + "unavailable", not 0', () => {
    const rows = analyticsRows(computeAnalytics(empty(), ALL, NOW))
    assert.deepEqual(rows.find((r) => r[0] === 'Average compliance score'), ['Average compliance score', null, 'KPI', 'All available time', 'unavailable'])
  })
})

describe('empty states', () => {
  const s = computeAnalytics(empty(), ALL, NOW)
  it('flags no records and produces honest zeros/nulls', () => {
    assert.equal(s.noRecords, true)
    assert.equal(kpi(s, 'total_submissions').value, 0)
    assert.equal(s.trend.points.length, 0)
    assert.equal(s.status.total, 0)
    assert.equal(s.contentType.total, 0)
    assert.equal(s.reviewDecisions.total, 0)
    assert.equal(s.severity.total, 0)
  })
  it('every insight is unavailable with a reason', () => {
    for (const i of s.insights) {
      assert.equal(i.text, null)
      assert.ok(i.unavailableReason)
    }
  })
  it('no history events', () => assert.equal(buildHistoryEvents(empty()).length, 0))
})

describe('insights wording', () => {
  it('reports ties instead of picking one', () => {
    const s = computeAnalytics(source(), ALL, NOW)
    const type = s.insights.find((i) => i.id === 'content_type')
    assert.match(type?.text ?? '', /Email \/ Newsletter leads with 2 submissions out of 6/)
  })
  it('does not report a pattern from a single item', () => {
    const s = computeAnalytics(source({ submissions: [realSubmission('SUB-2026-0050')], reports: [], cases: [], reviews: [] }), ALL, NOW)
    assert.equal(s.insights.find((i) => i.id === 'content_type')?.text, null)
  })
})

// --- tiny strict CSV parser used only to verify the writer ---
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else field += c
  }
  assert.equal(quoted, false, 'unterminated quote')
  assert.equal(field, '', 'file must end with CRLF')
  assert.equal(row.length, 0)
  return rows
}
