import { AlertTriangle, CheckCircle2, FlaskConical, HelpCircle, XCircle, type LucideIcon } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { CLASSIFICATION_LABELS, COMPLIANCE_STATUS_LABELS, SEVERITY_LABELS } from '@/lib/analysis'
import type { ClaimClassification, ClaimSeverity, ComplianceStatus } from '@/types/analysis'

const CLASSIFICATION: Record<ClaimClassification, { variant: BadgeProps['variant']; icon: LucideIcon }> = {
  supported: { variant: 'success', icon: CheckCircle2 },
  contradicted: { variant: 'danger', icon: XCircle },
  unsupported: { variant: 'warning', icon: HelpCircle },
}

const SEVERITY: Record<ClaimSeverity, BadgeProps['variant']> = {
  critical: 'danger',
  high: 'warning',
  medium: 'neutral',
  low: 'outline',
}

const STATUS: Record<ComplianceStatus, { variant: BadgeProps['variant']; icon: LucideIcon }> = {
  excellent: { variant: 'success', icon: CheckCircle2 },
  needs_review: { variant: 'warning', icon: AlertTriangle },
  critical: { variant: 'danger', icon: XCircle },
}

export function ClassificationBadge({ classification }: { classification: ClaimClassification }) {
  const { variant, icon: Icon } = CLASSIFICATION[classification]
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {CLASSIFICATION_LABELS[classification]}
    </Badge>
  )
}

export function SeverityBadge({ severity }: { severity: ClaimSeverity }) {
  return <Badge variant={SEVERITY[severity]}>{SEVERITY_LABELS[severity]} severity</Badge>
}

export function ComplianceStatusBadge({ status }: { status: ComplianceStatus }) {
  const { variant, icon: Icon } = STATUS[status]
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {COMPLIANCE_STATUS_LABELS[status]}
    </Badge>
  )
}

/** Shown wherever demonstration results appear. */
export function DemoBadge() {
  return (
    <Badge variant="outline">
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      Demo data
    </Badge>
  )
}

/** Marks a source reference as a sample, not a real citation. */
export function DemoRefTag({ show }: { show: boolean }) {
  return show ? <span className="ml-1.5 rounded border border-border px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Demo reference</span> : null
}
