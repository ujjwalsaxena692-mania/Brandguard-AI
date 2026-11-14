import { apiGet, apiRequest } from '@/services/api'
import type {
  ApiAttachment,
  ApiSubmissionDetail,
  SubmissionListParams,
  SubmissionListResponse,
  SubmissionPayload,
} from '@/types/content-submission'

const BASE = '/api/v1/submissions'

export function listSubmissions(params: SubmissionListParams, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) })
  if (params.status) query.set('status', params.status)
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.mine) query.set('mine', 'true')
  return apiGet<SubmissionListResponse>(`${BASE}?${query.toString()}`, signal)
}

export function getSubmission(id: string, signal?: AbortSignal) {
  return apiGet<ApiSubmissionDetail>(`${BASE}/${encodeURIComponent(id)}`, signal)
}

export function createSubmission(payload: SubmissionPayload) {
  return apiRequest<ApiSubmissionDetail>('POST', BASE, { body: payload })
}

export function updateSubmission(id: string, payload: Partial<SubmissionPayload>) {
  return apiRequest<ApiSubmissionDetail>('PATCH', `${BASE}/${encodeURIComponent(id)}`, { body: payload })
}

export function deleteSubmission(id: string) {
  return apiRequest<void>('DELETE', `${BASE}/${encodeURIComponent(id)}`)
}

export function submitSubmission(id: string) {
  return apiRequest<ApiSubmissionDetail>('POST', `${BASE}/${encodeURIComponent(id)}/submit`)
}

export function cancelSubmission(id: string) {
  return apiRequest<ApiSubmissionDetail>('POST', `${BASE}/${encodeURIComponent(id)}/cancel`)
}

export function reopenSubmission(id: string) {
  return apiRequest<ApiSubmissionDetail>('POST', `${BASE}/${encodeURIComponent(id)}/reopen`)
}

export function uploadAttachment(submissionId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file) // the server validates name, type, size and content itself
  return apiRequest<ApiAttachment>('POST', `${BASE}/${encodeURIComponent(submissionId)}/attachments`, { formData })
}

export function deleteAttachment(submissionId: string, attachmentId: string) {
  return apiRequest<void>(
    'DELETE',
    `${BASE}/${encodeURIComponent(submissionId)}/attachments/${encodeURIComponent(attachmentId)}`,
  )
}
