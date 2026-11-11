import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { countWords } from '@/lib/correction'

/** The submitted content, exactly as received. Read-only, so there is nothing to edit by accident. */
export function OriginalContent({ content }: { content: string }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Original content</CardTitle>
          <Badge variant="outline">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Read-only
          </Badge>
        </div>
        <CardDescription>As submitted. This never changes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <div
          tabIndex={0}
          role="region"
          aria-label="Original content, read-only"
          className="max-h-96 min-h-[16rem] flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {content.length.toLocaleString()} characters · {countWords(content).toLocaleString()} words
        </p>
      </CardContent>
    </Card>
  )
}
