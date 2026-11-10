import { getDemoAnalysisReports } from '@/data/demo/analysis'
import type { AnalysisReport } from '@/types/analysis'

// Built once, so timestamps and object identity stay stable across renders.
const reports: AnalysisReport[] = getDemoAnalysisReports()

/**
 * Single data entry point for analysis results.
 *
 * It returns demo reports only. No analysis engine exists yet, and results are
 * never generated for the user's own submissions. To go live, replace this with
 * a query that returns real `AnalysisReport` records (with `isDemo: false`)
 * and delete src/data/demo/analysis.ts.
 */
export function useAnalysisReports(): AnalysisReport[] {
  return reports
}
