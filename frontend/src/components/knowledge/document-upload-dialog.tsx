import { FileText, FileUp, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import { cn } from '@/lib/utils'

const MAX_BYTES = 10 * 1024 * 1024

const TYPES: Record<string, string> = {
  pdf: 'PDF document',
  docx: 'Word document (DOCX)',
  txt: 'Plain text (TXT)',
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.')
  return index === -1 ? '' : name.slice(index + 1).toLowerCase()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const choose = (candidate: File | undefined) => {
    if (!candidate) return
    if (!(extensionOf(candidate.name) in TYPES)) {
      setFile(null)
      setError('Unsupported file type. Choose a PDF, DOCX or TXT file.')
      return
    }
    if (candidate.size === 0) {
      setFile(null)
      setError('This file is empty. Choose a different file.')
      return
    }
    if (candidate.size > MAX_BYTES) {
      setFile(null)
      setError(`This file is ${formatBytes(candidate.size)}. The maximum size is ${formatBytes(MAX_BYTES)}.`)
      return
    }
    setError(null)
    setFile(candidate)
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    choose(event.target.files?.[0])
    event.target.value = '' // allow re-selecting the same file after removing it
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0])
  }

  const remove = () => {
    setFile(null)
    setError(null)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Upload document</DialogTitle>
        <DialogDescription>Select a brand document (PDF, DOCX or TXT, up to 10 MB).</DialogDescription>
      </DialogHeader>

      <Notice tone="info">
        Document processing is not available yet. Selected files stay in your browser: they are not uploaded, stored, read or
        analysed. This will be enabled after backend integration.
      </Notice>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-dashed border-input px-4 py-8 text-center transition-colors',
          dragging && 'border-primary bg-primary-soft',
        )}
      >
        <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Drag a file here, or</p>
        <input
          ref={inputRef}
          id="kn-upload-input"
          type="file"
          accept=".pdf,.docx,.txt"
          className="sr-only"
          onChange={onInputChange}
        />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {file && (
        <div className="flex items-center gap-3 rounded-md border border-border p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {TYPES[extensionOf(file.name)]} · {formatBytes(file.size)} · Selected, not uploaded
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={remove} aria-label={`Remove ${file.name}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Close</Button>
        </DialogClose>
      </DialogFooter>
    </>
  )
}

export function DocumentUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>{/* Mounted only while open, so a selection never lingers between uses. */}<UploadPanel /></DialogContent>
    </Dialog>
  )
}
