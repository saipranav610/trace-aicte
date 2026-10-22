import { applyTransition, Role, State } from './workflow';
export interface Event { type: 'transition'; to: State; role: Role; version: number; reason?: string }
export interface Replayed { state: State; version: number; rejected: { index: number; error: string }[] }
/** Pure: no I/O, no live mutation, no notifications. */
export function replay(initial: State, events: Event[]): Replayed {
  let cur = { state: initial, version: 1 }; const rejected: Replayed['rejected'] = [];
  events.forEach((e, index) => { const r = applyTransition(cur, e.to, e.role, e.version, e.reason);
    if (r.ok) cur = { state: r.state, version: r.version }; else rejected.push({ index, error: r.error }); });
  return { ...cur, rejected };
}
export const verify = (initial: State, events: Event[], recorded: { state: State; version: number }) => {
  const r = replay(initial, events); const match = r.state === recorded.state && r.version === recorded.version;
  return { match, replayed: r, explanation: match ? 'Replay matches recorded state.' : `DIVERGENCE: replayed ${r.state}@v${r.version}, recorded ${recorded.state}@v${recorded.version}` };
};
