import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { AiGeneratedTag } from './review-badges'
import type { CorrectionProgress } from '@/lib/review'

/** C. Correction summary: what was done with the AI suggestions in the Correction Editor. */
export function CorrectionProgressPanel({ progress, submissionId }: { progress: CorrectionProgress | null; submissionId: string }) {
  const editorLink = `/corrections?submission=${encodeURIComponent(submissionId)}`
  return (
    <Card>
      <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Correction summary</CardTitle>
          <CardDescription>What happened to the suggested corrections. The suggestions are AI-generated (demo); the choices were made by a person.</CardDescription>
        </div>
        <AiGeneratedTag />
      </CardHeader>
      <CardContent className="space-y-4">
        {progress === null ? (
          <Notice tone="info">No correction data is available for this item.</Notice>
        ) : (
          <>
            <ul className="grid grid-cols-3 gap-3">
              <li className="rounded-md border border-border p-3">
                <p className="text-2xl font-semibold tabular-nums">{progress.accepted}</p>
                <p className="text-xs text-muted-foreground">Accepted</p>
              </li>
              <li className="rounded-md border border-border p-3">
                <p className="text-2xl font-semibold tabular-nums">{progress.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </li>
              <li className="rounded-md border border-border p-3">
                <p className="text-2xl font-semibold tabular-nums">{progress.unresolved}</p>
                <p className="text-xs text-muted-foreground">Unresolved</p>
              </li>
            </ul>
            <p className="text-sm">
              <span className="font-medium">Manual changes: </span>
              {progress.manualEdits === null ? (
                <span className="text-muted-foreground">Not available (the Correction Editor has not been used).</span>
              ) : progress.manualEdits ? (
                'The content was edited by hand beyond the accepted suggestions.'
              ) : (
                'None. The content only reflects accepted suggestions.'
              )}
            </p>
            {!progress.started && (
              <Notice tone="info">
                No suggestion has been accepted or rejected yet, so all {progress.total} are unresolved.{' '}
                <Link to={editorLink} className="font-medium underline underline-offset-4">
                  Open Correction Editor
                </Link>
              </Notice>
            )}
            {progress.started && progress.unresolved > 0 && (
              <p className="text-xs text-muted-foreground">
                {progress.unresolved} {progress.unresolved === 1 ? 'suggestion is' : 'suggestions are'} unresolved. You can still decide, and the reviewer sees this count.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
