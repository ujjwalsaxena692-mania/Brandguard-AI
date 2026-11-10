import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import type { AnalysisClaim } from '@/types/analysis'
import { ClassificationBadge, DemoRefTag, SeverityBadge } from './analysis-badges'
import { HighlightedClaim } from './claim-card'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="break-words text-sm leading-relaxed">{children}</div>
    </section>
  )
}

interface ClaimDetailDialogProps {
  claim: AnalysisClaim | null
  isDemo: boolean
  onClose: () => void
}

export function ClaimDetailDialog({ claim, isDemo, onClose }: ClaimDetailDialogProps) {
  return (
    <Dialog open={claim !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {claim && (
          <>
            <DialogHeader>
              <DialogTitle>Claim details</DialogTitle>
              <DialogDescription>
                {isDemo ? 'Part of a demonstration result. Sample data only.' : 'Finding from the analysis of this submission.'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <ClassificationBadge classification={claim.classification} />
              <SeverityBadge severity={claim.severity} />
            </div>

            <Section title="Original claim">
              <blockquote className="font-medium">
                “<HighlightedClaim text={claim.text} highlight={claim.conflictingText} />”
              </blockquote>
            </Section>

            <Section title="Explanation">{claim.detail}</Section>

            <Section title="Matched approved knowledge">
              {claim.matched ? (
                <div className="space-y-1 rounded-md border border-border p-3">
                  <p className="font-medium">{claim.matched.title}</p>
                  <p className="text-xs text-muted-foreground">{claim.matched.category}</p>
                  <p>{claim.matched.excerpt}</p>
                </div>
              ) : (
                <span className="text-muted-foreground">No matching approved knowledge was found.</span>
              )}
            </Section>

            <Section title="Evidence reference">
              {claim.evidenceRef ? (
                <>
                  {claim.evidenceRef}
                  <DemoRefTag show={isDemo} />
                </>
              ) : (
                <span className="text-muted-foreground">No approved evidence found.</span>
              )}
              {claim.missingEvidence && (
                <p className="mt-1">
                  <span className="font-medium">Missing: </span>
                  {claim.missingEvidence}
                </p>
              )}
            </Section>

            <Section title="Recommended next action">{claim.recommendedAction}</Section>

            <Notice tone="info">
              This is an informational suggestion. A human reviewer makes the final decision; nothing here approves or rejects content.
            </Notice>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              {claim.classification !== 'supported' && (
                <Button asChild variant="outline">
                  <Link to="/knowledge-hub">Open Brand Knowledge Hub</Link>
                </Button>
              )}
              <DialogClose asChild>
                <Button variant="ghost">Close</Button>
              </DialogClose>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
