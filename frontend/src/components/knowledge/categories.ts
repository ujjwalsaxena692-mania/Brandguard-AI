import { BookOpen, FileCheck2, Languages, Palette, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { KnowledgeCategory } from '@/types/knowledge'

export const CATEGORY_META: Record<KnowledgeCategory, { icon: LucideIcon; description: string }> = {
  guidelines: {
    icon: BookOpen,
    description: 'Brand identity, mission and values, tone of voice, writing style and visual identity.',
  },
  facts: {
    icon: FileCheck2,
    description: 'Product details, pricing, company information, contact information and product specifications.',
  },
  claims: {
    icon: ShieldCheck,
    description:
      'Marketing claims with supporting evidence, approval date, source reference and validity date. A claim is only verified when its evidence is approved and in date.',
  },
  terminology: {
    icon: Languages,
    description: 'Preferred terms, prohibited terms, alternative phrases and capitalisation rules.',
  },
  assets: {
    icon: Palette,
    description: 'Logos, brand colours, typography and other brand resources.',
  },
}
