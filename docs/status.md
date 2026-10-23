# Status (honest)
**Implemented and tested (13 unit tests passing):** deadline calc (calendar/working/holidays/negative offset), bucket classification, escalation levels, state machine (prohibited/role/reason/optimistic version), idempotent outbox with backoff retry, deterministic replay with divergence explanation.
**Written, NOT executed:** SQL migration/RLS (no Postgres here), web app (production build succeeded; not browser-tested).
**Not implemented:** Supabase Auth wiring and data queries in UI, SQL transition RPC, storage policies, document upload/OCR, EVC board, rule comparison/impact UI, audit explorer, analytics, health page, NestJS/worker, Playwright tests, full seed (~20 apps), docs listed in the master prompt.
**Unverified:** all deployments. Official AICTE rules not checked.

## Round 2
Added: Supabase sign-in/logout (Gate.tsx), live obligations read under RLS (Live.tsx) with independent recompute check, 0002_seed_obligations.sql, search_path fix on role helpers.
Verify manually: officer@trace.test sees 4 obligations; institution@trace.test sees only 2 (Demo Institute). Not yet automated.

## Round 3
Added: 0003_transitions.sql (workflow_transitions table + transition_application() SECURITY DEFINER: role/institution/version/reason checks, atomic audit event + idempotent outbox row), Applications page with audit timeline, 10 SQL tests run on PGlite (in-process Postgres) with stubbed auth.uid().
Limits: PGlite runs as superuser so RLS policies themselves are NOT exercised by tests; verify manually per role in Supabase. Rejected attempts are not audited (the exception rolls back the transaction). Not yet: write RLS policies for documents/obligations, storage policies, worker for outbox.
