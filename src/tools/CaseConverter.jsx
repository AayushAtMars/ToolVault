import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Copy, Check, Type, Download, Trash2, RotateCcw,
  Search, ChevronDown, ChevronUp, Replace, History,
  ArrowRight, Star, StarOff,
} from 'lucide-react';

/* ── responsive hook ─────────────────────────────────────── */
function useWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

/* ── collapsible ─────────────────────────────────────────── */
function Collapsible({ title, icon: Icon, defaultOpen = true, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', background:'var(--surface-raised,#18181f)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:7, padding:'10px 14px', background:'transparent', border:'none', cursor:'pointer' }}>
        {Icon && <Icon size={12} style={{ color:'var(--text-muted)', flexShrink:0 }}/>}
        <span style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'left' }}>{title}</span>
        {badge && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:100, background:'rgba(37,99,235,0.12)', color:'var(--accent-blue,#2563EB)', fontWeight:700 }}>{badge}</span>}
        {open ? <ChevronUp size={13} style={{ color:'var(--text-muted)' }}/> : <ChevronDown size={13} style={{ color:'var(--text-muted)' }}/>}
      </button>
      {open && <div style={{ padding:'0 14px 14px' }}>{children}</div>}
    </div>
  );
}

/* ── all case conversions ────────────────────────────────── */
const CONVERSIONS = [
  {
    id:'upper', label:'UPPERCASE', group:'basic',
    desc:'All letters capitalized',
    color:'#2563eb',
    fn: t => t.toUpperCase(),
  },
  {
    id:'lower', label:'lowercase', group:'basic',
    desc:'All letters lowercased',
    color:'#7c3aed',
    fn: t => t.toLowerCase(),
  },
  {
    id:'title', label:'Title Case', group:'basic',
    desc:'First letter of each word capitalized',
    color:'#0891b2',
    fn: t => t.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  },
  {
    id:'sentence', label:'Sentence case', group:'basic',
    desc:'First letter of each sentence capitalized',
    color:'#16a34a',
    fn: t => t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase()),
  },
  {
    id:'toggle', label:'tOGGLE cASE', group:'basic',
    desc:'Inverts the case of every character',
    color:'#d97706',
    fn: t => t.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''),
  },
  {
    id:'alt', label:'aLtErNaTiNg', group:'basic',
    desc:'Alternates between lower and upper',
    color:'#dc2626',
    fn: t => t.split('').map((c,i) => i%2===0 ? c.toLowerCase() : c.toUpperCase()).join(''),
  },
  {
    id:'camel', label:'camelCase', group:'code',
    desc:'Used for JS variables & functions',
    color:'#f59e0b',
    fn: t => t.trim().toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()),
  },
  {
    id:'pascal', label:'PascalCase', group:'code',
    desc:'Used for classes & React components',
    color:'#8b5cf6',
    fn: t => t.trim().replace(/(?:^|[^a-zA-Z0-9])(.)/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, ''),
  },
  {
    id:'snake', label:'snake_case', group:'code',
    desc:'Used for Python variables & DB columns',
    color:'#10b981',
    fn: t => t.trim().toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, ''),
  },
  {
    id:'kebab', label:'kebab-case', group:'code',
    desc:'Used for CSS classes & URL slugs',
    color:'#f43f5e',
    fn: t => t.trim().toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, ''),
  },
  {
    id:'constant', label:'CONSTANT_CASE', group:'code',
    desc:'Used for constants & env variables',
    color:'#06b6d4',
    fn: t => t.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''),
  },
  {
    id:'dot', label:'dot.case', group:'code',
    desc:'Used in some config file formats',
    color:'#84cc16',
    fn: t => t.trim().toLowerCase().replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.|\.$/g, ''),
  },
  {
    id:'path', label:'path/case', group:'code',
    desc:'Used for file paths and routes',
    color:'#a78bfa',
    fn: t => t.trim().toLowerCase().replace(/[^a-zA-Z0-9]+/g, '/').replace(/^\/|\/$/, ''),
  },
  {
    id:'slug', label:'url-slug', group:'web',
    desc:'SEO-friendly URL format',
    color:'#fb923c',
    fn: t => t.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
  },
  {
    id:'hashtag', label:'#HashTags', group:'web',
    desc:'Social media hashtags from text',
    color:'#38bdf8',
    fn: t => t.split(/\s+/).filter(Boolean).map(w=>'#'+w.replace(/[^a-zA-Z0-9]/g,'')).filter(h=>h.length>1).join(' '),
  },
];

const GROUPS = ['basic','code','web'];
const GROUP_LABELS = { basic:'Text Cases', code:'Code Cases', web:'Web / Social' };

/* ════════════════════════════════════════════════════════ */
export default function CaseConverter() {
  const vw        = useWidth();
  const isMobile  = vw < 640;
  const isDesktop = vw >= 1024;

  const [text,       setText]       = useState('');
  const [copied,     setCopied]     = useState(null);
  const [activeId,   setActiveId]   = useState(null);  // applied to textarea
  const [favorites,  setFavorites]  = useState(new Set(['upper','lower','title','camel','snake','kebab']));
  const [filterGroup,setFilterGroup]= useState('all');

  // History
  const [history,    setHistory]    = useState([]);  // last 10 texts

  // Find & Replace
  const [findVal,    setFindVal]    = useState('');
  const [replaceVal, setReplaceVal] = useState('');
  const [caseSens,   setCaseSens]   = useState(false);

  const textareaRef = useRef(null);

  /* ── derived stats (useMemo = no setState = no focus loss) ── */
  const stats = useMemo(() => {
    const t = text;
    return {
      words:    t.trim() ? t.trim().split(/\s+/).length : 0,
      chars:    t.length,
      noSpaces: t.replace(/\s/g,'').length,
      lines:    t ? t.split('\n').length : 0,
      sentences:t.trim() ? t.split(/[.!?]+/).filter(s=>s.trim()).length : 0,
      upper:    (t.match(/[A-Z]/g)||[]).length,
      lower:    (t.match(/[a-z]/g)||[]).length,
    };
  }, [text]);

  /* ── find count (also useMemo) ───────────────────────────── */
  const findCount = useMemo(() => {
    if (!findVal) return 0;
    try {
      const flags = caseSens ? 'g' : 'gi';
      const m = text.match(new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), flags));
      return m ? m.length : 0;
    } catch { return 0; }
  }, [findVal, text, caseSens]);

  /* ── convert results (useMemo, stable, no setState) ──────── */
  const results = useMemo(() => {
    if (!text) return {};
    return Object.fromEntries(CONVERSIONS.map(c => [c.id, c.fn(text)]));
  }, [text]);

  /* ── save to history when text changes ───────────────────── */
  const saveHistory = () => {
    if (!text.trim()) return;
    setHistory(h => {
      const filtered = h.filter(x => x !== text);
      return [text, ...filtered].slice(0, 10);
    });
  };

  /* ── apply a conversion to the textarea ─────────────────── */
  const applyConversion = (conv) => {
    if (!text) return;
    saveHistory();
    setText(conv.fn(text));
    setActiveId(conv.id);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  /* ── copy ────────────────────────────────────────────────── */
  const copyResult = (id) => {
    if (!results[id]) return;
    navigator.clipboard.writeText(results[id]);
    setCopied(id); setTimeout(() => setCopied(null), 1800);
  };

  /* ── find & replace ──────────────────────────────────────── */
  const doReplace = (all=true) => {
    if (!findVal) return;
    saveHistory();
    try {
      const flags = caseSens ? (all?'g':'') : (all?'gi':'i');
      const re = new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), flags);
      setText(t => t.replace(re, replaceVal));
      setTimeout(() => textareaRef.current?.focus(), 0);
    } catch {}
  };

  /* ── export ──────────────────────────────────────────────── */
  const exportAll = () => {
    const lines = CONVERSIONS.map(c => `${c.label}:\n${results[c.id]||''}`).join('\n\n---\n\n');
    const blob  = new Blob([`ORIGINAL:\n${text}\n\n${'='.repeat(40)}\n\n${lines}`], { type:'text/plain' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href=url; a.download='case_conversions.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ── toggle favorite ─────────────────────────────────────── */
  const toggleFav = (id) => setFavorites(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  /* ── filtered conversions ────────────────────────────────── */
  const filtered = CONVERSIONS.filter(c =>
    filterGroup==='all' || filterGroup==='fav' ? (filterGroup==='fav' ? favorites.has(c.id) : true)
    : c.group === filterGroup
  );

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* ── Textarea ── */}
      <div style={{ position:'relative' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type or paste your text here…"
          style={{
            width:'100%', minHeight: isMobile ? 160 : 220, padding:'14px 16px',
            background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)',
            borderRadius:12, color:'var(--text,#f0f0f5)', fontSize:14, lineHeight:1.7,
            outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit',
          }}
          onFocus={e=>e.target.style.borderColor='var(--accent-blue,#2563EB)'}
          onBlur={e=>e.target.style.borderColor='var(--border)'}
        />
        {text && (
          <div style={{ position:'absolute', bottom:10, right:12, fontSize:10, fontFamily:'monospace',
            color:'var(--text-muted)', background:'var(--surface-raised,#18181f)', padding:'2px 7px', borderRadius:5 }}>
            {stats.words}w · {stats.chars}c
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        {/* Undo */}
        <button onClick={()=>{ if(history.length){ setText(history[0]); setHistory(h=>h.slice(1)); setTimeout(()=>textareaRef.current?.focus(),0); }}}
          disabled={!history.length} title="Undo"
          style={{ ...AB, opacity:history.length?1:0.35 }}><RotateCcw size={13}/></button>
        {/* Copy all text */}
        <button onClick={()=>{ navigator.clipboard.writeText(text); setCopied('all'); setTimeout(()=>setCopied(null),1800); }} disabled={!text}
          style={{ ...AB, gap:5, opacity:text?1:0.35, color:copied==='all'?'#16a34a':'var(--text-muted)' }}>
          {copied==='all'?<Check size={13}/>:<Copy size={13}/>} Copy
        </button>
        {/* Export */}
        <button onClick={exportAll} disabled={!text}
          style={{ ...AB, gap:5, opacity:text?1:0.35 }}><Download size={13}/> Export All</button>
        {/* Clear */}
        <button onClick={()=>{ saveHistory(); setText(''); setActiveId(null); setTimeout(()=>textareaRef.current?.focus(),0); }} disabled={!text}
          style={{ ...AB, gap:5, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)', opacity:text?1:0.35 }}><Trash2 size={13}/> Clear</button>
      </div>

      {/* ── Stats strip ── */}
      {text && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {[
            { l:'Words',     v:stats.words.toLocaleString()    },
            { l:'Chars',     v:stats.chars.toLocaleString()    },
            { l:'No Spaces', v:stats.noSpaces.toLocaleString() },
            { l:'Lines',     v:stats.lines.toLocaleString()    },
            { l:'Sentences', v:stats.sentences.toLocaleString()},
            { l:'UPPER',     v:stats.upper,  c:'#2563eb'       },
            { l:'lower',     v:stats.lower,  c:'#7c3aed'       },
          ].map(({l,v,c})=>(
            <div key={l} style={{ display:'flex', flexDirection:'column', gap:2, padding:'8px 12px', borderRadius:9,
              background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', minWidth:60 }}>
              <span style={{ fontSize:18, fontWeight:800, color:c||'var(--text)', fontFamily:'monospace', lineHeight:1 }}>{v}</span>
              <span style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{l}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter tabs ── */}
      {text && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {[{id:'all',label:`All (${CONVERSIONS.length})`},{id:'fav',label:`⭐ Favorites (${favorites.size})`}, ...GROUPS.map(g=>({id:g,label:GROUP_LABELS[g]}))].map(tab=>(
            <button key={tab.id} onClick={()=>setFilterGroup(tab.id)}
              style={{ padding:'5px 12px', borderRadius:100, cursor:'pointer', fontSize:11, fontWeight:600, border:'none', transition:'all 0.15s',
                outline:`1px solid ${filterGroup===tab.id?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:filterGroup===tab.id?'rgba(37,99,235,0.1)':'var(--surface-raised,#18181f)',
                color:filterGroup===tab.id?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Conversion cards ── */}
      {text && (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : isDesktop ? 'repeat(2,1fr)' : 'repeat(2,1fr)', gap:8 }}>
          {filtered.map(conv => {
            const res = results[conv.id] || '';
            const isActive = activeId === conv.id;
            const isCopied = copied === conv.id;
            const isFav    = favorites.has(conv.id);
            return (
              <div key={conv.id}
                style={{ borderRadius:12, border:`1px solid ${isActive?conv.color+'60':'var(--border)'}`,
                  background: isActive ? `${conv.color}08` : 'var(--surface-raised,#18181f)',
                  overflow:'hidden', transition:'all 0.15s' }}>

                {/* Header */}
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  {/* Color dot */}
                  <div style={{ width:8, height:8, borderRadius:'50%', background:conv.color, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color: isActive ? conv.color : 'var(--text)', fontFamily:'monospace' }}>{conv.label}</div>
                    {!isMobile && <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:1 }}>{conv.desc}</div>}
                  </div>
                  {/* Group badge */}
                  <span style={{ fontSize:8, padding:'2px 6px', borderRadius:100, background:`${conv.color}15`, color:conv.color, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', flexShrink:0 }}>
                    {conv.group}
                  </span>
                  {/* Favorite */}
                  <button onClick={()=>toggleFav(conv.id)}
                    style={{ ...IB2, color:isFav?'#f59e0b':'var(--border)', borderColor:'transparent', background:'transparent' }} title={isFav?'Remove favorite':'Add favorite'}>
                    {isFav?<Star size={12} fill="#f59e0b"/>:<Star size={12}/>}
                  </button>
                </div>

                {/* Result preview */}
                <div style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace', lineHeight:1.5,
                  color:'var(--text-muted)', background:'rgba(0,0,0,0.1)',
                  maxHeight:72, overflowY:'hidden', overflowX:'hidden', textOverflow:'ellipsis',
                  whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
                  {res.slice(0,120)}{res.length>120?'…':''}
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:0, borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                  <button onClick={()=>applyConversion(conv)}
                    style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 10px', border:'none', background:'transparent', cursor:'pointer', fontSize:11, fontWeight:600, color: isActive?conv.color:'var(--text-muted)', transition:'all 0.15s',
                      borderRight:'1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {isActive?<Check size={11}/>:<ArrowRight size={11}/>} {isActive?'Applied':'Apply'}
                  </button>
                  <button onClick={()=>copyResult(conv.id)}
                    style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 10px', border:'none', background:'transparent', cursor:'pointer', fontSize:11, fontWeight:600,
                      color:isCopied?'#16a34a':'var(--text-muted)', transition:'all 0.15s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {isCopied?<Check size={11}/>:<Copy size={11}/>} {isCopied?'Copied!':'Copy'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Find & Replace ── */}
      {text && (
        <Collapsible title="Find & Replace" icon={Search} defaultOpen={false} badge={findVal&&findCount>0?String(findCount):undefined}>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ position:'relative' }}>
              <Search size={12} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
              <input type="text" placeholder="Find…" value={findVal} onChange={e=>setFindVal(e.target.value)}
                style={{ ...IN, paddingLeft:32 }}/>
              {findVal && (
                <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:10, fontFamily:'monospace', color:'var(--accent-blue,#2563EB)', fontWeight:700 }}>
                  {findCount} match{findCount!==1?'es':''}
                </span>
              )}
            </div>
            <div style={{ position:'relative' }}>
              <Replace size={12} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
              <input type="text" placeholder="Replace with…" value={replaceVal} onChange={e=>setReplaceVal(e.target.value)}
                style={{ ...IN, paddingLeft:32 }}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-muted)', cursor:'pointer' }}>
                <input type="checkbox" checked={caseSens} onChange={e=>setCaseSens(e.target.checked)} style={{ accentColor:'var(--accent-blue,#2563EB)' }}/>
                Case sensitive
              </label>
              <div style={{ flex:1 }}/>
              <button onClick={()=>doReplace(false)} disabled={!findVal||!findCount}
                style={{ padding:'6px 12px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:11, fontWeight:600, cursor:findVal&&findCount?'pointer':'not-allowed', opacity:findVal&&findCount?1:0.4 }}>
                Replace Next
              </button>
              <button onClick={()=>doReplace(true)} disabled={!findVal||!findCount}
                style={{ padding:'6px 12px', borderRadius:7, border:'none', background:'var(--accent-blue,#2563EB)', color:'white', fontSize:11, fontWeight:600, cursor:findVal&&findCount?'pointer':'not-allowed', opacity:findVal&&findCount?1:0.4 }}>
                Replace All ({findCount})
              </button>
            </div>
          </div>
        </Collapsible>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <Collapsible title="History" icon={History} defaultOpen={false} badge={String(history.length)}>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button onClick={()=>{ setText(h); setTimeout(()=>textareaRef.current?.focus(),0); }}
                  style={{ flex:1, textAlign:'left', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface,#111118)', color:'var(--text-muted)', fontSize:11, cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace', transition:'all 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent-blue,#2563EB)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  {h.slice(0,80)}{h.length>80?'…':''}
                </button>
                <button onClick={()=>setHistory(hh=>hh.filter((_,j)=>j!==i))} style={{ ...IB2 }}><Trash2 size={11}/></button>
              </div>
            ))}
            <button onClick={()=>setHistory([])} style={{ fontSize:11, color:'#ef4444', background:'transparent', border:'none', cursor:'pointer', textAlign:'left', padding:'4px 0' }}>
              Clear history
            </button>
          </div>
        </Collapsible>
      )}

    </div>
  );
}

const IN  = { width:'100%', padding:'8px 12px', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text,#f0f0f5)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
const AB  = { display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'7px 13px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' };
const IB2 = { display:'flex', alignItems:'center', justifyContent:'center', width:26, height:26, borderRadius:6, border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)', color:'var(--text-muted)', cursor:'pointer', flexShrink:0 };