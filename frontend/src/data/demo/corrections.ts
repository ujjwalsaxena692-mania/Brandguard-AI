/**
 * DEMO DATA LAYER for the AI Correction Editor.
 *
 * Everything here is fictional and hand-written: the content, the suggestions,
 * the "approved knowledge" and every source reference are invented samples
 * (marked "Demo reference"). None of it was produced by an AI model, and it is
 * never attached to a user's own submissions. The submission IDs use a SUB-DEMO
 * prefix so they match the demo analysis reports and can never collide with
 * records from the Content Submission page.
 *
 * Every `originalText` below occurs exactly once in its case's `originalContent`
 * (checked by the logic tests), so each suggestion applies to one unambiguous place.
 */
import type { CorrectionCase, SuggestionGuideline } from '@/types/correction'

const GUIDELINES = {
  tone: {
    title: 'Tone of voice principles',
    category: 'Brand guideline · Tone of voice',
    excerpt: 'Write in a confident, warm and plain-spoken voice. Prefer short sentences and active verbs. Avoid hype, jargon and exaggerated promises.',
  },
  positioning: {
    title: 'Brand positioning statement',
    category: 'Brand guideline · Brand identity',
    excerpt: 'Orbit is the clear, trustworthy analytics partner for growing teams. We position ourselves as practical and approachable.',
  },
  capitalisation: {
    title: 'Product names and capitalisation',
    category: 'Terminology · Capitalisation rule',
    excerpt: 'Capitalise product names: Orbit Platform, Orbit Insights.',
  },
  workspace: {
    title: 'Say "workspace", not "account"',
    category: 'Terminology · Preferred term',
    excerpt: 'Use "workspace" for the shared area where a team works. Reserve "account" for billing and login contexts only.',
  },
  prohibited: {
    title: 'Avoid "guaranteed" and "best-in-class"',
    category: 'Terminology · Prohibited term',
    excerpt: 'Do not use "guaranteed", "best-in-class", "revolutionary" or "unbeatable" in any marketing copy. They create unsupported promises.',
  },
  pricing: {
    title: 'Growth plan pricing',
    category: 'Approved fact · Pricing',
    excerpt: 'EUR 49 per user per month billed annually, EUR 59 billed monthly. Prices exclude VAT.',
  },
  speed: {
    title: 'Reports generate 40% faster than version 3',
    category: 'Approved claim · Performance',
    excerpt: 'Up to 40% faster on standard datasets. Always include "up to" and the benchmark conditions.',
  },
  security: {
    title: 'SOC 2 Type II certified',
    category: 'Approved claim · Security and compliance',
    excerpt: 'Holds a SOC 2 Type II report covering security and availability. Do not describe this as a guarantee against breaches.',
  },
  editions: {
    title: 'Orbit Platform editions',
    category: 'Approved fact · Product details',
    excerpt: 'Only Enterprise includes single sign-on and a dedicated success manager.',
  },
  apiLimits: {
    title: 'API rate limits by plan',
    category: 'Draft fact · Product specifications',
    excerpt: 'Growth: 600 requests per minute. (Draft, not approved, so it cannot be used as evidence.)',
  },
  carbon: {
    title: 'Carbon-neutral hosting',
    category: 'Approved claim · Sustainability',
    excerpt: 'Hosted on carbon-neutral infrastructure. (Validity date passed.)',
  },
} satisfies Record<string, SuggestionGuideline>

const autumnEmail: CorrectionCase = {
  id: 'COR-DEMO-0101',
  isDemo: true,
  submissionId: 'SUB-DEMO-0101',
  analysisReportId: 'ANL-DEMO-0101',
  title: 'Autumn Campaign Launch Email',
  contentType: 'email_newsletter',
  originalContent: `Subject: Meet orbit insights. Reporting that finally makes sense.

Hi there,

Orbit Platform is available in three editions: Starter, Growth and Enterprise. Reports generate up to 40% faster than version 3.

Trusted by thousands of teams worldwide. Invite your whole team to your Orbit account and start building shared reports together.

Start your free 14-day trial today and see your data in a whole new light.

The Orbit team`,
  suggestions: [
    {
      id: 'sug-101',
      claimId: 'c-105',
      category: 'unsupported_claim',
      severity: 'medium',
      originalText: 'Trusted by thousands of teams worldwide.',
      suggestedText: 'Orbit is built to be the clear, trustworthy analytics partner for growing teams.',
      explanation: 'No approved customer-count fact covers "thousands of teams", so the figure cannot be verified.',
      whyItImproves:
        'The replacement drops the unverifiable number and uses the approved positioning instead. If an approved customer count is added to the Knowledge Hub later, the figure can be restored with its source.',
      guideline: GUIDELINES.positioning,
      evidenceRef: 'Demo reference · Sample brand guidelines v4.2, section 1',
    },
    {
      id: 'sug-102',
      claimId: null,
      category: 'brand_guideline',
      severity: 'low',
      originalText: 'Meet orbit insights',
      suggestedText: 'Meet Orbit Insights',
      explanation: 'The product name is written in lower case in the subject line.',
      whyItImproves: 'Product names are capitalised in all customer-facing copy, so the subject line matches the approved product name.',
      guideline: GUIDELINES.capitalisation,
      evidenceRef: 'Demo reference · Sample terminology glossary v7',
    },
    {
      id: 'sug-103',
      claimId: null,
      category: 'terminology',
      severity: 'low',
      originalText: 'your Orbit account',
      suggestedText: 'your Orbit workspace',
      explanation: '"Account" is reserved for billing and login; the shared team area is a workspace.',
      whyItImproves: 'Using the preferred term keeps product language consistent and avoids confusing the shared area with billing or login.',
      guideline: GUIDELINES.workspace,
      evidenceRef: 'Demo reference · Sample terminology glossary v7',
    },
    {
      id: 'sug-104',
      claimId: null,
      category: 'tone_voice',
      severity: 'low',
      originalText: 'see your data in a whole new light',
      suggestedText: 'see your data clearly',
      explanation: 'A figurative, slightly hyped phrase where the guideline asks for plain speech.',
      whyItImproves: 'A short, plain phrase keeps the confident and warm voice without exaggerating what the product does.',
      guideline: GUIDELINES.tone,
      evidenceRef: 'Demo reference · Sample brand guidelines v4.2, section 3',
    },
  ],
}

const q4Announcement: CorrectionCase = {
  id: 'COR-DEMO-0102',
  isDemo: true,
  submissionId: 'SUB-DEMO-0102',
  analysisReportId: 'ANL-DEMO-0102',
  title: 'Q4 Product Announcement',
  contentType: 'blog_post',
  originalContent: `Introducing the Orbit Q4 release

Orbit's Q4 release is the most powerful release we have ever shipped. Here is what is new from the team at Orbit Analytics GmbH, founded in 2016.

Pricing
The Growth plan costs EUR 39 per user per month.

Speed
Reports now generate 40% faster.

Security
Our platform guarantees your data can never be breached.

Access
Single sign-on is available on every plan. That means every team can roll Orbit out in minutes.

For developers
Growth customers can make up to 600 API requests per minute.`,
  suggestions: [
    {
      id: 'sug-201',
      claimId: 'c-201',
      category: 'contradicted_claim',
      severity: 'high',
      originalText: 'The Growth plan costs EUR 39 per user per month.',
      suggestedText: 'The Growth plan costs EUR 49 per user per month when billed annually, or EUR 59 per user per month when billed monthly. Prices exclude VAT.',
      explanation: 'The stated price is lower than the approved Growth price and omits the billing period.',
      whyItImproves: 'Restores the approved price, states both billing options and notes that VAT is excluded, so customers are not misled about cost.',
      guideline: GUIDELINES.pricing,
      evidenceRef: 'Demo reference · Sample pricing sheet 2026-Q4',
    },
    {
      id: 'sug-202',
      claimId: 'c-204',
      category: 'contradicted_claim',
      severity: 'low',
      originalText: 'Reports now generate 40% faster.',
      suggestedText: 'Reports now generate up to 40% faster than in version 3 on standard datasets.',
      explanation: 'Drops the required "up to" qualifier and the benchmark conditions.',
      whyItImproves: 'The approved claim is a best-case figure on standard datasets. The qualifier stops it reading as a guaranteed result.',
      guideline: GUIDELINES.speed,
      evidenceRef: 'Demo reference · Sample benchmark DEMO-BR-14',
    },
    {
      id: 'sug-203',
      claimId: 'c-202',
      category: 'contradicted_claim',
      severity: 'high',
      originalText: 'Our platform guarantees your data can never be breached.',
      suggestedText: 'Orbit Platform holds a SOC 2 Type II report covering security and availability.',
      explanation: 'An absolute security promise that the approved wording explicitly rules out.',
      whyItImproves: 'Replaces the guarantee with the approved factual statement about the independent audit report, and removes the prohibited term "guarantees".',
      guideline: GUIDELINES.security,
      evidenceRef: 'Demo reference · Sample trust centre document',
    },
    {
      id: 'sug-204',
      claimId: 'c-203',
      category: 'contradicted_claim',
      severity: 'medium',
      originalText: 'available on every plan',
      suggestedText: 'available on the Enterprise edition',
      explanation: 'Single sign-on is approved for the Enterprise edition only.',
      whyItImproves: 'Customers on other plans will not expect a feature their plan does not include. Keeps the rest of the sentence as written.',
      guideline: GUIDELINES.editions,
      evidenceRef: 'Demo reference · Sample product catalogue, edition list',
    },
    {
      id: 'sug-205',
      claimId: 'c-203',
      category: 'promotional_claim',
      severity: 'medium',
      originalText: 'Single sign-on is available on every plan. That means every team can roll Orbit out in minutes.',
      suggestedText: 'Single sign-on is available on the Enterprise edition.',
      explanation: 'Also removes "in minutes", a rollout-time promise with no approved evidence.',
      whyItImproves: 'Fixes the edition error and drops the unverified timing promise in one change. It covers the same sentence as the narrower correction above, so only one of the two can be applied.',
      guideline: GUIDELINES.editions,
      evidenceRef: 'Demo reference · Sample product catalogue, edition list',
    },
    {
      id: 'sug-206',
      claimId: 'c-205',
      category: 'unsupported_claim',
      severity: 'medium',
      originalText: 'Growth customers can make up to 600 API requests per minute.',
      suggestedText: 'API rate limits depend on your plan.',
      explanation: 'The 600 requests figure comes from a draft knowledge entry that has not been approved.',
      whyItImproves: 'Removes a figure that cannot be verified. The specific limit can be restored once the product owner approves the entry.',
      guideline: GUIDELINES.apiLimits,
      evidenceRef: 'Demo reference · Sample knowledge entry in Draft status',
    },
    {
      id: 'sug-207',
      claimId: null,
      category: 'tone_voice',
      severity: 'medium',
      originalText: "Orbit's Q4 release is the most powerful release we have ever shipped.",
      suggestedText: "Orbit's Q4 release is here.",
      explanation: 'A superlative with no supporting evidence, in a voice that should avoid hype.',
      whyItImproves: 'A short, plain statement matches the tone of voice principles and avoids an exaggerated, unprovable promise.',
      guideline: GUIDELINES.tone,
      evidenceRef: 'Demo reference · Sample brand guidelines v4.2, section 3',
    },
  ],
}

const holidayCarousel: CorrectionCase = {
  id: 'COR-DEMO-0103',
  isDemo: true,
  submissionId: 'SUB-DEMO-0103',
  analysisReportId: 'ANL-DEMO-0103',
  title: 'Holiday Offer Carousel',
  contentType: 'social_post',
  originalContent: `Slide 1: Guaranteed lowest price of the year.
Slide 2: Save 50% on all plans until 31 December.
Slide 3: Best-in-class analytics, period.
Slide 4: Carbon-neutral hosting for every customer.
Slide 5: Join thousands of happy teams. Orbit Platform comes in three editions.`,
  suggestions: [
    {
      id: 'sug-301',
      claimId: 'c-301',
      category: 'contradicted_claim',
      severity: 'critical',
      originalText: 'Guaranteed lowest price of the year.',
      suggestedText: 'Our holiday offer is here.',
      explanation: 'Uses a prohibited term and makes a price guarantee that no approved source supports.',
      whyItImproves: 'Removes the guarantee and the "lowest price" comparison, which carry legal and brand risk, and keeps the slide as a plain announcement.',
      guideline: GUIDELINES.prohibited,
      evidenceRef: 'Demo reference · Sample legal guidance note LG-12',
    },
    {
      id: 'sug-302',
      claimId: 'c-303',
      category: 'promotional_claim',
      severity: 'high',
      originalText: 'Save 50% on all plans until 31 December.',
      suggestedText: 'Ask us about our holiday offer.',
      explanation: 'No approved promotion terms cover the discount level, eligible plans or end date.',
      whyItImproves: 'Avoids publishing a discount that cannot be verified. The figure and date can be restored once approved promotion terms exist in the Knowledge Hub.',
      guideline: null,
      evidenceRef: null,
    },
    {
      id: 'sug-303',
      claimId: 'c-302',
      category: 'terminology',
      severity: 'high',
      originalText: 'Best-in-class analytics, period.',
      suggestedText: 'Analytics built to make reporting simpler.',
      explanation: '"Best-in-class" is a prohibited superlative with no approved comparative claim behind it.',
      whyItImproves: 'Describes the aim of the product in plain words, in line with the tone of voice, without a comparison that cannot be proven.',
      guideline: GUIDELINES.prohibited,
      evidenceRef: 'Demo reference · Sample legal guidance note LG-12',
    },
    {
      id: 'sug-304',
      claimId: 'c-304',
      category: 'unsupported_claim',
      severity: 'high',
      originalText: 'Slide 4: Carbon-neutral hosting for every customer.\n',
      suggestedText: '',
      explanation: 'The supporting evidence has expired, and "every customer" goes further than the original claim.',
      whyItImproves: 'Removes the claim until renewed evidence is approved. Remember to renumber the remaining slide afterwards.',
      guideline: GUIDELINES.carbon,
      evidenceRef: 'Demo reference · Sample provider certificate, expired',
    },
    {
      id: 'sug-305',
      claimId: 'c-305',
      category: 'unsupported_claim',
      severity: 'medium',
      originalText: 'Join thousands of happy teams.',
      suggestedText: 'See how Orbit can simplify your reporting.',
      explanation: 'No approved customer-count or satisfaction evidence exists for "thousands" or "happy".',
      whyItImproves: 'Keeps the call to action but removes two claims that cannot be verified, using a plain-spoken invitation instead.',
      guideline: GUIDELINES.tone,
      evidenceRef: null,
    },
  ],
}

export function getDemoCorrectionCases(): CorrectionCase[] {
  return [autumnEmail, q4Announcement, holidayCarousel]
}
