import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, FileUp, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface QuickAction {
  to: string
  title: string
  description: string
  icon: LucideIcon
}

// Paths match the routes registered in App.tsx / lib/navigation.ts.
const QUICK_ACTIONS: readonly QuickAction[] = [
  { to: '/submit', title: 'Submit Content', description: 'Run a new brand compliance check', icon: FileUp },
  { to: '/knowledge-hub', title: 'Open Brand Knowledge Hub', description: 'Guidelines, facts and terminology', icon: BookOpen },
  { to: '/approvals', title: 'Review Pending Items', description: 'Decide on content awaiting approval', icon: ClipboardCheck },
  { to: '/analytics', title: 'View Analytics', description: 'Compliance trends across teams', icon: BarChart3 },
]

export function QuickActions({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>Jump straight to common tasks.</CardDescription>
      </CardHeader>
      <CardContent>
        <nav aria-label="Quick actions">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {QUICK_ACTIONS.map(({ to, title, description, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="group flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </CardContent>
    </Card>
  )
}
