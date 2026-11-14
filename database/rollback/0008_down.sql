-- Rolls back 0008: removes submissions and attachments (and their policies, triggers, indexes).
-- The storage bucket 'submission-attachments' is NOT removed here: Supabase refuses to delete a
-- bucket that still holds objects. Empty and delete it from the dashboard (Storage) if wanted.
drop policy if exists submission_attachments_select on public.submission_attachments;
drop policy if exists content_submissions_select on public.content_submissions;
drop table if exists public.submission_attachments;
drop table if exists public.content_submissions;
drop function if exists private.guard_attachment_parent();
