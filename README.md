# TRACE-AICTE (SIH26262 prototype)
Traceable Regulatory Approval, Compliance and Escalation Engine. **All data is synthetic; all rules are illustrative and unverified against official AICTE sources.**

## Structure
- `packages/shared` – deterministic engine (deadlines, workflow state machine, notification outbox, replay) + Vitest tests
- `apps/web` – React/Vite UI (Command Center with "Explain This Decision", Governance demo, demo clock)
- `supabase/migrations/0001_core.sql`, `seed.sql` – schema, RLS, immutability triggers
- `docs/status.md` – honest implemented / not implemented list

## Run
```
npm install
npm test          # engine tests
npm run dev       # web app
npm run build     # production build (Netlify: netlify.toml included)
```
## Deploy
1. Supabase: create project, run `supabase/migrations/0001_core.sql` then `seed.sql` in the SQL editor; create a private `evidence` bucket; add Auth redirect URL.
2. Netlify: import GitHub repo (settings come from `netlify.toml`); set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
Never put service-role keys in `VITE_` vars.
