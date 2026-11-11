import { CheckCircle2, ClipboardList, Clock, MessageSquareWarning, XCircle } from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import type { ReviewStats } from '@/lib/review'

export function ReviewStatsGrid({ stats }: { stats: ReviewStats }) {
  return (
    <section aria-label="Review statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Total reviews" value={stats.total} caption="Review-ready items in the queue" icon={ClipboardList} />
      <StatCard label="Pending reviews" value={stats.pending} caption="Waiting for a human decision" icon={Clock} />
      <StatCard label="Approved content" value={stats.approved} caption="Approved by a human reviewer" icon={CheckCircle2} />
      <StatCard label="Rejected content" value={stats.rejected} caption="Rejected by a human reviewer" icon={XCircle} />
      <StatCard label="Changes requested" value={stats.changesRequested} caption="Sent back for changes" icon={MessageSquareWarning} />
    </section>
  )
}
