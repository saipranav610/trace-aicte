import { describe, it, expect } from 'vitest';
import { computeDeadline, classify, escalationLevel, applyTransition, enqueue, processOutbox, replay, verify } from '../src';
describe('deadline golden cases', () => {
  it('calendar +30', () => expect(computeDeadline({ trigger: '2026-01-15', offsetDays: 30, policy: 'calendar' }).due).toBe('2026-02-14'));
  it('working +5 skips weekend', () => expect(computeDeadline({ trigger: '2026-10-22', offsetDays: 5, policy: 'working' }).due).toBe('2026-10-29'));
  it('working skips holiday', () => expect(computeDeadline({ trigger: '2026-10-22', offsetDays: 1, policy: 'working', holidays: ['2026-10-23'] }).due).toBe('2026-10-26'));
  it('negative offset (reminder)', () => expect(computeDeadline({ trigger: '2026-03-01', offsetDays: -30, policy: 'calendar' }).due).toBe('2026-01-30'));
  it('classify + escalate', () => { expect(classify('2026-10-20', '2026-10-22')).toBe('overdue'); expect(classify('2026-10-22', '2026-10-22')).toBe('due_today'); expect(escalationLevel('2026-10-10', '2026-10-22', [3, 7, 14])).toBe(2); });
});
describe('workflow', () => {
  it('rejects prohibited', () => expect(applyTransition({ state: 'draft', version: 1 }, 'approved', 'officer', 1)).toMatchObject({ ok: false }));
  it('rejects wrong role', () => expect(applyTransition({ state: 'draft', version: 1 }, 'submitted', 'officer', 1)).toMatchObject({ ok: false }));
  it('requires reason', () => expect(applyTransition({ state: 'under_scrutiny', version: 1 }, 'correction_requested', 'officer', 1)).toMatchObject({ error: 'REASON_REQUIRED' }));
  it('detects stale version', () => expect(applyTransition({ state: 'draft', version: 2 }, 'submitted', 'institution', 1)).toMatchObject({ error: expect.stringContaining('CONFLICT') }));
});
describe('outbox', () => {
  it('retries without duplicates', async () => {
    const s: any[] = []; const a = { obligationId: 'o1', kind: 'reminder', dueDate: '2026-11-01', recipient: 'x', body: 'b' };
    enqueue(s, a, 0); enqueue(s, a, 0); expect(s).toHaveLength(1);
    let fail = true; const send = async () => { if (fail) throw new Error('provider down'); };
    await processOutbox(s, send, 0); expect(s[0].status).toBe('retry_scheduled');
    fail = false; await processOutbox(s, send, 10000); expect(s[0].status).toBe('delivered'); expect(s).toHaveLength(1);
  });
  it('fails after max attempts', async () => { const s: any[] = []; enqueue(s, { obligationId: 'o', kind: 'k', dueDate: 'd', recipient: 'r', body: 'b' }, 0);
    for (let t = 0; t < 3; t++) await processOutbox(s, async () => { throw new Error('x'); }, t * 100000); expect(s[0].status).toBe('failed'); });
});
describe('replay', () => {
  const ev: any[] = [{ type: 'transition', to: 'submitted', role: 'institution', version: 1 }, { type: 'transition', to: 'initial_validation', role: 'officer', version: 2 }];
  it('deterministic', () => expect(replay('draft', ev)).toEqual(replay('draft', ev)));
  it('verifies match and flags divergence', () => { expect(verify('draft', ev, { state: 'initial_validation', version: 3 }).match).toBe(true);
    expect(verify('draft', ev, { state: 'approved', version: 3 }).explanation).toContain('DIVERGENCE'); });
});
