import { BookOpen, FileCheck2, ClipboardCheck, ShieldCheck, Upload, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DeleteDialog } from '@/components/knowledge/delete-dialog'
import { DocumentUploadDialog } from '@/components/knowledge/document-upload-dialog'
import { KnowledgeBrowser } from '@/components/knowledge/knowledge-browser'
import { KnowledgeDetailDialog } from '@/components/knowledge/knowledge-detail-dialog'
import { KnowledgeFormDialog } from '@/components/knowledge/knowledge-form-dialog'
import { StatCard } from '@/components/stat-card'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { addEntry, changeStatus, removeEntry, updateEntry, useKnowledgeEntries } from '@/hooks/use-knowledge-store'
import { isAuthoritative } from '@/lib/knowledge'
import type { KnowledgeEntry, KnowledgeInput } from '@/types/knowledge'

type FormState = { mode: 'add' } | { mode: 'edit'; id: string } | null

export function KnowledgeHubPage() {
  const entries = useKnowledgeEntries()
  const [form, setForm] = useState<FormState>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Confirmation messages fade out on their own.
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 6000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const stats = useMemo(() => {
    const guidelines = entries.filter((entry) => entry.category === 'guidelines' && entry.status !== 'archived')
    const facts = entries.filter((entry) => entry.category === 'facts')
    const claims = entries.filter((entry) => entry.category === 'claims')
    return {
      guidelines: guidelines.length,
      guidelinesApproved: guidelines.filter((entry) => entry.status === 'approved').length,
      approvedFacts: facts.filter(isAuthoritative).length,
      factsAwaiting: facts.filter((entry) => entry.status === 'pending_review').length,
      verifiedClaims: claims.filter(isAuthoritative).length,
      claimsNotVerified: claims.filter((entry) => entry.status === 'approved' && !isAuthoritative(entry)).length,
      pending: entries.filter((entry) => entry.status === 'pending_review').length,
    }
  }, [entries])

  const editing = form?.mode === 'edit' ? (entries.find((entry) => entry.id === form.id) ?? null) : null
  const detailEntry = entries.find((entry) => entry.id === detailId) ?? null
  const deleteEntry = entries.find((entry) => entry.id === deleteId) ?? null

  const openEdit = (entry: KnowledgeEntry) => {
    setDetailId(null)
    setForm({ mode: 'edit', id: entry.id })
  }
  const openDelete = (entry: KnowledgeEntry) => {
    setDetailId(null)
    setDeleteId(entry.id)
  }

  const handleSubmit = (input: KnowledgeInput) => {
    if (form?.mode === 'edit' && editing) {
      updateEntry(editing.id, input)
      setFeedback(
        input.status === 'pending_review' && editing.status === 'approved'
          ? `“${input.title.trim()}” was updated and sent back to Pending Review.`
          : `“${input.title.trim()}” was updated.`,
      )
    } else {
      addEntry(input)
      setFeedback(`“${input.title.trim()}” was added.`)
    }
    setForm(null)
  }

  const handleDelete = (entry: KnowledgeEntry) => {
    removeEntry(entry.id)
    setDeleteId(null)
    setFeedback(`“${entry.title}” was deleted.`)
  }

  return (
    <>
      <PageHeader
        title="Brand Knowledge Hub"
        description="The central source of approved brand information: guidelines, facts, claims, terminology and assets that every content check is measured against."
        actions={
          <>
            <Button onClick={() => setForm({ mode: 'add' })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Knowledge
            </Button>
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload Document
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <Notice tone="info">
          Sample data: these entries and figures are demonstration values, not your organisation&apos;s live knowledge. Changes you
          make are kept in this browser session only and are not saved to a server.
        </Notice>

        {feedback && <Notice tone="success">{feedback}</Notice>}

        <section aria-label="Knowledge overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Guidelines" value={stats.guidelines} caption={`${stats.guidelinesApproved} approved (demo)`} icon={BookOpen} />
          <StatCard
            label="Approved Facts"
            value={stats.approvedFacts}
            caption={`${stats.factsAwaiting} awaiting review (demo)`}
            icon={FileCheck2}
          />
          <StatCard
            label="Approved Claims"
            value={stats.verifiedClaims}
            caption={
              stats.claimsNotVerified > 0
                ? `${stats.claimsNotVerified} approved but expired or unverified (demo)`
                : 'All with approved evidence (demo)'
            }
            icon={ShieldCheck}
          />
          <StatCard label="Pending Review" value={stats.pending} caption="Not yet authoritative (demo)" icon={ClipboardCheck} />
        </section>

        <KnowledgeBrowser
          entries={entries}
          onAdd={() => setForm({ mode: 'add' })}
          onView={(entry) => setDetailId(entry.id)}
          onEdit={openEdit}
          onDelete={openDelete}
        />
      </div>

      <KnowledgeFormDialog
        open={form !== null && (form.mode === 'add' || editing !== null)}
        entry={editing}
        onClose={() => setForm(null)}
        onSubmit={handleSubmit}
      />
      <KnowledgeDetailDialog
        entry={detailEntry}
        onClose={() => setDetailId(null)}
        onEdit={openEdit}
        onDelete={openDelete}
        onChangeStatus={changeStatus}
      />
      <DeleteDialog entry={deleteEntry} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
      <DocumentUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  )
}
