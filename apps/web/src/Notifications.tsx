import { useEffect, useState, useCallback } from 'react'; import { supabase } from './supabase';
type Row = { id: string; idempotency_key: string; status: string; attempts: number; next_attempt_at: string; notification_attempts: { id: number; outcome: string; detail: string; at: string }[] };
export default function Notifications() {
  const [rows, setRows] = useState<Row[]>([]); const [msg, setMsg] = useState(''); const [mins, setMins] = useState(0);
  const load = useCallback(async () => { const { data, error } = await supabase.from('notification_outbox').select('id,idempotency_key,status,attempts,next_attempt_at,notification_attempts(id,outcome,detail,at)').order('next_attempt_at'); if (error) setMsg(error.message); else setRows(data as unknown as Row[]); }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (fail: boolean) => { const { data, error } = await supabase.rpc('process_outbox', { p_now: new Date(Date.now() + mins * 60000).toISOString(), p_fail: fail });
    setMsg(error ? `Database rejected: ${error.message}` : `${fail ? 'Failure simulated' : 'Provider OK'}: ${JSON.stringify(data)}`); load(); };
  return <div><p>Simulated provider (no real email is sent). Backoff is 2, 4 minutes; failed after 3 attempts. Use the clock skip to make retries due immediately.</p>
    <button onClick={() => run(true)}>Process — simulate provider failure</button> <button onClick={() => run(false)}>Process — provider OK</button>{' '}
    <label>Skip clock ahead (min): <input type="number" value={mins} onChange={e => setMins(+e.target.value)} style={{ width: 70 }} /></label>
    {msg && <p role="status">{msg}</p>}<p>{rows.length} logical alert(s) in outbox (never duplicated by retries)</p>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th align="left">Alert key</th><th>Status</th><th>Attempts</th><th align="left">History</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}><td>{r.idempotency_key.slice(0, 40)}</td><td align="center">{r.status}</td><td align="center">{r.attempts}</td><td>{r.notification_attempts.map(a => a.outcome).join(' → ')}</td></tr>)}</tbody></table></div>;
}
