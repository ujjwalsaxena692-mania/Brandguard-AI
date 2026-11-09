import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <Button asChild>
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
