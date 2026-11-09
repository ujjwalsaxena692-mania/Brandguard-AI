import type { RefObject } from 'react'
import { SelectField, TextAreaField } from '@/components/knowledge/fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Notice } from '@/components/ui/notice'
import { CONTENT_TYPES, LIMITS, PLATFORMS, countWords } from '@/lib/submission'
import { cn } from '@/lib/utils'
import type { ContentType } from '@/types/submission'
import { FileAttachments } from './file-attachments'
import type { SubmissionFormApi } from './use-submission-form'

interface SubmissionFormProps {
  form: SubmissionFormApi
  formRef: RefObject<HTMLFormElement>
  onSubmit: () => void
  onSaveDraft: () => void
  onClear: () => void
}

const TYPE_OPTIONS = CONTENT_TYPES.map((type) => ({ value: type.value as string, label: type.label }))
const PLATFORM_OPTIONS = PLATFORMS.map((value) => ({ value, label: value }))

const PLACEHOLDER =
  'Example: “Meet Orbit Insights: reporting that finally makes sense. Start your free 14-day trial today and see your data in a whole new light.”'

export function SubmissionForm({ form, formRef, onSubmit, onSaveDraft, onClear }: SubmissionFormProps) {
  const { values, errors, attachments, draftId, setField, addFiles, removeAttachment } = form
  const characters = values.contentText.length
  const words = countWords(values.contentText)
  const overLimit = characters > LIMITS.contentMax

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="space-y-6"
    >
      {draftId && (
        <Notice tone="info">
          You are editing draft <span className="font-mono">{draftId}</span>. Saving updates this draft; submitting turns it into a
          submission.
        </Notice>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Content details</CardTitle>
          <CardDescription>Fields marked * are required.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField
              id="sub-title"
              label="Content title *"
              required
              value={values.title}
              onChange={(event) => setField('title', event.target.value)}
              error={errors.title}
              placeholder="e.g. Autumn campaign launch email"
              autoComplete="off"
            />
          </div>
          <SelectField
            id="sub-type"
            label="Content type *"
            required
            value={values.contentType}
            onChange={(event) => setField('contentType', event.target.value as ContentType | '')}
            options={TYPE_OPTIONS}
            placeholder="Select a content type"
            error={errors.contentType}
          />
          <FormField
            id="sub-campaign"
            label="Campaign name (optional)"
            value={values.campaignName}
            onChange={(event) => setField('campaignName', event.target.value)}
            error={errors.campaignName}
            autoComplete="off"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
          <CardDescription>Paste or write the exact text you want checked against your brand knowledge.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <TextAreaField
            id="sub-text"
            label="Content text *"
            required
            value={values.contentText}
            onChange={(event) => setField('contentText', event.target.value)}
            error={errors.contentText}
            placeholder={PLACEHOLDER}
            rows={14}
            className="min-h-[18rem] leading-relaxed"
          />
          <p className={cn('flex flex-wrap justify-between gap-x-4 text-xs', overLimit ? 'font-medium text-destructive' : 'text-muted-foreground')}>
            <span>
              {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
            </span>
            <span>
              {characters.toLocaleString()} / {LIMITS.contentMax.toLocaleString()} characters (minimum {LIMITS.contentMin} to submit)
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachments (optional)</CardTitle>
          <CardDescription>Add supporting documents or images for the reviewer.</CardDescription>
        </CardHeader>
        <CardContent>
          <FileAttachments attachments={attachments} error={errors.attachments} onAdd={addFiles} onRemove={removeAttachment} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing details (optional)</CardTitle>
          <CardDescription>Helps reviewers judge the content in context.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="sub-audience"
            label="Target audience"
            value={values.targetAudience}
            onChange={(event) => setField('targetAudience', event.target.value)}
            error={errors.targetAudience}
            placeholder="e.g. Marketing managers at mid-size companies"
            autoComplete="off"
          />
          <SelectField
            id="sub-platform"
            label="Intended publishing platform"
            value={values.platform}
            onChange={(event) => setField('platform', event.target.value)}
            options={PLATFORM_OPTIONS}
            placeholder="Not specified"
          />
          <FormField
            id="sub-date"
            label="Publishing date"
            type="date"
            value={values.publishingDate}
            onChange={(event) => setField('publishingDate', event.target.value)}
            error={errors.publishingDate}
          />
          <div className="sm:col-span-2">
            <TextAreaField
              id="sub-context"
              label="Additional context for the reviewer"
              value={values.reviewerContext}
              onChange={(event) => setField('reviewerContext', event.target.value)}
              error={errors.reviewerContext}
              hint="Anything the reviewer should know, such as claims to double-check or approvals already obtained."
              rows={3}
              className="min-h-[5rem]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg">
          Submit for Brand Review
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onSaveDraft}>
          Save as Draft
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onClear}>
          Clear Form
        </Button>
      </div>
    </form>
  )
}
