import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Copy, Check, Upload, Trash2, AlertCircle,
  CheckCircle2, Hash, RefreshCw, Eye, EyeOff,
  ShieldCheck, ShieldX, FileText
} from 'lucide-react';

/* ─── useWidth ───────────────────────────────────────────── */
function useWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

/* ─── Hash computation ───────────────────────────────────── */
async function computeHash(data, algorithm) {
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashText(text, algorithm) {
  const data = new TextEncoder().encode(text);
  return computeHash(data, algorithm);
}

async function hashFile(file, algorithm) {
  const buffer = await file.arrayBuffer();
  return computeHash(new Uint8Array(buffer), algorithm);
}

/* ─── Algorithm definitions ──────────────────────────────── */
const ALGOS = [
  { id: 'SHA-1',   label: 'SHA-1',   bits: 160, color: '#f59e0b', warn: true,  desc: 'Legacy — not recommended for security' },
  { id: 'SHA-256', label: 'SHA-256', bits: 256, color: '#2563eb', warn: false, desc: 'Industry standard — widely used' },
  { id: 'SHA-384', label: 'SHA-384', bits: 384, color: '#8b5cf6', warn: false, desc: 'Stronger variant of SHA-2' },
  { id: 'SHA-512', label: 'SHA-512', bits: 512, color: '#10b981', warn: false, desc: 'Highest strength in SHA-2 family' },
];

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/* ─── Reusable UI ────────────────────────────────────────── */
function Panel({ title, icon: Icon, rightSlot, children }) {
  return (
    <div style={{ background: 'var(--surface-raised,#18181f)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {Icon && <Icon size={11} />}{title}
        </span>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

function CopyBtn({ getText, small }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(getText()).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 1500); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: small ? '4px 9px' : '7px 13px', borderRadius: 7,
        background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
        color: ok ? '#10b981' : 'var(--text-muted)',
        fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
      }}>
      {ok ? <Check size={11} /> : <Copy size={11} />}
      {ok ? 'Copied' : 'Copy'}
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize: 12, fontWeight: 800, fontFamily: '"DM Mono",monospace', color: 'var(--text,#f0f0f5)' }}>{value}</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

/* ─── Single hash result row ─────────────────────────────── */
function HashRow({ algo, hash, isLoading, format, upperCase }) {
  const [showFull, setShowFull] = useState(false);
  const displayed = hash
    ? (upperCase ? hash.toUpperCase() : hash)
    : null;

  const formatted = displayed
    ? format === 'groups'
      ? displayed.match(/.{1,8}/g)?.join(' ') ?? displayed
      : format === 'colon'
      ? displayed.match(/.{1,2}/g)?.join(':') ?? displayed
      : displayed
    : null;

  const preview = formatted
    ? showFull ? formatted : formatted.slice(0, format === 'colon' ? 47 : 32) + (formatted.length > (format === 'colon' ? 47 : 32) ? '…' : '')
    : null;

  return (
    <div style={{
      background: 'var(--surface,#111118)',
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${algo.color}`,
      borderRadius: 10, overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: hash ? '1px solid var(--border)' : 'none' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: algo.color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text,#f0f0f5)', fontFamily: '"DM Mono",monospace' }}>{algo.label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>{algo.bits}-bit</span>
        {algo.warn && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 5, padding: '2px 6px' }}>
            <AlertCircle size={9} /> Deprecated
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.5 }}>{algo.desc}</span>
      </div>

      {/* Hash value */}
      {isLoading && (
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={13} style={{ color: 'var(--text-muted)', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: '"DM Mono",monospace' }}>Computing…</span>
        </div>
      )}

      {hash && !isLoading && (
        <div style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <code style={{
              flex: 1, fontSize: 12.5, lineHeight: 1.6,
              fontFamily: '"DM Mono",monospace',
              color: algo.color,
              wordBreak: 'break-all',
              cursor: 'pointer',
            }} onClick={() => setShowFull(s => !s)}>
              {preview}
            </code>
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              <button onClick={() => setShowFull(s => !s)} title={showFull ? 'Collapse' : 'Expand'} style={{
                width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
              }}>
                {showFull ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <CopyBtn getText={() => formatted} small />
            </div>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', opacity: 0.5, fontFamily: 'monospace' }}>
            {hash.length} hex chars = {algo.bits / 4} nibbles
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Verify panel ───────────────────────────────────────── */
function VerifyPanel({ hashes }) {
  const [expected, setExpected] = useState('');
  const [algoId, setAlgoId] = useState('SHA-256');

  const actual = hashes[algoId];
  const match = actual && expected.trim()
    ? actual.toLowerCase() === expected.trim().toLowerCase()
    : null;

  return (
    <Panel title="Verify Hash" icon={ShieldCheck}>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {ALGOS.map(a => (
            <button key={a.id} onClick={() => setAlgoId(a.id)} style={{
              padding: '5px 10px', borderRadius: 7, border: `1px solid ${algoId === a.id ? a.color + '66' : 'var(--border)'}`,
              background: algoId === a.id ? a.color + '18' : 'var(--surface,#111118)',
              color: algoId === a.id ? a.color : 'var(--text-muted)',
              fontFamily: '"DM Mono",monospace', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.13s',
            }}>{a.label}</button>
          ))}
        </div>
        <input
          value={expected}
          onChange={e => setExpected(e.target.value)}
          placeholder={`Paste expected ${algoId} hash to verify…`}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 9,
            background: 'var(--surface,#111118)',
            border: `1px solid ${match === true ? 'rgba(16,185,129,0.4)' : match === false ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
            color: 'var(--text,#f0f0f5)', fontFamily: '"DM Mono",monospace', fontSize: 12, outline: 'none',
            transition: 'border-color 0.15s',
          }}
        />
        {match !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8,
            background: match ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${match ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            color: match ? '#10b981' : '#f87171', fontSize: 13, fontWeight: 700,
          }}>
            {match ? <ShieldCheck size={15} /> : <ShieldX size={15} />}
            {match ? 'Hash matches ✓ — integrity verified' : 'Hash mismatch ✗ — content may be altered'}
          </div>
        )}
        {!actual && expected && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>Generate hashes first to compare.</div>
        )}
      </div>
    </Panel>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function HashGenerator() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [inputType, setInputType] = useState('text'); // 'text' | 'file'
  const [text, setText]           = useState('');
  const [file, setFile]           = useState(null);
  const [hashes, setHashes]       = useState({});
  const [loading, setLoading]     = useState({});
  const [format, setFormat]       = useState('plain');   // 'plain' | 'groups' | 'colon'
  const [upperCase, setUpperCase] = useState(false);
  const [activeAlgos, setActiveAlgos] = useState(new Set(['SHA-1','SHA-256','SHA-384','SHA-512']));
  const fileRef = useRef(null);

  /* ── Compute all on input change ── */
  const compute = useCallback(async () => {
    const active = ALGOS.filter(a => activeAlgos.has(a.id));
    if (!active.length) return;
    if (inputType === 'text' && !text.trim()) { setHashes({}); return; }
    if (inputType === 'file' && !file) { setHashes({}); return; }

    const loadingState = Object.fromEntries(active.map(a => [a.id, true]));
    setLoading(loadingState);

    const results = {};
    await Promise.all(active.map(async algo => {
      try {
        results[algo.id] = inputType === 'text'
          ? await hashText(text, algo.id)
          : await hashFile(file, algo.id);
        setLoading(prev => ({ ...prev, [algo.id]: false }));
        setHashes(prev => ({ ...prev, [algo.id]: results[algo.id] }));
      } catch {
        setLoading(prev => ({ ...prev, [algo.id]: false }));
      }
    }));
  }, [text, file, inputType, activeAlgos]);

  useEffect(() => { compute(); }, [compute]);

  const toggleAlgo = (id) => {
    setActiveAlgos(prev => {
      const next = new Set(prev);
      if (next.has(id) && next.size > 1) next.delete(id);
      else next.add(id);
      return next;
    });
    setHashes(prev => { const n = {...prev}; delete n[id]; return n; });
  };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setHashes({});
  };

  const clearAll = () => { setText(''); setFile(null); setHashes({}); };

  const inputBytes = inputType === 'text' ? new Blob([text]).size : file?.size ?? 0;
  const hasOutput = Object.keys(hashes).length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .hg * { box-sizing: border-box; }
        .hg { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }
        .hg-textarea {
          width:100%; min-height:140px; padding:14px 16px;
          background:transparent; border:none; resize:vertical; outline:none;
          font-family:'DM Mono',monospace; font-size:13px; line-height:1.7;
          color:var(--text,#f0f0f5);
        }
        .hg-textarea::placeholder { color:rgba(255,255,255,0.2); }
        .hg-drop {
          min-height:140px; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:10px;
          cursor:pointer; padding:24px; transition:all 0.2s;
        }
        .hg-drop:hover { background:rgba(37,99,235,0.04); }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .hg-fadein { animation:fadeIn 0.2s ease both; }
      `}</style>

      <div className="hg">
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 320px' : '1fr', gap: 16, alignItems: 'start' }}>

          {/* ═══ LEFT ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Input panel */}
            <Panel title={inputType === 'text' ? 'Input Text' : 'Input File'} icon={inputType === 'text' ? FileText : Upload}
              rightSlot={
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {/* Text / File toggle */}
                  <div style={{ display: 'flex', background: 'var(--surface,#111118)', border: '1px solid var(--border)', borderRadius: 8, padding: 2, gap: 1 }}>
                    {[{ id: 'text', label: 'Text' }, { id: 'file', label: 'File' }].map(t => (
                      <button key={t.id} onClick={() => { setInputType(t.id); clearAll(); }} style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none',
                        background: inputType === t.id ? 'var(--accent-blue,#2563eb)' : 'transparent',
                        color: inputType === t.id ? '#fff' : 'var(--text-muted)',
                        fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.13s',
                      }}>{t.label}</button>
                    ))}
                  </div>
                  {(text || file) && <button onClick={clearAll} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }}><Trash2 size={12} /></button>}
                </div>
              }
            >
              {inputType === 'text' ? (
                <textarea className="hg-textarea" value={text} onChange={e => setText(e.target.value)}
                  placeholder="Type or paste text to hash…&#10;Updates live as you type." spellCheck={false}
                />
              ) : (
                <div className="hg-drop"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue,#2563eb)' }}>
                    <Upload size={20} />
                  </div>
                  {file ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>✓ {file.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{file.type || 'unknown type'} · {formatBytes(file.size)}</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Drop any file or click to browse</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Hash any file locally — nothing is uploaded</div>
                    </div>
                  )}
                </div>
              )}

              {/* Input stats */}
              {(text || file) && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '7px 12px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                  <Stat label="bytes" value={formatBytes(inputBytes)} />
                  {inputType === 'text' && <Stat label="chars" value={text.length.toLocaleString()} />}
                  {inputType === 'text' && <Stat label="words" value={text.trim() ? text.trim().split(/\s+/).length : 0} />}
                </div>
              )}
            </Panel>

            {/* Hash results */}
            {ALGOS.filter(a => activeAlgos.has(a.id)).map((algo, i) => (
              (hashes[algo.id] || loading[algo.id]) && (
                <div key={algo.id} className="hg-fadein" style={{ animationDelay: `${i * 40}ms` }}>
                  <HashRow
                    algo={algo}
                    hash={hashes[algo.id] || null}
                    isLoading={!!loading[algo.id]}
                    format={format}
                    upperCase={upperCase}
                  />
                </div>
              )
            ))}

            {/* Verify panel — shown after hashes generated */}
            {hasOutput && (
              <div className="hg-fadein">
                <VerifyPanel hashes={hashes} />
              </div>
            )}
          </div>

          {/* ═══ RIGHT SIDEBAR ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Algorithms */}
            <Panel title="Algorithms">
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ALGOS.map(algo => {
                  const on = activeAlgos.has(algo.id);
                  return (
                    <button key={algo.id} onClick={() => toggleAlgo(algo.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${on ? algo.color + '55' : 'var(--border)'}`,
                      background: on ? algo.color + '12' : 'var(--surface,#111118)',
                      transition: 'all 0.15s', textAlign: 'left',
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: on ? algo.color : 'var(--border)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: on ? algo.color : 'var(--text-muted)', fontFamily: '"DM Mono",monospace' }}>{algo.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{algo.bits}-bit{algo.warn ? ' · ⚠ deprecated' : ''}</div>
                      </div>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: on ? algo.color : 'transparent', border: `2px solid ${on ? algo.color : 'var(--border)'}`, flexShrink: 0, transition: 'all 0.15s' }} />
                    </button>
                  );
                })}
              </div>
            </Panel>

            {/* Output format */}
            <Panel title="Output Format">
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { id: 'plain',  label: 'Plain hex',        example: 'a3b4c5d6…' },
                  { id: 'groups', label: '8-char groups',     example: 'a3b4c5d6 e7f8a1b2…' },
                  { id: 'colon',  label: 'Colon-separated',  example: 'a3:b4:c5:d6…' },
                ].map(f => (
                  <button key={f.id} onClick={() => setFormat(f.id)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '8px 11px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${format === f.id ? 'var(--accent-blue,#2563eb)' : 'var(--border)'}`,
                    background: format === f.id ? 'rgba(37,99,235,0.1)' : 'var(--surface,#111118)',
                    transition: 'all 0.15s', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: format === f.id ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)' }}>{f.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.5, fontFamily: '"DM Mono",monospace', marginTop: 2 }}>{f.example}</span>
                  </button>
                ))}

                {/* Case toggle */}
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Uppercase output</span>
                  <div onClick={() => setUpperCase(u => !u)} style={{
                    width: 36, height: 20, borderRadius: 99,
                    background: upperCase ? 'var(--accent-blue,#2563eb)' : 'var(--surface,#111118)',
                    border: `1px solid ${upperCase ? 'var(--accent-blue,#2563eb)' : 'var(--border)'}`,
                    position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                  }}>
                    <div style={{ position: 'absolute', top: 2, left: upperCase ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  </div>
                </div>
              </div>
            </Panel>

            {/* Mobile: show verify here too if no desktop */}
            {!isDesktop && hasOutput && (
              <VerifyPanel hashes={hashes} />
            )}

          </div>
        </div>
      </div>
    </>
  );
}