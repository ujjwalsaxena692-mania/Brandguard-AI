import { useState, type FormEvent } from 'react'
import { Notice } from '@/components/ui/notice'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  STATUSES,
  STATUS_LABELS,
  SUBTYPES,
  validateKnowledge,
  type FieldErrors,
} from '@/lib/knowledge'
import type { KnowledgeCategory, KnowledgeEntry, KnowledgeInput, KnowledgeStatus } from '@/types/knowledge'
import { SelectField, TextAreaField } from './fields'

interface KnowledgeFormDialogProps {
  open: boolean
  /** Entry being edited, or null when adding. */
  entry: KnowledgeEntry | null
  onClose: () => void
  onSubmit: (input: KnowledgeInput) => void
}

const CATEGORY_OPTIONS = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))
const STATUS_OPTIONS = STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))

function initialValues(entry: KnowledgeEntry | null): KnowledgeInput {
  if (!entry) {
    // New entries start as drafts: nothing is ever approved automatically.
    return {
      title: '',
      category: 'guidelines',
      subtype: SUBTYPES.guidelines[0],
      description: '',
      source: '',
      evidence: '',
      status: 'draft',
      validUntil: '',
    }
  }
  return {
    title: entry.title,
    category: entry.category,
    subtype: entry.subtype,
    description: entry.description,
    source: entry.source,
    evidence: entry.evidence,
    status: entry.status,
    validUntil: entry.validUntil ?? '',
  }
}

function contentChanged(entry: KnowledgeEntry, input: KnowledgeInput): boolean {
  return (
    entry.title !== input.title.trim() ||
    entry.category !== input.category ||
    entry.subtype !== input.subtype ||
    entry.description !== input.description.trim() ||
    entry.source !== input.source.trim() ||
    (input.category === 'claims' ? entry.evidence !== input.evidence.trim() : entry.evidence !== '') ||
    (entry.validUntil ?? '') !== input.validUntil
  )
}

function KnowledgeForm({ entry, onSubmit }: Pick<KnowledgeFormDialogProps, 'entry' | 'onSubmit'>) {
  const [values, setValues] = useState<KnowledgeInput>(() => initialValues(entry))
  const [errors, setErrors] = useState<FieldErrors>({})
  const isEdit = entry !== null

  const set = <K extends keyof KnowledgeInput>(key: K, value: KnowledgeInput[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }

  const changeCategory = (category: KnowledgeCategory) => {
    setValues((previous) => ({ ...previous, category, subtype: SUBTYPES[category][0] }))
    setErrors((previous) => ({ ...previous, category: undefined, subtype: undefined, evidence: undefined }))
  }

  // Editing approved knowledge sends it back for re-approval instead of silently keeping it approved.
  const needsReapproval =
    entry !== null && entry.status === 'approved' && values.status === 'approved' && contentChanged(entry, values)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = validateKnowledge(values)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    onSubmit({ ...values, status: needsReapproval ? 'pending_review' : values.status })
  }

  const subtypeOptions = SUBTYPES[values.category].map((value) => ({ value, label: value }))
  const requiresSource = values.category === 'facts' || values.category === 'claims'
  const hasErrors = Object.values(errors).some(Boolean)

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit knowledge' : 'Add knowledge'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Update this entry. Changes to approved knowledge need to be approved again.'
            : 'New entries are saved as drafts unless you choose another status. Nothing is approved automatically.'}
        </DialogDescription>
      </DialogHeader>

      {hasErrors && <Notice tone="error">Please fix the highlighted fields before saving.</Notice>}

      <FormField
        id="kn-title"
        label="Title"
        value={values.title}
        onChange={(event) => set('title', event.target.value)}
        error={errors.title}
        maxLength={120}
        autoComplete="off"
        placeholder="e.g. Tone of voice principles"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="kn-category"
          label="Category"
          value={values.category}
          onChange={(event) => changeCategory(event.target.value as KnowledgeCategory)}
          options={CATEGORY_OPTIONS}
          error={errors.category}
        />
        <SelectField
          id="kn-subtype"
          label="Knowledge type"
          value={values.subtype}
          onChange={(event) => set('subtype', event.target.value)}
          options={subtypeOptions}
          error={errors.subtype}
        />
      </div>

      <TextAreaField
        id="kn-description"
        label="Description or guideline text"
        value={values.description}
        onChange={(event) => set('description', event.target.value)}
        error={errors.description}
        maxLength={2000}
        rows={5}
        placeholder="Write the approved wording, rule, fact or claim in full."
      />

      <FormField
        id="kn-source"
        label={requiresSource ? 'Source / reference' : 'Source / reference (recommended)'}
        value={values.source}
        onChange={(event) => set('source', event.target.value)}
        error={errors.source}
        hint="Document name, section or link, so future checks can cite the evidence."
        maxLength={200}
        autoComplete="off"
      />

      {values.category === 'claims' && (
        <TextAreaField
          id="kn-evidence"
          label="Supporting evidence"
          value={values.evidence}
          onChange={(event) => set('evidence', event.target.value)}
          error={errors.evidence}
          hint="Required before a claim can be approved. Describe or reference the proof."
          maxLength={1000}
          rows={3}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="kn-status"
          label="Status"
          value={values.status}
          onChange={(event) => set('status', event.target.value as KnowledgeStatus)}
          options={STATUS_OPTIONS}
          error={errors.status}
        />
        <FormField
          id="kn-valid-until"
          label="Valid until (optional)"
          type="date"
          value={values.validUntil}
          onChange={(event) => set('validUntil', event.target.value)}
          error={errors.validUntil}
          hint="Leave empty if this does not expire."
        />
      </div>

      {needsReapproval && (
        <Notice tone="info">
          You changed approved knowledge, so it will be saved as <strong>Pending Review</strong> until it is approved again.
        </Notice>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit">{isEdit ? 'Save changes' : 'Add entry'}</Button>
      </DialogFooter>
    </form>
  )
}

export function KnowledgeFormDialog({ open, entry, onClose, onSubmit }: KnowledgeFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {/* Mounted only while open, so the form always starts from fresh values. */}
        <KnowledgeForm entry={entry} onSubmit={onSubmit} />
      </DialogContent>
    </Dialog>
  )
}
