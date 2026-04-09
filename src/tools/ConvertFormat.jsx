import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, Download, AlertCircle, X, Zap, Trash2,
  ArrowRight, Plus, RotateCcw, Eye, ChevronLeft,
  ChevronRight, Package, Image as ImageIcon,
  ChevronDown, ChevronUp, Info, Check,
} from 'lucide-react';
import JSZip from 'jszip';

/* ── helpers ─────────────────────────────────────────────── */
function fmtBytes(b) {
  if (!b) return '—';
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${['B','KB','MB','GB'][i]}`;
}
function uid() { return Math.random().toString(36).slice(2, 11); }
function pct(a, b) { if (!a || !b) return 0; return Math.round((1 - b/a) * 100); }

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
function Collapsible({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', background:'var(--surface-raised,#18181f)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'transparent', border:'none', cursor:'pointer' }}>
        <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase' }}>{title}</span>
        {open ? <ChevronUp size={13} style={{ color:'var(--text-muted)' }}/> : <ChevronDown size={13} style={{ color:'var(--text-muted)' }}/>}
      </button>
      {open && <div style={{ padding:'0 14px 14px' }}>{children}</div>}
    </div>
  );
}

/* ── drag-to-compare slider ─────────────────────────────── */
function CompareSlider({ beforeUrl, afterUrl, style }) {
  const [pos, setPos] = useState(50);
  const sliderRef = useRef(null);
  const dragging  = useRef(false);

  const move = (e) => {
    if (!dragging.current || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x    = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    setPos(Math.min(100, Math.max(0, (x / rect.width) * 100)));
  };
  const stop = () => { dragging.current = false; };

  return (
    <div ref={sliderRef}
      style={{ position:'relative', overflow:'hidden', cursor:'col-resize', userSelect:'none', ...style }}
      onMouseDown={()=>{ dragging.current=true; }}
      onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
      onTouchStart={()=>{ dragging.current=true; }}
      onTouchMove={move} onTouchEnd={stop}>

      {/* After (full) */}
      <img src={afterUrl} alt="after" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block', background:'#111' }}/>

      {/* Before (clipped) */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden', width:`${pos}%` }}>
        <img src={beforeUrl} alt="before" style={{ width:`${10000/pos}%`, height:'100%', objectFit:'contain', display:'block', background:'#0a0a0f' }}/>
      </div>

      {/* Divider line */}
      <div style={{ position:'absolute', top:0, bottom:0, left:`${pos}%`, width:2, background:'white', transform:'translateX(-50%)', boxShadow:'0 0 8px rgba(0,0,0,0.6)' }}>
        {/* Handle */}
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:32, height:32, borderRadius:'50%', background:'white', boxShadow:'0 2px 12px rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:2 }}>
          <ChevronLeft size={11} style={{ color:'#333' }}/><ChevronRight size={11} style={{ color:'#333' }}/>
        </div>
      </div>

      {/* Labels */}
      <div style={{ position:'absolute', top:8, left:8, padding:'3px 8px', borderRadius:100, background:'rgba(0,0,0,0.6)', color:'white', fontSize:9, fontWeight:700 }}>BEFORE</div>
      <div style={{ position:'absolute', top:8, right:8, padding:'3px 8px', borderRadius:100, background:'rgba(22,163,74,0.8)', color:'white', fontSize:9, fontWeight:700 }}>AFTER</div>
    </div>
  );
}

/* ── format definitions ─────────────────────────────────── */
const FORMATS = [
  { value:'webp', label:'WebP', mime:'image/webp', ext:'webp', color:'#2563eb',
    badge:'MODERN', desc:'Best ratio for web. 25–35% smaller than JPEG at same quality. Supports transparency & animation.',
    pros:['Smaller than JPEG/PNG','Supports transparency','Widely supported'], hasQuality:true },
  { value:'jpeg', label:'JPEG', mime:'image/jpeg', ext:'jpg',  color:'#d97706',
    badge:'POPULAR', desc:'Universal compatibility. Great for photos. No transparency support.',
    pros:['Universal support','Great for photos','Adjustable quality'], hasQuality:true },
  { value:'png',  label:'PNG',  mime:'image/png',  ext:'png',  color:'#7c3aed',
    badge:'LOSSLESS', desc:'Perfect for logos, screenshots, graphics with text. Lossless compression.',
    pros:['Lossless quality','Transparency support','Great for graphics'], hasQuality:false },
  { value:'avif', label:'AVIF', mime:'image/avif', ext:'avif', color:'#059669',
    badge:'NEXT-GEN', desc:'Next-generation format. Up to 50% smaller than JPEG. Limited browser support.',
    pros:['Smallest file size','HDR support','Modern compression'], hasQuality:true },
  { value:'bmp',  label:'BMP',  mime:'image/bmp',  ext:'bmp',  color:'#6b7280',
    badge:'LEGACY', desc:'Uncompressed bitmap. Maximum compatibility with old software.',
    pros:['Universal legacy support','No quality loss'], hasQuality:false },
];

const QUALITY_PRESETS = [
  { label:'Low',  value:50  },
  { label:'Med',  value:75  },
  { label:'High', value:90  },
  { label:'Max',  value:99  },
];

/* ── convert on canvas ───────────────────────────────────── */
function doConvert(item, targetFmt, quality) {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (targetFmt.value === 'jpeg') { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); }
      ctx.drawImage(img, 0, 0);
      const q = targetFmt.hasQuality ? quality/100 : undefined;
      canvas.toBlob(blob => {
        if (!blob) { resolve(null); return; }
        resolve({ blob, url:URL.createObjectURL(blob), size:blob.size, ext:targetFmt.ext });
      }, targetFmt.mime, q);
    };
    img.onerror = () => resolve(null);
    img.src = item.origUrl;
  });
}

/* ════════════════════════════════════════════════════════ */
export default function ConvertFormat() {
  const vw        = useWidth();
  const isMobile  = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage, setStage]     = useState('idle');
  const [items, setItems]     = useState([]);
  const [drag, setDrag]       = useState(false);
  const [error, setError]     = useState('');

  const [targetFmt, setTargetFmt] = useState('webp');
  const [quality, setQuality]     = useState(90);
  const [prefix, setPrefix]       = useState('');
  const [suffix, setSuffix]       = useState('');
  const [showFmtInfo, setShowFmtInfo] = useState(false);

  const [lightbox, setLightbox] = useState(null);
  const addMoreRef = useRef(null);

  const fmt = FORMATS.find(f => f.value===targetFmt);

  /* ── ingest ──────────────────────────────────────────────── */
  const ingest = useCallback((files) => {
    const valid = ['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/avif'];
    const next  = Array.from(files)
      .filter(f => valid.includes(f.type) || f.name.match(/\.(jpe?g|png|webp|gif|bmp|avif)$/i))
      .map(f => ({
        id: uid(), file: f, name: f.name,
        type: f.type || 'image/jpeg',
        origSize: f.size,
        origUrl:  URL.createObjectURL(f),
        status:   'pending',
        newSize:  null, blob: null, compUrl: null, outExt: null,
      }));
    if (!next.length) { setError('Upload valid image files (JPG, PNG, WebP, GIF, BMP, AVIF).'); return; }
    setError('');
    setItems(prev => [...prev, ...next]);
    if (stage==='idle') setStage('ready');
  }, [stage]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, [ingest]);

  /* ── process all ─────────────────────────────────────────── */
  const processAll = async () => {
    const pending = items.filter(i => i.status==='pending');
    if (!pending.length) return;
    setStage('processing');
    const fmtObj = FORMATS.find(f => f.value===targetFmt);
    for (const item of pending) {
      setItems(prev => prev.map(i => i.id===item.id ? {...i, status:'processing'} : i));
      const res = await doConvert(item, fmtObj, quality);
      if (res) {
        setItems(prev => prev.map(i => i.id===item.id ? {...i, status:'done', blob:res.blob, compUrl:res.url, newSize:res.size, outExt:res.ext} : i));
      } else {
        setItems(prev => prev.map(i => i.id===item.id ? {...i, status:'error'} : i));
      }
    }
    setStage('done');
  };

  /* ── download ────────────────────────────────────────────── */
  const dlOne = (item) => {
    const a    = document.createElement('a');
    const base = item.name.replace(/\.[^/.]+$/, '');
    const name = `${prefix}${base}${suffix}.${item.outExt}`;
    a.href = item.compUrl; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const dlAll = async () => {
    const done = items.filter(i => i.status==='done');
    if (done.length===1) { dlOne(done[0]); return; }
    const zip = new JSZip();
    done.forEach(i => {
      const base = i.name.replace(/\.[^/.]+$/, '');
      zip.file(`${prefix}${base}${suffix}.${i.outExt}`, i.blob);
    });
    const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6} });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download='converted_images.zip';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const removeItem = (id) => {
    const item = items.find(i=>i.id===id);
    if (item?.origUrl) URL.revokeObjectURL(item.origUrl);
    if (item?.compUrl) URL.revokeObjectURL(item.compUrl);
    const next = items.filter(i=>i.id!==id);
    setItems(next);
    if (!next.length) setStage('idle');
  };

  const reset = () => {
    items.forEach(i=>{ URL.revokeObjectURL(i.origUrl); if(i.compUrl) URL.revokeObjectURL(i.compUrl); });
    setItems([]); setStage('idle'); setError(''); setPrefix(''); setSuffix('');
  };

  const doneItems    = items.filter(i=>i.status==='done');
  const pendingItems = items.filter(i=>i.status==='pending');
  const lbItem       = lightbox ? items.find(i=>i.id===lightbox) : null;
  const lbIdx        = lightbox ? items.findIndex(i=>i.id===lightbox) : -1;

  /* ── settings panel ──────────────────────────────────────── */
  const SettingsPanel = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* Format cards */}
      <Collapsible title="Target Format">
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {FORMATS.map(f => (
            <button key={f.value} onClick={()=>{ setTargetFmt(f.value); setShowFmtInfo(false); }}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 11px', borderRadius:9, cursor:'pointer', border:'none', transition:'all 0.15s', textAlign:'left',
                outline:`1px solid ${targetFmt===f.value?f.color:'var(--border)'}`,
                background:targetFmt===f.value?`${f.color}12`:'var(--surface,#111118)' }}>
              {/* Format badge */}
              <div style={{ width:38, height:22, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                background:targetFmt===f.value?f.color:'var(--border)' }}>
                <span style={{ fontSize:9, fontWeight:800, color:'white', fontFamily:'monospace' }}>{f.label}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:targetFmt===f.value?f.color:'var(--text)', marginBottom:1 }}>{f.label}</div>
                <div style={{ fontSize:9, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.badge} · {f.desc.split('.')[0]}</div>
              </div>
              {targetFmt===f.value && <Check size={14} style={{ color:f.color, flexShrink:0 }}/>}
            </button>
          ))}
        </div>

        {/* Format info */}
        {fmt && (
          <div style={{ marginTop:10, padding:'10px 12px', borderRadius:9, background:`${fmt.color}0d`, border:`1px solid ${fmt.color}30` }}>
            <div style={{ fontSize:11, color:fmt.color, fontWeight:700, marginBottom:4 }}>{fmt.label} · {fmt.badge}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.6, marginBottom:6 }}>{fmt.desc}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {fmt.pros.map(p=>(
                <span key={p} style={{ fontSize:9, padding:'2px 7px', borderRadius:100, background:`${fmt.color}18`, color:fmt.color, fontWeight:600 }}>✓ {p}</span>
              ))}
            </div>
          </div>
        )}
      </Collapsible>

      {/* Quality */}
      {fmt?.hasQuality && (
        <Collapsible title="Quality">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Output quality</span>
            <span style={{ fontSize:13, fontWeight:800, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{quality}%</span>
          </div>
          <div style={{ display:'flex', gap:4, marginBottom:10 }}>
            {QUALITY_PRESETS.map(p=>(
              <button key={p.value} onClick={()=>setQuality(p.value)}
                style={{ flex:1, padding:'6px 4px', borderRadius:7, cursor:'pointer', border:'none', fontSize:10, fontWeight:700, transition:'all 0.15s', fontFamily:'monospace',
                  outline:`1px solid ${quality===p.value?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                  background:quality===p.value?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                  color:quality===p.value?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                {p.label}
              </button>
            ))}
          </div>
          <input type="range" min={20} max={100} step={1} value={quality} onChange={e=>setQuality(Number(e.target.value))}
            style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginTop:4 }}>
            <span>Smaller file</span><span>Best quality</span>
          </div>
        </Collapsible>
      )}

      {/* File naming */}
      <Collapsible title="File Naming" defaultOpen={false}>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10, lineHeight:1.6 }}>
          Rename output files by adding a prefix or suffix.
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div>
            <div style={LS}>Prefix</div>
            <input type="text" value={prefix} onChange={e=>setPrefix(e.target.value)}
              placeholder="e.g. site_" style={IN}/>
          </div>
          <div>
            <div style={LS}>Suffix</div>
            <input type="text" value={suffix} onChange={e=>setSuffix(e.target.value)}
              placeholder="e.g. _v2" style={IN}/>
          </div>
          {(prefix||suffix) && (
            <div style={{ padding:'8px 10px', borderRadius:8, background:'var(--surface,#111118)', border:'1px solid var(--border)', fontSize:11, fontFamily:'monospace', color:'var(--text-muted)' }}>
              Preview: <span style={{ color:'var(--accent-blue,#2563EB)' }}>{prefix}filename{suffix}.{fmt?.ext}</span>
            </div>
          )}
        </div>
      </Collapsible>

      {/* Stats */}
      {doneItems.length > 0 && (
        <div style={{ padding:'12px 14px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid rgba(22,163,74,0.2)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { l:'CONVERTED', v:`${doneItems.length}/${items.length}`                                                     },
              { l:'TOTAL ORIG', v:fmtBytes(items.reduce((s,i)=>s+i.origSize,0))                                           },
              { l:'TOTAL NEW',  v:fmtBytes(doneItems.reduce((s,i)=>s+(i.newSize||0),0)),           c:'#16a34a'             },
              { l:'SIZE Δ',     v:`${pct(items.reduce((s,i)=>s+i.origSize,0),doneItems.reduce((s,i)=>s+(i.newSize||0),0))}%`, c:'#16a34a' },
            ].map(({l,v,c})=>(
              <div key={l}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:13, fontWeight:800, color:c||'var(--text)', fontFamily:'monospace' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {pendingItems.length>0 && stage!=='processing' && (
          <button onClick={processAll}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none',
              background:`var(--accent-blue,#2563EB)`, color:'white', fontSize:14, fontWeight:600, cursor:'pointer',
              boxShadow:'0 4px 16px rgba(37,99,235,0.3)', transition:'all 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            <Zap size={15}/> Convert {pendingItems.length} Image{pendingItems.length!==1?'s':''}
          </button>
        )}
        {stage==='processing' && (
          <button disabled style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none', background:'var(--surface-raised,#18181f)', color:'var(--text-muted)', fontSize:14, fontWeight:600, cursor:'not-allowed' }}>
            <div style={{ width:14, height:14, border:'2px solid rgba(37,99,235,0.2)', borderTopColor:'var(--accent-blue,#2563EB)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            Converting…
          </button>
        )}
        {doneItems.length>0 && (
          <button onClick={dlAll}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none',
              background:'#16a34a', color:'white', fontSize:14, fontWeight:600, cursor:'pointer',
              boxShadow:'0 4px 16px rgba(22,163,74,0.3)', transition:'all 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            {doneItems.length===1?<Download size={15}/>:<Package size={15}/>}
            {doneItems.length===1?'Download Image':`Download ZIP (${doneItems.length})`}
          </button>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <label style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9,
            border:'1px dashed var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-blue,#2563EB)';e.currentTarget.style.color='var(--accent-blue,#2563EB)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)';}}>
            <input ref={addMoreRef} type="file" multiple accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
            <Plus size={13}/> Add More
          </label>
          <button onClick={reset}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9,
              border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
            <RotateCcw size={12}/> Start Over
          </button>
        </div>
      </div>
    </div>
  );

  /* ── image grid ──────────────────────────────────────────── */
  const ImageGrid = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Progress */}
      {stage==='processing' && (
        <div style={{ padding:'10px 14px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid rgba(37,99,235,0.3)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'monospace', marginBottom:6 }}>
            <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:700 }}>Converting to {fmt?.label}…</span>
            <span style={{ color:'var(--text-muted)' }}>{doneItems.length}/{items.length}</span>
          </div>
          <div style={{ height:4, background:'var(--border)', borderRadius:100, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:100, transition:'width 0.35s ease',
              background:`linear-gradient(90deg,${fmt?.color||'#2563eb'},${fmt?.color||'#2563eb'}88)`,
              width:`${items.length?Math.round(doneItems.length/items.length*100):0}%` }}/>
          </div>
        </div>
      )}

      {/* Cards */}
      <div style={{ display:'grid',
        gridTemplateColumns: isMobile ? '1fr' : vw<860 ? 'repeat(2,1fr)' : 'repeat(auto-fill,minmax(190px,1fr))',
        gap:10 }}>
        {items.map(item => {
          const saving = item.newSize ? pct(item.origSize, item.newSize) : null;
          return (
            <div key={item.id} style={{ borderRadius:12, overflow:'hidden',
              border:`1px solid ${item.status==='done'?`${fmt?.color||'#16a34a'}50`:item.status==='error'?'rgba(239,68,68,0.3)':'var(--border)'}`,
              background:'var(--surface-raised,#18181f)', transition:'all 0.2s' }}>

              {/* Image */}
              <div style={{ position:'relative', height: isMobile ? 110 : undefined, aspectRatio: isMobile ? undefined : '4/3',
                overflow:'hidden', background:'#0a0a0f', cursor:item.status==='done'?'zoom-in':'default' }}
                onClick={()=>item.status==='done'&&setLightbox(item.id)}>
                <img src={item.status==='done'&&item.compUrl?item.compUrl:item.origUrl}
                  alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>

                {item.status==='processing' && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
                    <div style={{ width:28, height:28, border:'2px solid rgba(255,255,255,0.2)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                    <span style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>Converting…</span>
                  </div>
                )}

                {item.status==='done' && (
                  <>
                    {/* Format badge */}
                    <div style={{ position:'absolute', bottom:6, left:6, padding:'2px 7px', borderRadius:100,
                      background:fmt?.color||'#16a34a', color:'white', fontSize:9, fontWeight:800 }}>
                      {item.outExt?.toUpperCase()}
                    </div>
                    {/* Savings badge */}
                    {saving !== null && (
                      <div style={{ position:'absolute', top:6, right:6, padding:'3px 7px', borderRadius:100,
                        background: saving > 0 ? 'rgba(22,163,74,0.9)' : 'rgba(239,68,68,0.85)',
                        color:'white', fontSize:9, fontWeight:700 }}>
                        {saving > 0 ? `-${saving}%` : `+${Math.abs(saving)}%`}
                      </div>
                    )}
                  </>
                )}
                {item.status==='error' && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(239,68,68,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <AlertCircle size={20} color="#ef4444"/>
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={{ padding:'9px 11px' }}>
                <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>
                  {(prefix||suffix)&&item.status==='done'
                    ? `${prefix}${item.name.replace(/\.[^/.]+$/,'')}${suffix}.${item.outExt}`
                    : item.name}
                </div>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace', marginBottom:8, display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                  <span>{fmtBytes(item.origSize)}</span>
                  {item.status==='done' && <>
                    <ArrowRight size={9}/>
                    <span style={{ color: (saving||0)>=0 ? '#16a34a' : '#ef4444', fontWeight:700 }}>{fmtBytes(item.newSize)}</span>
                  </>}
                </div>

                <div style={{ display:'flex', gap:5 }}>
                  {item.status==='done' && (
                    <>
                      <button onClick={()=>setLightbox(item.id)} style={{ ...SmBtn, flex:1, gap:4 }}>
                        <Eye size={11}/> Compare
                      </button>
                      <button onClick={()=>dlOne(item)} style={{ ...SmBtn, background:'rgba(22,163,74,0.1)', borderColor:`rgba(22,163,74,0.3)`, color:'#16a34a' }}>
                        <Download size={12}/>
                      </button>
                    </>
                  )}
                  {item.status==='pending' && (
                    <button onClick={()=>removeItem(item.id)} style={{ ...SmBtn, flex:1, gap:4, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)' }}>
                      <Trash2 size={11}/> Remove
                    </button>
                  )}
                  {item.status==='error' && <span style={{ fontSize:11, color:'#ef4444' }}>Conversion failed</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Error */}
      {error && (
        <div style={{ display:'flex', gap:10, alignItems:'center', padding:'11px 16px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={15} style={{ color:'#ef4444', flexShrink:0 }}/>
          <div style={{ flex:1, fontSize:13, color:'#ef4444' }}>{error}</div>
          <button onClick={()=>setError('')} style={IB}><X size={12}/></button>
        </div>
      )}

      {/* ══ IDLE ══ */}
      {stage==='idle' && (
        <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14,
            padding: isMobile ? '48px 20px' : '80px 40px',
            border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:16,
            background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.2s' }}>
          <input type="file" multiple accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
          <div style={{ width:68, height:68, borderRadius:20, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
            background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)', transition:'all 0.2s' }}>
            <ImageIcon size={28} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize: isMobile ? 15 : 17, fontWeight:600, marginBottom:6 }}>{drag?'Drop images here':'Convert Image Format'}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span>
              {!isMobile && ' · JPG, PNG, WebP, GIF, BMP, AVIF'}
            </div>
            <div style={{ marginTop:10, display:'flex', gap:5, justifyContent:'center', flexWrap:'wrap' }}>
              {['5 Formats','Batch Convert','Drag Compare','File Rename','Quality Control','ZIP Download'].map(t=>(
                <span key={t} style={{ fontSize:10, padding:'3px 8px', borderRadius:100, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text-muted)', fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>
        </label>
      )}

      {/* ══ ACTIVE ══ */}
      {stage!=='idle' && (
        isDesktop ? (
          <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16, alignItems:'start' }}>
            <div style={{ position:'sticky', top:16 }}><SettingsPanel/></div>
            <ImageGrid/>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Mobile action bar */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {pendingItems.length>0 && stage!=='processing' && (
                <button onClick={processAll} style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', borderRadius:9, border:'none', background:'var(--accent-blue,#2563EB)', color:'white', fontSize:13, fontWeight:600, cursor:'pointer', flex:1 }}>
                  <Zap size={13}/> Convert {pendingItems.length}
                </button>
              )}
              {doneItems.length>0 && (
                <button onClick={dlAll} style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', borderRadius:9, border:'none', background:'#16a34a', color:'white', fontSize:13, fontWeight:600, cursor:'pointer', flex:1 }}>
                  {doneItems.length===1?<Download size={13}/>:<Package size={13}/>}
                  {doneItems.length===1?'Download':`ZIP (${doneItems.length})`}
                </button>
              )}
              <label style={{ display:'flex', alignItems:'center', gap:5, padding:'10px 12px', borderRadius:9, border:'1px dashed var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                <input type="file" multiple accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/><Plus size={13}/>
              </label>
              <button onClick={reset} style={{ display:'flex', alignItems:'center', gap:5, padding:'10px 12px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                <RotateCcw size={13}/>
              </button>
            </div>

            <Collapsible title="Settings" defaultOpen={!isMobile}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* Format pills */}
                <div>
                  <div style={SH}>Format</div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {FORMATS.map(f=>(
                      <button key={f.value} onClick={()=>setTargetFmt(f.value)}
                        style={{ padding:'6px 12px', borderRadius:100, cursor:'pointer', border:'none', fontSize:11, fontWeight:700, fontFamily:'monospace', transition:'all 0.15s',
                          outline:`1px solid ${targetFmt===f.value?f.color:'var(--border)'}`,
                          background:targetFmt===f.value?`${f.color}15`:'var(--surface,#111118)',
                          color:targetFmt===f.value?f.color:'var(--text-muted)' }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Quality */}
                {fmt?.hasQuality && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={SH}>Quality</div>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{quality}%</span>
                    </div>
                    <input type="range" min={20} max={100} step={1} value={quality} onChange={e=>setQuality(Number(e.target.value))}
                      style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)' }}/>
                  </div>
                )}
              </div>
            </Collapsible>

            <ImageGrid/>
          </div>
        )
      )}

      {/* ══ LIGHTBOX with drag-compare ══ */}
      {lightbox && lbItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.93)', backdropFilter:'blur(10px)', zIndex:200,
          display:'flex', alignItems:'center', justifyContent:'center', padding: isMobile ? 10 : 0 }}
          onClick={()=>setLightbox(null)}>
          <div style={{ maxWidth: isMobile ? '100%' : '90vw', width: isMobile ? '100%' : 800,
            display:'flex', flexDirection:'column', gap:10 }}
            onClick={e=>e.stopPropagation()}>

            {/* Top bar */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:12, background:'rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize:12, fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lbItem.name}</span>
              <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace' }}>Drag to compare</span>
                <button onClick={()=>lbIdx>0&&setLightbox(items[lbIdx-1].id)} disabled={lbIdx===0} style={{ ...IB, opacity:lbIdx===0?0.3:1 }}><ChevronLeft size={13}/></button>
                <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace' }}>{lbIdx+1}/{items.filter(i=>i.status==='done').length}</span>
                <button onClick={()=>lbIdx<items.length-1&&setLightbox(items[lbIdx+1].id)} disabled={lbIdx>=items.length-1} style={{ ...IB, opacity:lbIdx>=items.length-1?0.3:1 }}><ChevronRight size={13}/></button>
                <button onClick={()=>dlOne(lbItem)} style={{ ...IB, background:'rgba(22,163,74,0.15)', borderColor:'rgba(22,163,74,0.4)', color:'#16a34a' }}><Download size={13}/></button>
                <button onClick={()=>setLightbox(null)} style={{ ...IB, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)' }}><X size={13}/></button>
              </div>
            </div>

            {/* Drag-compare slider */}
            <CompareSlider
              beforeUrl={lbItem.origUrl}
              afterUrl={lbItem.compUrl}
              style={{ width:'100%', height: isMobile ? 280 : 440, borderRadius:12 }}
            />

            {/* Meta strip */}
            <div style={{ display:'flex', gap:16, padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,0.05)', fontSize:11, fontFamily:'monospace', flexWrap:'wrap' }}>
              {[
                { l:'ORIGINAL',  v:lbItem.origSize?`.${lbItem.type?.split('/')[1]?.toUpperCase()||'?'} · ${fmtBytes(lbItem.origSize)}`:'—' },
                { l:'CONVERTED', v:`${lbItem.outExt?.toUpperCase()} · ${fmtBytes(lbItem.newSize)}`, c:'#16a34a' },
                { l:'SIZE DIFF', v:`${pct(lbItem.origSize,lbItem.newSize)>0?'-':'+'} ${Math.abs(pct(lbItem.origSize,lbItem.newSize))}%`,
                  c:pct(lbItem.origSize,lbItem.newSize)>=0?'#16a34a':'#f59e0b' },
                ...(prefix||suffix ? [{l:'FILENAME', v:`${prefix||''}name${suffix||''}.${lbItem.outExt}`}] : []),
              ].map(({l,v,c})=>(
                <div key={l}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', marginBottom:2 }}>{l}</div>
                  <div style={{ fontWeight:700, color:c||'white' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const IB    = { display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:7, flexShrink:0, border:'1px solid var(--border)', background:'rgba(255,255,255,0.04)', color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s' };
const IN    = { width:'100%', padding:'8px 11px', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:12, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
const LS    = { fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:5, display:'block' };
const SH    = { fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8, display:'block' };
const SmBtn = { display:'flex', alignItems:'center', justifyContent:'center', padding:'6px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--surface,#111118)', color:'var(--text-muted)', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s' };