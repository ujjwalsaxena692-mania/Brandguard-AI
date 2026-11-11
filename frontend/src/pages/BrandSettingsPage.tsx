import { useState, type FormEvent } from 'react'
import { SelectField, TextAreaField } from '@/components/knowledge/fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { BRAND_VOICES, useWorkspace, workspaceActions, type BrandSettings, type BrandVoice } from '@/hooks/use-workspace-store'

const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'German'].map((l) => ({ value: l, label: l }))
const HEX = /^#[0-9a-fA-F]{6}$/

function ColourField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const valid = HEX.test(value)
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-input bg-card p-1" />
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!valid || undefined} className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive" />
      </div>
      {!valid && <p role="alert" className="text-xs font-medium text-destructive">Use a hex colour such as #C62828.</p>}
    </div>
  )
}

export function BrandSettingsPage() {
  const { brand } = useWorkspace()
  const [form, setForm] = useState<BrandSettings>(brand)
  const [saved, setSaved] = useState(false)

  const change = <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }
  const nameError = form.name.trim() ? undefined : 'Brand name is required.'
  const coloursValid = HEX.test(form.primaryColour) && HEX.test(form.secondaryColour)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (nameError || !coloursValid) return
    workspaceActions.saveBrand({ ...form, name: form.name.trim() })
    setSaved(true)
  }

  return (
    <>
      <PageHeader title="Brand settings" description="Describe your brand's voice and style." badge="Local only" />
      <form onSubmit={submit} className="space-y-6" noValidate>
        <Notice>These are demo/local preferences. They are stored in this browser session only and do not yet modify the AI engine.</Notice>
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="brand-name" label="Brand name" value={form.name} error={nameError} onChange={(e) => change('name', e.target.value)} />
            <TextAreaField id="brand-description" label="Brand description" value={form.description} onChange={(e) => change('description', e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="brand-website" label="Website" type="url" value={form.website} onChange={(e) => change('website', e.target.value)} />
              <FormField id="brand-industry" label="Industry" value={form.industry} onChange={(e) => change('industry', e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Voice and language</CardTitle>
            <CardDescription>Separate multiple terms with commas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField id="brand-voice" label="Brand voice" value={form.voice} options={BRAND_VOICES.map((v) => ({ value: v, label: v }))} onChange={(e) => change('voice', e.target.value as BrandVoice)} />
              <SelectField id="brand-language" label="Preferred language" value={form.language} options={LANGUAGES} onChange={(e) => change('language', e.target.value)} />
            </div>
            <TextAreaField id="brand-terms" label="Preferred terminology" value={form.terminology} onChange={(e) => change('terminology', e.target.value)} placeholder="e.g. customers, not users" />
            <TextAreaField id="brand-avoid" label="Words to avoid" value={form.avoidWords} onChange={(e) => change('avoidWords', e.target.value)} placeholder="e.g. cheap, revolutionary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Colours</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ColourField id="brand-primary" label="Primary colour" value={form.primaryColour} onChange={(v) => change('primaryColour', v)} />
            <ColourField id="brand-secondary" label="Secondary colour" value={form.secondaryColour} onChange={(v) => change('secondaryColour', v)} />
          </CardContent>
        </Card>
        {saved && <Notice tone="success">Saved locally. The AI engine is unchanged.</Notice>}
        <Button type="submit" disabled={Boolean(nameError) || !coloursValid}>Save brand settings</Button>
      </form>
    </>
  )
}
