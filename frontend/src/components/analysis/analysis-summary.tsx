import { AlertTriangle, CheckCircle2, ListChecks, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import type { AnalysisReport } from '@/types/analysis'

function Block({ title, icon: Icon, items, empty }: { title: string; icon: LucideIcon; items: string[]; empty: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function AnalysisSummary({ report }: { report: AnalysisReport }) {
  return (
    <section aria-label="Analysis summary" className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Block title="Strong points" icon={CheckCircle2} items={report.strongPoints} empty="No strong points were recorded." />
        <Block title="Main compliance risks" icon={AlertTriangle} items={report.risks} empty="No compliance risks were recorded." />
        <Block title="Recommended next steps" icon={ListChecks} items={report.nextSteps} empty="No next steps were recorded." />
      </div>
      <Notice tone="info">
        The points above are informational suggestions only. Final decisions on approving, rejecting or changing content are made
        by human reviewers, and nothing on this page approves content.
      </Notice>
    </section>
  )
}
