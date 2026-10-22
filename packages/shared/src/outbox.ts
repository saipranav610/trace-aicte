export type NStatus = 'pending' | 'retry_scheduled' | 'delivered' | 'failed';
export interface Outbox { id: string; idempotencyKey: string; recipient: string; body: string; status: NStatus; attempts: number; nextAt: number; log: string[]; }
export const idempotencyKey = (obligationId: string, kind: string, dueDate: string) => `${obligationId}:${kind}:${dueDate}`;
/** Enqueue is idempotent: same logical alert never creates a second row. */
export function enqueue(store: Outbox[], o: { obligationId: string; kind: string; dueDate: string; recipient: string; body: string }, now: number): Outbox {
  const key = idempotencyKey(o.obligationId, o.kind, o.dueDate);
  const ex = store.find(x => x.idempotencyKey === key); if (ex) return ex;
  const row: Outbox = { id: `n${store.length + 1}`, idempotencyKey: key, recipient: o.recipient, body: o.body, status: 'pending', attempts: 0, nextAt: now, log: [] };
  store.push(row); return row;
}
export const backoffMs = (attempt: number) => Math.min(2 ** attempt * 1000, 60000);
export async function processOutbox(store: Outbox[], send: (n: Outbox) => Promise<void>, now: number, maxAttempts = 3) {
  for (const n of store.filter(x => (x.status === 'pending' || x.status === 'retry_scheduled') && x.nextAt <= now)) {
    n.attempts++;
    try { await send(n); n.status = 'delivered'; n.log.push(`attempt ${n.attempts}: delivered`); }
    catch (e) { n.log.push(`attempt ${n.attempts}: ${(e as Error).message}`);
      if (n.attempts >= maxAttempts) n.status = 'failed'; else { n.status = 'retry_scheduled'; n.nextAt = now + backoffMs(n.attempts); } }
  }
}
