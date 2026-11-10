import { cn } from '@/lib/utils'
import { COMPLIANCE_STATUS_LABELS } from '@/lib/analysis'
import type { ComplianceStatus } from '@/types/analysis'

const SIZE = 136
const STROKE = 12
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const COLORS: Record<ComplianceStatus, string> = {
  excellent: 'text-success',
  needs_review: 'text-warning',
  critical: 'text-primary',
}

/** Circular score indicator. The number and status label are real text, not just colour. */
export function ScoreRing({ score, status }: { score: number; status: ComplianceStatus }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const offset = CIRCUMFERENCE * (1 - clamped / 100)

  return (
    <div
      className="relative h-[136px] w-[136px] shrink-0"
      role="img"
      aria-label={`Overall compliance score ${clamped} out of 100, ${COMPLIANCE_STATUS_LABELS[status]}`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="currentColor" strokeWidth={STROKE} className="text-muted" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-500', COLORS[status])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight">{clamped}</span>
        <span className="text-xs text-muted-foreground">out of 100</span>
      </div>
    </div>
  )
}
