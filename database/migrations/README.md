# Migrations

Numbered, forward-only SQL files (`NNNN_description.sql`), applied in order in the
Supabase SQL editor. Full instructions, verification queries and rollback:
[docs/MIGRATION_GUIDE.md](../../docs/MIGRATION_GUIDE.md).

| File | Purpose |
| --- | --- |
| `0001_enable_extensions.sql` | Enables `pgvector` (the `vector` extension). |
| `0002_core_tables.sql` | Organisations, profiles, memberships, invitations, audit logs. |
| `0003_security_helpers.sql` | `private` RLS helper functions; membership integrity trigger. |
| `0004_rls_policies.sql` | Privilege lock-down and Row Level Security policies. |
| `0005_auth_profile_sync.sql` | Creates a profile for each new Supabase Auth user. |
| `0006_organisation_functions.sql` | `create_organisation()` and `accept_invitation()`. |
| `0008_content_submissions.sql` | Content submissions and attachments (RLS, draft-only trigger) and the private `submission-attachments` storage bucket. |
| `0007_knowledge_documents.sql` | Knowledge Hub: `knowledge_documents` table (RLS, read-only for clients) and the private `knowledge-documents` storage bucket. |

Rollback scripts: `../rollback/`. Test-only shim for local PostgreSQL: `../tests/`.

Every table added later must ship with Row Level Security enabled and
organisation-scoped policies in the same migration.
