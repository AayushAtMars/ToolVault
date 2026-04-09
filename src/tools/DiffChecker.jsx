import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Copy, Check, Download, RefreshCw, ArrowLeftRight,
  ChevronDown, ChevronUp, Eye, EyeOff, AlignLeft,
  Columns, FileText, Filter, Search,
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

/* ══════════════════════════════════════════════════════════
   DIFF ENGINE — word-level inline diffs using LCS
══════════════════════════════════════════════════════════ */

// Line-level Myers diff (simplified)
function lineDiff(a, b) {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const m = linesA.length, n = linesB.length;
  const dp = Array.from({ length:m+1 }, () => new Array(n+1).fill(0));
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
    dp[i][j] = linesA[i-1]===linesB[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j],dp[i][j-1]);

  const ops = []; let i=m, j=n;
  while (i>0||j>0) {
    if (i>0&&j>0&&linesA[i-1]===linesB[j-1]) { ops.push({type:'same',a:linesA[i-1],b:linesB[j-1],ai:i,bi:j}); i--;j--; }
    else if (j>0&&(i===0||dp[i][j-1]>=dp[i-1][j])) { ops.push({type:'add',b:linesB[j-1],bi:j}); j--; }
    else { ops.push({type:'del',a:linesA[i-1],ai:i}); i--; }
  }
  return ops.reverse();
}

// Word-level LCS for inline highlighting
function wordDiff(a, b) {
  const wa = a.split(/(\s+)/), wb = b.split(/(\s+)/);
  const m=wa.length, n=wb.length;
  const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=wa[i-1]===wb[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
  const ops=[]; let i=m,j=n;
  while(i>0||j>0){
    if(i>0&&j>0&&wa[i-1]===wb[j-1]){ops.push({type:'same',v:wa[i-1]});i--;j--;}
    else if(j>0&&(i===0||dp[i][j-1]>=dp[i-1][j])){ops.push({type:'add',v:wb[j-1]});j--;}
    else{ops.push({type:'del',v:wa[i-1]});i--;}
  }
  return ops.reverse();
}

// Render word-diff inline JSX
function InlineDiff({ a, b, mode }) {
  const parts = wordDiff(a, b);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.type==='same') return <span key={i}>{p.v}</span>;
        if (p.type==='del' && mode!=='add') return (
          <span key={i} style={{ background:'rgba(220,38,38,0.35)', color:'#fca5a5', borderRadius:2, textDecoration:'line-through', padding:'0 1px' }}>{p.v}</span>
        );
        if (p.type==='add' && mode!=='del') return (
          <span key={i} style={{ background:'rgba(22,163,74,0.35)', color:'#86efac', borderRadius:2, padding:'0 1px' }}>{p.v}</span>
        );
        return null;
      })}
    </span>
  );
}

/* ── stat pill ───────────────────────────────────────────── */
function StatPill({ label, value, color }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3, padding:'10px 16px', borderRadius:10,
      background:'var(--surface-raised,#18181f)', border:`1px solid ${color}30`, minWidth:70, textAlign:'center' }}>
      <span style={{ fontSize:20, fontWeight:800, color, fontFamily:'monospace', lineHeight:1 }}>{value}</span>
      <span style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</span>
    </div>
  );
}

/* ── textarea with label ─────────────────────────────────── */
function DiffTextarea({ label, value, onChange, placeholder, badge, badgeColor, lineCount }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1, minWidth:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', flex:1 }}>{label}</span>
        {badge && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:100, background:`${badgeColor}18`, color:badgeColor, fontWeight:700, fontFamily:'monospace' }}>{badge}</span>}
        <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace' }}>{lineCount} line{lineCount!==1?'s':''}</span>
      </div>
      <textarea
        value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width:'100%', minHeight:220, padding:'12px 14px', resize:'vertical',
          background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)',
          borderRadius:10, color:'var(--text,#f0f0f5)', fontSize:13, lineHeight:1.7,
          fontFamily:'monospace', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s',
        }}
        onFocus={e=>e.target.style.borderColor=badgeColor||'var(--accent-blue,#2563EB)'}
        onBlur={e=>e.target.style.borderColor='var(--border)'}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════ */
export default function DiffChecker() {
  const vw        = useWidth();
  const isMobile  = vw < 640;
  const isDesktop = vw >= 1024;

  const [textA,      setTextA]      = useState('');
  const [textB,      setTextB]      = useState('');
  const [viewMode,   setViewMode]   = useState('unified'); // unified | split
  const [showSame,   setShowSame]   = useState(true);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWS,   setIgnoreWS]   = useState(false);
  const [inlineWords,setInlineWords]= useState(true);
  const [copied,     setCopied]     = useState(null);
  const [search,     setSearch]     = useState('');

  const copy = (val, key) => {
    navigator.clipboard.writeText(val);
    setCopied(key); setTimeout(()=>setCopied(null), 1800);
  };

  /* ── preprocess ──────────────────────────────────────────── */
  const preprocess = (t) => {
    let s = t;
    if (ignoreCase) s = s.toLowerCase();
    if (ignoreWS)   s = s.split('\n').map(l=>l.replace(/\s+/g,' ').trim()).join('\n');
    return s;
  };

  /* ── diff computation ────────────────────────────────────── */
  const diff = useMemo(() => {
    if (!textA && !textB) return null;
    const a = preprocess(textA), b = preprocess(textB);
    const ops = lineDiff(a, b);
    let added=0, removed=0, unchanged=0, changed=0;
    const lines = [];

    // Group consecutive same lines
    for (const op of ops) {
      if (op.type==='same')      { unchanged++; }
      else if (op.type==='add')  { added++;     }
      else if (op.type==='del')  { removed++;   }
    }

    // Pair del+add for changed counting
    let i=0;
    while(i<ops.length) {
      if (ops[i].type==='del' && ops[i+1]?.type==='add') {
        lines.push({ type:'changed', del:ops[i].a, add:ops[i+1].b, ai:ops[i].ai, bi:ops[i+1].bi });
        changed++; i+=2;
      } else {
        lines.push(ops[i]); i++;
      }
    }

    // Filter by search
    const filtered = search
      ? lines.filter(l => {
          const hay = ((l.a||l.del||'')+(l.b||l.add||'')).toLowerCase();
          return hay.includes(search.toLowerCase());
        })
      : lines;

    return { lines:filtered, added, removed, unchanged, changed, total:ops.length };
  }, [textA, textB, ignoreCase, ignoreWS, search]);

  /* ── line numbers ────────────────────────────────────────── */
  const linesA = textA ? textA.split('\n').length : 0;
  const linesB = textB ? textB.split('\n').length : 0;

  /* ── export patch ────────────────────────────────────────── */
  const exportPatch = () => {
    if (!diff) return;
    const lines = diff.lines.map(l => {
      if (l.type==='add')     return `+ ${l.b}`;
      if (l.type==='del')     return `- ${l.a}`;
      if (l.type==='changed') return `- ${l.del}\n+ ${l.add}`;
      return `  ${l.a}`;
    });
    const patch = `--- Original\n+++ Modified\n${lines.join('\n')}`;
    const blob  = new Blob([patch], {type:'text/plain'});
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href=url; a.download='diff.patch';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  /* ── render a diff row ───────────────────────────────────── */
  const renderRow = (line, idx) => {
    const isAdd     = line.type==='add';
    const isDel     = line.type==='del';
    const isChanged = line.type==='changed';
    const isSame    = line.type==='same';

    if (isSame && !showSame) return null;

    const LS = { padding:'1px 14px 1px 8px', fontFamily:'monospace', fontSize:isMobile?11:13, lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word' };
    const LN = { display:'inline-block', minWidth:32, color:'rgba(255,255,255,0.2)', textAlign:'right', marginRight:12, fontSize:11, userSelect:'none', fontFamily:'monospace' };

    if (viewMode==='unified') {
      if (isChanged) return (
        <div key={idx}>
          <div style={{ ...LS, background:'rgba(220,38,38,0.08)', borderLeft:'3px solid #dc2626' }}>
            <span style={LN}>{line.ai}</span>
            <span style={{ color:'#f87171' }}>─ </span>
            {inlineWords ? <InlineDiff a={line.del} b={line.add} mode="del"/> : <span style={{ color:'#fca5a5' }}>{line.del}</span>}
          </div>
          <div style={{ ...LS, background:'rgba(22,163,74,0.08)', borderLeft:'3px solid #16a34a' }}>
            <span style={LN}>{line.bi}</span>
            <span style={{ color:'#4ade80' }}>+ </span>
            {inlineWords ? <InlineDiff a={line.del} b={line.add} mode="add"/> : <span style={{ color:'#86efac' }}>{line.add}</span>}
          </div>
        </div>
      );
      if (isDel) return (
        <div key={idx} style={{ ...LS, background:'rgba(220,38,38,0.07)', borderLeft:'3px solid #dc2626' }}>
          <span style={LN}>{line.ai}</span>
          <span style={{ color:'#f87171' }}>─ </span>
          <span style={{ color:'#fca5a5' }}>{line.a}</span>
        </div>
      );
      if (isAdd) return (
        <div key={idx} style={{ ...LS, background:'rgba(22,163,74,0.07)', borderLeft:'3px solid #16a34a' }}>
          <span style={LN}>{line.bi}</span>
          <span style={{ color:'#4ade80' }}>+ </span>
          <span style={{ color:'#86efac' }}>{line.b}</span>
        </div>
      );
      // same
      return (
        <div key={idx} style={{ ...LS, borderLeft:'3px solid transparent' }}>
          <span style={LN}>{line.ai}</span>
          <span style={{ color:'var(--border)' }}>  </span>
          <span style={{ color:'var(--text-muted)' }}>{line.a}</span>
        </div>
      );
    }

    // Split view
    const cellA = (content, bg, color, lineNum) => (
      <div style={{ flex:1, minWidth:0, padding:'1px 8px', background:bg, borderLeft:'3px solid transparent', fontFamily:'monospace', fontSize:isMobile?11:12, lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word', color }}>
        <span style={{ ...LN, minWidth:24 }}>{lineNum||''}</span>{content}
      </div>
    );

    if (isChanged) return (
      <div key={idx} style={{ display:'flex', gap:1, borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
        {cellA(inlineWords?<InlineDiff a={line.del} b={line.add} mode="del"/>:<span>{line.del}</span>, 'rgba(220,38,38,0.08)', '#fca5a5', line.ai)}
        {cellA(inlineWords?<InlineDiff a={line.del} b={line.add} mode="add"/>:<span>{line.add}</span>, 'rgba(22,163,74,0.08)', '#86efac', line.bi)}
      </div>
    );
    if (isDel) return (
      <div key={idx} style={{ display:'flex', gap:1, borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
        {cellA(<span style={{color:'#fca5a5'}}>{line.a}</span>, 'rgba(220,38,38,0.07)', '#fca5a5', line.ai)}
        {cellA('', '', 'transparent', '')}
      </div>
    );
    if (isAdd) return (
      <div key={idx} style={{ display:'flex', gap:1, borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
        {cellA('', '', 'transparent', '')}
        {cellA(<span style={{color:'#86efac'}}>{line.b}</span>, 'rgba(22,163,74,0.07)', '#86efac', line.bi)}
      </div>
    );
    return (
      <div key={idx} style={{ display:'flex', gap:1, borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
        {cellA(line.a, '', 'var(--text-muted)', line.ai)}
        {cellA(line.a, '', 'var(--text-muted)', line.bi)}
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* ── Input area ── */}
      <div style={{ display:'flex', flexDirection: isMobile?'column':'row', gap:12 }}>
        <DiffTextarea
          label="Original" placeholder="Paste the original text here…"
          value={textA} onChange={setTextA}
          badge={`A`} badgeColor="#dc2626"
          lineCount={linesA}
        />
        {/* Swap button (between textareas) */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <button onClick={()=>{ setTextA(textB); setTextB(textA); }}
            style={{ ...IB, borderRadius:'50%', width:36, height:36, color:'var(--accent-blue,#2563EB)', borderColor:'rgba(37,99,235,0.3)', background:'rgba(37,99,235,0.07)' }}
            title="Swap sides">
            <ArrowLeftRight size={15}/>
          </button>
        </div>
        <DiffTextarea
          label="Modified" placeholder="Paste the modified text here…"
          value={textB} onChange={setTextB}
          badge={`B`} badgeColor="#16a34a"
          lineCount={linesB}
        />
      </div>

      {/* ── Action bar ── */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        {/* View mode */}
        <div style={{ display:'flex', gap:3, padding:3, background:'var(--surface-raised,#18181f)', borderRadius:9, border:'1px solid var(--border)' }}>
          {[{id:'unified',l:'Unified',I:AlignLeft},{id:'split',l:'Split',I:Columns}].map(({id,l,I})=>(
            <button key={id} onClick={()=>setViewMode(id)}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:6, cursor:'pointer', border:'none', fontSize:11, fontWeight:600, transition:'all 0.15s',
                background:viewMode===id?'var(--surface,#111118)':'transparent',
                color:viewMode===id?'var(--text)':'var(--text-muted)' }}>
              <I size={12}/>{!isMobile&&l}
            </button>
          ))}
        </div>

        <div style={{ width:1, height:20, background:'var(--border)' }}/>

        {/* Toggles */}
        {[
          { key:'showSame',   val:showSame,    set:setShowSame,    label:'Context', icon:Eye },
          { key:'inlineWords',val:inlineWords, set:setInlineWords, label:'Inline',  icon:FileText },
          { key:'ignoreCase', val:ignoreCase,  set:setIgnoreCase,  label:'∑ Case',  icon:Filter },
          { key:'ignoreWS',   val:ignoreWS,    set:setIgnoreWS,    label:'∑ Space', icon:Filter },
        ].map(({key,val,set,label,icon:Icon})=>(
          <button key={key} onClick={()=>set(v=>!v)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600, border:'none', transition:'all 0.15s',
              outline:`1px solid ${val?'var(--accent-blue,#2563EB)':'var(--border)'}`,
              background:val?'rgba(37,99,235,0.1)':'transparent',
              color:val?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
            <Icon size={11}/>{!isMobile&&label}
          </button>
        ))}

        <div style={{ flex:1 }}/>

        {/* Copy / Export */}
        <button onClick={exportPatch} disabled={!diff}
          style={{ ...AB, opacity:diff?1:0.35, gap:5 }}><Download size={13}/>{!isMobile&&'Export .patch'}</button>
        <button onClick={()=>copy(textA,'a')} disabled={!textA} style={{ ...AB, opacity:textA?1:0.35, gap:5, color:copied==='a'?'#16a34a':'var(--text-muted)' }}>
          {copied==='a'?<Check size={12}/>:<Copy size={12}/>}{!isMobile&&'Copy A'}</button>
        <button onClick={()=>copy(textB,'b')} disabled={!textB} style={{ ...AB, opacity:textB?1:0.35, gap:5, color:copied==='b'?'#16a34a':'var(--text-muted)' }}>
          {copied==='b'?<Check size={12}/>:<Copy size={12}/>}{!isMobile&&'Copy B'}</button>
        <button onClick={()=>{ setTextA(''); setTextB(''); }} disabled={!textA&&!textB} style={{ ...AB, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)', opacity:textA||textB?1:0.35, gap:5 }}>
          <RefreshCw size={12}/>{!isMobile&&'Clear'}</button>
      </div>

      {/* ── Stats ── */}
      {diff && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <StatPill label="Added"     value={`+${diff.added}`}     color="#16a34a"/>
          <StatPill label="Removed"   value={`-${diff.removed}`}   color="#dc2626"/>
          <StatPill label="Changed"   value={`~${diff.changed}`}   color="#f59e0b"/>
          <StatPill label="Unchanged" value={diff.unchanged}       color="var(--text-muted)"/>
          <StatPill label="Total"     value={diff.total}           color="var(--accent-blue,#2563EB)"/>
          {/* Similarity */}
          <div style={{ display:'flex', flexDirection:'column', gap:3, padding:'10px 16px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', justifyContent:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:20, fontWeight:800, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace', lineHeight:1 }}>
                {diff.total ? Math.round(diff.unchanged/diff.total*100) : 100}%
              </span>
              <span style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Similar</span>
            </div>
            <div style={{ width:120, height:4, background:'var(--border)', borderRadius:100, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'var(--accent-blue,#2563EB)', borderRadius:100, transition:'width 0.4s ease',
                width:`${diff.total ? diff.unchanged/diff.total*100 : 100}%` }}/>
            </div>
          </div>
        </div>
      )}

      {/* ── Search in diff ── */}
      {diff && (
        <div style={{ position:'relative' }}>
          <Search size={12} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
          <input type="text" placeholder="Search within diff…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{ ...IN, paddingLeft:34 }}/>
          {search && (
            <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:10, fontFamily:'monospace', color:'var(--accent-blue,#2563EB)', fontWeight:700 }}>
              {diff.lines.length} result{diff.lines.length!==1?'s':''}
            </span>
          )}
        </div>
      )}

      {/* ── Diff output ── */}
      {diff && diff.lines.length > 0 && (
        <div style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', background:'var(--surface-raised,#18181f)' }}>
          {/* Header */}
          {viewMode==='split' && (
            <div style={{ display:'flex', gap:1, padding:'7px 14px', borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.2)' }}>
              <div style={{ flex:1, fontSize:10, fontWeight:700, color:'#dc2626', letterSpacing:'0.07em', textTransform:'uppercase' }}>A — Original</div>
              <div style={{ flex:1, fontSize:10, fontWeight:700, color:'#16a34a', letterSpacing:'0.07em', textTransform:'uppercase' }}>B — Modified</div>
            </div>
          )}
          {viewMode==='unified' && (
            <div style={{ padding:'7px 14px', borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.2)', display:'flex', gap:16, fontSize:10, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase' }}>
              <span style={{ color:'#dc2626' }}>─ Removed</span>
              <span style={{ color:'#16a34a' }}>+ Added</span>
              <span style={{ color:'var(--text-muted)' }}>  Unchanged</span>
              <span style={{ flex:1 }}/>
              <span style={{ color:'var(--text-muted)' }}>{diff.lines.length} lines</span>
            </div>
          )}

          {/* Lines */}
          <div style={{ maxHeight:560, overflowY:'auto', overflowX:'auto' }}>
            {diff.lines.map((line, i) => renderRow(line, i))}
          </div>
        </div>
      )}

      {/* No diff / identical */}
      {diff && diff.lines.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'40px 20px', borderRadius:12, border:'1px solid rgba(22,163,74,0.3)', background:'rgba(22,163,74,0.04)', textAlign:'center' }}>
          <div style={{ fontSize:28 }}>✓</div>
          <div style={{ fontSize:15, fontWeight:600, color:'#16a34a' }}>
            {search ? 'No matches found in diff' : 'Texts are identical'}
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>
            {search ? `Try a different search term` : 'No differences detected between A and B'}
          </div>
        </div>
      )}

      <style>{`
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
      `}</style>
    </div>
  );
}

const IN  = { width:'100%', padding:'8px 12px', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text,#f0f0f5)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
const AB  = { display:'flex', alignItems:'center', padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' };
const IB  = { display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)', color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s' };