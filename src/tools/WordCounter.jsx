import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Type, Copy, Trash2, Download, Search, Target,
  ChevronDown, ChevronUp, Check, RefreshCw, AlignLeft,
  BarChart2, Clock, Eye, EyeOff, Replace,
} from 'lucide-react';

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

/* ── Collapsible ─────────────────────────────────────────── */
function Collapsible({ title, icon: Icon, defaultOpen = true, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', background:'var(--surface-raised,#18181f)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:7, padding:'11px 14px', background:'transparent', border:'none', cursor:'pointer' }}>
        {Icon && <Icon size={12} style={{ color:'var(--text-muted)', flexShrink:0 }}/>}
        <span style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'left' }}>{title}</span>
        {badge != null && (
          <span style={{ fontSize:10, padding:'1px 7px', borderRadius:100, background:'rgba(37,99,235,0.12)', color:'var(--accent-blue,#2563EB)', fontWeight:700, fontFamily:'monospace' }}>{badge}</span>
        )}
        {open ? <ChevronUp size={13} style={{ color:'var(--text-muted)', flexShrink:0 }}/> : <ChevronDown size={13} style={{ color:'var(--text-muted)', flexShrink:0 }}/>}
      </button>
      {open && <div style={{ padding:'0 14px 14px' }}>{children}</div>}
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────── */
function Stat({ label, value, sub, color, accent }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, padding:'14px 16px', borderRadius:12,
      background:'var(--surface-raised,#18181f)', border:`1px solid ${accent?accent+'30':'var(--border)'}`,
      position:'relative', overflow:'hidden' }}>
      {accent && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:accent }}/>}
      <div style={{ fontSize:22, fontWeight:800, color:color||'var(--text)', fontFamily:'monospace', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>{sub}</div>}
    </div>
  );
}

/* ── Progress bar ────────────────────────────────────────── */
function GoalBar({ label, current, goal, color = 'var(--accent-blue,#2563EB)' }) {
  const pct = goal ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const done = goal && current >= goal;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, color:done?'#16a34a':color }}>
          {current.toLocaleString()} / {goal.toLocaleString()} {done&&'✓'}
        </span>
      </div>
      <div style={{ height:5, background:'var(--border)', borderRadius:100, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:100, transition:'width 0.4s ease',
          background: done ? '#16a34a' : color,
          width:`${pct}%`, boxShadow: done ? '0 0 8px rgba(22,163,74,0.5)' : undefined }}/>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════ */
export default function WordCounter() {
  const vw        = useWidth();
  const isMobile  = vw < 640;
  const isDesktop = vw >= 1024;

  const [text,      setText]      = useState('');
  const [copied,    setCopied]    = useState(false);
  const [showDensity, setShowDensity] = useState(false);

  // Goals
  const [goalWords, setGoalWords] = useState(500);
  const [goalChars, setGoalChars] = useState(2500);
  const [showGoals, setShowGoals] = useState(false);

  // Find & Replace
  const [findVal,   setFindVal]   = useState('');
  const [replaceVal,setReplaceVal]= useState('');
  const [caseSens,  setCaseSens]  = useState(false);
  const [findCount, setFindCount] = useState(0);
  const textareaRef = useRef(null);

  // Case conversion
  const [caseMode, setCaseMode]   = useState('');

  /* ── stats ───────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const t   = text;
    const trimmed = t.trim();
    const words      = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars      = t.length;
    const charsNoSp  = t.replace(/\s/g, '').length;
    const sentences  = trimmed ? t.split(/[.!?]+/).filter(s => s.trim()).length : 0;
    const paragraphs = trimmed ? t.split(/\n\n+/).filter(p => p.trim()).length : 0;
    const lines      = t ? t.split('\n').length : 0;
    const readMin    = Math.max(1, Math.ceil(words / 200));
    const speakMin   = Math.max(1, Math.ceil(words / 130));
    const avgWordLen = words ? (charsNoSp / words).toFixed(1) : '0';
    const uniqueWords = trimmed
      ? new Set(trimmed.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z]/g, ''))).size
      : 0;

    // Keyword density (top 10, skip stopwords)
    const STOP = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','is','it','as','by','that','this','was','are','be','from','has','have','had','he','she','they','we','you','i','not','if','my','so','do','its','his','her','our','their','which','who','what','can','will','been','were','about','more','one','all','also','when','than','up','out','no','there','would','into','some','could','them','these','how','your','any','just','after','over','such','like','well','back','other','time','way','two','get','only','see','go','now','very','come','said','than','then','am','did','use','may','per','made','new','must','need','too']);
    const freqMap = {};
    if (trimmed) {
      trimmed.toLowerCase().split(/\s+/).forEach(w => {
        const clean = w.replace(/[^a-z']/g, '');
        if (clean.length > 2 && !STOP.has(clean)) freqMap[clean] = (freqMap[clean]||0) + 1;
      });
    }
    const topKeywords = Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count, pct: words ? Math.round(count/words*100*10)/10 : 0 }));

    return { words, chars, charsNoSp, sentences, paragraphs, lines, readMin, speakMin, avgWordLen, uniqueWords, topKeywords };
  }, [text]);

  /* ── find count ──────────────────────────────────────────── */
  useEffect(() => {
    if (!findVal) { setFindCount(0); return; }
    try {
      const flags = caseSens ? 'g' : 'gi';
      const matches = text.match(new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags));
      setFindCount(matches ? matches.length : 0);
    } catch { setFindCount(0); }
  }, [findVal, text, caseSens]);

  /* ── find & replace ──────────────────────────────────────── */
  const doReplace = (all = true) => {
    if (!findVal) return;
    try {
      const flags = caseSens ? (all?'g':'') : (all?'gi':'i');
      const re = new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      setText(text.replace(re, replaceVal));
    } catch {}
  };

  /* ── case conversion ─────────────────────────────────────── */
  const applyCase = (mode) => {
    let out = text;
    if      (mode==='upper')    out = text.toUpperCase();
    else if (mode==='lower')    out = text.toLowerCase();
    else if (mode==='title')    out = text.replace(/\b\w/g, c=>c.toUpperCase());
    else if (mode==='sentence') out = text.replace(/(^\s*\w|[.!?]\s+\w)/g, c=>c.toUpperCase());
    else if (mode==='toggle')   out = text.split('').map(c=>c===c.toUpperCase()?c.toLowerCase():c.toUpperCase()).join('');
    setText(out); setCaseMode(mode);
    setTimeout(()=>setCaseMode(''), 1500);
  };

  /* ── copy ────────────────────────────────────────────────── */
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(()=>setCopied(false), 2000);
  };

  /* ── export ──────────────────────────────────────────────── */
  const exportTxt = () => {
    const blob = new Blob([text], { type:'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download='text_export.txt';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  /* ── highlight matches in preview ───────────────────────── */
  const highlightedHtml = useMemo(() => {
    if (!findVal || !text) return null;
    try {
      const flags = caseSens ? 'g' : 'gi';
      const re = new RegExp(`(${findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, flags);
      return text
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(re, `<mark style="background:#f59e0b;color:#000;border-radius:2px;">$1</mark>`)
        .replace(/\n/g,'<br/>');
    } catch { return null; }
  }, [findVal, text, caseSens]);

  /* ── main stats bar data ─────────────────────────────────── */
  const PRIMARY_STATS = [
    { label:'Words',       value:stats.words.toLocaleString(),      accent:'#2563eb' },
    { label:'Characters',  value:stats.chars.toLocaleString(),      accent:'#7c3aed' },
    { label:'No Spaces',   value:stats.charsNoSp.toLocaleString(),  accent:'#0891b2' },
    { label:'Sentences',   value:stats.sentences.toLocaleString(),   accent:'#d97706' },
    { label:'Paragraphs',  value:stats.paragraphs.toLocaleString(),  accent:'#16a34a' },
    { label:'Lines',       value:stats.lines.toLocaleString(),       accent:'#dc2626' },
    { label:'Read Time',   value:`${stats.readMin}m`,                accent:'#2563eb', sub:`~200 wpm` },
    { label:'Speak Time',  value:`${stats.speakMin}m`,               accent:'#7c3aed', sub:`~130 wpm` },
    { label:'Avg Word Len',value:stats.avgWordLen,                   accent:'#0891b2', sub:`characters` },
    { label:'Unique Words',value:stats.uniqueWords.toLocaleString(), accent:'#16a34a' },
  ];

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* ── Textarea ── */}
      <div style={{ position:'relative' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e=>setText(e.target.value)}
          placeholder="Start typing or paste your text here…"
          style={{
            width:'100%', minHeight: isMobile ? 200 : 280, padding:'16px',
            background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)',
            borderRadius:12, color:'var(--text,#f0f0f5)', fontSize:14, lineHeight:1.7,
            outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit',
            transition:'border-color 0.15s',
          }}
          onFocus={e=>e.target.style.borderColor='var(--accent-blue,#2563EB)'}
          onBlur={e=>e.target.style.borderColor='var(--border)'}
        />
        {/* Word count badge inside textarea */}
        {text && (
          <div style={{ position:'absolute', bottom:10, right:12, fontSize:11, fontFamily:'monospace',
            color:'var(--text-muted)', background:'var(--surface-raised,#18181f)', padding:'2px 8px', borderRadius:6 }}>
            {stats.words.toLocaleString()} words
          </div>
        )}
      </div>

      {/* ── Quick action bar ── */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        <button onClick={copy}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:copied?'#16a34a':'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
          {copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Copied!':'Copy'}
        </button>
        <button onClick={exportTxt}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          <Download size={13}/> Export .txt
        </button>
        <button onClick={()=>setText('')} disabled={!text}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'#ef4444', fontSize:12, fontWeight:600, cursor:text?'pointer':'not-allowed', opacity:text?1:0.4 }}>
          <Trash2 size={13}/> Clear
        </button>

        <div style={{ width:1, height:20, background:'var(--border)', margin:'0 2px' }}/>

        {/* Case conversion */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {[
            { m:'upper',    l:'AA' },
            { m:'lower',    l:'aa' },
            { m:'title',    l:'Aa' },
            { m:'sentence', l:'A.' },
            { m:'toggle',   l:'aA' },
          ].map(({m,l})=>(
            <button key={m} onClick={()=>applyCase(m)} disabled={!text}
              style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)',
                background:caseMode===m?'rgba(37,99,235,0.1)':'transparent',
                color:caseMode===m?'var(--accent-blue,#2563EB)':'var(--text-muted)',
                fontSize:11, fontWeight:700, fontFamily:'monospace', cursor:text?'pointer':'not-allowed', opacity:text?1:0.4, transition:'all 0.15s' }}
              title={`Convert to ${m} case`}>{l}</button>
          ))}
        </div>

        <div style={{ flex:1 }}/>
        <button onClick={()=>setShowGoals(v=>!v)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:8,
            border:`1px solid ${showGoals?'var(--accent-blue,#2563EB)':'var(--border)'}`,
            background:showGoals?'rgba(37,99,235,0.1)':'transparent',
            color:showGoals?'var(--accent-blue,#2563EB)':'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          <Target size={13}/> Goals
        </button>
      </div>

      {/* ── Goals bar ── */}
      {showGoals && (
        <div style={{ padding:'14px 16px', borderRadius:12, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase' }}>Writing Goals</div>
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12 }}>
            <GoalBar label="Word Goal" current={stats.words} goal={goalWords} color="var(--accent-blue,#2563EB)"/>
            <GoalBar label="Character Goal" current={stats.chars} goal={goalChars} color="#7c3aed"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Word Target</div>
              <input type="number" value={goalWords} onChange={e=>setGoalWords(Number(e.target.value))} min={1}
                style={{ ...IN, padding:'7px 10px', fontSize:13, fontFamily:'monospace' }}/>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Char Target</div>
              <input type="number" value={goalChars} onChange={e=>setGoalChars(Number(e.target.value))} min={1}
                style={{ ...IN, padding:'7px 10px', fontSize:13, fontFamily:'monospace' }}/>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats grid ── */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap:8 }}>
        {PRIMARY_STATS.slice(0, isMobile?6:10).map(s=>(
          <Stat key={s.label} {...s}/>
        ))}
      </div>

      {/* ── Find & Replace ── */}
      <Collapsible title="Find & Replace" icon={Search} defaultOpen={false} badge={findVal&&findCount>0?findCount:undefined}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* Find */}
          <div style={{ position:'relative' }}>
            <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input type="text" placeholder="Find…" value={findVal} onChange={e=>setFindVal(e.target.value)}
              style={{ ...IN, paddingLeft:33 }}/>
            {findVal && (
              <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                fontSize:10, fontFamily:'monospace', color:'var(--accent-blue,#2563EB)', fontWeight:700 }}>
                {findCount} match{findCount!==1?'es':''}
              </span>
            )}
          </div>

          {/* Replace */}
          <div style={{ position:'relative' }}>
            <Replace size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input type="text" placeholder="Replace with…" value={replaceVal} onChange={e=>setReplaceVal(e.target.value)}
              style={{ ...IN, paddingLeft:33 }}/>
          </div>

          {/* Options + buttons */}
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-muted)', cursor:'pointer' }}>
              <input type="checkbox" checked={caseSens} onChange={e=>setCaseSens(e.target.checked)} style={{ accentColor:'var(--accent-blue,#2563EB)' }}/>
              Case sensitive
            </label>
            <div style={{ flex:1 }}/>
            <button onClick={()=>doReplace(false)} disabled={!findVal||!findCount}
              style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:11, fontWeight:600, cursor:findVal&&findCount?'pointer':'not-allowed', opacity:findVal&&findCount?1:0.4 }}>
              Replace Next
            </button>
            <button onClick={()=>doReplace(true)} disabled={!findVal||!findCount}
              style={{ padding:'7px 12px', borderRadius:8, border:'none', background:'var(--accent-blue,#2563EB)', color:'white', fontSize:11, fontWeight:600, cursor:findVal&&findCount?'pointer':'not-allowed', opacity:findVal&&findCount?1:0.4 }}>
              Replace All ({findCount})
            </button>
          </div>

          {/* Highlighted preview */}
          {highlightedHtml && findCount > 0 && (
            <div style={{ padding:'10px 12px', borderRadius:8, background:'var(--surface,#111118)', border:'1px solid var(--border)', fontSize:12, lineHeight:1.7, maxHeight:120, overflowY:'auto', color:'var(--text-muted)' }}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}/>
          )}
        </div>
      </Collapsible>

      {/* ── Keyword Density ── */}
      {stats.topKeywords.length > 0 && (
        <Collapsible title="Keyword Density" icon={BarChart2} defaultOpen={false} badge={stats.topKeywords.length}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {stats.topKeywords.map(({ word, count, pct }, idx) => (
              <div key={word} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', fontFamily:'monospace', width:20, textAlign:'right', flexShrink:0 }}>#{idx+1}</div>
                <div style={{ fontSize:12, fontWeight:600, minWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{word}</div>
                <div style={{ flex:1, height:4, background:'var(--border)', borderRadius:100, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:100, background:`hsl(${200+idx*20},70%,55%)`,
                    width:`${(count/stats.topKeywords[0].count)*100}%`, transition:'width 0.4s ease' }}/>
                </div>
                <div style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)', flexShrink:0, minWidth:60, textAlign:'right' }}>
                  {count}× · {pct}%
                </div>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* ── Detailed stats ── */}
      <Collapsible title="Detailed Statistics" icon={AlignLeft} defaultOpen={false}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            { l:'Total Words',        v:stats.words.toLocaleString()       },
            { l:'Unique Words',       v:stats.uniqueWords.toLocaleString() },
            { l:'Total Characters',   v:stats.chars.toLocaleString()       },
            { l:'Without Spaces',     v:stats.charsNoSp.toLocaleString()   },
            { l:'Sentences',          v:stats.sentences.toLocaleString()   },
            { l:'Paragraphs',         v:stats.paragraphs.toLocaleString()  },
            { l:'Lines',              v:stats.lines.toLocaleString()       },
            { l:'Avg Word Length',    v:`${stats.avgWordLen} chars`        },
            { l:'Reading Time (200wpm)', v:`${stats.readMin} min`          },
            { l:'Speaking Time (130wpm)',v:`${stats.speakMin} min`         },
          ].map(({l,v})=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', gap:8, padding:'8px 10px', borderRadius:8, background:'var(--surface,#111118)', border:'1px solid var(--border)' }}>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{l}</span>
              <span style={{ fontSize:11, fontWeight:700, fontFamily:'monospace', color:'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>
      </Collapsible>

    </div>
  );
}

const IN = { width:'100%', padding:'9px 12px', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text,#f0f0f5)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };