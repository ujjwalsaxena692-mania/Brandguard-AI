import { getDemoCorrectionCases } from '@/data/demo/corrections'
import type { CorrectionCase } from '@/types/correction'

// Built once, so object identity stays stable across renders.
const cases: CorrectionCase[] = getDemoCorrectionCases()

/**
 * Single data entry point for correction suggestions.
 *
 * It returns demo cases only. No correction engine exists yet, and suggestions
 * are never generated for the user's own submissions. To go live, replace this
 * with a query that returns real `CorrectionCase` records (with `isDemo: false`)
 * and delete src/data/demo/corrections.ts.
 */
export function useCorrectionCases(): CorrectionCase[] {
  return cases
}
