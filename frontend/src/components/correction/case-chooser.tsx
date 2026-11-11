import { Link } from 'react-router-dom'
import { DemoBadge } from '@/components/analysis/analysis-badges'
import { formatDate } from '@/components/dashboard/format'
import { SubmissionStatusBadge } from '@/components/submission/submission-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import { cn } from '@/lib/utils'
import type { CorrectionCase } from '@/types/correction'
import type { ContentSubmission } from '@/types/submission'

const MAX_SUBMISSIONS = 6
const editorLink = (submissionId: string) => `/corrections?submission=${encodeURIComponent(submissionId)}`
const itemClass = 'block rounded-md border border-border p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface CaseChooserProps {
  cases: CorrectionCase[]
  /** Submitted items from the Content Submission store. They have no correction data. */
  submissions: ContentSubmission[]
}

export function CaseChooser({ cases, submissions }: CaseChooserProps) {
  const submitted = submissions
    .filter((item) => item.status === 'submitted')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
  const shown = submitted.slice(0, MAX_SUBMISSIONS)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose content to correct</CardTitle>
        <CardDescription>Open a demonstration example, or check what is available for one of your submissions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section aria-labelledby="demo-cases-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 id="demo-cases-heading" className="text-sm font-semibold">
              Demonstration examples
            </h3>
            <DemoBadge />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cases.map((item) => (
              <li key={item.id}>
                <Link to={editorLink(item.submissionId)} className={itemClass}>
                  <span className="block break-words text-sm font-medium">{item.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {CONTENT_TYPE_LABELS[item.contentType]} · {item.suggestions.length} demo suggestions
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="real-cases-heading" className="space-y-3">
          <h3 id="real-cases-heading" className="text-sm font-semibold">
            Your submissions
          </h3>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing submitted yet.{' '}
              <Link to="/submit" className="font-medium text-primary underline-offset-4 hover:underline">
                Submit content
              </Link>{' '}
              to see it here.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">No AI correction is available yet, so these have no suggestions. Opening one explains its status.</p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((item) => (
                  <li key={item.id}>
                    <Link to={editorLink(item.id)} className={cn(itemClass)}>
                      <span className="block break-words text-sm font-medium">{item.title}</span>
                      <span className="mt-1 block font-mono text-xs text-muted-foreground">
                        {item.id} · {formatDate(item.submittedAt ?? item.updatedAt)}
                      </span>
                      <span className="mt-2 block">
                        <SubmissionStatusBadge status={item.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
