import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Download, FileText, X, RefreshCw, Plus, Search,
  Hash, Trash2, ChevronRight, ChevronDown, ChevronUp,
  GripVertical, RotateCcw, Shuffle, Calendar, Type,
  ArrowUpDown, Check, AlertCircle, Package,
} from 'lucide-react';
import JSZip from 'jszip';

/* ── helpers ─────────────────────────────────────────────── */
function fmtBytes(b) {
  if (!b) return '—';
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${['B','KB','MB','GB'][i]}`;
}
function uid() { return Math.random().toString(36).slice(2, 9); }

function useWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

function Collapsible({ title, icon: Icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', background:'var(--surface-raised,#18181f)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'11px 14px', background:'transparent', border:'none', cursor:'pointer' }}>
        {Icon && <Icon size={12} style={{ color:'var(--text-muted)', flexShrink:0 }}/>}
        <span style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'left' }}>{title}</span>
        {open ? <ChevronUp size={13} style={{ color:'var(--text-muted)' }}/> : <ChevronDown size={13} style={{ color:'var(--text-muted)' }}/>}
      </button>
      {open && <div style={{ padding:'0 14px 14px' }}>{children}</div>}
    </div>
  );
}

/* ── case options ─────────────────────────────────────────── */
const CASE_OPTIONS = [
  { id:'original', label:'Original' },
  { id:'lower',    label:'lowercase' },
  { id:'upper',    label:'UPPERCASE' },
  { id:'title',    label:'Title Case' },
  { id:'camel',    label:'camelCase' },
  { id:'snake',    label:'snake_case' },
  { id:'kebab',    label:'kebab-case' },
];

const EXT_OPTIONS = ['original','.jpg','.jpeg','.png','.webp','.gif','.bmp','.avif'];

/* ── sort modes ───────────────────────────────────────────── */
const SORT_MODES = [
  { id:'none',    label:'Manual Order' },
  { id:'alpha',   label:'A → Z' },
  { id:'zalpha',  label:'Z → A' },
  { id:'size',    label:'Smallest First' },
  { id:'zsize',   label:'Largest First' },
];

/* ── apply case ───────────────────────────────────────────── */
function applyCase(name, mode) {
  if (mode==='lower')  return name.toLowerCase();
  if (mode==='upper')  return name.toUpperCase();
  if (mode==='title')  return name.replace(/\b\w/g, c=>c.toUpperCase());
  if (mode==='camel') {
    return name.replace(/[-_\s]+(.)/g,(_,c)=>c.toUpperCase())
               .replace(/^(.)/, c=>c.toLowerCase());
  }
  if (mode==='snake')  return name.replace(/[-\s]+/g,'_').replace(/([A-Z])/g,'_$1').replace(/^_/,'').toLowerCase();
  if (mode==='kebab')  return name.replace(/[_\s]+/g,'-').replace(/([A-Z])/g,'-$1').replace(/^-/,'').toLowerCase();
  return name;
}

/* ── token expansion ──────────────────────────────────────── */
function expandTokens(str, index, file, startNum, padding) {
  const now   = new Date();
  const pad   = (n,l=2)=>String(n).padStart(l,'0');
  const num   = String(startNum + index).padStart(padding,'0');
  return str
    .replace(/{n}/gi,   num)
    .replace(/{name}/gi, file.originalName)
    .replace(/{ext}/gi,  file.ext.replace('.',''))
    .replace(/{date}/gi, `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`)
    .replace(/{year}/gi, String(now.getFullYear()))
    .replace(/{month}/gi,pad(now.getMonth()+1))
    .replace(/{day}/gi,  pad(now.getDate()))
    .replace(/{size}/gi, fmtBytes(file.size).replace(/\s/,''));
}

/* ── Sidebar (top-level so it never remounts on parent re-render) ─ */
function SidebarContent({
  prefix, setPrefix, suffix, setSuffix,
  search, setSearch, replace, setReplace,
  regexMode, setRegexMode, caseSens, setCaseSens, regexError, setRegexError,
  caseFormat, setCaseFormat, extMode, setExtMode,
  useNumbering, setUseNumbering, startNum, setStartNum, padding, setPadding, numPos, setNumPos,
  applySort, shuffle,
  handleRename, undo, clearAll,
  isProcessing, done, hasDupes, filesLen, historyLen,
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* Prefix / Suffix */}
      <Collapsible title="Prefix & Suffix" icon={Type}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div>
            <div style={LS}>Prefix</div>
            <input type="text" value={prefix} onChange={e=>setPrefix(e.target.value)} placeholder='e.g. v1_ or {date}_'
              style={IN}/>
          </div>
          <div>
            <div style={LS}>Suffix</div>
            <input type="text" value={suffix} onChange={e=>setSuffix(e.target.value)} placeholder='e.g. _final or _{n}'
              style={IN}/>
          </div>
          {/* Token reference */}
          <div style={{ padding:'8px 10px', borderRadius:8, background:'var(--surface,#111118)', border:'1px solid var(--border)' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:5 }}>Available Tokens</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {['{n}','  {name}','{ext}','{date}','{year}','{month}','{day}','{size}'].map(t=>(
                <span key={t} style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:'rgba(37,99,235,0.12)', color:'var(--accent-blue,#2563EB)', fontFamily:'monospace', fontWeight:700 }}>{t.trim()}</span>
              ))}
            </div>
          </div>
        </div>
      </Collapsible>

      {/* Search & Replace */}
      <Collapsible title="Search & Replace" icon={Search}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* Regex toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={()=>setRegexMode(v=>!v)}
              style={{ padding:'4px 10px', borderRadius:7, cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'monospace', border:'none', transition:'all 0.15s',
                outline:`1px solid ${regexMode?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:regexMode?'rgba(37,99,235,0.12)':'transparent',
                color:regexMode?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
              .* Regex
            </button>
            <button onClick={()=>setCaseSens(v=>!v)}
              style={{ padding:'4px 10px', borderRadius:7, cursor:'pointer', fontSize:10, fontWeight:700, border:'none', transition:'all 0.15s',
                outline:`1px solid ${caseSens?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:caseSens?'rgba(37,99,235,0.12)':'transparent',
                color:caseSens?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
              Aa Case
            </button>
          </div>
          <div>
            <div style={LS}>Find</div>
            <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setRegexError('');}} placeholder={regexMode?'RegEx pattern…':'IMG_'}
              style={{ ...IN, borderColor:regexError?'rgba(239,68,68,0.5)':'var(--border)' }}/>
            {regexError && <div style={{ fontSize:10, color:'#ef4444', marginTop:4, lineHeight:1.4 }}>⚠ {regexError}</div>}
          </div>
          <div>
            <div style={LS}>Replace with</div>
            <input type="text" value={replace} onChange={e=>setReplace(e.target.value)} placeholder='Photo_  (supports $1 for groups)'
              style={IN}/>
          </div>
        </div>
      </Collapsible>

      {/* Case format */}
      <Collapsible title="Case Format" icon={Type} defaultOpen={false}>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {CASE_OPTIONS.map(opt=>(
            <button key={opt.id} onClick={()=>setCaseFormat(opt.id)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'pointer', border:'none', transition:'all 0.15s', textAlign:'left',
                outline:`1px solid ${caseFormat===opt.id?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:caseFormat===opt.id?'rgba(37,99,235,0.08)':'var(--surface,#111118)' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:caseFormat===opt.id?'var(--accent-blue,#2563EB)':'var(--border)', flexShrink:0 }}/>
              <span style={{ fontSize:12, fontWeight:600, color:caseFormat===opt.id?'var(--accent-blue,#2563EB)':'var(--text-muted)', fontFamily:'monospace' }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </Collapsible>

      {/* Extension */}
      <Collapsible title="Change Extension" icon={FileText} defaultOpen={false}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {EXT_OPTIONS.map(ext=>(
            <button key={ext} onClick={()=>setExtMode(ext)}
              style={{ padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'monospace', border:'none', transition:'all 0.15s',
                outline:`1px solid ${extMode===ext?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:extMode===ext?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                color:extMode===ext?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
              {ext==='original'?'Original':ext}
            </button>
          ))}
        </div>
        {extMode!=='original'&&(
          <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.25)', fontSize:11, color:'#f59e0b', lineHeight:1.5 }}>
            ⚠ Changing extension doesn't convert file format — only renames it.
          </div>
        )}
      </Collapsible>

      {/* Numbering */}
      <Collapsible title="Numbering" icon={Hash} defaultOpen={false}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>Enable Auto-Number</span>
          <button onClick={()=>setUseNumbering(v=>!v)}
            style={{ width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', transition:'all 0.2s', position:'relative', background:useNumbering?'var(--accent-blue,#2563EB)':'var(--border)' }}>
            <div style={{ position:'absolute', top:3, left:useNumbering?17:3, width:14, height:14, borderRadius:'50%', background:'white', transition:'all 0.2s' }}/>
          </button>
        </div>
        {useNumbering && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div>
                <div style={LS}>Start At</div>
                <input type="number" min={0} value={startNum} onChange={e=>setStartNum(Number(e.target.value))} style={{ ...IN, fontFamily:'monospace', textAlign:'center' }}/>
              </div>
              <div>
                <div style={LS}>Zero-Pad</div>
                <select value={padding} onChange={e=>setPadding(Number(e.target.value))} style={{ ...IN, cursor:'pointer' }}>
                  <option value={1}>1  →  1, 2, 10</option>
                  <option value={2}>2  →  01, 02</option>
                  <option value={3}>3  →  001, 002</option>
                  <option value={4}>4  →  0001, 0002</option>
                </select>
              </div>
            </div>
            <div>
              <div style={LS}>Position</div>
              <div style={{ display:'flex', gap:5 }}>
                {[{v:'before',l:'Before name'},{v:'after',l:'After name'}].map(p=>(
                  <button key={p.v} onClick={()=>setNumPos(p.v)}
                    style={{ flex:1, padding:'7px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:600, border:'none', transition:'all 0.15s',
                      outline:`1px solid ${numPos===p.v?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                      background:numPos===p.v?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                      color:numPos===p.v?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding:'7px 10px', borderRadius:8, background:'var(--surface,#111118)', border:'1px solid var(--border)', fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>
              Preview: {numPos==='before'?`${prefix||''}${'0'.repeat(padding-1)}${startNum}_name${suffix||''}.ext`:`${prefix||''}name_${'0'.repeat(padding-1)}${startNum}${suffix||''}.ext`}
            </div>
          </div>
        )}
      </Collapsible>

      {/* Sort */}
      <Collapsible title="Sort Order" icon={ArrowUpDown} defaultOpen={false}>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {SORT_MODES.map(s=>(
            <button key={s.id} onClick={()=>applySort(s.id)} disabled={s.id==='none'}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:s.id==='none'?'default':'pointer', border:'none', transition:'all 0.15s',
                background:'var(--surface,#111118)', outline:'1px solid var(--border)',
                color:s.id==='none'?'var(--text-muted)':'var(--text)', opacity:s.id==='none'?0.5:1 }}>
              <ArrowUpDown size={11} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
              <span style={{ fontSize:12, fontWeight:600 }}>{s.label}</span>
            </button>
          ))}
          <button onClick={shuffle}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'pointer', border:'none', transition:'all 0.15s',
              background:'var(--surface,#111118)', outline:'1px solid var(--border)', color:'var(--text)' }}>
            <Shuffle size={11} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
            <span style={{ fontSize:12, fontWeight:600 }}>Shuffle Random</span>
          </button>
        </div>
      </Collapsible>

      {/* Actions */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
        <button onClick={handleRename} disabled={isProcessing||!filesLen||hasDupes}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none',
            background: filesLen&&!hasDupes&&!isProcessing ? 'var(--accent-blue,#2563EB)' : 'var(--surface-raised,#18181f)',
            color: filesLen&&!hasDupes&&!isProcessing ? 'white' : 'var(--text-muted)',
            fontSize:14, fontWeight:600, cursor: filesLen&&!hasDupes&&!isProcessing ? 'pointer' : 'not-allowed',
            boxShadow: filesLen&&!hasDupes&&!isProcessing ? '0 4px 16px rgba(37,99,235,0.3)' : 'none', transition:'all 0.15s' }}
          onMouseEnter={e=>{ if(filesLen&&!hasDupes&&!isProcessing) e.currentTarget.style.transform='translateY(-1px)'; }}
          onMouseLeave={e=>e.currentTarget.style.transform='none'}>
          {isProcessing
            ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Creating ZIP…</>
            : done
            ? <><Check size={15}/> Download Again</>
            : <><Package size={15}/> Rename & Download ZIP</>}
        </button>

        {hasDupes && (
          <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'9px 12px', borderRadius:9, background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.25)' }}>
            <AlertCircle size={13} style={{ color:'#ef4444', flexShrink:0, marginTop:1 }}/>
            <div style={{ fontSize:11, color:'#ef4444', lineHeight:1.5 }}>Duplicate filenames detected. Adjust your settings to continue.</div>
          </div>
        )}

        <div style={{ display:'flex', gap:6 }}>
          <button onClick={undo} disabled={!historyLen}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, fontWeight:600, cursor:historyLen?'pointer':'not-allowed', opacity:historyLen?1:0.4 }}>
            <RotateCcw size={12}/> Undo
          </button>
          <button onClick={clearAll}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9, border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.05)', color:'#ef4444', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <Trash2 size={12}/> Clear All
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════ */
export default function BulkRename() {
  const vw        = useWidth();
  const isMobile  = vw < 640;
  const isDesktop = vw >= 1024;

  const [files,       setFiles]       = useState([]);
  const [drag,        setDrag]        = useState(false);
  const [isProcessing,setIsProcessing]= useState(false);
  const [done,        setDone]        = useState(false);

  // Rename settings
  const [prefix,      setPrefix]      = useState('');
  const [suffix,      setSuffix]      = useState('');
  const [search,      setSearch]      = useState('');
  const [replace,     setReplace]     = useState('');
  const [regexMode,   setRegexMode]   = useState(false);
  const [caseSens,    setCaseSens]    = useState(false);
  const [caseFormat,  setCaseFormat]  = useState('original');
  const [extMode,     setExtMode]     = useState('original');
  const [useNumbering,setUseNumbering]= useState(false);
  const [startNum,    setStartNum]    = useState(1);
  const [padding,     setPadding]     = useState(1);
  const [numPos,      setNumPos]      = useState('after');  // before | after
  const [sortMode,    setSortMode]    = useState('none');
  const [regexError,  setRegexError]  = useState('');

  // Undo stack
  const [history,     setHistory]     = useState([]);

  // Drag-reorder state
  const dragItem    = useRef(null);
  const dragOverItem= useRef(null);

  /* ── sorted display list ────────────────────────────────── */
  const displayFiles = useCallback(() => {
    const arr = [...files];
    if      (sortMode==='alpha')  arr.sort((a,b)=>a.originalName.localeCompare(b.originalName));
    else if (sortMode==='zalpha') arr.sort((a,b)=>b.originalName.localeCompare(a.originalName));
    else if (sortMode==='size')   arr.sort((a,b)=>a.size-b.size);
    else if (sortMode==='zsize')  arr.sort((a,b)=>b.size-a.size);
    return arr;
  }, [files, sortMode]);

  /* ── new name logic ─────────────────────────────────────── */
  const getNewName = useCallback((f, index) => {
    let name = f.originalName;

    // 1. Search & Replace
    if (search) {
      try {
        if (regexMode) {
          const flags = caseSens ? 'g' : 'gi';
          name = name.replace(new RegExp(search, flags), replace);
          setRegexError('');
        } else {
          const flags = caseSens ? 'g' : 'gi';
          name = name.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), flags), replace);
        }
      } catch(e) { setRegexError(e.message); }
    }

    // 2. Case
    name = applyCase(name, caseFormat);

    // 3. Expand tokens in prefix/suffix
    const expandedPrefix = expandTokens(prefix, index, f, startNum, padding);
    const expandedSuffix = expandTokens(suffix, index, f, startNum, padding);

    // 4. Numbering
    let num = '';
    if (useNumbering) num = String(startNum + index).padStart(padding,'0');

    // 5. Assemble
    if (useNumbering && numPos==='before') {
      name = `${expandedPrefix}${num}_${name}${expandedSuffix}`;
    } else if (useNumbering && numPos==='after') {
      name = `${expandedPrefix}${name}_${num}${expandedSuffix}`;
    } else {
      name = `${expandedPrefix}${name}${expandedSuffix}`;
    }

    // 6. Extension
    const ext = extMode==='original' ? f.ext : extMode;
    return name + ext;
  }, [prefix, suffix, search, replace, caseFormat, useNumbering, startNum, padding, numPos, regexMode, caseSens, extMode]);

  /* ── ingest ──────────────────────────────────────────────── */
  const ingest = (incoming) => {
    const newFiles = Array.from(incoming).map(f => {
      const lastDot = f.name.lastIndexOf('.');
      return {
        file: f, id: uid(),
        originalName: lastDot!==-1 ? f.name.slice(0, lastDot) : f.name,
        ext:          lastDot!==-1 ? f.name.slice(lastDot) : '',
        size: f.size,
      };
    });
    saveHistory();
    setFiles(prev => [...prev, ...newFiles]);
    setDone(false);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files) ingest(e.dataTransfer.files);
  };

  /* ── undo ────────────────────────────────────────────────── */
  const saveHistory = () => setHistory(h => [...h.slice(-19), [...files]]);
  const undo = () => {
    if (!history.length) return;
    setFiles(history[history.length-1]);
    setHistory(h => h.slice(0,-1));
  };

  /* ── drag-to-reorder ─────────────────────────────────────── */
  const onDragStart = (e, idx) => { dragItem.current = idx; };
  const onDragEnter = (e, idx) => { dragOverItem.current = idx; };
  const onDragEnd   = () => {
    if (dragItem.current===null || dragOverItem.current===null) return;
    saveHistory();
    const arr = [...files];
    const [moved] = arr.splice(dragItem.current, 1);
    arr.splice(dragOverItem.current, 0, moved);
    setFiles(arr);
    dragItem.current = null; dragOverItem.current = null;
    setSortMode('none');
  };

  /* ── sort ────────────────────────────────────────────────── */
  const applySort = (mode) => {
    if (mode==='none') return;
    saveHistory();
    setSortMode(mode);
    // Physically reorder files array to match
    setFiles(displayFiles());
    setSortMode('none');
  };

  /* ── shuffle ─────────────────────────────────────────────── */
  const shuffle = () => {
    saveHistory();
    setFiles(arr => {
      const a = [...arr];
      for (let i=a.length-1;i>0;i--) {
        const j=Math.floor(Math.random()*(i+1));
        [a[i],a[j]]=[a[j],a[i]];
      }
      return a;
    });
  };

  /* ── remove / clear ──────────────────────────────────────── */
  const removeFile = (id) => { saveHistory(); setFiles(p=>p.filter(f=>f.id!==id)); };
  const clearAll   = () => {
    saveHistory();
    setFiles([]); setPrefix(''); setSuffix(''); setSearch(''); setReplace('');
    setCaseFormat('original'); setUseNumbering(false); setDone(false);
  };

  /* ── duplicate detection ─────────────────────────────────── */
  const df = displayFiles();
  const newNames = df.map((f,i)=>getNewName(f,i));
  const dupeSet  = new Set(newNames.filter((n,i)=>newNames.indexOf(n)!==i));

  /* ── process ─────────────────────────────────────────────── */
  const handleRename = async () => {
    if (!files.length) return;
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      df.forEach((f,i) => zip.file(getNewName(f,i), f.file));
      const content = await zip.generateAsync({ type:'blob', compression:'STORE' });
      const url = URL.createObjectURL(content);
      const a   = document.createElement('a');
      a.href=url; a.download='renamed_files.zip';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setDone(true);
    } catch(e) { console.error(e); }
    setIsProcessing(false);
  };

  const hasDupes = dupeSet.size > 0;

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ══ DROP ZONE ══ */}
      <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
        style={{ display:'flex', alignItems:'center', gap:14,
          padding: isMobile ? '16px' : files.length ? '14px 20px' : '36px 40px',
          flexDirection: files.length && !isMobile ? 'row' : 'column',
          border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:14,
          background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.2s',
          justifyContent: files.length&&!isMobile?'flex-start':'center' }}>
        <input type="file" multiple style={{display:'none'}} onChange={e=>ingest(e.target.files)}/>
        <div style={{ width:48, height:48, borderRadius:14, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)', transition:'all 0.2s' }}>
          <Plus size={22} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
        </div>
        <div style={{ textAlign: files.length&&!isMobile ? 'left':'center' }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>
            {files.length ? `${files.length} file${files.length!==1?'s':''} loaded · Drop more to add` : 'Drop files here to rename'}
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>
            {files.length ? 'Any file type accepted' : 'or click to browse · Any file type · All processing is local'}
          </div>
        </div>
      </label>

      {/* ══ MAIN LAYOUT ══ */}
      {files.length > 0 && (
        <div style={{ display:isDesktop?'grid':'flex', gridTemplateColumns:'1fr 290px', flexDirection:'column', gap:14, alignItems:'start' }}>

          {/* ── FILE TABLE ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', flex:1 }}>
                {files.length} file{files.length!==1?'s':''} · Drag rows to reorder
              </span>
              {hasDupes && <span style={{ fontSize:10, color:'#ef4444', fontWeight:700 }}>⚠ Duplicates</span>}
              {done      && <span style={{ fontSize:10, color:'#16a34a', fontWeight:700 }}>✓ Downloaded</span>}
              <button onClick={undo} disabled={!history.length} title="Undo last change"
                style={{ ...IB, opacity:history.length?1:0.35 }}><RotateCcw size={13}/></button>
              <button onClick={clearAll} title="Clear all" style={{ ...IB, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.05)' }}><Trash2 size={13}/></button>
            </div>

            {/* Table */}
            <div style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', background:'var(--surface-raised,#18181f)' }}>
              {/* Header */}
              <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 24px 1fr 28px', padding:'8px 12px', borderBottom:'1px solid var(--border)',
                background:'rgba(0,0,0,0.2)', gap:8 }}>
                {['','Original Name','','New Name',''].map((h,i)=>(
                  <div key={i} style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              <div style={{ maxHeight: isMobile?320:520, overflowY:'auto' }}>
                {df.map((f, i) => {
                  const newName = getNewName(f, i);
                  const isDupe  = dupeSet.has(newName);
                  const changed = newName !== (f.originalName + f.ext);
                  return (
                    <div key={f.id}
                      draggable
                      onDragStart={e=>onDragStart(e,i)}
                      onDragEnter={e=>onDragEnter(e,i)}
                      onDragEnd={onDragEnd}
                      onDragOver={e=>e.preventDefault()}
                      style={{ display:'grid', gridTemplateColumns:'32px 1fr 24px 1fr 28px', gap:8, padding:'9px 12px', alignItems:'center',
                        borderBottom:'1px solid rgba(255,255,255,0.04)',
                        background: isDupe ? 'rgba(239,68,68,0.05)' : 'transparent',
                        transition:'background 0.15s', cursor:'grab' }}>

                      {/* Grip */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'var(--border)', cursor:'grab' }}>
                        <GripVertical size={14}/>
                      </div>

                      {/* Original name */}
                      <div style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {f.originalName}{f.ext}
                        <div style={{ fontSize:9, color:'var(--border)', marginTop:1 }}>{fmtBytes(f.size)}</div>
                      </div>

                      {/* Arrow */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <ChevronRight size={12} style={{ color: changed ? 'var(--accent-blue,#2563EB)' : 'var(--border)' }}/>
                      </div>

                      {/* New name */}
                      <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        color: isDupe ? '#ef4444' : changed ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)' }}>
                        {newName}
                        {isDupe && <div style={{ fontSize:9, color:'#ef4444', marginTop:1 }}>Duplicate filename</div>}
                        {!isDupe && changed && <div style={{ fontSize:9, color:'var(--accent-blue,#2563EB)', marginTop:1 }}>Renamed</div>}
                        {!isDupe && !changed && <div style={{ fontSize:9, color:'var(--border)', marginTop:1 }}>Unchanged</div>}
                      </div>

                      {/* Remove */}
                      <button onClick={()=>removeFile(f.id)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'center', width:22, height:22, borderRadius:6, border:'none', background:'transparent', color:'rgba(239,68,68,0.4)', cursor:'pointer', transition:'all 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.color='#ef4444'}
                        onMouseLeave={e=>e.currentTarget.style.color='rgba(239,68,68,0.4)'}>
                        <X size={12}/>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Footer stats */}
              <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:16, background:'rgba(0,0,0,0.15)', flexWrap:'wrap' }}>
                {[
                  { l:'Total',    v:files.length                              },
                  { l:'Renamed',  v:df.filter((_,i)=>getNewName(df[i],i)!==(df[i].originalName+df[i].ext)).length, c:'var(--accent-blue,#2563EB)' },
                  { l:'Unchanged',v:df.filter((_,i)=>getNewName(df[i],i)===(df[i].originalName+df[i].ext)).length  },
                  { l:'Dupes',    v:dupeSet.size, c:dupeSet.size?'#ef4444':undefined                              },
                ].map(({l,v,c})=>(
                  <div key={l}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:13, fontWeight:800, color:c||'var(--text)', fontFamily:'monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile sidebar */}
            {!isDesktop && (
              <div style={{ marginTop:4 }}>
                <SidebarContent prefix={prefix} setPrefix={setPrefix} suffix={suffix} setSuffix={setSuffix}
            search={search} setSearch={setSearch} replace={replace} setReplace={setReplace}
            regexMode={regexMode} setRegexMode={setRegexMode} caseSens={caseSens} setCaseSens={setCaseSens}
            regexError={regexError} setRegexError={setRegexError}
            caseFormat={caseFormat} setCaseFormat={setCaseFormat}
            extMode={extMode} setExtMode={setExtMode}
            useNumbering={useNumbering} setUseNumbering={setUseNumbering}
            startNum={startNum} setStartNum={setStartNum}
            padding={padding} setPadding={setPadding}
            numPos={numPos} setNumPos={setNumPos}
            applySort={applySort} shuffle={shuffle}
            handleRename={handleRename} undo={undo} clearAll={clearAll}
            isProcessing={isProcessing} done={done} hasDupes={hasDupes}
            filesLen={files.length} historyLen={history.length}/>
              </div>
            )}
          </div>

          {/* Desktop sidebar */}
          {isDesktop && <SidebarContent prefix={prefix} setPrefix={setPrefix} suffix={suffix} setSuffix={setSuffix}
            search={search} setSearch={setSearch} replace={replace} setReplace={setReplace}
            regexMode={regexMode} setRegexMode={setRegexMode} caseSens={caseSens} setCaseSens={setCaseSens}
            regexError={regexError} setRegexError={setRegexError}
            caseFormat={caseFormat} setCaseFormat={setCaseFormat}
            extMode={extMode} setExtMode={setExtMode}
            useNumbering={useNumbering} setUseNumbering={setUseNumbering}
            startNum={startNum} setStartNum={setStartNum}
            padding={padding} setPadding={setPadding}
            numPos={numPos} setNumPos={setNumPos}
            applySort={applySort} shuffle={shuffle}
            handleRename={handleRename} undo={undo} clearAll={clearAll}
            isProcessing={isProcessing} done={done} hasDupes={hasDupes}
            filesLen={files.length} historyLen={history.length}/>}
        </div>
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

const IN = { width:'100%', padding:'9px 12px', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text,#f0f0f5)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
const LS = { fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:5, display:'block' };
const IB = { display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:7, flexShrink:0, border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)', color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s' };