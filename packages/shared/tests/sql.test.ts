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
  await db.exec(sql('migrations/0001_core.sql')); await db.exec(sql('seed.sql')); await db.exec(sql('migrations/0002_seed_obligations.sql')); await db.exec(sql('migrations/0003_transitions.sql')); await db.exec(sql('migrations/0004_evidence_outbox.sql'));
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

const rpc = async (q: string, args: unknown[]) => { try { return (await db.query<{ r: any }>(q, args)).rows[0].r; } catch (e) { return { error: (e as Error).message }; } };
const H = 'a'.repeat(64);
describe('evidence + outbox (real SQL on PGlite)', () => {
  let doc = '';
  it('institution registers own document', async () => { await as(U.inst1); const r = await rpc(`select register_document($1,'Fire cert','11111111-1111-1111-1111-111111111111/f.pdf',$2,'2027-01-01') r`, [A, H]); expect(r.document_id).toBeTruthy(); doc = r.document_id; });
  it('other institution cannot register against it', async () => { await as(U.inst2); expect((await rpc(`select register_document($1,'x','22222222-2222-2222-2222-222222222222/f.pdf',$2) r`, [A, H])).error).toContain('NOT_FOUND'); });
  it('path traversal / wrong folder rejected', async () => { await as(U.inst1); expect((await rpc(`select register_document($1,'x','../x.pdf',$2) r`, [A, H])).error).toContain('INVALID_PATH'); });
  it('institution cannot review', async () => { await as(U.inst1); expect((await rpc(`select review_document($1,'approved') r`, [doc])).error).toContain('FORBIDDEN'); });
  it('rejection needs reason', async () => { await as(U.officer); expect((await rpc(`select review_document($1,'rejected') r`, [doc])).error).toContain('REASON_REQUIRED'); });
  it('review records decision + audit', async () => { await as(U.officer); expect((await rpc(`select review_document($1,'needs_correction','Expiry unreadable') r`, [doc])).status).toBe('needs_correction');
    expect((await db.query<any>(`select review_status from documents where id=$1`, [doc])).rows[0].review_status).toBe('needs_correction');
    expect((await db.query<any>(`select count(*)::int c from audit_events where entity_id=$1`, [doc])).rows[0].c).toBe(2); });
  it('outbox: failure -> retry -> delivered, no duplicate rows', async () => {
    await as(U.officer); const n = (await db.query<any>(`select count(*)::int c from notification_outbox`)).rows[0].c; expect(n).toBeGreaterThan(0);
    await rpc(`select process_outbox(now(), true) r`, []); expect((await db.query<any>(`select distinct status from notification_outbox`)).rows).toEqual([{ status: 'retry_scheduled' }]);
    await rpc(`select process_outbox(now(), false) r`, []); expect((await db.query<any>(`select count(*)::int c from notification_outbox where status='retry_scheduled'`)).rows[0].c).toBe(n);
    await rpc(`select process_outbox(now() + interval '10 minutes', false) r`, []);
    expect((await db.query<any>(`select distinct status from notification_outbox`)).rows).toEqual([{ status: 'delivered' }]);
    expect((await db.query<any>(`select count(*)::int c from notification_outbox`)).rows[0].c).toBe(n);
    expect((await db.query<any>(`select count(*)::int c from notification_attempts`)).rows[0].c).toBe(2 * n); });
  it('auditor cannot process outbox', async () => { await as(U.auditor); expect((await rpc(`select process_outbox(now(), false) r`, [])).error).toContain('FORBIDDEN'); });
});
