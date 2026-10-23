import { useEffect, useState, useCallback } from 'react'; import { supabase } from './supabase';
type Doc = { id: string; doc_type: string; storage_path: string; sha256: string; expiry_date: string | null; review_status: string; institutions: { name: string } | null };
type App = { id: string; institution_id: string; institutions: { name: string } | null };
type Rev = { id: string; decision: string; reason: string | null; at: string };
const card: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, margin: '12px 0', background: '#fff' };
const MAGIC: Record<string, number[]> = { 'application/pdf': [0x25, 0x50, 0x44, 0x46], 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff] };
async function sha256(buf: ArrayBuffer) { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
export default function Evidence() {
  const [docs, setDocs] = useState<Doc[]>([]); const [apps, setApps] = useState<App[]>([]); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(true);
  const [appId, setAppId] = useState(''); const [type, setType] = useState(''); const [exp, setExp] = useState(''); const [file, setFile] = useState<File | null>(null);
  const [sel, setSel] = useState<string | null>(null); const [revs, setRevs] = useState<Rev[]>([]); const [dec, setDec] = useState('approved'); const [reason, setReason] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const say = (m: string, good: boolean) => { setMsg(m); setOk(good); };
  const load = useCallback(async () => {
    const d = await supabase.from('documents').select('id,doc_type,storage_path,sha256,expiry_date,review_status,institutions(name)').order('created_at', { ascending: false });
    const a = await supabase.from('applications').select('id,institution_id,institutions(name)');
    if (d.error) say(d.error.message, false); else setDocs(d.data as unknown as Doc[]); if (a.data) { setApps(a.data as unknown as App[]); setAppId(x => x || a.data![0]?.id || ''); } }, []);
  const loadRevs = useCallback(async (id: string) => { const { data } = await supabase.from('evidence_reviews').select('id,decision,reason,at').eq('document_id', id).order('at'); setRevs((data ?? []) as Rev[]); }, []);
  useEffect(() => { load(); }, [load]); useEffect(() => { if (sel) loadRevs(sel); }, [sel, loadRevs]);
  const upload = async (e: React.FormEvent) => { e.preventDefault(); const app = apps.find(a => a.id === appId); if (!file || !app || !type.trim()) return say('Choose application, type and file.', false);
    if (file.size > 5 * 1024 * 1024) return say('File too large (max 5 MB).', false);
    const buf = await file.arrayBuffer(); const head = [...new Uint8Array(buf.slice(0, 4))]; const sig = MAGIC[file.type];
    if (!sig || !sig.every((b, i) => head[i] === b)) return say('Only PDF/PNG/JPEG whose content matches their type are accepted.', false);
    const path = `${app.institution_id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const up = await supabase.storage.from('evidence').upload(path, file, { contentType: file.type, upsert: false }); if (up.error) return say(`Upload failed: ${up.error.message}`, false);
    const { error } = await supabase.rpc('register_document', { p_app: appId, p_doc_type: type, p_path: path, p_sha256: await sha256(buf), p_expiry: exp || null });
    if (error) return say(`Database rejected: ${error.message}`, false); say('Uploaded, checksummed and registered.', true); setFile(null); load(); };
  const review = async () => { if (!sel) return; if (!confirmed) return say('Confirm you have checked the fields against the source.', false);
    const { error } = await supabase.rpc('review_document', { p_doc: sel, p_decision: dec, p_reason: reason || null, p_fields: { confirmed_by_human: true } });
    if (error) say(`Database rejected: ${error.message}`, false); else { say('Review recorded.', true); setReason(''); setConfirmed(false); load(); loadRevs(sel); } };
  const open = async (d: Doc) => { const { data, error } = await supabase.storage.from('evidence').createSignedUrl(d.storage_path, 60); if (error) say(`Cannot open: ${error.message}`, false); else window.open(data.signedUrl, '_blank', 'noopener'); };
  const cur = docs.find(d => d.id === sel);
  return <div>{msg && <p role="status" style={{ color: ok ? '#166534' : '#b91c1c' }}>{msg}</p>}
    <form onSubmit={upload} style={card}><h3>Upload evidence</h3>
      <select aria-label="Application" value={appId} onChange={e => setAppId(e.target.value)}>{apps.map(a => <option key={a.id} value={a.id}>{a.institutions?.name} · {a.id.slice(0, 8)}</option>)}</select>{' '}
      <input aria-label="Document type" placeholder="Document type" value={type} onChange={e => setType(e.target.value)} />{' '}
      <input aria-label="Expiry date" type="date" value={exp} onChange={e => setExp(e.target.value)} />{' '}
      <input aria-label="File" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] ?? null)} /> <button>Upload</button></form>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th align="left">Institution</th><th align="left">Document</th><th>Expiry</th><th>Status</th><th></th></tr></thead><tbody>
      {docs.map(d => <tr key={d.id} style={{ borderTop: '1px solid #e2e8f0' }}><td>{d.institutions?.name}</td><td>{d.doc_type}</td><td align="center">{d.expiry_date ?? '—'}</td><td align="center">{d.review_status}</td>
        <td><button onClick={() => setSel(d.id)}>Review</button> <button onClick={() => open(d)}>Open</button></td></tr>)}</tbody></table>
    {cur && <div style={card}><h3>Evidence review — {cur.doc_type}</h3><p>Checksum (SHA-256): <code>{cur.sha256.slice(0, 16)}…</code> · Declared expiry: {cur.expiry_date ?? 'none recorded'} · Extraction: manual entry (OCR not enabled)</p>
      <select aria-label="Decision" value={dec} onChange={e => setDec(e.target.value)}><option value="approved">approved</option><option value="needs_correction">needs_correction</option><option value="rejected">rejected</option></select>{' '}
      <input aria-label="Reason" placeholder="Reason (required unless approved)" value={reason} onChange={e => setReason(e.target.value)} />{' '}
      <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I checked the fields against the source</label> <button onClick={review}>Record review</button>
      <h4>Review history</h4>{!revs.length ? <p>No reviews yet.</p> : <ul>{revs.map(r => <li key={r.id}>{new Date(r.at).toISOString()} · {r.decision}{r.reason ? ` · ${r.reason}` : ''}</li>)}</ul>}</div>}</div>;
}
