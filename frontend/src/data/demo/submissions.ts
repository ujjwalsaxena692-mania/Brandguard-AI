/**
 * DEMO DATA LAYER for Content Submission.
 *
 * Fabricated sample records. None has been analysed or approved, and no
 * compliance scores exist here by design. Replace with API data later.
 */
import type { ContentSubmission } from '@/types/submission'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

type Seed = Pick<ContentSubmission, 'id' | 'title' | 'contentType' | 'contentText' | 'status'> &
  Partial<Pick<ContentSubmission, 'campaignName' | 'targetAudience' | 'platform' | 'reviewerContext'>> & {
    created: number
    updated: number
  }

const SEEDS: Seed[] = [
  {
    id: 'SUB-2026-0042',
    title: 'Winter Sale Instagram Carousel',
    contentType: 'social_post',
    contentText: 'Slide 1: Winter is coming. So are our best prices of the year.\nSlide 2: Save on every Orbit plan until the end of the month.',
    status: 'draft',
    campaignName: 'Winter Sale 2026',
    platform: 'Instagram',
    created: 2 * DAY,
    updated: 5 * HOUR,
  },
  {
    id: 'SUB-2026-0041',
    title: 'Q4 Partner Webinar Landing Page',
    contentType: 'landing_page',
    contentText: 'Join our partner webinar on turning reporting into decisions. Hear from three customers and see the new Orbit Insights features live.',
    status: 'draft',
    targetAudience: 'Existing partners and resellers',
    platform: 'Company website',
    created: 4 * DAY,
    updated: 1 * DAY,
  },
  {
    id: 'SUB-2026-0040',
    title: 'Autumn Campaign Launch Email',
    contentType: 'email_newsletter',
    contentText: 'Subject: Meet Orbit Insights. Reporting that finally makes sense. Start your free 14-day trial today and see your data in a whole new light.',
    status: 'submitted',
    campaignName: 'Autumn Launch',
    targetAudience: 'Trial leads',
    platform: 'Email',
    created: 3 * DAY,
    updated: 2 * DAY,
  },
  {
    id: 'SUB-2026-0039',
    title: 'Series B Press Release',
    contentType: 'press_release',
    contentText: 'Orbit Analytics GmbH today announced a Series B funding round to expand its reporting platform across Europe.',
    status: 'submitted',
    reviewerContext: 'Embargoed until the announcement date. Please check the funding figures against the approved company facts.',
    created: 6 * DAY,
    updated: 5 * DAY,
  },
  {
    id: 'SUB-2026-0038',
    title: 'Winter Range Search Ads',
    contentType: 'ad_copy',
    contentText: 'Headline: Reporting made simple. Description: Try Orbit free for 14 days. No credit card needed.',
    status: 'submitted',
    campaignName: 'Winter Range',
    platform: 'Paid advertising',
    created: 8 * DAY,
    updated: 7 * DAY,
  },
]

export function getDemoSubmissions(): ContentSubmission[] {
  return SEEDS.map(({ created, updated, campaignName, targetAudience, platform, reviewerContext, ...seed }) => ({
    ...seed,
    campaignName: campaignName ?? '',
    targetAudience: targetAudience ?? '',
    platform: platform ?? '',
    publishingDate: '',
    reviewerContext: reviewerContext ?? '',
    attachments: [],
    createdAt: ago(created),
    updatedAt: ago(updated),
    submittedAt: seed.status === 'submitted' ? ago(updated) : null,
  }))
}
