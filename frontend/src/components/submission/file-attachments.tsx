import { FileText, FileUp, Loader2, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { ATTACHMENT_LABELS } from '@/lib/content-submission'
import { formatBytes } from '@/lib/files'
import { ALLOWED_FILE_TYPES, FILE_ACCEPT, LIMITS } from '@/lib/submission'
import { cn } from '@/lib/utils'
import type { ApiAttachment } from '@/types/content-submission'
import type { PendingFile } from './use-submission-form'

interface FileAttachmentsProps {
  /** Already uploaded to the draft on the server. */
  saved: ApiAttachment[]
  /** Selected but not uploaded yet. */
  pending: PendingFile[]
  /** Id of the saved attachment currently being removed (disables its button). */
  removingId: string | null
  disabled?: boolean
  error?: string
  onAdd: (files: File[]) => string[]
  onRemovePending: (id: string) => void
  onRemoveSaved: (attachment: ApiAttachment) => void
}

function extensionLabel(name: string): string {
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  return ALLOWED_FILE_TYPES[extension] ?? extension.toUpperCase()
}

export function FileAttachments({
  saved,
  pending,
  removingId,
  disabled,
  error,
  onAdd,
  onRemovePending,
  onRemoveSaved,
}: FileAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problems, setProblems] = useState<string[]>([])
  const total = saved.length + pending.length

  const handleFiles = (list: FileList | null) => {
    if (disabled || !list || list.length === 0) return
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
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-dashed border-input px-4 py-6 text-center transition-colors',
          dragging && 'border-primary bg-primary-soft',
          disabled && 'opacity-60',
        )}
      >
        <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? 'No files attached. Drag files here, or choose them from your device.'
            : 'Drag more files here, or choose them from your device.'}
        </p>
        <input
          ref={inputRef}
          id="submission-files"
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
        />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
          Choose files
        </Button>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX or TXT · up to {formatBytes(LIMITS.fileMaxBytes)} each · up to {LIMITS.maxFiles} files
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Files are uploaded to your organisation&apos;s private storage when you save or submit, and their text is extracted so it
        can be analysed later. Nothing is analysed or approved at this step.
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

      {total > 0 && (
        <ul className="space-y-2" aria-label="Attached files">
          {saved.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-3 rounded-md border border-border p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{attachment.original_filename}</p>
                <p className="text-xs text-muted-foreground">
                  {extensionLabel(attachment.original_filename)} · {formatBytes(attachment.size_bytes)}
                </p>
                {attachment.status === 'failed' && attachment.error_message && (
                  <p className="mt-1 text-xs text-destructive">{attachment.error_message} Remove it to continue.</p>
                )}
              </div>
              <Badge variant={attachment.status === 'failed' ? 'danger' : attachment.status === 'ready' ? 'success' : 'neutral'}>
                {ATTACHMENT_LABELS[attachment.status]}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveSaved(attachment)}
                disabled={disabled || removingId === attachment.id}
                aria-label={`Remove ${attachment.original_filename}`}
              >
                {removingId === attachment.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <X className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </li>
          ))}
          {pending.map(({ id, file }) => (
            <li key={id} className="flex items-center gap-3 rounded-md border border-dashed border-border p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {extensionLabel(file.name)} · {formatBytes(file.size)}
                </p>
              </div>
              <Badge variant="warning">Uploads on save</Badge>
              <Button variant="ghost" size="icon" onClick={() => onRemovePending(id)} disabled={disabled} aria-label={`Remove ${file.name}`}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
