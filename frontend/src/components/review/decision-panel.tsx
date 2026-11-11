import { CheckCircle2, MessageSquareWarning, PauseCircle, XCircle, type LucideIcon } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { DECISION_ACTION_LABELS, decisionBlockedReason, formatDateTime } from '@/lib/review'
import type { ReviewDecisionKind, ReviewStatus } from '@/types/review'
import { ReviewStatusBadge } from './review-badges'

const ACTIONS: readonly { decision: ReviewDecisionKind; icon: LucideIcon; variant: ButtonProps['variant'] }[] = [
  { decision: 'approve', icon: CheckCircle2, variant: 'default' },
  { decision: 'request_changes', icon: MessageSquareWarning, variant: 'outline' },
  { decision: 'reject', icon: XCircle, variant: 'destructive' },
  { decision: 'keep_pending', icon: PauseCircle, variant: 'outline' },
]

interface DecisionPanelProps {
  status: ReviewStatus
  reviewer: string
  /** Timestamp of the latest decision, or null when none has been recorded. */
  lastDecisionAt: string | null
  onDecide: (decision: ReviewDecisionKind) => void
}

/** D. The human decision. Only a person using these buttons can change a status. */
export function DecisionPanel({ status, reviewer, lastDecisionAt, onDecide }: DecisionPanelProps) {
  const blockedReasons = ACTIONS.map(({ decision }) => ({ decision, reason: decisionBlockedReason(status, decision) })).filter(
    (item): item is { decision: ReviewDecisionKind; reason: string } => item.reason !== null,
  )
  const finalDecision = status === 'approved' || status === 'rejected'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your decision</CardTitle>
        <CardDescription>Only a human reviewer can approve, reject or request changes. Nothing is decided automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Current status</dt>
            <dd>
              <ReviewStatusBadge status={status} />
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">Reviewer</dt>
            <dd className="break-all text-right font-medium">{reviewer}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">Last decision</dt>
            <dd className="text-right">{lastDecisionAt ? formatDateTime(lastDecisionAt) : 'None yet'}</dd>
          </div>
        </dl>

        {finalDecision && <Notice tone="info">A final decision has been recorded for this item. It cannot be changed in this demo.</Notice>}

        <div className="grid gap-2">
          {ACTIONS.map(({ decision, icon: Icon, variant }) => (
            <Button
              key={decision}
              variant={variant}
              disabled={decisionBlockedReason(status, decision) !== null}
              onClick={() => onDecide(decision)}
              className="justify-start"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {DECISION_ACTION_LABELS[decision]}
            </Button>
          ))}
        </div>

        {!finalDecision && blockedReasons.length > 0 && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {blockedReasons.map(({ decision, reason }) => (
              <li key={decision}>
                <span className="font-medium">{DECISION_ACTION_LABELS[decision]}:</span> {reason}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
