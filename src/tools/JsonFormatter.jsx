import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy, Check, Download, Trash2, AlertCircle, CheckCircle2,
  Maximize2, Minimize2, ChevronRight, ChevronDown,
  Search, ArrowUpDown, FileJson, Braces, Eye, EyeOff
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

/* ─── JSON syntax highlighter ────────────────────────────── */
function highlight(json) {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-num';
        if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-str';
        else if (/true|false/.test(match)) cls = 'json-bool';
        else if (/null/.test(match)) cls = 'json-null';
        return `<span class="${cls}">${match}</span>`;
      }
    );
}

/* ─── Get JSON stats ─────────────────────────────────────── */
function getStats(parsed) {
  let keys = 0, depth = 0, arrays = 0, objects = 0;
  function walk(val, d = 0) {
    if (d > depth) depth = d;
    if (Array.isArray(val)) { arrays++; val.forEach(v => walk(v, d + 1)); }
    else if (val && typeof val === 'object') {
      objects++;
      Object.entries(val).forEach(([, v]) => { keys++; walk(v, d + 1); });
    }
  }
  walk(parsed);
  return { keys, depth, arrays, objects };
}

/* ─── Collapsible tree node ──────────────────────────────── */
function TreeNode({ keyName, value, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const isObj = value !== null && typeof value === 'object';
  const isArr = Array.isArray(value);
  const indent = depth * 16;

  const typeColor = {
    string:  '#86efac',
    number:  '#93c5fd',
    boolean: '#fcd34d',
    null:    '#f87171',
  };

  if (!isObj) {
    const t = value === null ? 'null' : typeof value;
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '2px 0', paddingLeft: indent }}>
        {keyName !== undefined && (
          <span style={{ color: '#c4b5fd', fontSize: 12, fontFamily: '"DM Mono",monospace', flexShrink: 0 }}>
            "{keyName}"<span style={{ color: 'rgba(255,255,255,0.3)' }}>:</span>
          </span>
        )}
        <span style={{ color: typeColor[t] || '#f0f0f5', fontSize: 12, fontFamily: '"DM Mono",monospace', wordBreak: 'break-all' }}>
          {t === 'string' ? `"${value}"` : String(value)}
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>{t}</span>
      </div>
    );
  }

  const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
  const bracket = isArr ? ['[', ']'] : ['{', '}'];
  const count = entries.length;

  return (
    <div style={{ paddingLeft: indent }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          cursor: 'pointer', padding: '2px 0', userSelect: 'none',
        }}
      >
        <span style={{ color: 'var(--text-muted)', width: 14, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {open ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
        </span>
        {keyName !== undefined && (
          <span style={{ color: '#c4b5fd', fontSize: 12, fontFamily: '"DM Mono",monospace', flexShrink: 0 }}>
            "{keyName}"<span style={{ color: 'rgba(255,255,255,0.3)' }}>: </span>
          </span>
        )}
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: '"DM Mono",monospace' }}>
          {bracket[0]}
        </span>
        {!open && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: '"DM Mono",monospace' }}>
            {count} {isArr ? 'item' : 'key'}{count !== 1 ? 's' : ''} …{bracket[1]}
          </span>
        )}
      </div>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <TreeNode key={k} keyName={isArr ? undefined : k} value={v} depth={depth + 1}/>
          ))}
          <div style={{ paddingLeft: 14, fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: '"DM Mono",monospace' }}>
            {bracket[1]}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Panel wrapper ──────────────────────────────────────── */
function Panel({ title, icon: Icon, rightSlot, children, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface-raised,#18181f)',
      border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', ...style,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.15)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
        display:'flex',alignItems:'center',gap:5,
        padding: small ? '5px 10px' : '7px 13px',
        borderRadius:8,
        background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
        border:`1px solid ${ok?'rgba(16,185,129,0.3)':'var(--border)'}`,
        color: ok ? '#10b981' : 'var(--text-muted)',
        fontFamily:'inherit',fontSize:12,fontWeight:700,
        cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap',
      }}>
      {ok ? <Check size={11}/> : <Copy size={11}/>}
      {ok ? 'Copied!' : label}
    </button>
  );
}

/* ─── Sample JSON ────────────────────────────────────────── */
const SAMPLE = `{
  "name": "AayuTools",
  "version": "2.0.0",
  "features": ["format", "minify", "validate", "tree view"],
  "config": {
    "indent": 2,
    "theme": "dark",
    "autoFormat": true
  },
  "stats": {
    "users": 12400,
    "rating": 4.9,
    "active": true,
    "deprecated": null
  }
}`;

/* ══ Main Component ══════════════════════════════════════════ */
export default function JsonFormatter() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [input, setInput]       = useState('');
  const [parsed, setParsed]     = useState(null);
  const [error, setError]       = useState('');
  const [indent, setIndent]     = useState(2);
  const [outputMode, setOutputMode] = useState('highlight'); // 'highlight' | 'tree' | 'raw'
  const [sortKeys, setSortKeys] = useState(false);
  const [searchQ, setSearchQ]   = useState('');
  const [inputStats, setInputStats] = useState(null);

  /* ── process input on change ── */
  const process = useCallback((raw) => {
    if (!raw.trim()) { setParsed(null); setError(''); setInputStats(null); return; }
    try {
      const p = JSON.parse(raw);
      setParsed(p);
      setError('');
      setInputStats(getStats(p));
    } catch (e) {
      setParsed(null);
      setInputStats(null);
      // Extract line/col hint from error
      const msg = e.message.replace('JSON.parse: ', '').replace('JSON Parse error: ', '');
      setError(msg);
    }
  }, []);

  useEffect(() => { process(input); }, [input, process]);

  /* ── sort object keys recursively ── */
  function sortObj(val) {
    if (Array.isArray(val)) return val.map(sortObj);
    if (val && typeof val === 'object') {
      return Object.fromEntries(Object.keys(val).sort().map(k => [k, sortObj(val[k])]));
    }
    return val;
  }

  const outputParsed = parsed ? (sortKeys ? sortObj(parsed) : parsed) : null;
  const formatted    = outputParsed ? JSON.stringify(outputParsed, null, indent) : '';
  const minified     = outputParsed ? JSON.stringify(outputParsed) : '';

  /* ── search filter ── */
  const filteredFormatted = searchQ && formatted
    ? formatted.split('\n').map((line, i) => ({
        line, i,
        match: line.toLowerCase().includes(searchQ.toLowerCase()),
      }))
    : null;

  const download = (content, name) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const loadSample = () => setInput(SAMPLE);
  const clear = () => { setInput(''); setSearchQ(''); };

  const isValid = parsed !== null;
  const hasInput = input.trim().length > 0;

  /* ── Stat pill ── */
  const S = ({ l, v }) => (
    <div style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:7,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize:12,fontWeight:800,fontFamily:'"DM Mono",monospace',color:'var(--text,#f0f0f5)' }}>{v}</span>
      <span style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:600 }}>{l}</span>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .jf * { box-sizing: border-box; }
        .jf { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }

        .jf-textarea {
          width:100%; min-height:340px; padding:16px 18px;
          background:transparent; border:none; resize:vertical; outline:none;
          font-family:'DM Mono',monospace; font-size:13px; line-height:1.7;
          color:var(--text,#f0f0f5); tab-size:2;
        }
        .jf-textarea::placeholder { color:rgba(255,255,255,0.2); }

        .jf-output {
          padding:16px 18px; overflow:auto; min-height:340px;
          font-family:'DM Mono',monospace; font-size:13px; line-height:1.7;
          white-space:pre; cursor:text; word-break:break-word;
        }

        .json-key  { color:#c4b5fd; }
        .json-str  { color:#86efac; }
        .json-num  { color:#93c5fd; }
        .json-bool { color:#fcd34d; }
        .json-null { color:#f87171; }

        .jf-line-match    { background:rgba(250,204,21,0.12); border-radius:3px; }
        .jf-line-no-match { opacity:0.25; }

        .jf-mode-btn {
          display:flex;align-items:center;gap:5px;
          padding:5px 11px;border-radius:7px;border:none;
          background:transparent;color:var(--text-muted);
          font-family:inherit;font-size:11px;font-weight:700;
          cursor:pointer;transition:all 0.12s;
        }
        .jf-mode-btn.active { background:rgba(37,99,235,0.15); color:var(--accent-blue,#2563eb); }
        .jf-mode-btn:hover:not(.active) { background:rgba(255,255,255,0.06); color:var(--text,#f0f0f5); }

        .jf-icon-btn {
          width:30px;height:30px;border-radius:8px;border:none;
          background:rgba(255,255,255,0.04);border:1px solid var(--border);
          color:var(--text-muted);cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          transition:all 0.12s;font-family:inherit;
        }
        .jf-icon-btn:hover { background:rgba(255,255,255,0.09);color:var(--text,#f0f0f5); }
        .jf-icon-btn.active { background:rgba(37,99,235,0.15);border-color:rgba(37,99,235,0.35);color:var(--accent-blue,#2563eb); }

        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)} }
        .jf-fadein { animation:fadeSlideIn 0.2s ease both; }

        .jf-search {
          background:var(--surface,#111118);border:1px solid var(--border);
          border-radius:8px;padding:6px 10px;
          font-family:inherit;font-size:12px;color:var(--text,#f0f0f5);
          outline:none;width:160px;transition:border-color 0.15s;
        }
        .jf-search:focus { border-color:rgba(37,99,235,0.5); }
        .jf-search::placeholder { color:rgba(255,255,255,0.2); }
      `}</style>

      <div className="jf">
        <div style={{
          display:'grid',
          gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
          gap:16,
          alignItems:'start',
        }}>

          {/* ═══ INPUT ═══ */}
          <Panel
            title="Input"
            icon={FileJson}
            rightSlot={
              <div style={{ display:'flex',gap:5,alignItems:'center' }}>
                {hasInput && (
                  <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                    {isValid
                      ? <span style={{ display:'flex',alignItems:'center',gap:4,fontSize:10,fontWeight:700,color:'#10b981' }}><CheckCircle2 size={11}/>Valid</span>
                      : <span style={{ display:'flex',alignItems:'center',gap:4,fontSize:10,fontWeight:700,color:'#f87171' }}><AlertCircle size={11}/>Error</span>
                    }
                  </div>
                )}
                <button onClick={loadSample} style={{ fontSize:10,fontWeight:700,color:'var(--accent-blue,#2563eb)',background:'rgba(37,99,235,0.1)',border:'1px solid rgba(37,99,235,0.2)',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s' }}>
                  Sample
                </button>
                {hasInput && <button onClick={clear} className="jf-icon-btn" title="Clear"><Trash2 size={12}/></button>}
              </div>
            }
          >
            <textarea
              className="jf-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={'Paste JSON here…\n\n{"key": "value"}'}
              spellCheck={false}
            />

            {/* Input stats */}
            {inputStats && (
              <div style={{ display:'flex',gap:5,flexWrap:'wrap',padding:'8px 14px',borderTop:'1px solid var(--border)',background:'rgba(0,0,0,0.1)' }}>
                <S l="keys"    v={inputStats.keys}/>
                <S l="objects" v={inputStats.objects}/>
                <S l="arrays"  v={inputStats.arrays}/>
                <S l="depth"   v={inputStats.depth}/>
                <S l="chars"   v={input.length.toLocaleString()}/>
              </div>
            )}

            {/* Error message */}
            {error && hasInput && (
              <div style={{ display:'flex',alignItems:'flex-start',gap:8,padding:'10px 14px',background:'rgba(239,68,68,0.08)',borderTop:'1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={14} style={{ color:'#f87171',flexShrink:0,marginTop:1 }}/>
                <span style={{ fontSize:12,color:'#fca5a5',fontFamily:'"DM Mono",monospace',lineHeight:1.5 }}>{error}</span>
              </div>
            )}
          </Panel>

          {/* ═══ OUTPUT ═══ */}
          <Panel
            title="Output"
            icon={Braces}
            rightSlot={
              <div style={{ display:'flex',gap:4,alignItems:'center',flexWrap:'wrap' }}>
                {/* Mode buttons */}
                <div style={{ display:'flex',background:'var(--surface,#111118)',border:'1px solid var(--border)',borderRadius:8,padding:2,gap:1 }}>
                  {[
                    { id:'highlight', icon:Eye,         label:'Code'  },
                    { id:'tree',      icon:ChevronRight, label:'Tree'  },
                    { id:'raw',       icon:FileJson,     label:'Raw'   },
                  ].map(({ id, icon: Icon, label }) => (
                    <button key={id} className={`jf-mode-btn${outputMode===id?' active':''}`} onClick={() => setOutputMode(id)}>
                      <Icon size={11}/>{!isDesktop ? '' : label}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            {/* Output toolbar */}
            <div style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 10px',borderBottom:'1px solid var(--border)',background:'rgba(0,0,0,0.1)',flexWrap:'wrap' }}>
              {/* Indent */}
              <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                <span style={{ fontSize:10,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em' }}>Indent</span>
                <div style={{ display:'flex',background:'var(--surface,#111118)',border:'1px solid var(--border)',borderRadius:7,padding:2,gap:1 }}>
                  {[2,4,8].map(n => (
                    <button key={n} onClick={() => setIndent(n)} style={{
                      padding:'3px 8px',borderRadius:5,border:'none',
                      background:indent===n?'var(--accent-blue,#2563eb)':'transparent',
                      color:indent===n?'#fff':'var(--text-muted)',
                      fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s',
                    }}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Sort keys */}
              <button className={`jf-icon-btn${sortKeys?' active':''}`} title="Sort keys A-Z" onClick={() => setSortKeys(s => !s)}>
                <ArrowUpDown size={12}/>
              </button>

              <div style={{ flex:1 }}/>

              {/* Search in output */}
              {outputMode !== 'tree' && (
                <div style={{ position:'relative',display:'flex',alignItems:'center' }}>
                  <Search size={11} style={{ position:'absolute',left:8,color:'var(--text-muted)',pointerEvents:'none' }}/>
                  <input className="jf-search" placeholder="Search…" value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ paddingLeft:26 }}/>
                </div>
              )}
            </div>

            {/* Output content */}
            <div className="jf-output">
              {!hasInput && (
                <span style={{ color:'rgba(255,255,255,0.2)' }}>Formatted output will appear here…</span>
              )}
              {hasInput && !isValid && (
                <span style={{ color:'rgba(255,255,255,0.2)' }}>Fix the error in your input to see output.</span>
              )}
              {isValid && outputMode === 'highlight' && (
                <div className="jf-fadein" dangerouslySetInnerHTML={{ __html:
                  filteredFormatted
                    ? filteredFormatted.map(({ line, match }) =>
                        `<div class="${match ? 'jf-line-match' : 'jf-line-no-match'}">${highlight(line)}</div>`
                      ).join('')
                    : highlight(formatted)
                }}/>
              )}
              {isValid && outputMode === 'raw' && (
                <span className="jf-fadein" style={{ color:'var(--text,#f0f0f5)' }}>
                  {filteredFormatted
                    ? filteredFormatted.map(({ line, i, match }) => (
                        <div key={i} style={{ opacity: match ? 1 : 0.2, background: match ? 'rgba(250,204,21,0.1)' : 'transparent' }}>{line}</div>
                      ))
                    : formatted
                  }
                </span>
              )}
              {isValid && outputMode === 'tree' && (
                <div className="jf-fadein" style={{ padding:'0 4px' }}>
                  <TreeNode value={outputParsed} depth={0}/>
                </div>
              )}
            </div>

            {/* Output stats + actions */}
            {isValid && (
              <div style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderTop:'1px solid var(--border)',background:'rgba(0,0,0,0.1)',flexWrap:'wrap' }}>
                <S l="formatted" v={`${(formatted.length/1024).toFixed(1)}kb`}/>
                <S l="minified"  v={`${(minified.length/1024).toFixed(1)}kb`}/>
                <S l="saved"     v={`${Math.round((1-minified.length/formatted.length)*100)}%`}/>
                <div style={{ flex:1 }}/>
                <CopyBtn label="Formatted" getText={() => formatted} small/>
                <CopyBtn label="Minified"  getText={() => minified}  small/>
                <button onClick={() => download(formatted,'formatted.json')} className="jf-icon-btn" title="Download formatted JSON">
                  <Download size={12}/>
                </button>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}