export type Policy = 'calendar' | 'working';
export interface DeadlineInput { trigger: string; offsetDays: number; policy: Policy; holidays?: string[]; }
export interface DeadlineResult { due: string; explanation: string; }
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + 'T00:00:00Z');
/** Deterministic: no dependence on machine clock. Dates are YYYY-MM-DD (local-date rule). */
export function computeDeadline(i: DeadlineInput): DeadlineResult {
  const hol = new Set(i.holidays ?? []);
  const d = parse(i.trigger);
  if (i.policy === 'calendar') d.setUTCDate(d.getUTCDate() + i.offsetDays);
  else {
    const step = i.offsetDays < 0 ? -1 : 1; let left = Math.abs(i.offsetDays);
    while (left > 0) { d.setUTCDate(d.getUTCDate() + step); const w = d.getUTCDay();
      if (w !== 0 && w !== 6 && !hol.has(iso(d))) left--; }
  }
  return { due: iso(d), explanation: `${i.trigger} ${i.offsetDays >= 0 ? '+' : ''}${i.offsetDays} ${i.policy} day(s)` + (i.policy === 'working' ? ` (weekends and ${hol.size} listed holiday(s) skipped)` : '') + ` = ${iso(d)}` };
}
export type Bucket = 'overdue' | 'due_today' | 'upcoming' | 'later';
export function classify(due: string, now: string, upcomingDays = 7): Bucket {
  const diff = (parse(due).getTime() - parse(now).getTime()) / 86400000;
  return diff < 0 ? 'overdue' : diff === 0 ? 'due_today' : diff <= upcomingDays ? 'upcoming' : 'later';
}
export function escalationLevel(due: string, now: string, thresholds: number[]): number {
  const late = (parse(now).getTime() - parse(due).getTime()) / 86400000;
  return thresholds.filter(t => late >= t).length;
}
