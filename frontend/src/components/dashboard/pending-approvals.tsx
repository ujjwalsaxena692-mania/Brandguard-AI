import { ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { PendingApproval } from '@/types/dashboard'
import { formatDate } from './format'
import { ReviewStatusBadge } from './status'

interface PendingApprovalsProps {
  items: PendingApproval[]
  total: number
  className?: string
}

export function PendingApprovals({ items, total, className }: PendingApprovalsProps) {
  return (
    <Card className={className}>
      <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Pending approvals</CardTitle>
          <CardDescription>
            {items.length > 0
              ? `Showing ${items.length} of ${Math.max(total, items.length)} waiting for a reviewer's decision.`
              : "Content waiting for a human reviewer's decision."}
          </CardDescription>
        </div>
        {items.length > 0 && (
          <Button asChild variant="ghost" size="sm" className="self-start">
            <Link to="/approvals">View all</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            compact
            icon={ClipboardCheck}
            title="No pending approvals"
            description="Items awaiting review will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.submitter} · Submitted {formatDate(item.submittedAt)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <ReviewStatusBadge status={item.reviewStatus} />
                  <Button asChild variant="outline" size="sm">
                    <Link to="/approvals" aria-label={`Review ${item.title}`}>
                      Review
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
