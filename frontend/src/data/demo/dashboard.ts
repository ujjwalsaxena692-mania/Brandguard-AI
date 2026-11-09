/**
 * DEMO DATA LAYER for the Dashboard.
 *
 * Everything here is fabricated sample content for design and QA. It is not
 * read from any backend. To go live, replace the body of `useDashboardData`
 * (src/hooks/use-dashboard-data.ts) with a real query that returns
 * `DashboardData` with `source: 'api'`; this file can then be deleted.
 */
import type { DashboardData } from '@/types/dashboard'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

const weekLabel = (weeksAgo: number) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(Date.now() - weeksAgo * 7 * DAY),
  )

const WEEKLY_AVERAGES = [79, 81, 80, 84, 85, 86, 86, 87]

export function getDemoDashboardData(): DashboardData {
  return {
    source: 'demo',
    kpis: [
      {
        id: 'total_checks',
        label: 'Total Content Checks',
        value: '248',
        description: 'Pieces of content checked this quarter',
        trend: { label: '+18% vs last quarter', direction: 'up', sentiment: 'positive' },
      },
      {
        id: 'average_score',
        label: 'Average Brand Compliance Score',
        value: '87%',
        description: 'Across all checked content',
        trend: { label: '+3 pts vs last month', direction: 'up', sentiment: 'positive' },
      },
      {
        id: 'pending_reviews',
        label: 'Pending Reviews',
        value: '17',
        description: 'Waiting for a reviewer decision',
        trend: { label: '4 more than last week', direction: 'up', sentiment: 'negative' },
      },
      {
        id: 'critical_issues',
        label: 'Critical Issues',
        value: '31',
        description: 'Open across 12 content items',
        trend: { label: '9 fewer than last month', direction: 'down', sentiment: 'positive' },
      },
    ],
    averageScore: 87,
    breakdown: { compliant: 183, needsReview: 53, critical: 12 },
    trend: WEEKLY_AVERAGES.map((score, index) => ({
      label: weekLabel(WEEKLY_AVERAGES.length - 1 - index),
      score,
    })),
    recentChecks: [
      { id: 'chk-1048', title: 'Autumn Campaign Launch Email', contentType: 'Email', score: 94, status: 'compliant', checkedAt: ago(2 * HOUR) },
      { id: 'chk-1047', title: 'Q4 Product Announcement', contentType: 'Blog post', score: 78, status: 'needs_review', checkedAt: ago(5 * HOUR) },
      { id: 'chk-1046', title: 'Holiday Offer Carousel', contentType: 'Social post', score: 52, status: 'critical', checkedAt: ago(1 * DAY) },
      { id: 'chk-1045', title: 'Partner Webinar Landing Page', contentType: 'Landing page', score: 91, status: 'compliant', checkedAt: ago(1 * DAY + 3 * HOUR) },
      { id: 'chk-1044', title: 'Sales Enablement Deck v3', contentType: 'Presentation', score: 73, status: 'needs_review', checkedAt: ago(2 * DAY) },
      { id: 'chk-1043', title: 'Series B Press Release', contentType: 'Press release', score: 88, status: 'compliant', checkedAt: ago(3 * DAY) },
      { id: 'chk-1042', title: 'Search Ads: Winter Range', contentType: 'Ad copy', score: 46, status: 'critical', checkedAt: ago(4 * DAY) },
      { id: 'chk-1041', title: 'November Customer Newsletter', contentType: 'Newsletter', score: 81, status: 'needs_review', checkedAt: ago(6 * DAY) },
    ],
    pendingApprovals: [
      { id: 'apr-221', title: 'Q4 Product Announcement', submitter: 'Priya Sharma', submittedAt: ago(5 * HOUR), reviewStatus: 'awaiting_review' },
      { id: 'apr-220', title: 'Sales Enablement Deck v3', submitter: 'Daniel Okafor', submittedAt: ago(2 * DAY), reviewStatus: 'in_review' },
      { id: 'apr-219', title: 'Holiday Offer Carousel', submitter: 'Mei Tanaka', submittedAt: ago(1 * DAY), reviewStatus: 'changes_requested' },
      { id: 'apr-218', title: 'November Customer Newsletter', submitter: 'Lucas Meyer', submittedAt: ago(6 * DAY), reviewStatus: 'in_review' },
      { id: 'apr-217', title: 'Careers Page Refresh', submitter: 'Aisha Rahman', submittedAt: ago(7 * DAY), reviewStatus: 'awaiting_review' },
    ],
    pendingTotal: 17,
    activity: [
      { id: 'act-1', kind: 'content_submitted', message: 'submitted "Autumn Campaign Launch Email" for a brand check', actor: 'Priya Sharma', occurredAt: ago(2 * HOUR) },
      { id: 'act-2', kind: 'suggestion_accepted', message: 'accepted a terminology correction on "Q4 Product Announcement"', actor: 'Daniel Okafor', occurredAt: ago(4 * HOUR) },
      { id: 'act-3', kind: 'guideline_updated', message: 'updated the "Tone of voice" guideline (v2.4)', actor: 'Brand team', occurredAt: ago(1 * DAY) },
      { id: 'act-4', kind: 'review_completed', message: 'completed the review of "Series B Press Release"', actor: 'Aisha Rahman', occurredAt: ago(3 * DAY) },
      { id: 'act-5', kind: 'suggestion_accepted', message: 'accepted a logo-usage correction on "Partner Webinar Landing Page"', actor: 'Mei Tanaka', occurredAt: ago(3 * DAY + 2 * HOUR) },
      { id: 'act-6', kind: 'guideline_updated', message: 'added 12 approved product terms to the glossary', actor: 'Brand team', occurredAt: ago(5 * DAY) },
    ],
  }
}
