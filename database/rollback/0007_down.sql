-- Rolls back 0007: removes the knowledge_documents table (and its policy, trigger, indexes).
-- The storage bucket 'knowledge-documents' is NOT removed here: Supabase refuses to delete a
-- bucket that still holds objects. Empty and delete it from the dashboard (Storage) if wanted.
drop policy if exists knowledge_documents_select_member on public.knowledge_documents;
drop table if exists public.knowledge_documents;
