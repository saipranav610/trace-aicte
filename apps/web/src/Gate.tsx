import { useEffect, useState } from 'react'; import type { Session } from '@supabase/supabase-js';
import { supabase, configured } from './supabase'; import { Shell } from './App';
export default function Gate() {
  const [s, setS] = useState<Session | null>(null); const [ready, setReady] = useState(false);
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!configured) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setS(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, ses) => setS(ses)); return () => data.subscription.unsubscribe(); }, []);
  if (!ready) return <p style={{ padding: 16 }}>Loading…</p>;
  if (!configured) return <p style={{ padding: 16 }}>Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to apps/web/.env.local and fill it in.</p>;
  if (s) return <Shell who={s.user.email ?? ''} onOut={() => supabase.auth.signOut()} />;
  const login = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw }); if (error) setErr(error.message); setBusy(false); };
  return <form onSubmit={login} style={{ fontFamily: 'system-ui', maxWidth: 360, margin: '80px auto', padding: 16 }}>
    <h1 style={{ color: '#1e3a8a' }}>TRACE-AICTE</h1><p>Sign in (synthetic demo accounts, e.g. officer@trace.test)</p>
    <input aria-label="Email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ display: 'block', width: '100%', margin: '8px 0', padding: 8 }} />
    <input aria-label="Password" type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} style={{ display: 'block', width: '100%', margin: '8px 0', padding: 8 }} />
    <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>{err && <p role="alert" style={{ color: '#b91c1c' }}>{err}</p>}</form>;
}
