-- 0001: enable PostgreSQL extensions required by BrandGuard AI.
-- Run in the Supabase SQL editor (or via the Supabase CLI) on your project.
-- No tables are created yet: the schema and Row Level Security policies are
-- designed together in the next part, once the data model is agreed.

-- Vector similarity search for the future RAG pipeline.
create extension if not exists vector with schema extensions;
