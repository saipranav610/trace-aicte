import { useState } from 'react'; import { Routes, Route, NavLink } from 'react-router-dom'; import Live from './Live';
import { applyTransition, enqueue, processOutbox, verify, type Outbox, type Event } from '@trace/shared';
const card: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, margin: '12px 0', background: '#fff' };
function Governance() {
  const [msg, setMsg] = useState(''); const [log, setLog] = useState<string[]>([]);
  const bad = () => { const r = applyTransition({ state: 'draft', version: 1 }, 'approved', 'officer', 1); setMsg(r.ok ? 'ok' : r.error); };
  const recover = async () => { const store: Outbox[] = []; const a = { obligationId: 'OBL-002', kind: 'reminder', dueDate: '2026-09-25', recipient: 'inst@example.invalid', body: 'Expiry reminder' };
    enqueue(store, a, 0); enqueue(store, a, 0); let fail = true; const send = async () => { if (fail) throw new Error('simulated provider failure'); };
    await processOutbox(store, send, 0); const l1 = store[0].log.slice(); fail = false; await processOutbox(store, send, 5000);
    setLog([...l1, ...store[0].log.slice(l1.length), `rows in outbox: ${store.length} (no duplicate)`, `final: ${store[0].status}`]); };
  const ev: Event[] = [{ type: 'transition', to: 'submitted', role: 'institution', version: 1 }, { type: 'transition', to: 'initial_validation', role: 'officer', version: 2 }];
  const v = verify('draft', ev, { state: 'initial_validation', version: 3 });
  return <div><div style={card}><h3>Prohibited transition</h3><button onClick={bad}>Officer: draft → approved</button> <code>{msg}</code></div>
    <div style={card}><h3>Notification failure recovery</h3><button onClick={recover}>Simulate failure + retry</button><pre>{log.join('\n')}</pre></div>
    <div style={card}><h3>Audit replay</h3><p>{v.explanation}</p></div></div>;
}
export function Shell({ who, onOut }: { who: string; onOut: () => void }) {
  const [off, setOff] = useState(0); const d = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + off); const now = d.toISOString().slice(0, 10);
  return <div style={{ fontFamily: 'system-ui', maxWidth: 960, margin: '0 auto', padding: 16, color: '#0f172a' }}>
    <h1 style={{ color: '#1e3a8a' }}>TRACE-AICTE</h1><span style={{ float: 'right' }}>{who} <button onClick={onOut}>Log out</button></span>
    <small>Synthetic demo data · illustrative rules · not an official AICTE system</small>
    <nav style={{ display: 'flex', gap: 16, margin: '12px 0' }}><NavLink to="/">Command Center</NavLink><NavLink to="/governance">Governance</NavLink></nav>
    <label>Demo clock offset (days): <input type="number" value={off} onChange={e => setOff(+e.target.value)} /></label>
    <Routes><Route path="/" element={<Live now={now} simulated={off !== 0} />} /><Route path="/governance" element={<Governance />} /></Routes></div>;
}
