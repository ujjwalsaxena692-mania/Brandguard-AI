# Migrations

Numbered, forward-only SQL files (`NNNN_description.sql`), applied in order.

| File | Purpose |
| --- | --- |
| `0001_enable_extensions.sql` | Enables `pgvector` (the `vector` extension). |

Every table added later must ship with Row Level Security enabled and
organisation-scoped policies in the same migration.
