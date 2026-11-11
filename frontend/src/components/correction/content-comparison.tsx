import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DiffHunk } from '@/types/correction'

const REMOVED = 'rounded-sm bg-primary-soft px-0.5 text-primary-soft-foreground line-through decoration-primary/70'
const MODIFIED_OLD = 'rounded-sm bg-warning-soft px-0.5 text-warning line-through decoration-warning/70'
const INSERTED = 'rounded-sm bg-success-soft px-0.5 font-medium text-success underline decoration-success/60 underline-offset-2'
const MODIFIED_NEW = 'rounded-sm bg-warning-soft px-0.5 font-medium text-warning underline decoration-warning/70 underline-offset-2'

/** Marks are announced as text too, so meaning never depends on colour or strike-through alone. */
function Mark({ kind, className, children }: { kind: 'inserted' | 'removed' | 'modified'; className: string; children: ReactNode }) {
  const Tag = kind === 'inserted' || (kind === 'modified' && className === MODIFIED_NEW) ? 'ins' : 'del'
  return (
    <Tag className={className}>
      <span className="sr-only">[{kind}: </span>
      {children}
      <span className="sr-only">]</span>
    </Tag>
  )
}

function Pane({ title, hunks, side, emptyText }: { title: string; hunks: readonly DiffHunk[]; side: 'original' | 'corrected'; emptyText: string }) {
  const nodes: ReactNode[] = []
  hunks.forEach((hunk, index) => {
    if (hunk.type === 'equal') nodes.push(hunk.text)
    else if (side === 'original') {
      if (hunk.type === 'removed') nodes.push(<Mark key={index} kind="removed" className={REMOVED}>{hunk.text}</Mark>)
      else if (hunk.type === 'modified') nodes.push(<Mark key={index} kind="modified" className={MODIFIED_OLD}>{hunk.before}</Mark>)
    } else if (hunk.type === 'inserted') nodes.push(<Mark key={index} kind="inserted" className={INSERTED}>{hunk.text}</Mark>)
    else if (hunk.type === 'modified') nodes.push(<Mark key={index} kind="modified" className={MODIFIED_NEW}>{hunk.after}</Mark>)
  })

  return (
    <div className="min-w-0 space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div
        tabIndex={0}
        role="region"
        aria-label={title}
        className="max-h-96 min-h-[8rem] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-card p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {nodes.length === 0 ? <span className="italic text-muted-foreground">{emptyText}</span> : nodes}
      </div>
    </div>
  )
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return <span className={className}>{label}</span>
}

/** Original and corrected side by side from the lg breakpoint, stacked below it. */
export function ContentComparison({ hunks }: { hunks: readonly DiffHunk[] }) {
  const changed = hunks.some((hunk) => hunk.type !== 'equal')
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparison</CardTitle>
        <CardDescription>What changed between the original and the corrected content, by word.</CardDescription>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-muted-foreground">Key:</span>
          <LegendItem className={INSERTED} label="Inserted" />
          <LegendItem className={REMOVED} label="Removed" />
          <LegendItem className={MODIFIED_OLD} label="Modified (before)" />
          <LegendItem className={MODIFIED_NEW} label="Modified (after)" />
        </p>
      </CardHeader>
      <CardContent>
        {!changed && (
          <p className="mb-3 text-sm text-muted-foreground" role="status">
            No differences yet. The corrected content is identical to the original.
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Pane title="Original" hunks={hunks} side="original" emptyText="The original content is empty." />
          <Pane title="Corrected" hunks={hunks} side="corrected" emptyText="The corrected content is empty." />
        </div>
      </CardContent>
    </Card>
  )
}
