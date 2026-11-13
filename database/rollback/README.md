# Rollback scripts

Forward-only migrations are the norm; these scripts exist for development and
emergencies. Apply them in **reverse order** (`0007_down` first). Each one reverses
exactly one migration.

| Script | Effect | Data loss? |
| --- | --- | --- |
| `0007_down.sql` | Drops `knowledge_documents` and its policy (the storage bucket is left; empty and delete it in the dashboard) | **Yes** (document metadata and extracted text) |
| `0006_down.sql` | Drops `create_organisation`, `accept_invitation` | No |
| `0005_down.sql` | Drops the sign-up trigger and its function | No (profiles are kept) |
| `0004_down.sql` | Drops all policies, keeps RLS **enabled** (deny-all) | No |
| `0003_down.sql` | Drops helper functions and the membership guard | No |
| `0002_down.sql` | Drops all five tables | **YES, destroys all data** |

`0004_down.sql` intentionally leaves RLS enabled: removing policies yields "no access",
never "open access". Do not disable RLS on a live project.
