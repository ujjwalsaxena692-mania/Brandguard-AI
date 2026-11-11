import { Clock, User } from 'lucide-react'
import { CATEGORY_ICONS, EventOriginBadge, EventStatusBadge } from '@/components/history/event-badges'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import { formatDateTime } from '@/lib/review'
import type { DayGroup } from '@/lib/history'
import type { HistoryEvent } from '@/types/insights'

const dayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function formatDayHeading(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return dayFormatter.format(new Date(year, month - 1, date))
}


function EventRow({ event, onOpen }: { event: HistoryEvent; onOpen: (event: HistoryEvent) => void }) {
  const Icon = CATEGORY_ICONS[event.category]
  return (
    <li className="relative pl-12">
      <span
        aria-hidden="true"
        className="absolute left-0 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-primary"
      >
        <Icon className="h-4 w-4" />
      </span>
      <button
        type="button"
        onClick={() => onOpen(event)}
        aria-haspopup="dialog"
        className="w-full rounded-lg border border-border bg-card p-4 text-left shadow-card transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{event.title}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{event.contentTitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <EventStatusBadge event={event} />
            <EventOriginBadge origin={event.origin} />
          </div>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Submission ID</dt>
            <dd className="font-mono">{event.submissionId}</dd>
          </div>
          {event.contentType && (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Content type</dt>
              <dd>{CONTENT_TYPE_LABELS[event.contentType]}</dd>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <dt className="sr-only">When</dt>
            <dd>
              <time dateTime={event.at}>{formatDateTime(event.at)}</time>
            </dd>
          </div>
          {event.user && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden="true" />
              <dt className="sr-only">User</dt>
              <dd>{event.user}</dd>
            </div>
          )}
        </dl>
      </button>
    </li>
  )
}

/** Events grouped by day, newest or oldest first as given. A vertical rule joins the events of one day. */
export function HistoryTimeline({ groups, onOpen }: { groups: DayGroup[]; onOpen: (event: HistoryEvent) => void }) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.day} aria-labelledby={`day-${group.day}`}>
          <h2 id={`day-${group.day}`} className="mb-3 text-sm font-semibold text-foreground">
            {formatDayHeading(group.day)}
            <span className="ml-2 font-normal text-muted-foreground">
              {group.events.length} {group.events.length === 1 ? 'event' : 'events'}
            </span>
          </h2>
          <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-border">
            {group.events.map((event) => (
              <EventRow key={event.id} event={event} onOpen={onOpen} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

