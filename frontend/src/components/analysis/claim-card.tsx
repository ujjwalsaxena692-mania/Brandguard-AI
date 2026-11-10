import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AnalysisClaim, ClaimClassification } from '@/types/analysis'
import { ClassificationBadge, DemoRefTag, SeverityBadge } from './analysis-badges'

const BORDER: Record<ClaimClassification, string> = {
  supported: 'border-l-success',
  contradicted: 'border-l-primary',
  unsupported: 'border-l-warning',
}

/** The claim text, with the conflicting part marked (underlined and bold, so it is not colour-only). */
export function HighlightedClaim({ text, highlight }: { text: string; highlight?: string }) {
  const index = highlight ? text.indexOf(highlight) : -1
  if (!highlight || index === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-primary-soft px-0.5 font-semibold text-primary-soft-foreground underline decoration-primary decoration-2 underline-offset-2">
        {highlight}
      </mark>
      {text.slice(index + highlight.length)}
    </>
  )
}

interface ClaimCardProps {
  claim: AnalysisClaim
  isDemo: boolean
  onOpen: (claim: AnalysisClaim) => void
}

export function ClaimCard({ claim, isDemo, onOpen }: ClaimCardProps) {
  return (
    <article className={cn('space-y-3 rounded-lg border border-l-4 border-border bg-card p-4', BORDER[claim.classification])}>
      <div className="flex flex-wrap items-center gap-2">
        <ClassificationBadge classification={claim.classification} />
        <SeverityBadge severity={claim.severity} />
      </div>

      <blockquote className="break-words text-sm font-medium leading-relaxed">
        “<HighlightedClaim text={claim.text} highlight={claim.conflictingText} />”
      </blockquote>

      <p className="text-sm text-muted-foreground">{claim.explanation}</p>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-0.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Matched knowledge
          </dt>
          <dd className="break-words">
            {claim.matched ? (
              <>
                {claim.matched.title}
                <span className="block text-xs text-muted-foreground">{claim.matched.category}</span>
              </>
            ) : (
              <span className="text-muted-foreground">None found</span>
            )}
          </dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {claim.classification === 'unsupported' ? 'Evidence status' : 'Evidence reference'}
          </dt>
          <dd className="break-words">
            {claim.evidenceRef ?? <span className="text-muted-foreground">No approved evidence found</span>}
            {claim.evidenceRef && <DemoRefTag show={isDemo} />}
          </dd>
        </div>
        {claim.missingEvidence && (
          <div className="space-y-0.5 sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Missing</dt>
            <dd className="break-words">{claim.missingEvidence}</dd>
          </div>
        )}
      </dl>

      <Button variant="outline" size="sm" onClick={() => onOpen(claim)} aria-label={`View details for claim: ${claim.text}`}>
        View details
      </Button>
    </article>
  )
}
