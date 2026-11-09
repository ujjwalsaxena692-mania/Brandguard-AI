/**
 * DEMO DATA LAYER for the Brand Knowledge Hub.
 *
 * Fabricated sample entries for a fictional company. Not read from any backend.
 * To connect a real API, replace the store in src/hooks/use-knowledge-store.ts
 * and delete this file.
 */
import type { KnowledgeEntry } from '@/types/knowledge'

const DAY = 24 * 60 * 60 * 1000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()
const inDays = (days: number) => {
  const date = new Date(Date.now() + days * DAY)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

type Seed = Omit<KnowledgeEntry, 'createdAt' | 'updatedAt' | 'approvedAt' | 'evidence' | 'validUntil'> & {
  evidence?: string
  validUntil?: string
  created: number
  updated: number
}

const SEEDS: Seed[] = [
  { id: 'kn-001', category: 'guidelines', subtype: 'Brand identity', title: 'Brand positioning statement', description: 'Orbit is the clear, trustworthy analytics partner for growing teams. We position ourselves as practical and approachable, never as complex or elitist.', source: 'Brand Guidelines v4.2, section 1', status: 'approved', created: 240, updated: 35 },
  { id: 'kn-002', category: 'guidelines', subtype: 'Mission and values', title: 'Mission and core values', description: 'Mission: make data understandable for everyone. Values: clarity, integrity, curiosity and care for customers. Use these values to guide messaging priorities.', source: 'Brand Guidelines v4.2, section 2', status: 'approved', created: 240, updated: 90 },
  { id: 'kn-003', category: 'guidelines', subtype: 'Tone of voice', title: 'Tone of voice principles', description: 'Write in a confident, warm and plain-spoken voice. Prefer short sentences and active verbs. Avoid hype, jargon and exaggerated promises.', source: 'Brand Guidelines v4.2, section 3', status: 'approved', created: 240, updated: 12 },
  { id: 'kn-004', category: 'guidelines', subtype: 'Writing style', title: 'Headline and punctuation style', description: 'Use sentence case for headlines. No exclamation marks in headlines. Use the Oxford comma. Spell out numbers under ten.', source: 'Editorial style guide, draft 3', status: 'pending_review', created: 20, updated: 4 },
  { id: 'kn-005', category: 'guidelines', subtype: 'Visual identity', title: 'Photography and imagery direction', description: 'Use natural light, real customers and uncluttered backgrounds. Avoid stock images with staged handshakes and generic office scenes.', source: 'Creative brief, Q4 refresh', status: 'draft', created: 9, updated: 3 },
  { id: 'kn-006', category: 'guidelines', subtype: 'Tone of voice', title: 'Legacy playful tone guide (2022)', description: 'Previous tone guide with a humorous, informal style. Replaced by the current tone of voice principles.', source: 'Brand Guidelines v3.0', status: 'archived', created: 800, updated: 200 },

  { id: 'kn-007', category: 'facts', subtype: 'Product details', title: 'Orbit Platform editions', description: 'Orbit Platform is available in three editions: Starter, Growth and Enterprise. Only Enterprise includes single sign-on and a dedicated success manager.', source: 'Product catalogue, October 2026', status: 'approved', created: 150, updated: 21 },
  { id: 'kn-008', category: 'facts', subtype: 'Pricing', title: 'Growth plan pricing', description: 'The Growth plan costs EUR 49 per user per month when billed annually, or EUR 59 per user per month when billed monthly. Prices exclude VAT.', source: 'Pricing sheet 2026-Q4', status: 'approved', validUntil: inDays(60), created: 100, updated: 14 },
  { id: 'kn-009', category: 'facts', subtype: 'Company information', title: 'Company registration and headquarters', description: 'Orbit Analytics GmbH is headquartered in Berlin, Germany, and was founded in 2016. Always use the full legal name in contracts and press releases.', source: 'Company fact sheet 2026', status: 'approved', created: 300, updated: 70 },
  { id: 'kn-010', category: 'facts', subtype: 'Contact information', title: 'Customer support contact details', description: 'Support is available Monday to Friday, 08:00 to 18:00 CET, at support@orbit.example. Do not publish personal phone numbers.', source: 'Support operations handbook', status: 'pending_review', created: 12, updated: 5 },
  { id: 'kn-011', category: 'facts', subtype: 'Product specifications', title: 'API rate limits by plan', description: 'Starter: 60 requests per minute. Growth: 600 requests per minute. Enterprise: custom limits agreed in contract.', source: '', status: 'draft', created: 6, updated: 2 },

  { id: 'kn-012', category: 'claims', subtype: 'Performance claim', title: 'Reports generate 40% faster than version 3', description: 'Orbit reports generate up to 40% faster than in version 3 on standard datasets. Always include the phrase "up to" and the benchmark conditions.', source: 'Benchmark report BR-2026-14', evidence: 'Internal benchmark, August 2026, 120 datasets, reviewed and signed off by Engineering.', status: 'approved', validUntil: inDays(120), created: 80, updated: 28 },
  { id: 'kn-013', category: 'claims', subtype: 'Security and compliance claim', title: 'SOC 2 Type II certified', description: 'Orbit Platform holds a SOC 2 Type II report covering security and availability. Do not describe this as a guarantee against breaches.', source: 'Trust centre, compliance documents', evidence: 'SOC 2 Type II report issued by an independent auditor, March 2026.', status: 'approved', validUntil: inDays(200), created: 200, updated: 60 },
  { id: 'kn-014', category: 'claims', subtype: 'Customer outcome claim', title: 'Customers cut review time by 60%', description: 'Customers reduce reporting review time by 60% after adopting Orbit.', source: 'Customer survey summary', status: 'pending_review', created: 15, updated: 6 },
  { id: 'kn-015', category: 'claims', subtype: 'Sustainability claim', title: 'Carbon-neutral hosting', description: 'Orbit Platform is hosted on carbon-neutral infrastructure through our cloud provider.', source: 'Cloud provider sustainability statement', evidence: 'Provider certificate covering 2025 operations.', status: 'approved', validUntil: inDays(-20), created: 400, updated: 120 },

  { id: 'kn-016', category: 'terminology', subtype: 'Preferred term', title: 'Say "workspace", not "account"', description: 'Use "workspace" for the shared area where a team works. Reserve "account" for billing and login contexts only.', source: 'Terminology glossary v7', status: 'approved', created: 180, updated: 40 },
  { id: 'kn-017', category: 'terminology', subtype: 'Prohibited term', title: 'Avoid "guaranteed" and "best-in-class"', description: 'Do not use "guaranteed", "best-in-class", "revolutionary" or "unbeatable" in any marketing copy. They create unsupported promises.', source: 'Legal guidance note LG-12', status: 'approved', created: 160, updated: 45 },
  { id: 'kn-018', category: 'terminology', subtype: 'Capitalisation rule', title: 'Product names and capitalisation', description: 'Capitalise product names: Orbit Platform, Orbit Insights. Write "dashboard" and "report" in lower case unless starting a sentence.', source: 'Terminology glossary v7', status: 'approved', created: 180, updated: 30 },
  { id: 'kn-019', category: 'terminology', subtype: 'Alternative phrase', title: 'Alternatives to "cheap"', description: 'Prefer "affordable", "cost-effective" or "good value". Avoid "cheap" when describing our plans.', source: 'Editorial style guide, draft 3', status: 'draft', created: 8, updated: 8 },

  { id: 'kn-020', category: 'assets', subtype: 'Logo', title: 'Primary logo and clear-space rules', description: 'Use the red wordmark on white or off-white backgrounds. Keep clear space equal to the height of the letter "O" on all sides. Never stretch or recolour the logo.', source: 'Brand Assets Library, Logos v5', status: 'approved', created: 250, updated: 55 },
  { id: 'kn-021', category: 'assets', subtype: 'Brand colours', title: 'Brand colour palette', description: 'Primary red #C62828, white #FFFFFF, off-white #F8F8F8, charcoal #222222 and light grey #E5E5E5. Use red sparingly as an accent.', source: 'Brand Guidelines v4.2, section 5', status: 'approved', created: 250, updated: 50 },
  { id: 'kn-022', category: 'assets', subtype: 'Typography', title: 'Typeface and type scale', description: 'Use the approved sans-serif family for all headings and body text. Headings are semibold; body text is regular with generous line height.', source: 'Design system documentation', status: 'pending_review', created: 18, updated: 7 },
  { id: 'kn-023', category: 'assets', subtype: 'Other resource', title: 'Slide and email templates', description: 'Starter templates for presentations and email campaigns. Awaiting final layout checks before release.', source: 'Brand Assets Library, Templates', status: 'draft', created: 5, updated: 1 },
]

export function getDemoKnowledgeEntries(): KnowledgeEntry[] {
  return SEEDS.map(({ created, updated, evidence, validUntil, ...seed }) => ({
    ...seed,
    evidence: evidence ?? '',
    validUntil: validUntil ?? null,
    createdAt: ago(created),
    updatedAt: ago(updated),
    approvedAt: seed.status === 'approved' ? ago(updated) : null,
  }))
}
