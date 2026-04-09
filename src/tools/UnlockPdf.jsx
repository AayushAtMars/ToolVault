import { useState, useRef, useCallback , useEffect} from 'react';
import {
  Lock,
  Unlock,
  Download,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  X,
  FileText,
  Key,
  Eye,
  EyeOff,
  Shield,
  ShieldOff,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Server,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;

/* ── API URL: auto-detects local dev vs Vercel production ─── */
const IS_DEV  = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = IS_DEV
  ? 'http://localhost:5050'           // local Python server in dev
  : `${window.location.origin}/api`;  // Vercel serverless in production

const ENDPOINTS = {
  health:  IS_DEV ? `${API_BASE}/health`              : `${API_BASE}/pdf?action=health`,
  encrypt: IS_DEV ? `${API_BASE}/encrypt`             : `${API_BASE}/pdf?action=encrypt`,
  decrypt: IS_DEV ? `${API_BASE}/decrypt`             : `${API_BASE}/pdf?action=decrypt`,
};

/* ── Helpers ─────────────────────────────────────────────── */
function fmtBytes(b) {
  if (!b) return '—';
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${['B','KB','MB','GB'][i]}`;
}

function pwStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let s = 0;
  if (pw.length >= 8)           s++;
  if (pw.length >= 12)          s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: s, label: 'Weak',   color: '#ef4444' };
  if (s <= 3) return { score: s, label: 'Medium', color: '#f59e0b' };
  return            { score: s, label: 'Strong', color: '#16a34a' };
}

function genPassword(len = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const MODES = [
  { id:'lock',   label:'Add Password',    Icon:Shield,   desc:'Encrypt with AES-256 — real password protection' },
  { id:'unlock', label:'Remove Password', Icon:ShieldOff, desc:'Strip encryption from a protected PDF' },
];

/* ════════════════════════════════════════════════════════ */

/* ── Responsive hook ─────────────────────────────────────── */
function useWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

/* ── Collapsible section ─────────────────────────────────── */
function Collapsible({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', background:'var(--surface-raised,#18181f)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px',
          background:'transparent', border:'none', cursor:'pointer' }}>
        <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase' }}>{title}</span>
        {open ? <ChevronUp size={13} style={{ color:'var(--text-muted)' }}/> : <ChevronDown size={13} style={{ color:'var(--text-muted)' }}/>}
      </button>
      {open && <div style={{ padding:'0 14px 14px' }}>{children}</div>}
    </div>
  );
}

export default function UnlockPdf() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [mode, setMode]           = useState('lock');
  const [stage, setStage]         = useState('idle');
  const [file, setFile]           = useState(null);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [error, setError]         = useState('');
  const [drag, setDrag]           = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [outBlob, setOutBlob]     = useState(null);
  const [outFilename, setOutFilename] = useState('');
  const [attempts, setAttempts]   = useState(0);
  const [apiOnline, setApiOnline] = useState(null);

  const [unlockPw,    setUnlockPw]    = useState('');
  const [showUnlock,  setShowUnlock]  = useState(false);
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied,      setCopied]      = useState(false);

  const pwInputRef = useRef(null);

  /* ── Check API ──────────────────────────────────────────── */
  const checkApi = async () => {
    try {
      const res = await fetch(ENDPOINTS.health, { signal: AbortSignal.timeout(3000) });
      const ok  = res.ok;
      setApiOnline(ok);
      return ok;
    } catch {
      setApiOnline(false);
      return false;
    }
  };

  /* ── Ingest PDF ─────────────────────────────────────────── */
  const ingest = async (files) => {
    setIsReading(true);
    await new Promise(r => setTimeout(r, 50));
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.'); setIsReading(false); return;
    }
    setError(''); setAttempts(0); setUnlockPw(''); setOutBlob(null);

    const online = await checkApi();
    if (!online) { setFile(f); setStage('ready'); setIsReading(false); return; }

    // Detect encryption
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      try {
        await pdfjsLib.getDocument({ data: bytes.slice().buffer }).promise;
        setIsEncrypted(false);
      } catch (err) {
        setIsEncrypted(err.name === 'PasswordException');
      }
    } catch {}

    setFile(f); setStage('ready');
    if (mode === 'unlock') setTimeout(() => pwInputRef.current?.focus(), 80);
    setIsReading(false);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, [mode]);

  /* ── Encrypt ─────────────────────────────────────────────── */
  const processLock = async () => {
    if (!newPw)              { setError('Please enter a password.'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return; }
    if (newPw.length < 4)   { setError('Password must be at least 4 characters.'); return; }
    setStage('processing'); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('password', newPw);
      const res = await fetch(ENDPOINTS.encrypt, { method: 'POST', body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Server error ${res.status}`);
      }
      const blob  = await res.blob();
      const fname = file.name.replace(/\.pdf$/i, '') + '_protected.pdf';
      setOutBlob(blob); setOutFilename(fname); setStage('done');
    } catch(err) {
      setError(err.message || 'Encryption failed.');
      setStage('ready');
    }
  };

  /* ── Decrypt ─────────────────────────────────────────────── */
  const processUnlock = async () => {
    if (isEncrypted && !unlockPw) { setError('Please enter the PDF password.'); return; }
    setStage('processing'); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (unlockPw) fd.append('password', unlockPw);
      const res = await fetch(ENDPOINTS.decrypt, { method: 'POST', body: fd });
      if (res.status === 401) {
        const n = attempts + 1; setAttempts(n);
        setError(`Incorrect password. ${n >= 5 ? 'Please verify you have the right password.' : `${5-n} attempt${5-n!==1?'s':''} remaining.`}`);
        setStage('ready');
        setTimeout(() => { pwInputRef.current?.focus(); pwInputRef.current?.select(); }, 80);
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Server error ${res.status}`);
      }
      const blob  = await res.blob();
      const fname = file.name.replace(/\.pdf$/i, '') + '_unlocked.pdf';
      setOutBlob(blob); setOutFilename(fname); setAttempts(0); setStage('done');
    } catch(err) {
      setError(err.message || 'Failed. Check the API server.');
      setStage('ready');
    }
  };

  const download = () => {
    if (!outBlob) return;
    const url = URL.createObjectURL(outBlob);
    const a   = document.createElement('a');
    a.href = url; a.download = outFilename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyPw = () => { navigator.clipboard.writeText(newPw); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const gen    = () => { const pw = genPassword(); setNewPw(pw); setConfirmPw(pw); };
  const reset  = () => {
    setStage('idle'); setFile(null); setIsEncrypted(false);
    setUnlockPw(''); setNewPw(''); setConfirmPw('');
    setOutBlob(null); setOutFilename(''); setError(''); setAttempts(0);
  };

  const strength = pwStrength(mode === 'lock' ? newPw : unlockPw);

  /* ── API badge ───────────────────────────────────────────── */
  const ApiBadge = () => (
    <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:100, fontSize:10, fontWeight:700, fontFamily:'monospace',
      background: apiOnline===true?'rgba(22,163,74,0.1)':apiOnline===false?'rgba(239,68,68,0.1)':'rgba(255,255,255,0.05)',
      border:`1px solid ${apiOnline===true?'rgba(22,163,74,0.3)':apiOnline===false?'rgba(239,68,68,0.3)':'var(--border)'}`,
      color:apiOnline===true?'#16a34a':apiOnline===false?'#ef4444':'var(--text-muted)' }}>
      {apiOnline===true?<Wifi size={10}/>:apiOnline===false?<WifiOff size={10}/>:<Server size={10}/>}
      {apiOnline===true ? (IS_DEV?'Local API Online':'Vercel API Online') : apiOnline===false ? 'API Offline' : 'Checking…'}
    </div>
  );

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* ══ READING OVERLAY ══ */}
      {isReading && (
        <div style={OverlayBase}>
          <div style={SpinnerBig} />
          <div style={{ color:'white', fontWeight:600 }}>Reading PDF...</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'11px 16px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={15} style={{ color:'#ef4444', flexShrink:0, marginTop:1 }}/>
          <div style={{ flex:1, fontSize:13, color:'#ef4444', lineHeight:1.5 }}>{error}</div>
          <button onClick={()=>setError('')} style={IB}><X size={12}/></button>
        </div>
      )}

      {/* ══ IDLE ══ */}
      {stage === 'idle' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Mode cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {MODES.map(({ id, label, Icon, desc }) => (
              <button key={id} onClick={()=>setMode(id)}
                style={{ display:'flex', flexDirection:'column', gap:8, padding:'16px 18px', borderRadius:12,
                  cursor:'pointer', textAlign:'left', border:'none', transition:'all 0.15s',
                  outline:mode===id?`1.5px solid ${id==='lock'?'var(--accent-blue,#2563EB)':'#f59e0b'}`:'1px solid var(--border)',
                  background:mode===id?(id==='lock'?'rgba(37,99,235,0.08)':'rgba(245,158,11,0.08)'):'var(--surface-raised,#18181f)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:34, height:34, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center',
                    background:mode===id?(id==='lock'?'rgba(37,99,235,0.15)':'rgba(245,158,11,0.15)'):'var(--surface,#111118)',
                    border:`1px solid ${mode===id?(id==='lock'?'rgba(37,99,235,0.35)':'rgba(245,158,11,0.35)'):'var(--border)'}` }}>
                    <Icon size={16} color={mode===id?(id==='lock'?'var(--accent-blue,#2563EB)':'#f59e0b'):'var(--text-muted)'}/>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:mode===id?(id==='lock'?'var(--accent-blue,#2563EB)':'#f59e0b'):'var(--text)' }}>{label}</span>
                  {mode===id && <span style={{ marginLeft:'auto', width:8, height:8, borderRadius:'50%', background:id==='lock'?'var(--accent-blue,#2563EB)':'#f59e0b' }}/>}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.5 }}>{desc}</div>
              </button>
            ))}
          </div>

          {/* API info card */}
          <div style={{ padding:'14px 16px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                <Server size={12}/> Encryption Engine
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <ApiBadge/>
                <button onClick={checkApi} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:10, cursor:'pointer' }}>
                  <RefreshCw size={10}/> Check
                </button>
              </div>
            </div>

            {/* Environment-aware instructions */}
            {IS_DEV ? (
              <div>
                <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.7, marginBottom:8 }}>
                  <strong style={{ color:'var(--text)' }}>Development:</strong> Runs via a local Python server using <code style={CODE}>pikepdf</code> for real AES-256 encryption.
                </div>
                <div style={{ background:'rgba(0,0,0,0.4)', borderRadius:8, padding:'10px 14px', fontFamily:'monospace', fontSize:12, color:'#86efac', lineHeight:1.9 }}>
                  <div style={{ color:'var(--text-muted)', fontSize:10, marginBottom:3 }}># In a separate terminal:</div>
                  <div>pip install pikepdf flask --break-system-packages</div>
                  <div>python3 pdf_encrypt_server.py</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.7 }}>
                <strong style={{ color:'var(--text)' }}>Production:</strong> Runs as a Vercel serverless function (<code style={CODE}>api/pdf.py</code>) — no extra setup needed after deployment.
              </div>
            )}
          </div>

          {/* Drop zone */}
          <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:'60px 40px',
              border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:16,
              background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.2s' }}>
            <input type="file" accept=".pdf,application/pdf" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
            <div style={{ width:68, height:68, borderRadius:20, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s', background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)' }}>
              {mode==='lock'?<Lock size={28} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>:<Unlock size={28} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>}
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:600, marginBottom:5 }}>
                {drag?'Drop PDF here':mode==='lock'?'Drop PDF to Encrypt':'Drop PDF to Decrypt'}
              </div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span>
              </div>
            </div>
          </label>
        </div>
      )}

      {/* ══ API OFFLINE ══ */}
      {stage === 'ready' && apiOnline === false && (
        <div style={{ padding:'20px', borderRadius:12, background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.25)' }}>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
            <WifiOff size={20} style={{ color:'#ef4444', flexShrink:0, marginTop:2 }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#ef4444', marginBottom:6 }}>
                {IS_DEV ? 'Local API Server Not Running' : 'Vercel API Not Responding'}
              </div>
              <div style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.7, marginBottom:12 }}>
                {IS_DEV
                  ? 'Start the local Python server to enable encryption:'
                  : 'The serverless function may be cold-starting. Try again in a moment.'}
              </div>
              {IS_DEV && (
                <div style={{ background:'rgba(0,0,0,0.5)', borderRadius:8, padding:'10px 14px', fontFamily:'monospace', fontSize:12, color:'#86efac', lineHeight:1.9, marginBottom:12 }}>
                  <div>pip install pikepdf flask --break-system-packages</div>
                  <div>python3 pdf_encrypt_server.py</div>
                </div>
              )}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={checkApi} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                  <RefreshCw size={12}/> Retry
                </button>
                <button onClick={reset} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOCK FORM ══ */}
      {stage === 'ready' && apiOnline !== false && mode === 'lock' && (
        <div style={{ background:'var(--surface-raised,#18181f)', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', background:'rgba(37,99,235,0.07)', borderBottom:'1px solid rgba(37,99,235,0.2)', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:42, height:42, borderRadius:11, background:'rgba(37,99,235,0.12)', border:'1px solid rgba(37,99,235,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Shield size={19} color="var(--accent-blue,#2563EB)"/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--accent-blue,#2563EB)' }}>AES-256 Encryption</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file?.name}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace' }}>{fmtBytes(file?.size)}</div>
              <div style={{ fontSize:10, padding:'2px 7px', borderRadius:100, background:'rgba(22,163,74,0.1)', color:'#16a34a', fontWeight:700 }}>REAL ENCRYPTION</div>
            </div>
          </div>

          <div style={{ padding:'22px', display:'flex', flexDirection:'column', gap:16 }}>
            {/* Password field */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={LS}>New Password</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={gen} style={SmBtn}><RefreshCw size={11}/> Generate</button>
                  {newPw && <button onClick={copyPw} style={{ ...SmBtn, color:copied?'#16a34a':undefined }}>{copied?<Check size={11}/>:<Copy size={11}/>} {copied?'Copied':'Copy'}</button>}
                </div>
              </div>
              <div style={{ position:'relative' }}>
                <Key size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
                <input type={showNew?'text':'password'} value={newPw} onChange={e=>setNewPw(e.target.value)}
                  placeholder="Enter a strong password…" autoFocus
                  style={{ ...IN, paddingLeft:38, paddingRight:44, fontFamily:showNew?'inherit':'monospace' }}/>
                <button onMouseDown={e=>{e.preventDefault();setShowNew(v=>!v);}} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', ...IB, width:28, height:28, border:'none', background:'none' }}>
                  {showNew?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
              {newPw && (
                <div style={{ marginTop:8 }}>
                  <div style={{ display:'flex', gap:3, marginBottom:5 }}>
                    {[1,2,3,4,5].map(i=><div key={i} style={{ flex:1, height:3, borderRadius:2, transition:'background 0.25s', background:i<=strength.score?strength.color:'var(--border)' }}/>)}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginBottom:8 }}>
                    <span>Strength</span><span style={{ color:strength.color, fontWeight:700 }}>{strength.label}</span>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {[{l:'8+ chars',m:newPw.length>=8},{l:'Uppercase',m:/[A-Z]/.test(newPw)},{l:'Number',m:/[0-9]/.test(newPw)},{l:'Symbol',m:/[^A-Za-z0-9]/.test(newPw)}].map(r=>(
                      <div key={r.l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:r.m?'#16a34a':'var(--text-muted)' }}>
                        <div style={{ width:12, height:12, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:r.m?'rgba(22,163,74,0.15)':'var(--border)', border:`1px solid ${r.m?'rgba(22,163,74,0.4)':'transparent'}` }}>
                          {r.m&&<Check size={8} strokeWidth={3}/>}
                        </div>{r.l}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <div style={LS}>Confirm Password</div>
              <div style={{ position:'relative' }}>
                <input type={showConfirm?'text':'password'} value={confirmPw} onChange={e=>setConfirmPw(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&processLock()}
                  placeholder="Re-enter password…"
                  style={{ ...IN, paddingRight:44, fontFamily:showConfirm?'inherit':'monospace',
                    borderColor:confirmPw&&confirmPw!==newPw?'rgba(239,68,68,0.5)':confirmPw&&confirmPw===newPw?'rgba(22,163,74,0.5)':undefined }}/>
                <button onMouseDown={e=>{e.preventDefault();setShowConfirm(v=>!v);}} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', ...IB, width:28, height:28, border:'none', background:'none' }}>
                  {showConfirm?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
                {confirmPw&&confirmPw===newPw&&<CheckCircle2 size={14} color="#16a34a" style={{ position:'absolute', right:42, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>}
              </div>
              {confirmPw&&confirmPw!==newPw&&<div style={{ fontSize:11, color:'#ef4444', marginTop:5 }}>Passwords do not match</div>}
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={processLock} disabled={!newPw||newPw!==confirmPw}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px 20px', borderRadius:9, border:'none',
                  background:newPw&&newPw===confirmPw?'var(--accent-blue,#2563EB)':'var(--surface,#111118)',
                  color:newPw&&newPw===confirmPw?'white':'var(--text-muted)',
                  fontSize:14, fontWeight:600, cursor:newPw&&newPw===confirmPw?'pointer':'not-allowed',
                  boxShadow:newPw&&newPw===confirmPw?'0 4px 14px rgba(37,99,235,0.3)':'none', transition:'all 0.15s' }}>
                <Lock size={15}/> Encrypt PDF — AES-256
              </button>
              <button onClick={reset} style={{ padding:'13px 16px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ UNLOCK FORM ══ */}
      {stage === 'ready' && apiOnline !== false && mode === 'unlock' && (
        <div style={{ background:'var(--surface-raised,#18181f)', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', background:'rgba(245,158,11,0.07)', borderBottom:'1px solid rgba(245,158,11,0.2)', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:42, height:42, borderRadius:11, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {isEncrypted?<Lock size={19} color="#f59e0b"/>:<Unlock size={19} color="#f59e0b"/>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#f59e0b' }}>{isEncrypted?'Password Protected PDF':'Remove PDF Restrictions'}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file?.name}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace' }}>{fmtBytes(file?.size)}</div>
              <div style={{ fontSize:10, padding:'2px 7px', borderRadius:100, background:isEncrypted?'rgba(239,68,68,0.1)':'rgba(22,163,74,0.1)', color:isEncrypted?'#ef4444':'#16a34a', fontWeight:700 }}>
                {isEncrypted?'ENCRYPTED':'OPEN'}
              </div>
            </div>
          </div>

          <div style={{ padding:'22px', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
            {isEncrypted ? (
              <div style={{ width:'100%', maxWidth:400 }}>
                <div style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', marginBottom:16, lineHeight:1.6 }}>
                  Enter the PDF password to decrypt and remove all protection.
                </div>
                <div style={LS}>Password</div>
                <div style={{ position:'relative' }}>
                  <Key size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
                  <input ref={pwInputRef} type={showUnlock?'text':'password'} value={unlockPw}
                    onChange={e=>setUnlockPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&processUnlock()}
                    placeholder="Enter PDF password…" autoFocus
                    style={{ ...IN, paddingLeft:38, paddingRight:44, fontFamily:showUnlock?'inherit':'monospace',
                      borderColor:error?'rgba(239,68,68,0.5)':undefined }}/>
                  <button onMouseDown={e=>{e.preventDefault();setShowUnlock(v=>!v);}} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', ...IB, width:28, height:28, border:'none', background:'none' }}>
                    {showUnlock?<EyeOff size={14}/>:<Eye size={14}/>}
                  </button>
                </div>
                {unlockPw&&<div style={{ display:'flex', gap:3, marginTop:8 }}>{[1,2,3,4,5].map(i=><div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<=strength.score?strength.color:'var(--border)' }}/>)}</div>}
                {attempts>=3&&<div style={{ marginTop:10, padding:'10px 14px', borderRadius:8, background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', fontSize:12, color:'#ef4444', lineHeight:1.5 }}>⚠️ Multiple failed attempts. Verify this is the correct password for this exact file.</div>}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🔓</div>
                <div style={{ fontSize:14, color:'var(--text-muted)', lineHeight:1.6 }}>This PDF is not password-protected.<br/>We'll save a clean unrestricted copy.</div>
              </div>
            )}

            <div style={{ width:'100%', maxWidth:400, display:'flex', flexDirection:'column', gap:8 }}>
              <button onClick={processUnlock} disabled={isEncrypted&&!unlockPw}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px 20px', borderRadius:9, border:'none',
                  background:(!isEncrypted||unlockPw)?'#f59e0b':'var(--surface,#111118)',
                  color:(!isEncrypted||unlockPw)?'white':'var(--text-muted)',
                  fontSize:14, fontWeight:600, cursor:(!isEncrypted||unlockPw)?'pointer':'not-allowed',
                  boxShadow:(!isEncrypted||unlockPw)?'0 4px 14px rgba(245,158,11,0.3)':'none', transition:'all 0.15s' }}>
                <Unlock size={15}/>{isEncrypted?'Decrypt & Remove Password':'Save Clean Copy'}
              </button>
              <button onClick={reset} style={{ padding:'10px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>
                ← Upload a different file
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PROCESSING ══ */}
      {stage === 'processing' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'64px 20px', textAlign:'center', background:'var(--surface-raised,#18181f)', borderRadius:16, border:'1px solid var(--border)' }}>
          <div style={{ width:56, height:56, border:'3px solid rgba(37,99,235,0.12)', borderTopColor:'var(--accent-blue,#2563EB)', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginBottom:20 }}/>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:6 }}>{mode==='lock'?'Encrypting with AES-256…':'Decrypting PDF…'}</div>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>{mode==='lock'?'Applying real password protection via pikepdf':'Removing all password restrictions'}</div>
          <div style={{ marginTop:10, fontSize:11, color:'var(--text-muted)', fontFamily:'monospace', opacity:0.6 }}>
            {IS_DEV ? 'via localhost:5050' : 'via vercel serverless function'}
          </div>
        </div>
      )}

      {/* ══ DONE ══ */}
      {stage === 'done' && outBlob && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 24px', textAlign:'center',
          background:mode==='lock'?'rgba(37,99,235,0.04)':'rgba(22,163,74,0.04)',
          borderRadius:16, border:`1px solid ${mode==='lock'?'rgba(37,99,235,0.2)':'rgba(22,163,74,0.2)'}` }}>
          <div style={{ width:68, height:68, borderRadius:'50%',
            background:mode==='lock'?'rgba(37,99,235,0.1)':'rgba(22,163,74,0.1)',
            border:`1px solid ${mode==='lock'?'rgba(37,99,235,0.25)':'rgba(22,163,74,0.25)'}`,
            display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
            {mode==='lock'?<ShieldCheck size={28} color="var(--accent-blue,#2563EB)"/>:<ShieldOff size={28} color="#16a34a"/>}
          </div>
          <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>{mode==='lock'?'PDF Encrypted!':'Password Removed!'}</div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10, lineHeight:1.6, maxWidth:380 }}>
            {mode==='lock'
              ? <><strong style={{ color:'var(--accent-blue,#2563EB)' }}>AES-256</strong> encryption applied. This PDF cannot be opened without the password.</>
              : 'All encryption and restrictions have been permanently removed.'}
          </div>
          {mode==='lock'&&(
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:100, background:'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.25)', fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', marginBottom:20, fontFamily:'monospace' }}>
              <Shield size={11}/> AES-256 · PDF Standard Encryption
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderRadius:12,
            background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', marginBottom:24, width:'100%', maxWidth:360, boxSizing:'border-box' }}>
            <div style={{ width:36, height:36, borderRadius:9, background:mode==='lock'?'rgba(37,99,235,0.1)':'rgba(22,163,74,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <FileText size={17} color={mode==='lock'?'var(--accent-blue,#2563EB)':'#16a34a'}/>
            </div>
            <div style={{ flex:1, textAlign:'left', minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{outFilename}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, fontFamily:'monospace' }}>{fmtBytes(outBlob.size)}</div>
            </div>
            <div style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6, fontFamily:'monospace', flexShrink:0,
              background:mode==='lock'?'rgba(37,99,235,0.1)':'rgba(22,163,74,0.1)',
              color:mode==='lock'?'var(--accent-blue,#2563EB)':'#16a34a' }}>
              {mode==='lock'?'ENCRYPTED':'UNLOCKED'}
            </div>
          </div>
          <button onClick={download} style={{ display:'flex', alignItems:'center', gap:8, padding:'13px 28px', borderRadius:10, border:'none',
            background:mode==='lock'?'var(--accent-blue,#2563EB)':'#16a34a', color:'white', fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:12,
            boxShadow:mode==='lock'?'0 4px 16px rgba(37,99,235,0.3)':'0 4px 16px rgba(22,163,74,0.3)', transition:'all 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            <Download size={15}/> Download PDF
          </button>
          <button onClick={reset} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:13, cursor:'pointer', padding:'8px' }}>
            ← Process another file
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const OverlayBase = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', backdropFilter: 'blur(4px)' };
const SpinnerBig = { width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 };

const LS   = { fontSize:11, fontWeight:700, color:'var(--text-muted,#6b6b80)', marginBottom:7, letterSpacing:'0.07em', textTransform:'uppercase', display:'block' };
const IB   = { display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:7, flexShrink:0, border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)', color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s' };
const IN   = { width:'100%', padding:'11px 14px', borderRadius:9, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box' };
const SmBtn = { display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:11, cursor:'pointer' };
const CODE  = { background:'rgba(255,255,255,0.08)', padding:'1px 5px', borderRadius:4, fontSize:11, fontFamily:'monospace' };