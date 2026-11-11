import { Check, Copy, RotateCcw, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { countWords } from '@/lib/correction'

type CopyState = 'idle' | 'copied' | 'failed'

interface CorrectedEditorProps {
  text: string
  onChange: (text: string) => void
  /** Null when undo is available; otherwise the reason it is not. */
  undoBlockedReason: string | null
  /** Shown under the editor when a correction exists but cannot be undone safely. */
  undoNote: string | null
  onUndo: () => void
  onReset: () => void
  /** Reset is pointless while nothing has changed. */
  canReset: boolean
}

export function CorrectedEditor({ text, onChange, undoBlockedReason, undoNote, onUndo, onReset, canReset }: CorrectedEditorProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  useEffect(() => {
    if (copyState === 'idle') return
    const timer = window.setTimeout(() => setCopyState('idle'), 2500)
    return () => window.clearTimeout(timer)
  }, [copyState])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <Card className="flex flex-col border-primary/40">
      <CardHeader>
        <CardTitle>Corrected content</CardTitle>
        <CardDescription>Your working version. Accepted suggestions appear here, and you can edit it freely.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            disabled={undoBlockedReason !== null}
            title={undoBlockedReason ?? 'Undo the most recently accepted correction'}
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Undo last correction
          </Button>
          <Button variant="outline" size="sm" onClick={copy}>
            {copyState === 'copied' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="destructive" size="sm" onClick={onReset} disabled={!canReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset to original
          </Button>
        </div>

        <label htmlFor="corrected-content" className="sr-only">
          Corrected content (editable)
        </label>
        <textarea
          id="corrected-content"
          value={text}
          onChange={(event) => onChange(event.target.value)}
          spellCheck
          className="min-h-[16rem] w-full flex-1 resize-y rounded-md border border-input bg-card p-3 text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {text.length.toLocaleString()} characters · {countWords(text).toLocaleString()} words
          </p>
          <p className="text-xs text-muted-foreground" role="status">
            {copyState === 'copied' && 'Corrected content copied to the clipboard.'}
            {copyState === 'failed' && 'Copy failed. Select the text and copy it manually.'}
          </p>
        </div>
        {undoNote && <p className="text-xs text-muted-foreground">{undoNote}</p>}
      </CardContent>
    </Card>
  )
}
