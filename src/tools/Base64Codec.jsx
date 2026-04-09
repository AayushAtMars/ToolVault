import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Copy, Check, Download, Upload, Trash2, ArrowLeftRight,
  AlertCircle, CheckCircle2, FileText, Image, Lock,
  Eye, EyeOff, RefreshCw
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

/* ─── Encode / Decode helpers ────────────────────────────── */
function encodeText(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function decodeText(b64) {
  return decodeURIComponent(escape(atob(b64)));
}
function isValidBase64(str) {
  try { atob(str.replace(/\s/g, '')); return true; } catch { return false; }
}
function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(2)} MB`;
}
function chunkString(str, size) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) chunks.push(str.slice(i, i + size));
  return chunks.join('\n');
}

/* ─── Panel wrapper ──────────────────────────────────────── */
function Panel({ title, icon: Icon, rightSlot, children }) {
  return (
    <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.15)', flexShrink:0 }}>
        <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
          {Icon && <Icon size={11}/>}{title}
        </span>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

/* ─── Copy button ────────────────────────────────────────── */
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

/* ─── Stat pill ──────────────────────────────────────────── */
function Stat({ label, value }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:7, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize:12, fontWeight:800, fontFamily:'"DM Mono",monospace', color:'var(--text,#f0f0f5)' }}>{value}</span>
      <span style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 }}>{label}</span>
    </div>
  );
}

/* ─── Icon button ────────────────────────────────────────── */
function IconBtn({ icon: Icon, title, onClick, active }) {
  return (
    <button title={title} onClick={onClick} style={{
      width:30, height:30, borderRadius:8, border:'1px solid var(--border)',
      background: active ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.04)',
      color: active ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
      display:'flex', alignItems:'center', justifyContent:'center',
      cursor:'pointer', transition:'all 0.13s', fontFamily:'inherit',
    }}>
      <Icon size={13}/>
    </button>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function Base64Codec() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [input, setInput]         = useState('');
  const [mode, setMode]           = useState('encode'); // 'encode' | 'decode'
  const [inputType, setInputType] = useState('text');   // 'text' | 'file'
  const [lineWrap, setLineWrap]   = useState(false);
  const [urlSafe, setUrlSafe]     = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fileInfo, setFileInfo]   = useState(null);
  const [error, setError]         = useState('');
  const fileRef = useRef(null);

  /* ── Live processing ── */
  const { output, isValid } = useCallback(() => {
    if (!input.trim()) return { output: '', isValid: null };
    try {
      let result;
      if (mode === 'encode') {
        result = encodeText(input);
        if (urlSafe) result = result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        if (lineWrap) result = chunkString(result, 76);
      } else {
        const clean = input.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
        result = decodeText(clean);
      }
      return { output: result, isValid: true };
    } catch {
      return { output: '', isValid: false };
    }
  }, [input, mode, lineWrap, urlSafe])();

  /* ── Swap: put output back as input and flip mode ── */
  const swap = () => {
    if (!output) return;
    setInput(output);
    setMode(m => m === 'encode' ? 'decode' : 'encode');
  };

  /* ── File upload ── */
  const handleFile = (file) => {
    if (!file) return;
    setFileInfo({ name: file.name, size: file.size, type: file.type });
    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target.result.split(',')[1];
      setInput(`data:${file.type};base64,${b64}`);
      setMode('decode');
    };
    reader.readAsDataURL(file);
  };

  /* ── Download decoded as file ── */
  const downloadDecoded = () => {
    if (!output || mode !== 'decode') return;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'decoded.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadEncoded = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'encoded.b64'; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Is output an image data URI ── */
  const isImageDataUri = output && output.startsWith('data:image/');
  const isDataUri = input.startsWith('data:') && mode === 'decode';

  /* ── Stats ── */
  const inputBytes  = new Blob([input]).size;
  const outputBytes = output ? new Blob([output]).size : 0;
  const ratio = outputBytes && inputBytes ? ((outputBytes / inputBytes) * 100).toFixed(0) : null;

  const clearAll = () => { setInput(''); setFileInfo(null); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .b64 * { box-sizing: border-box; }
        .b64 { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }

        .b64-textarea {
          width:100%; min-height:260px; padding:16px 18px;
          background:transparent; border:none; resize:vertical; outline:none;
          font-family:'DM Mono',monospace; font-size:13px; line-height:1.7;
          color:var(--text,#f0f0f5); word-break:break-all;
        }
        .b64-textarea::placeholder { color:rgba(255,255,255,0.2); }

        .b64-output {
          padding:16px 18px; min-height:260px; overflow:auto;
          font-family:'DM Mono',monospace; font-size:13px; line-height:1.7;
          color:var(--text,#f0f0f5); word-break:break-all; white-space:pre-wrap;
        }

        .b64-mode-btn {
          flex:1; padding:'9px 0'; border-radius:8px; border:none;
          font-family:inherit; font-size:13px; font-weight:700;
          cursor:pointer; transition:all 0.15s;
          display:flex; align-items:center; justify-content:center; gap:6px;
        }

        .b64-drop {
          min-height:180px; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:10px;
          cursor:pointer; transition:all 0.2s;
          padding:32px 20px;
        }
        .b64-drop:hover { background:rgba(37,99,235,0.04); }

        .b64-tag-pill {
          display:inline-flex; align-items:center; gap:4px;
          padding:3px 8px; border-radius:99px; font-size:10px; font-weight:700;
          text-transform:uppercase; letter-spacing:0.07em;
        }

        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
        .b64-fadein { animation:fadeIn 0.2s ease both; }
      `}</style>

      <div className="b64">

        {/* ── Mode + options bar ── */}
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>

          {/* Encode / Decode toggle */}
          <div style={{ display:'flex', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:10, padding:3, gap:2 }}>
            {['encode','decode'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding:'7px 20px', borderRadius:8, border:'none',
                background: mode===m ? 'var(--accent-blue,#2563eb)' : 'transparent',
                color: mode===m ? '#fff' : 'var(--text-muted)',
                fontFamily:'inherit', fontSize:13, fontWeight:700,
                cursor:'pointer', transition:'all 0.15s', textTransform:'capitalize',
              }}>
                {m === 'encode' ? '→ Encode' : '← Decode'}
              </button>
            ))}
          </div>

          {/* Input type */}
          <div style={{ display:'flex', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:10, padding:3, gap:2 }}>
            {[
              { id:'text', icon:FileText, label:'Text' },
              { id:'file', icon:Upload,   label:'File' },
            ].map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => { setInputType(id); clearAll(); }} style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'6px 12px', borderRadius:8, border:'none',
                background: inputType===id ? 'rgba(37,99,235,0.15)' : 'transparent',
                color: inputType===id ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
                fontFamily:'inherit', fontSize:12, fontWeight:700,
                cursor:'pointer', transition:'all 0.15s',
              }}>
                <Icon size={12}/>{label}
              </button>
            ))}
          </div>

          <div style={{ flex:1 }}/>

          {/* URL-safe toggle */}
          {mode === 'encode' && (
            <button onClick={() => setUrlSafe(s => !s)} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'6px 12px', borderRadius:8,
              background: urlSafe ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.04)',
              border:`1px solid ${urlSafe ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
              color: urlSafe ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
              fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
            }}>
              <Lock size={11}/> URL-safe
            </button>
          )}

          {/* Line wrap toggle */}
          {mode === 'encode' && (
            <button onClick={() => setLineWrap(s => !s)} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'6px 12px', borderRadius:8,
              background: lineWrap ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.04)',
              border:`1px solid ${lineWrap ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
              color: lineWrap ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
              fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
            }}>
              76-char wrap
            </button>
          )}
        </div>

        {/* ── Two panels ── */}
        <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr auto 1fr' : '1fr', gap: isDesktop ? 0 : 12, alignItems:'start' }}>

          {/* INPUT */}
          <Panel
            title={mode === 'encode' ? 'Plain Text' : 'Base64 String'}
            icon={mode === 'encode' ? FileText : Lock}
            rightSlot={
              <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                {input && <IconBtn icon={Trash2} title="Clear" onClick={clearAll}/>}
              </div>
            }
          >
            {inputType === 'text' ? (
              <textarea
                className="b64-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={mode === 'encode'
                  ? 'Type or paste text to encode…'
                  : 'Paste Base64 string to decode…'
                }
                spellCheck={false}
              />
            ) : (
              <div
                className="b64-drop"
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])}/>
                <div style={{ width:48, height:48, borderRadius:12, background:'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-blue,#2563eb)' }}>
                  <Upload size={22}/>
                </div>
                {fileInfo ? (
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#10b981', marginBottom:3 }}>✓ {fileInfo.name}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{fileInfo.type} · {formatBytes(fileInfo.size)}</div>
                  </div>
                ) : (
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text,#f0f0f5)', marginBottom:3 }}>Drop a file or click to browse</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Any file type supported</div>
                  </div>
                )}
              </div>
            )}

            {/* Input stats */}
            {input && (
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', padding:'8px 12px', borderTop:'1px solid var(--border)', background:'rgba(0,0,0,0.1)' }}>
                <Stat label="bytes" value={formatBytes(inputBytes)}/>
                <Stat label="chars" value={input.replace(/\s/g,'').length.toLocaleString()}/>
                {mode === 'decode' && (
                  <span className="b64-tag-pill" style={{
                    background: isValidBase64(input) ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    color: isValidBase64(input) ? '#10b981' : '#f87171',
                    border: `1px solid ${isValidBase64(input) ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  }}>
                    {isValidBase64(input) ? <CheckCircle2 size={9}/> : <AlertCircle size={9}/>}
                    {isValidBase64(input) ? 'Valid Base64' : 'Invalid Base64'}
                  </span>
                )}
              </div>
            )}
          </Panel>

          {/* SWAP button — centre column on desktop */}
          {isDesktop ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'0 12px', paddingTop: 52 }}>
              <button onClick={swap} title="Swap input ↔ output" disabled={!output} style={{
                width:36, height:36, borderRadius:10,
                background: output ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.04)',
                border:`1px solid ${output ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
                color: output ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor: output ? 'pointer' : 'default', transition:'all 0.15s',
                opacity: output ? 1 : 0.4,
              }}>
                <ArrowLeftRight size={15}/>
              </button>
            </div>
          ) : (
            output && (
              <div style={{ display:'flex', justifyContent:'center' }}>
                <button onClick={swap} style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'7px 16px', borderRadius:9,
                  background:'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.25)',
                  color:'var(--accent-blue,#2563eb)', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer',
                }}>
                  <ArrowLeftRight size={13}/> Swap ↔ Flip mode
                </button>
              </div>
            )
          )}

          {/* OUTPUT */}
          <Panel
            title={mode === 'encode' ? 'Base64 Output' : 'Decoded Text'}
            icon={mode === 'encode' ? Lock : FileText}
            rightSlot={
              output && (
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  {(isImageDataUri || mode === 'decode') && (
                    <IconBtn
                      icon={showPreview ? EyeOff : Eye}
                      title={showPreview ? 'Hide preview' : 'Show preview'}
                      onClick={() => setShowPreview(s => !s)}
                      active={showPreview}
                    />
                  )}
                </div>
              )
            }
          >
            {/* Image preview */}
            {showPreview && isImageDataUri && (
              <div className="b64-fadein" style={{ padding:16, borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.1)', display:'flex', justifyContent:'center' }}>
                <img src={output} alt="Preview" style={{ maxWidth:'100%', maxHeight:200, borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}/>
              </div>
            )}

            <div className="b64-output">
              {!input ? (
                <span style={{ color:'rgba(255,255,255,0.2)' }}>Output will appear here…</span>
              ) : !output ? (
                <div style={{ display:'flex', alignItems:'center', gap:8, color:'#fca5a5' }}>
                  <AlertCircle size={14}/>
                  <span style={{ fontSize:13, fontFamily:'"DM Mono",monospace' }}>
                    {mode === 'decode' ? 'Invalid Base64 — cannot decode' : 'Encoding error'}
                  </span>
                </div>
              ) : (
                <span className="b64-fadein">{output}</span>
              )}
            </div>

            {/* Output stats + actions */}
            {output && (
              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderTop:'1px solid var(--border)', background:'rgba(0,0,0,0.1)', flexWrap:'wrap' }}>
                <Stat label="bytes"  value={formatBytes(outputBytes)}/>
                {ratio && <Stat label="ratio" value={`${ratio}%`}/>}
                <div style={{ flex:1 }}/>
                <CopyBtn getText={() => output} label="Copy" small/>
                <IconBtn icon={Download} title="Download output" onClick={mode === 'encode' ? downloadEncoded : downloadDecoded}/>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}