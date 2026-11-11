import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import { countWords } from '@/lib/correction'

interface CorrectionPreviewDialogProps {
  open: boolean
  title: string
  text: string
  onClose: () => void
}

export function CorrectionPreviewDialog({ open, title, text, onClose }: CorrectionPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview corrected content</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <Notice tone="info">Preview only. This content has not been approved. A human reviewer makes the final decision.</Notice>
        <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-card p-4 text-sm leading-relaxed">
          {text === '' ? <span className="italic text-muted-foreground">The corrected content is empty.</span> : text}
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {text.length.toLocaleString()} characters · {countWords(text).toLocaleString()} words
        </p>
        <div className="flex justify-end border-t border-border pt-4">
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
