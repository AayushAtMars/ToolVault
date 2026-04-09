import { useState, useEffect, useCallback } from 'react';
import {
  Copy, Check, ArrowLeftRight, Trash2, AlertCircle,
  CheckCircle2, Link, Unlink, ChevronDown, ChevronRight,
  Plus, X, Download
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

/* ─── Encoding modes ─────────────────────────────────────── */
const ENCODE_MODES = [
  {
    id: 'component',
    label: 'encodeURIComponent',
    short: 'Component',
    desc: 'Encodes all chars except: A–Z a–z 0–9 - _ . ! ~ * \' ( )',
    encode: (s) => encodeURIComponent(s),
    decode: (s) => decodeURIComponent(s),
  },
  {
    id: 'uri',
    label: 'encodeURI',
    short: 'Full URI',
    desc: 'Encodes all chars except URI-legal chars (keeps : / ? # etc.)',
    encode: (s) => encodeURI(s),
    decode: (s) => decodeURI(s),
  },
  {
    id: 'form',
    label: 'Form Data',
    short: 'Form',
    desc: 'Like component but encodes spaces as + (application/x-www-form-urlencoded)',
    encode: (s) => encodeURIComponent(s).replace(/%20/g, '+'),
    decode: (s) => decodeURIComponent(s.replace(/\+/g, ' ')),
  },
];

/* ─── URL parser ─────────────────────────────────────────── */
function parseUrl(raw) {
  try {
    const url = new URL(raw);
    const params = [];
    url.searchParams.forEach((v, k) => params.push({ k, v }));
    return {
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname,
      hash: url.hash,
      params,
      valid: true,
    };
  } catch {
    return { valid: false };
  }
}

function buildUrl(base, params) {
  try {
    const url = new URL(base);
    url.search = '';
    params.forEach(({ k, v }) => { if (k) url.searchParams.append(k, v); });
    return url.toString();
  } catch {
    return base;
  }
}

/* ─── Helpers ────────────────────────────────────────────── */
function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function highlightEncoded(str) {
  // Highlight %XX sequences
  return str.replace(/(%[0-9A-Fa-f]{2})+/g, m =>
    `<span style="color:#93c5fd;font-weight:600">${m}</span>`
  );
}

/* ─── Reusable UI ────────────────────────────────────────── */
function Panel({ title, icon: Icon, rightSlot, children }) {
  return (
    <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.15)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
          {Icon && <Icon size={11}/>}{title}
        </span>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

function CopyBtn({ getText, label = 'Copy', small }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(getText()).catch(()=>{}); setOk(true); setTimeout(()=>setOk(false),1500); }}
      style={{
        display:'flex', alignItems:'center', gap:5,
        padding: small ? '5px 10px' : '7px 13px', borderRadius:8,
        background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
        border:`1px solid ${ok?'rgba(16,185,129,0.3)':'var(--border)'}`,
        color: ok ? '#10b981' : 'var(--text-muted)',
        fontFamily:'inherit', fontSize:12, fontWeight:700,
        cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap',
      }}>
      {ok ? <Check size={11}/> : <Copy size={11}/>}
      {ok ? 'Copied!' : label}
    </button>
  );
}

function IconBtn({ icon: Icon, title, onClick, active, danger }) {
  return (
    <button title={title} onClick={onClick} style={{
      width:30, height:30, borderRadius:8, border:'1px solid var(--border)',
      background: active ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.04)',
      color: danger ? 'rgba(239,68,68,0.6)' : active ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
      display:'flex', alignItems:'center', justifyContent:'center',
      cursor:'pointer', transition:'all 0.13s', fontFamily:'inherit',
    }}>
      <Icon size={13}/>
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:7, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize:12, fontWeight:800, fontFamily:'"DM Mono",monospace', color:'var(--text,#f0f0f5)' }}>{value}</span>
      <span style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 }}>{label}</span>
    </div>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function UrlEncoder() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [input, setInput]         = useState('');
  const [mode, setMode]           = useState('encode');
  const [encMode, setEncMode]     = useState('component');
  const [activeTab, setActiveTab] = useState('encode'); // 'encode' | 'builder' | 'parser'
  const [highlight, setHighlight] = useState(true);

  // URL Builder state
  const [builderBase, setBuilderBase] = useState('https://example.com/api');
  const [builderParams, setBuilderParams] = useState([
    { k: 'q', v: 'hello world' },
    { k: 'page', v: '1' },
  ]);

  const encoder = ENCODE_MODES.find(m => m.id === encMode);

  /* ── Live output ── */
  const { output, error } = useCallback(() => {
    if (!input.trim()) return { output: '', error: '' };
    try {
      const result = mode === 'encode' ? encoder.encode(input) : encoder.decode(input);
      return { output: result, error: '' };
    } catch (e) {
      return { output: '', error: e.message };
    }
  }, [input, mode, encoder])();

  /* ── Swap ── */
  const swap = () => {
    if (!output) return;
    setInput(output);
    setMode(m => m === 'encode' ? 'decode' : 'encode');
  };

  /* ── URL parser ── */
  const parsed = parseUrl(input);

  /* ── Builder URL ── */
  const builtUrl = buildUrl(builderBase, builderParams);

  /* ── Diff: which chars got encoded ── */
  const encodedCount = output ? (output.match(/%[0-9A-Fa-f]{2}/g) || []).length : 0;

  const inputBytes  = new Blob([input]).size;
  const outputBytes = output ? new Blob([output]).size : 0;

  const TABS = [
    { id: 'encode',  label: 'Encode / Decode', icon: Link },
    { id: 'builder', label: 'URL Builder',      icon: Plus },
    { id: 'parser',  label: 'URL Parser',        icon: Unlink },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .ue * { box-sizing: border-box; }
        .ue { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }

        .ue-textarea {
          width:100%; min-height:200px; padding:16px 18px;
          background:transparent; border:none; resize:vertical; outline:none;
          font-family:'DM Mono',monospace; font-size:13px; line-height:1.7;
          color:var(--text,#f0f0f5); word-break:break-all;
        }
        .ue-textarea::placeholder { color:rgba(255,255,255,0.2); }

        .ue-output {
          padding:16px 18px; min-height:200px; overflow:auto;
          font-family:'DM Mono',monospace; font-size:13px; line-height:1.7;
          color:var(--text,#f0f0f5); word-break:break-all; white-space:pre-wrap;
        }

        .ue-tab {
          display:flex; align-items:center; gap:6px;
          padding:9px 14px; border-bottom:2px solid transparent;
          background:transparent; border-top:none; border-left:none; border-right:none;
          color:var(--text-muted); font-family:inherit; font-size:12px; font-weight:600;
          cursor:pointer; transition:all 0.15s; white-space:nowrap;
        }
        .ue-tab.active { color:var(--accent-blue,#2563eb); border-bottom-color:var(--accent-blue,#2563eb); }
        .ue-tab:hover:not(.active) { color:var(--text,#f0f0f5); }

        .ue-param-row {
          display:grid; grid-template-columns:1fr 1fr auto;
          gap:6px; align-items:center;
        }
        .ue-param-input {
          width:100%; padding:7px 10px; border-radius:8px;
          background:var(--surface,#111118); border:1px solid var(--border);
          color:var(--text,#f0f0f5); font-family:'DM Mono',monospace;
          font-size:12px; outline:none;
        }
        .ue-param-input:focus { border-color:rgba(37,99,235,0.5); }
        .ue-param-input::placeholder { color:rgba(255,255,255,0.2); }

        .ue-parsed-row {
          display:flex; gap:8px; align-items:baseline;
          padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);
        }
        .ue-parsed-row:last-child { border-bottom:none; }

        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
        .ue-fadein { animation:fadeIn 0.2s ease both; }
      `}</style>

      <div className="ue">

        {/* ── Tab bar ── */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:16, overflowX:'auto' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`ue-tab${activeTab===id?' active':''}`} onClick={() => setActiveTab(id)}>
              <Icon size={12}/>{label}
            </button>
          ))}
        </div>

        {/* ══ TAB: ENCODE / DECODE ══ */}
        {activeTab === 'encode' && (
          <div className="ue-fadein">

            {/* Controls row */}
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>

              {/* Mode toggle */}
              <div style={{ display:'flex', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:10, padding:3, gap:2 }}>
                {['encode','decode'].map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    padding:'6px 16px', borderRadius:8, border:'none',
                    background: mode===m ? 'var(--accent-blue,#2563eb)' : 'transparent',
                    color: mode===m ? '#fff' : 'var(--text-muted)',
                    fontFamily:'inherit', fontSize:12, fontWeight:700,
                    cursor:'pointer', transition:'all 0.15s', textTransform:'capitalize',
                  }}>{mode===m ? (m==='encode'?'→ Encode':'← Decode') : (m==='encode'?'Encode':'Decode')}</button>
                ))}
              </div>

              {/* Encoding mode */}
              <div style={{ display:'flex', gap:4 }}>
                {ENCODE_MODES.map(em => (
                  <button key={em.id} onClick={() => setEncMode(em.id)} title={em.desc} style={{
                    padding:'6px 11px', borderRadius:8, border:'none',
                    background: encMode===em.id ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.04)',
                    color: encMode===em.id ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
                    fontFamily:'"DM Mono",monospace', fontSize:11, fontWeight:700,
                    cursor:'pointer', transition:'all 0.15s', border:`1px solid ${encMode===em.id?'rgba(37,99,235,0.3)':'var(--border)'}`,
                  }}>{em.short}</button>
                ))}
              </div>

              <div style={{ flex:1 }}/>

              {/* Highlight toggle */}
              <button onClick={() => setHighlight(h => !h)} style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'6px 11px', borderRadius:8,
                background: highlight ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.04)',
                border:`1px solid ${highlight?'rgba(37,99,235,0.3)':'var(--border)'}`,
                color: highlight ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
                fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
              }}>
                Highlight %XX
              </button>
            </div>

            {/* Encoding mode description */}
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginBottom:12, fontFamily:'"DM Mono",monospace', padding:'6px 10px', background:'rgba(255,255,255,0.02)', borderRadius:7, border:'1px solid var(--border)' }}>
              {encoder.label} — {encoder.desc}
            </div>

            {/* Two panels */}
            <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr auto 1fr' : '1fr', gap: isDesktop ? 0 : 12, alignItems:'start' }}>

              {/* Input */}
              <Panel title="Input" icon={Link}
                rightSlot={
                  <div style={{ display:'flex', gap:5 }}>
                    {input && <IconBtn icon={Trash2} title="Clear" onClick={() => setInput('')} danger/>}
                  </div>
                }
              >
                <textarea
                  className="ue-textarea"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={mode === 'encode'
                    ? 'Type or paste text / URL to encode…\nhttps://example.com/path?q=hello world&foo=bar baz'
                    : 'Paste URL-encoded string to decode…\nhttps%3A%2F%2Fexample.com%2F%3Fq%3Dhello%20world'
                  }
                  spellCheck={false}
                />
                {input && (
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', padding:'7px 12px', borderTop:'1px solid var(--border)', background:'rgba(0,0,0,0.1)' }}>
                    <Stat label="chars" value={input.length.toLocaleString()}/>
                    <Stat label="bytes" value={formatBytes(inputBytes)}/>
                  </div>
                )}
              </Panel>

              {/* Swap button */}
              {isDesktop ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'0 12px', paddingTop:48 }}>
                  <button onClick={swap} disabled={!output} title="Swap & flip mode" style={{
                    width:36, height:36, borderRadius:10,
                    background: output ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.04)',
                    border:`1px solid ${output?'rgba(37,99,235,0.3)':'var(--border)'}`,
                    color: output ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    cursor: output ? 'pointer' : 'default', transition:'all 0.15s', opacity: output ? 1 : 0.4,
                  }}>
                    <ArrowLeftRight size={15}/>
                  </button>
                </div>
              ) : (
                output && (
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <button onClick={swap} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:9, background:'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.25)', color:'var(--accent-blue,#2563eb)', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      <ArrowLeftRight size={13}/> Swap ↔ Flip mode
                    </button>
                  </div>
                )
              )}

              {/* Output */}
              <Panel title="Output" icon={Unlink}>
                <div className="ue-output">
                  {!input ? (
                    <span style={{ color:'rgba(255,255,255,0.2)' }}>Output appears here live…</span>
                  ) : error ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8, color:'#fca5a5' }}>
                      <AlertCircle size={14}/><span style={{ fontSize:13, fontFamily:'"DM Mono",monospace' }}>{error}</span>
                    </div>
                  ) : highlight && mode === 'encode' ? (
                    <span dangerouslySetInnerHTML={{ __html: highlightEncoded(output) }}/>
                  ) : (
                    output
                  )}
                </div>

                {output && (
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderTop:'1px solid var(--border)', background:'rgba(0,0,0,0.1)', flexWrap:'wrap' }}>
                    <Stat label="chars"   value={output.length.toLocaleString()}/>
                    <Stat label="bytes"   value={formatBytes(outputBytes)}/>
                    {mode === 'encode' && <Stat label="%XX seqs" value={encodedCount}/>}
                    <div style={{ flex:1 }}/>
                    <CopyBtn getText={() => output} small/>
                  </div>
                )}
              </Panel>
            </div>
          </div>
        )}

        {/* ══ TAB: URL BUILDER ══ */}
        {activeTab === 'builder' && (
          <div className="ue-fadein" style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Base URL */}
            <Panel title="Base URL" icon={Link}>
              <div style={{ padding:'12px 14px' }}>
                <input
                  value={builderBase}
                  onChange={e => setBuilderBase(e.target.value)}
                  placeholder="https://example.com/path"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text,#f0f0f5)', fontFamily:'"DM Mono",monospace', fontSize:13, outline:'none' }}
                />
              </div>
            </Panel>

            {/* Query params */}
            <Panel title="Query Parameters" icon={Plus}
              rightSlot={
                <button onClick={() => setBuilderParams(p => [...p, { k:'', v:'' }])} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:7, background:'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.25)', color:'var(--accent-blue,#2563eb)', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  <Plus size={11}/> Add param
                </button>
              }
            >
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:7 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:6, padding:'0 0 6px', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Key</span>
                  <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Value</span>
                  <span/>
                </div>
                {builderParams.map((p, i) => (
                  <div key={i} className="ue-param-row">
                    <input
                      className="ue-param-input" placeholder="key"
                      value={p.k} onChange={e => setBuilderParams(ps => ps.map((x,j)=>j===i?{...x,k:e.target.value}:x))}
                    />
                    <input
                      className="ue-param-input" placeholder="value"
                      value={p.v} onChange={e => setBuilderParams(ps => ps.map((x,j)=>j===i?{...x,v:e.target.value}:x))}
                    />
                    <button onClick={() => setBuilderParams(ps => ps.filter((_,j)=>j!==i))}
                      style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--border)', background:'rgba(239,68,68,0.08)', color:'rgba(239,68,68,0.6)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.13s', fontFamily:'inherit' }}>
                      <X size={12}/>
                    </button>
                  </div>
                ))}
                {builderParams.length === 0 && (
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.2)', padding:'8px 0' }}>No params yet — click "Add param"</div>
                )}
              </div>
            </Panel>

            {/* Result */}
            <Panel title="Built URL" icon={CheckCircle2}
              rightSlot={<CopyBtn getText={() => builtUrl} small/>}
            >
              <div style={{ padding:'14px 16px', fontFamily:'"DM Mono",monospace', fontSize:13, lineHeight:1.7, color:'var(--text,#f0f0f5)', wordBreak:'break-all' }}>
                <span style={{ color:'#93c5fd' }}>{builderBase.split('?')[0]}</span>
                {builderParams.some(p=>p.k) && (
                  <>
                    <span style={{ color:'rgba(255,255,255,0.3)' }}>?</span>
                    {builderParams.filter(p=>p.k).map((p,i) => (
                      <span key={i}>
                        {i > 0 && <span style={{ color:'rgba(255,255,255,0.3)' }}>&amp;</span>}
                        <span style={{ color:'#c4b5fd' }}>{encodeURIComponent(p.k)}</span>
                        <span style={{ color:'rgba(255,255,255,0.3)' }}>=</span>
                        <span style={{ color:'#86efac' }}>{encodeURIComponent(p.v)}</span>
                      </span>
                    ))}
                  </>
                )}
              </div>
            </Panel>
          </div>
        )}

        {/* ══ TAB: URL PARSER ══ */}
        {activeTab === 'parser' && (
          <div className="ue-fadein" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Panel title="URL to Parse" icon={Link}>
              <textarea
                className="ue-textarea"
                style={{ minHeight:80 }}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="https://example.com/path?foo=bar&baz=hello+world#section"
                spellCheck={false}
              />
            </Panel>

            {input && (
              parsed.valid ? (
                <div className="ue-fadein" style={{ display:'flex', flexDirection:'column', gap:10 }}>

                  {/* URL parts */}
                  <Panel title="URL Components" icon={Unlink}>
                    <div style={{ padding:'10px 16px' }}>
                      {[
                        { label: 'Protocol', value: parsed.protocol, color: '#fcd34d' },
                        { label: 'Host',     value: parsed.host,     color: '#93c5fd' },
                        { label: 'Path',     value: parsed.pathname, color: '#86efac' },
                        { label: 'Hash',     value: parsed.hash || '—', color: '#c4b5fd' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="ue-parsed-row">
                          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', minWidth:64, flexShrink:0 }}>{label}</span>
                          <span style={{ fontFamily:'"DM Mono",monospace', fontSize:13, color, flex:1, wordBreak:'break-all' }}>{value}</span>
                          {value !== '—' && <CopyBtn getText={() => value} label="" small/>}
                        </div>
                      ))}
                    </div>
                  </Panel>

                  {/* Query params */}
                  {parsed.params.length > 0 && (
                    <Panel title={`Query Params — ${parsed.params.length}`} icon={Plus}>
                      <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:0 }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:6, padding:'0 0 6px', borderBottom:'1px solid var(--border)', marginBottom:6 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Key</span>
                          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Value (decoded)</span>
                          <span/>
                        </div>
                        {parsed.params.map(({ k, v }, i) => (
                          <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:6, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', alignItems:'center' }}>
                            <span style={{ fontFamily:'"DM Mono",monospace', fontSize:12, color:'#c4b5fd', wordBreak:'break-all' }}>{k}</span>
                            <span style={{ fontFamily:'"DM Mono",monospace', fontSize:12, color:'#86efac', wordBreak:'break-all' }}>{v}</span>
                            <CopyBtn getText={() => `${k}=${v}`} label="" small/>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  )}
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, color:'#fca5a5', fontSize:13 }}>
                  <AlertCircle size={14}/> Not a valid URL — try including the protocol (https://…)
                </div>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}