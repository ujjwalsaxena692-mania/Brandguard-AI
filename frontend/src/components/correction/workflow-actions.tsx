import { Eye, Save, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { formatRelative } from '@/components/dashboard/format'
import { ConfirmDialog } from '@/components/submission/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import type { EditorSession } from '@/types/correction'

interface WorkflowActionsProps {
  session: EditorSession
  pendingCount: number
  onSaveDraft: () => void
  onPreview: () => void
  onMarkReady: () => void
}

/**
 * Frontend demo-state actions. None of them approves anything: saving keeps a marker in memory,
 * and "ready for human review" is a hand-off marker for a person who makes the final decision.
 */
export function WorkflowActions({ session, pendingCount, onSaveDraft, onPreview, onMarkReady }: WorkflowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const empty = session.text.trim() === ''

  const pendingNote =
    pendingCount > 0 ? ` ${pendingCount} ${pendingCount === 1 ? 'suggestion is' : 'suggestions are'} still pending and will stay undecided.` : ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>Save and hand over</CardTitle>
        <CardDescription>Saving a draft is not approval, and neither is marking content ready for review.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onSaveDraft}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Save draft
          </Button>
          <Button variant="outline" onClick={onPreview}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            Preview corrected content
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={empty || session.workflow === 'ready_for_review'}>
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            Mark as ready for human review
          </Button>
        </div>

        {session.workflow === 'draft_saved' && session.savedAt && (
          <Notice tone="success">Draft saved {formatRelative(session.savedAt)}. This is not approval.</Notice>
        )}
        {session.workflow === 'ready_for_review' && session.markedReadyAt && (
          <Notice tone="success">
            Marked ready for human review {formatRelative(session.markedReadyAt)}. This is not approval: a human reviewer must make the final decision.
          </Notice>
        )}
        {session.workflow === 'in_progress' && session.savedAt && (
          <Notice tone="info">You have changed the content since the last save, so it is no longer marked as saved or ready.</Notice>
        )}

        <p className="text-xs text-muted-foreground">
          Demo state only: drafts are kept in memory in this browser tab and are lost when you refresh the page. Nothing is sent to a server,
          and nothing is submitted for approval.
        </p>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        title="Mark as ready for human review?"
        description={`This records the corrected content as ready for a human reviewer. It does not approve the content, and the reviewer makes the final decision.${pendingNote} Any further change will remove the ready marker.`}
        confirmLabel="Mark as ready"
        onConfirm={() => {
          setConfirmOpen(false)
          onMarkReady()
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </Card>
  )
}
