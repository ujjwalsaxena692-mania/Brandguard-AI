import { AlertTriangle, Check, Layers, X } from 'lucide-react'
import { DemoRefTag, SeverityBadge } from '@/components/analysis/analysis-badges'
import { Button } from '@/components/ui/button'
import { conflictMessage } from '@/lib/correction'
import { cn } from '@/lib/utils'
import type { Applicability, CorrectionSuggestion, SuggestionStatus } from '@/types/correction'
import { CategoryBadge, SuggestionStatusBadge } from './correction-badges'

const BORDER: Record<SuggestionStatus, string> = {
  pending: 'border-l-primary',
  accepted: 'border-l-success',
  rejected: 'border-l-border',
}

interface CorrectionSuggestionCardProps {
  suggestion: CorrectionSuggestion
  status: SuggestionStatus
  applicability: Applicability
  isDemo: boolean
  /** Titles of other suggestions that target the same text. */
  overlapTitles: string[]
  /** For an accepted suggestion: whether its replacement text is still in the content. */
  appliedTextPresent: boolean
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onReconsider: (id: string) => void
  onDetails: (id: string) => void
}

export function CorrectionSuggestionCard({
  suggestion,
  status,
  applicability,
  isDemo,
  overlapTitles,
  appliedTextPresent,
  onAccept,
  onReject,
  onReconsider,
  onDetails,
}: CorrectionSuggestionCardProps) {
  const conflict = status === 'pending' ? conflictMessage(applicability) : null
  const isRemoval = suggestion.suggestedText === ''

  return (
    <article
      aria-label={`Suggestion: ${suggestion.originalText.trim()}`}
      className={cn('space-y-3 rounded-lg border border-l-4 border-border bg-card p-4', BORDER[status], status === 'rejected' && 'opacity-80')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={suggestion.category} />
        <SeverityBadge severity={suggestion.severity} />
        <SuggestionStatusBadge status={status} />
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Original text</p>
          <p className="whitespace-pre-wrap break-words rounded-md bg-primary-soft px-2 py-1.5 text-primary-soft-foreground line-through decoration-primary/60">
            {suggestion.originalText.trim()}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested replacement</p>
          {isRemoval ? (
            <p className="rounded-md bg-muted px-2 py-1.5 italic text-muted-foreground">Remove this text</p>
          ) : (
            <p className="whitespace-pre-wrap break-words rounded-md bg-success-soft px-2 py-1.5 font-medium text-success underline decoration-success/50 underline-offset-2">
              {suggestion.suggestedText}
            </p>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>

      {suggestion.guideline && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Based on: </span>
          {suggestion.guideline.title} · {suggestion.guideline.category}
          {suggestion.evidenceRef && <DemoRefTag show={isDemo} />}
        </p>
      )}

      {overlapTitles.length > 0 && status === 'pending' && !conflict && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Overlaps another suggestion for the same text. Accepting one will make the other a conflict.</span>
        </p>
      )}

      {conflict && (
        <p role="alert" className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium">Conflict. </span>
            {conflict}
          </span>
        </p>
      )}

      {status === 'accepted' && !appliedTextPresent && (
        <p className="text-xs text-muted-foreground">
          The applied wording has since been edited by hand. This suggestion stays marked as accepted.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'pending' && (
          <>
            <Button size="sm" onClick={() => onAccept(suggestion.id)} disabled={conflict !== null}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReject(suggestion.id)}>
              <X className="h-4 w-4" aria-hidden="true" />
              Reject
            </Button>
          </>
        )}
        {status === 'rejected' && (
          <Button size="sm" variant="outline" onClick={() => onReconsider(suggestion.id)}>
            Reconsider
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onDetails(suggestion.id)} aria-label={`View details for suggestion: ${suggestion.originalText.trim()}`}>
          View details
        </Button>
      </div>
    </article>
  )
}
