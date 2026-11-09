import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { KnowledgeEntry } from '@/types/knowledge'

interface DeleteDialogProps {
  entry: KnowledgeEntry | null
  onClose: () => void
  onConfirm: (entry: KnowledgeEntry) => void
}

export function DeleteDialog({ entry, onClose, onConfirm }: DeleteDialogProps) {
  return (
    <Dialog open={entry !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle>Delete this entry?</DialogTitle>
              <DialogDescription>
                “{entry.title}” will be permanently removed from the Knowledge Hub. If you only want it out of use, archive it
                instead.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={() => onConfirm(entry)}>Delete entry</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
