import { FileText } from 'lucide-react'
import { ComplianceOverview } from '@/components/dashboard/compliance-overview'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { PendingApprovals } from '@/components/dashboard/pending-approvals'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { RecentChecks } from '@/components/dashboard/recent-checks'
import { WelcomeSection } from '@/components/dashboard/welcome-section'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/loading-state'
import { Notice } from '@/components/ui/notice'
import { useAuth } from '@/hooks/use-auth'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { getDisplayName } from '@/lib/user'

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-72" />
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data, loading, error, refetch } = useDashboardData()

  return (
    <div className="space-y-6">
      <WelcomeSection name={getDisplayName(user)} />

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <Card>
          <ErrorState title="Couldn't load the dashboard" message={error.message} onRetry={refetch} />
        </Card>
      ) : !data ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Nothing to show yet"
            description="Dashboard figures will appear here once your team starts checking content."
          />
        </Card>
      ) : (
        <>
          {data.source === 'demo' && (
            <Notice tone="info">
              Sample data: the figures, content and activity on this dashboard are demonstration values, not
              live results from your organisation.
            </Notice>
          )}

          <KpiCards metrics={data.kpis} />

          <div className="grid gap-6 xl:grid-cols-3">
            <ComplianceOverview
              className="xl:col-span-2"
              averageScore={data.averageScore}
              breakdown={data.breakdown}
              trend={data.trend}
            />
            <QuickActions />
          </div>

          <RecentChecks checks={data.recentChecks} />

          <div className="grid gap-6 xl:grid-cols-3">
            <PendingApprovals className="xl:col-span-2" items={data.pendingApprovals} total={data.pendingTotal} />
            <RecentActivity events={data.activity} />
          </div>
        </>
      )}
    </div>
  )
}
