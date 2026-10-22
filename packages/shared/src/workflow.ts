export type Role = 'admin' | 'officer' | 'evc' | 'institution' | 'auditor';
export const STATES = ['draft','submitted','initial_validation','under_scrutiny','correction_requested','resubmitted','evc_pending','evc_scheduled','evc_completed','awaiting_decision','approved','rejected','closed'] as const;
export type State = typeof STATES[number];
interface T { to: State; roles: Role[]; needsReason?: boolean }
// ILLUSTRATIVE prototype workflow - not verified against official AICTE process.
export const TRANSITIONS: Record<State, T[]> = {
  draft: [{ to: 'submitted', roles: ['institution'] }],
  submitted: [{ to: 'initial_validation', roles: ['officer'] }],
  initial_validation: [{ to: 'under_scrutiny', roles: ['officer'] }],
  under_scrutiny: [{ to: 'correction_requested', roles: ['officer'], needsReason: true }, { to: 'evc_pending', roles: ['officer'] }],
  correction_requested: [{ to: 'resubmitted', roles: ['institution'] }],
  resubmitted: [{ to: 'under_scrutiny', roles: ['officer'] }],
  evc_pending: [{ to: 'evc_scheduled', roles: ['evc'] }],
  evc_scheduled: [{ to: 'evc_completed', roles: ['evc'] }, { to: 'evc_scheduled', roles: ['evc'], needsReason: true }],
  evc_completed: [{ to: 'awaiting_decision', roles: ['officer'] }],
  awaiting_decision: [{ to: 'approved', roles: ['officer'], needsReason: true }, { to: 'rejected', roles: ['officer'], needsReason: true }],
  approved: [{ to: 'closed', roles: ['officer', 'admin'] }],
  rejected: [{ to: 'closed', roles: ['officer', 'admin'] }],
  closed: [],
};
export type TransitionResult = { ok: true; state: State; version: number } | { ok: false; error: string };
export function applyTransition(a: { state: State; version: number }, to: State, role: Role, expectedVersion: number, reason?: string): TransitionResult {
  if (a.version !== expectedVersion) return { ok: false, error: 'CONFLICT: stale version' };
  const t = TRANSITIONS[a.state].find(x => x.to === to);
  if (!t) return { ok: false, error: `PROHIBITED: ${a.state} -> ${to}` };
  if (!t.roles.includes(role)) return { ok: false, error: `FORBIDDEN: role ${role} cannot ${a.state} -> ${to}` };
  if (t.needsReason && !reason?.trim()) return { ok: false, error: 'REASON_REQUIRED' };
  return { ok: true, state: to, version: a.version + 1 };
}
