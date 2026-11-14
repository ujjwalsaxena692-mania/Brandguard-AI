import { useCallback, useMemo, useState } from 'react'
import { detailToValues } from '@/lib/content-submission'
import { EMPTY_VALUES, isFormDirty, validateFile, type SubmissionErrors } from '@/lib/submission'
import type { ApiAttachment, ApiSubmissionDetail } from '@/types/content-submission'
import type { SubmissionFormValues } from '@/types/submission'

/** A file the user picked that has not been sent to the server yet. */
export interface PendingFile {
  id: string
  file: File
}

let pendingCounter = 0
const nextPendingId = () => {
  pendingCounter += 1
  return `pending-${Date.now().toString(36)}-${pendingCounter}`
}

/**
 * All state for the submission form. Values are kept as typed, so failed validation or a failed
 * request never loses content. `saved` are attachments already on the server draft; `pending`
 * are selected files that upload when the draft is saved or submitted.
 */
export function useSubmissionForm() {
  const [values, setValues] = useState<SubmissionFormValues>(EMPTY_VALUES)
  const [pending, setPending] = useState<PendingFile[]>([])
  const [saved, setSaved] = useState<ApiAttachment[]>([])
  const [errors, setErrors] = useState<SubmissionErrors>({})
  const [draftId, setDraftId] = useState<string | null>(null)

  const setField = useCallback(<K extends keyof SubmissionFormValues>(key: K, value: SubmissionFormValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => (previous[key] ? { ...previous, [key]: undefined } : previous))
  }, [])

  /** Adds the valid files and returns a message for each rejected one. */
  const addFiles = useCallback(
    (files: File[]): string[] => {
      const problems: string[] = []
      const accepted: PendingFile[] = []
      for (const file of files) {
        const known = [
          ...saved.map((item) => ({ name: item.original_filename, size: item.size_bytes })),
          ...pending.map((item) => ({ name: item.file.name, size: item.file.size })),
          ...accepted.map((item) => ({ name: item.file.name, size: item.file.size })),
        ]
        const problem = validateFile(file, known)
        if (problem) problems.push(problem)
        else accepted.push({ id: nextPendingId(), file })
      }
      if (accepted.length > 0) {
        setPending((previous) => [...previous, ...accepted])
        setErrors((previous) => (previous.attachments ? { ...previous, attachments: undefined } : previous))
      }
      return problems
    },
    [saved, pending],
  )

  const removePending = useCallback((id: string) => {
    setPending((previous) => previous.filter((item) => item.id !== id))
  }, [])

  const reset = useCallback(() => {
    setValues(EMPTY_VALUES)
    setPending([])
    setSaved([])
    setErrors({})
    setDraftId(null)
  }, [])

  const loadDraft = useCallback((detail: ApiSubmissionDetail) => {
    setValues(detailToValues(detail))
    setSaved(detail.attachments)
    setPending([])
    setErrors({})
    setDraftId(detail.id)
  }, [])

  const isDirty = useMemo(
    () => isFormDirty(values, pending.length + saved.length),
    [values, pending.length, saved.length],
  )

  return {
    values,
    pending,
    saved,
    errors,
    draftId,
    setErrors,
    setDraftId,
    setPending,
    setSaved,
    setField,
    addFiles,
    removePending,
    reset,
    loadDraft,
    isDirty,
  }
}

export type SubmissionFormApi = ReturnType<typeof useSubmissionForm>
