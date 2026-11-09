import { FileImage, FileText, FileUp, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { formatBytes } from '@/lib/files'
import { ALLOWED_FILE_TYPES, FILE_ACCEPT, LIMITS } from '@/lib/submission'
import { cn } from '@/lib/utils'
import type { FormAttachment } from '@/types/submission'

interface FileAttachmentsProps {
  attachments: FormAttachment[]
  /** Validation error from the submit check (e.g. files that need re-attaching). */
  error?: string
  onAdd: (files: File[]) => string[]
  onRemove: (id: string) => void
}

export function FileAttachments({ attachments, error, onAdd, onRemove }: FileAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problems, setProblems] = useState<string[]>([])

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    setProblems(onAdd(Array.from(list)))
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files)
    event.target.value = '' // lets the same file be chosen again after removal
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-dashed border-input px-4 py-6 text-center transition-colors',
          dragging && 'border-primary bg-primary-soft',
        )}
      >
        <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files selected. Drag files here, or choose them from your device.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Drag more files here, or choose them from your device.</p>
        )}
        <input ref={inputRef} id="submission-files" type="file" multiple accept={FILE_ACCEPT} className="sr-only" onChange={onInputChange} />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, TXT, PNG or JPG · up to {formatBytes(LIMITS.fileMaxBytes)} each · up to {LIMITS.maxFiles} files
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Files stay on your device. They are not uploaded, stored, read or analysed, and only their names are recorded with your
        submission.
      </p>

      {problems.length > 0 && (
        <Notice tone="error">
          <ul className="space-y-0.5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {attachments.length > 0 && (
        <ul className="space-y-2" aria-label="Selected files">
          {attachments.map(({ id, meta, file }) => {
            const isImage = meta.extension === 'png' || meta.extension === 'jpg' || meta.extension === 'jpeg'
            const Icon = isImage ? FileImage : FileText
            return (
              <li key={id} className="flex items-center gap-3 rounded-md border border-border p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{meta.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ALLOWED_FILE_TYPES[meta.extension] ?? meta.extension.toUpperCase()} · {formatBytes(meta.size)}
                  </p>
                </div>
                {file === null && <Badge variant="warning">Re-attach needed</Badge>}
                <Button variant="ghost" size="icon" onClick={() => onRemove(id)} aria-label={`Remove ${meta.name}`}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
