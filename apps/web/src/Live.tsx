import { useEffect, useState } from 'react'; import { supabase } from './supabase'; import { computeDeadline, classify, escalationLevel } from '@trace/shared';
type Row = { id: string; type: string; status: string; priority: string; responsible_role: string; trigger_event: string; due_date: string; deadline_explanation: string; institutions: { name: string } | null;
  rule_versions: { rule_id: string; version: number; source_ref: string; config: { offsetDays: number; policy: 'calendar' | 'working' } } | null; documents: { doc_type: string; expiry_date: string | null } | null };
const card: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, margin: '12px 0', background: '#fff' };
export default function Live({ now, simulated }: { now: string; simulated: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null); const [err, setErr] = useState(''); const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { supabase.from('obligations').select('id,type,status,priority,responsible_role,trigger_event,due_date,deadline_explanation,institutions(name),rule_versions(rule_id,version,source_ref,config),documents(doc_type,expiry_date)').order('due_date')
    .then(({ data, error }) => { if (error) setErr(error.message); else setRows(data as unknown as Row[]); }); }, []);
  if (err) return <p role="alert" style={{ color: '#b91c1c' }}>Could not load: {err}</p>;
  if (!rows) return <p>Loading obligations…</p>;
  if (!rows.length) return <p>No obligations visible to your role/institution. (Did you run 0002_seed_obligations.sql?)</p>;
  const s = rows.find(r => r.id === sel);
  const check = s?.documents?.expiry_date && s.rule_versions ? computeDeadline({ trigger: s.documents.expiry_date, offsetDays: s.rule_versions.config.offsetDays, policy: s.rule_versions.config.policy }) : null;
  return <div><p>Date used: <b>{now}</b> ({simulated ? 'SIMULATED' : 'real time'}) · {rows.length} obligation(s) visible to you (database-derived)</p>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th align="left">Institution</th><th align="left">Type</th><th>Due</th><th>Bucket</th><th>Esc.</th><th></th></tr></thead><tbody>
      {rows.map(r => <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}><td>{r.institutions?.name}</td><td>{r.type}</td><td align="center">{r.due_date}</td>
        <td align="center">{classify(r.due_date, now)}</td><td align="center">{escalationLevel(r.due_date, now, [3, 7, 14])}</td><td><button onClick={() => setSel(r.id)}>Explain</button></td></tr>)}</tbody></table>
    {s && <div style={card}><h3>Explain This Decision</h3><ul>
      <li>Triggering event: {s.trigger_event}</li><li>Rule: {s.rule_versions?.rule_id} v{s.rule_versions?.version} ({s.rule_versions?.source_ref})</li>
      <li>Stored calculation: {s.deadline_explanation}</li><li>Stored due date: {s.due_date}</li>
      <li>Independent recompute from evidence: {check ? `${check.due} — ${check.due === s.due_date ? 'MATCHES stored value' : 'MISMATCH with stored value'}` : 'not applicable (no evidence expiry date)'}</li>
      <li>Responsible role: {s.responsible_role}</li><li>Evidence: {s.documents ? `${s.documents.doc_type} (expires ${s.documents.expiry_date})` : 'none linked'}</li></ul></div>}</div>;
}
