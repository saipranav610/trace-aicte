# Status (honest)
**Implemented and tested (13 unit tests passing):** deadline calc (calendar/working/holidays/negative offset), bucket classification, escalation levels, state machine (prohibited/role/reason/optimistic version), idempotent outbox with backoff retry, deterministic replay with divergence explanation.
**Written, NOT executed:** SQL migration/RLS (no Postgres here), web app (production build succeeded; not browser-tested).
**Not implemented:** Supabase Auth wiring and data queries in UI, SQL transition RPC, storage policies, document upload/OCR, EVC board, rule comparison/impact UI, audit explorer, analytics, health page, NestJS/worker, Playwright tests, full seed (~20 apps), docs listed in the master prompt.
**Unverified:** all deployments. Official AICTE rules not checked.

## Round 2
Added: Supabase sign-in/logout (Gate.tsx), live obligations read under RLS (Live.tsx) with independent recompute check, 0002_seed_obligations.sql, search_path fix on role helpers.
Verify manually: officer@trace.test sees 4 obligations; institution@trace.test sees only 2 (Demo Institute). Not yet automated.
