import { Activity, BookOpen, CheckCircle2, FileUp, Sparkles, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { ActivityEvent, ActivityKind } from '@/types/dashboard'
import { formatRelative } from './format'

const ACTIVITY_ICONS: Record<ActivityKind, LucideIcon> = {
  content_submitted: FileUp,
  guideline_updated: BookOpen,
  review_completed: CheckCircle2,
  suggestion_accepted: Sparkles,
}

export function RecentActivity({ events, className }: { events: ActivityEvent[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Latest submissions, reviews and guideline changes.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            compact
            icon={Activity}
            title="No activity yet"
            description="Activity will be listed here as your team uses BrandGuard AI."
          />
        ) : (
          <ol className="space-y-5">
            {events.map((event, index) => {
              const Icon = ACTIVITY_ICONS[event.kind]
              const isLast = index === events.length - 1
              return (
                <li key={event.id} className="relative flex gap-3">
                  {!isLast && <span className="absolute left-4 top-9 h-[calc(100%-1rem)] w-px bg-border" aria-hidden="true" />}
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm">
                      <span className="font-medium">{event.actor}</span> {event.message}
                    </p>
                    <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">
                      {formatRelative(event.occurredAt)}
                    </time>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
