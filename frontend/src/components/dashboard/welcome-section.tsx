import { BookOpen, FilePlus2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/** First name for the greeting; falls back to the email's local part. */
function firstName(name: string | null): string | null {
  if (!name) return null
  const base = name.includes('@') ? name.split('@')[0] : name.split(' ')[0]
  return base || null
}

export function WelcomeSection({ name }: { name: string | null }) {
  const first = firstName(name)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 border-l-4 border-primary p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Brand compliance workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {first ? `Welcome back, ${first}` : 'Welcome to BrandGuard AI'}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Check marketing content against your approved brand guidelines, facts, terminology and visual
            identity before it is published, so every team speaks with one consistent voice.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
          <Button asChild size="lg">
            <Link to="/submit">
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              Check New Content
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/knowledge-hub">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              View Brand Guidelines
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}
