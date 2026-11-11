import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime, itemContentType, itemSubmittedAt, itemTitle, correctionProgress, type ReviewItem } from '@/lib/review'
import { WORKFLOW_LABELS } from '@/lib/correction'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  )
}

function ContentBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold">{label}</h3>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 font-sans text-sm leading-relaxed">
        {text}
      </pre>
    </div>
  )
}

/** A. Content information: what was submitted, by whom, and the corrected version if there is one. */
export function ContentInformation({ item }: { item: ReviewItem }) {
  const { record, correctionCase, session } = item
  const progress = correctionProgress(item)
  const type = itemContentType(item)
  const submittedAt = itemSubmittedAt(item)
  const editorLink = `/corrections?submission=${encodeURIComponent(record.submissionId)}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content information</CardTitle>
        <CardDescription>The submitted content and the corrected version, if one exists.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Content title">{itemTitle(item)}</Field>
          <Field label="Content type">{type ? CONTENT_TYPE_LABELS[type] : 'Not available'}</Field>
          <Field label="Submission ID">
            <span className="font-mono text-xs">{record.submissionId}</span>
          </Field>
          <Field label="Submitted by">{record.submittedBy}</Field>
          <Field label="Submitted">{submittedAt ? formatDateTime(submittedAt) : 'Not available'}</Field>
          <Field label="Correction editor marker">
            {session ? (
              <>
                {WORKFLOW_LABELS[session.workflow]}
                <span className="block text-xs text-muted-foreground">
                  {session.workflow === 'ready_for_review'
                    ? 'A hand-off marker set in the Correction Editor. It is not an approval.'
                    : 'Only a hand-off marker. It has no effect on the review decision.'}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Correction Editor not used yet</span>
            )}
          </Field>
        </dl>

        {correctionCase ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <ContentBox label="Original submitted content" text={correctionCase.originalContent} />
            {progress?.correctedText ? (
              <ContentBox label="Corrected content (working version)" text={progress.correctedText} />
            ) : (
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold">Corrected content</h3>
                <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                  {progress?.started
                    ? 'The working version is identical to the original: no suggestion has been accepted and nothing was edited.'
                    : 'No corrected content exists yet. The Correction Editor has not been used for this item.'}{' '}
                  <Link to={editorLink} className="font-medium text-primary underline-offset-4 hover:underline">
                    Open Correction Editor
                  </Link>
                </p>
              </div>
            )}
          </div>
        ) : (
          <Notice tone="info">The original content is not available for this record.</Notice>
        )}
      </CardContent>
    </Card>
  )
}
