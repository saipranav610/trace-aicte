import { useEffect, useState, useCallback } from 'react'; import { supabase } from './supabase'; import { TRANSITIONS, type State } from '@trace/shared';
type App = { id: string; state: State; version: number; institutions: { name: string } | null };
type Ev = { id: number; at: string; actor_role: string; prev_state: string; new_state: string; correlation_id: string; metadata: { reason?: string } };
const card: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, margin: '12px 0', background: '#fff' };
export default function Applications() {
  const [apps, setApps] = useState<App[] | null>(null); const [sel, setSel] = useState<string | null>(null); const [ev, setEv] = useState<Ev[]>([]); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(true);
  const load = useCallback(async () => { const { data, error } = await supabase.from('applications').select('id,state,version,institutions(name)').order('created_at');
    if (error) { setMsg(error.message); setOk(false); } else setApps(data as unknown as App[]); }, []);
  const loadEv = useCallback(async (id: string) => { const { data } = await supabase.from('audit_events').select('id,at,actor_role,prev_state,new_state,correlation_id,metadata').eq('entity_id', id).order('id'); setEv((data ?? []) as Ev[]); }, []);
  useEffect(() => { load(); }, [load]); useEffect(() => { if (sel) loadEv(sel); }, [sel, loadEv]);
  const go = async (a: App, to: string) => {
    const needs = TRANSITIONS[a.state].find(t => t.to === to)?.needsReason; const reason = needs ? window.prompt('Reason (required):') ?? '' : undefined;
    const { data, error } = await supabase.rpc('transition_application', { p_app: a.id, p_to: to, p_expected_version: a.version, p_reason: reason ?? null });
    if (error) { setOk(false); setMsg(`Database rejected: ${error.message}`); } else { setOk(true); setMsg(`OK → ${(data as { state: string }).state}`); await load(); }
    if (sel === a.id) await loadEv(a.id); };
  if (!apps) return <p>{msg || 'Loading applications…'}</p>;
  const cur = apps.find(a => a.id === sel);
  return <div><p>{apps.length} application(s) visible to you. Buttons are hints only: the database makes the final decision.</p>
    {msg && <p role="status" style={{ color: ok ? '#166534' : '#b91c1c' }}>{msg}</p>}
    <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th align="left">Institution</th><th align="left">State</th><th>v</th><th align="left">Actions</th></tr></thead><tbody>
      {apps.map(a => <tr key={a.id} style={{ borderTop: '1px solid #e2e8f0' }}><td>{a.institutions?.name}</td><td>{a.state}</td><td align="center">{a.version}</td>
        <td>{TRANSITIONS[a.state].map(t => <button key={t.to} onClick={() => go(a, t.to)}>{t.to}</button>)} <button onClick={() => go(a, 'approved')} title="Should always be rejected unless legal">try → approved</button> <button onClick={() => setSel(a.id)}>Timeline</button></td></tr>)}</tbody></table>
    {cur && <div style={card}><h3>Audit timeline — {cur.institutions?.name} (now {cur.state}, v{cur.version})</h3>{!ev.length ? <p>No events yet (or your role cannot read audit events).</p> :
      <ol>{ev.map(e => <li key={e.id}>{new Date(e.at).toISOString()} · {e.actor_role}: {e.prev_state} → {e.new_state}{e.metadata?.reason ? ` · reason: ${e.metadata.reason}` : ''} · corr {e.correlation_id.slice(0, 8)}</li>)}</ol>}</div>}</div>;
}
