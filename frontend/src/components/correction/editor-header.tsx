import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DemoBadge } from '@/components/analysis/analysis-badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { CorrectionCase, EditorSession } from '@/types/correction'
import { getStatusLabel, hasAnyChange } from '@/lib/correction'
import { CorrectionStatusBadge } from './correction-badges'

interface EditorHeaderProps {
  correctionCase: CorrectionCase
  session: EditorSession
}

export function EditorHeader({ correctionCase, session }: EditorHeaderProps) {
  const backTo = `/reports?submission=${encodeURIComponent(correctionCase.submissionId)}`
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-xl font-semibold tracking-tight">{correctionCase.title}</h2>
            {correctionCase.isDemo && <DemoBadge />}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-xs">{correctionCase.submissionId}</span> · {CONTENT_TYPE_LABELS[correctionCase.contentType]}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Correction status</span>
            <CorrectionStatusBadge
              label={getStatusLabel(correctionCase, session)}
              workflow={session.workflow}
              started={hasAnyChange(correctionCase, session)}
            />
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Analysis Results
          </Link>
        </Button>
      </div>
    </Card>
  )
}
