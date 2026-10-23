import { describe, it, expect, beforeAll } from 'vitest'; import { PGlite } from '@electric-sql/pglite'; import { readFileSync } from 'fs'; import { resolve } from 'path';
const sql = (f: string) => readFileSync(resolve(__dirname, '../../../supabase', f), 'utf8');
const A = 'bbbbbbbb-0000-0000-0000-000000000001'; // inst 1, under_scrutiny
let db: PGlite; const U = { officer: '00000000-0000-0000-0000-0000000000a1', inst1: '00000000-0000-0000-0000-0000000000a2', inst2: '00000000-0000-0000-0000-0000000000a3', auditor: '00000000-0000-0000-0000-0000000000a4' };
const as = (id: string) => db.query(`select set_config('request.jwt.claim.sub','${id}',false)`);
const tr = async (to: string, v: number, reason?: string) => { try { return (await db.query<{ r: any }>(`select transition_application($1,$2,$3,$4) r`, [A, to, v, reason ?? null])).rows[0].r; } catch (e) { return { error: (e as Error).message }; } };
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await db.exec(sql('migrations/0001_core.sql')); await db.exec(sql('seed.sql')); await db.exec(sql('migrations/0002_seed_obligations.sql')); await db.exec(sql('migrations/0003_transitions.sql'));
  const I1 = '11111111-1111-1111-1111-111111111111', I2 = '22222222-2222-2222-2222-222222222222';
  for (const [k, id] of Object.entries(U)) await db.query(`insert into auth.users values($1,$2)`, [id, k]);
  await db.query(`insert into profiles values($1,'officer',null),($2,'institution',$4),($3,'institution',$5),($6,'auditor',null)`, [U.officer, U.inst1, U.inst2, I1, I2, U.auditor]);
});
describe('transition_application (real SQL on PGlite)', () => {
  it('rejects unauthenticated', async () => { await as(''); expect((await tr('closed', 1)).error).toContain('UNAUTHENTICATED'); });
  it('prohibited jump rejected', async () => { await as(U.officer); expect((await tr('approved', 1)).error).toContain('PROHIBITED'); });
  it('reason required', async () => { await as(U.officer); expect((await tr('correction_requested', 1)).error).toContain('REASON_REQUIRED'); });
  it('other institution cannot see it', async () => { await as(U.inst2); expect((await tr('resubmitted', 1)).error).toContain('NOT_FOUND'); });
  it('auditor forbidden', async () => { await as(U.auditor); expect((await tr('correction_requested', 1, 'x')).error).toContain('FORBIDDEN'); });
  it('stale version conflict', async () => { await as(U.officer); expect((await tr('correction_requested', 9, 'x')).error).toContain('CONFLICT'); });
  it('failed attempts changed nothing', async () => expect((await db.query<any>(`select count(*)::int c from audit_events`)).rows[0].c).toBe(0));
  it('success writes audit + outbox atomically', async () => {
    await as(U.officer); const r = await tr('correction_requested', 1, 'Fire certificate illegible'); expect(r.state).toBe('correction_requested'); expect(r.version).toBe(2);
    const a = (await db.query<any>(`select prev_state,new_state,actor_role,metadata from audit_events`)).rows; expect(a).toHaveLength(1); expect(a[0]).toMatchObject({ prev_state: 'under_scrutiny', new_state: 'correction_requested', actor_role: 'officer' });
    expect((await db.query<any>(`select count(*)::int c from notification_outbox`)).rows[0].c).toBe(1);
  });
  it('institution can resubmit own', async () => { await as(U.inst1); expect((await tr('resubmitted', 2)).state).toBe('resubmitted'); });
  it('audit log is append-only', async () => { await expect(db.exec(`update audit_events set event_type='x'`)).rejects.toThrow(/immutable/); });
});
