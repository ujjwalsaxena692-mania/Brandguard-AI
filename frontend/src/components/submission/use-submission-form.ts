import { useCallback, useMemo, useState } from 'react'
import { EMPTY_VALUES, isFormDirty, toAttachmentMeta, validateFile, type SubmissionErrors } from '@/lib/submission'
import type { ContentSubmission, FormAttachment, SubmissionFormValues } from '@/types/submission'

let attachmentCounter = 0
const nextAttachmentId = () => {
  attachmentCounter += 1
  return `att-${Date.now().toString(36)}-${attachmentCounter}`
}

/** All state for the submission form. Values are kept as typed, so failed validation never loses content. */
export function useSubmissionForm() {
  const [values, setValues] = useState<SubmissionFormValues>(EMPTY_VALUES)
  const [attachments, setAttachments] = useState<FormAttachment[]>([])
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
      const accepted: FormAttachment[] = []
      for (const file of files) {
        const known = [...attachments, ...accepted].map((item) => ({ name: item.meta.name, size: item.meta.size }))
        const problem = validateFile(file, known)
        if (problem) problems.push(problem)
        else accepted.push({ id: nextAttachmentId(), meta: toAttachmentMeta(file), file })
      }
      if (accepted.length > 0) {
        setAttachments((previous) => [...previous, ...accepted])
        setErrors((previous) => (previous.attachments ? { ...previous, attachments: undefined } : previous))
      }
      return problems
    },
    [attachments],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((previous) => previous.filter((item) => item.id !== id))
    setErrors((previous) => (previous.attachments ? { ...previous, attachments: undefined } : previous))
  }, [])

  const reset = useCallback(() => {
    setValues(EMPTY_VALUES)
    setAttachments([])
    setErrors({})
    setDraftId(null)
  }, [])

  const loadDraft = useCallback((record: ContentSubmission) => {
    setValues({
      title: record.title,
      contentType: record.contentType ?? '',
      contentText: record.contentText,
      campaignName: record.campaignName,
      targetAudience: record.targetAudience,
      platform: record.platform,
      publishingDate: record.publishingDate,
      reviewerContext: record.reviewerContext,
    })
    // Only metadata is stored, so reopened attachments have no file until the user re-attaches them.
    setAttachments(record.attachments.map((meta) => ({ id: nextAttachmentId(), meta, file: null })))
    setErrors({})
    setDraftId(record.id)
  }, [])

  const isDirty = useMemo(() => isFormDirty(values, attachments.length), [values, attachments.length])

  return { values, attachments, errors, setErrors, draftId, setDraftId, setField, addFiles, removeAttachment, reset, loadDraft, isDirty }
}

export type SubmissionFormApi = ReturnType<typeof useSubmissionForm>
