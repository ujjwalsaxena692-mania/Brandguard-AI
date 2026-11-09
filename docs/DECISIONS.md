# Technical decisions

Short records of choices made in Part 01, and why.

1. **Tailwind CSS v3, not v4.** Mature, widely documented, and works with the shadcn conventions used here.
2. **shadcn-style components, hand-written.** Components follow shadcn/ui patterns (Radix + class-variance-authority) and `components.json` is provided, so the CLI can add more later. Our tokens use RGB channels rather than shadcn's default HSL, and `secondary`, `accent` and `popover` are aliased to brand tokens so CLI-added components still resolve.
3. **System font stack.** No external font requests; avoids a dependency and a privacy concern.
4. **Light theme only.** Dark mode was not requested; tokens make it a later addition.
5. **Input borders are darker (`#8A8A8A`) than card borders (`#E5E5E5`).** WCAG 1.4.11 needs 3:1 contrast for form controls; the specified light grey is used for all decorative borders.
6. **Semantic colours.** Success green and warning amber exist only for status meaning. "Danger" and errors use the brand red family.
7. **Auth is real or absent, never faked.** Sign-in and registration call Supabase Auth. Without keys the forms are disabled with an explanation. The dev server allows a labelled, unauthenticated preview of the shell; production builds without keys fail closed. The route guard is a UX layer only; the backend must verify JWTs.
8. **Settings via plain Pydantic + python-dotenv**, not `pydantic-settings`, to keep dependencies minimal. Secrets use `SecretStr`.
9. **Supabase SDK imported lazily** so the API starts without credentials and never pretends to be connected.
10. **Integration status reports credentials only.** "Configured" is not "verified"; the UI says so.
11. **Deferred dependencies.** `anthropic`, PyMuPDF, python-docx, pytesseract and an embedding SDK are added by the modules that use them.
12. **Provisional statuses.** `SubmissionStatus` in `frontend/src/types` exists only for badge rendering and must be aligned with the database enum.
13. **Only extensions in the first migration.** The schema and Row Level Security policies should be designed together in the next part.
14. **No account-to-organisation link yet.** Registration creates an auth user only; organisation membership arrives with access control.

## Open questions for the next part

- Embedding provider and vector dimension (this fixes the `vector(n)` column size).
- Roles: which of admin / brand manager / reviewer / contributor are needed?
- Single organisation per user, or multiple memberships?
- Supported document types and size limits for the knowledge hub.
