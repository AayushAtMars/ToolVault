import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  Trash2,
  ArrowRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Package,
  RotateCcw
} from "lucide-react";
import JSZip from 'jszip';

/* ── helpers ─────────────────────────────────────────────── */
function fmtBytes(b) {
  if (!b || b === 0) return '0 B';
  const k = 1024, i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${['B','KB','MB','GB'][i]}`;
}
function pct(a, b) { return b ? Math.round((1 - b/a) * 100) : 0; }
function uid()      { return Math.random().toString(36).slice(2, 11); }

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

const OUTPUT_FORMATS = [
  { value:'jpeg', label:'JPEG', desc:'Best compression', mime:'image/jpeg', ext:'jpg'  },
  { value:'webp', label:'WebP', desc:'Modern · smaller', mime:'image/webp', ext:'webp' },
  { value:'png',  label:'PNG',  desc:'Lossless',         mime:'image/png',  ext:'png'  },
];

const RESIZE_MODES = [
  { value:'none',   label:'Original' },
  { value:'50',     label:'50%'      },
  { value:'75',     label:'75%'      },
  { value:'custom', label:'Custom'   },
];

const QUALITY_PRESETS = [
  { label:'Low',    value:40,  desc:'Smallest' },
  { label:'Medium', value:70,  desc:'Balanced' },
  { label:'High',   value:85,  desc:'Recommended' },
  { label:'Max',    value:95,  desc:'Near lossless' },
];

/* ════════════════════════════════════════════════════════ */
export default function CompressImage() {
  const vw          = useWidth();
  const isMobile    = vw < 640;
  const isDesktop   = vw >= 1024;

  const [stage, setStage]         = useState('idle');
  const [items, setItems]         = useState([]);
  const [drag, setDrag]           = useState(false);
  const [error, setError]         = useState('');

  const [quality,     setQuality]     = useState(85);
  const [outFormat,   setOutFormat]   = useState('jpeg');
  const [resizeMode,  setResizeMode]  = useState('none');
  const [customScale, setCustomScale] = useState(80);

  const [lightbox, setLightbox]   = useState(null);
  const [lbSide,   setLbSide]     = useState('after');
  const [totalSaved, setTotalSaved] = useState(0);

  const addMoreRef = useRef(null);

  /* ── ingest ──────────────────────────────────────────────── */
  const ingest = useCallback((files) => {
    const valid = ['image/jpeg','image/png','image/webp','image/gif','image/bmp'];
    const next  = Array.from(files)
      .filter(f => valid.includes(f.type) || f.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i))
      .map(f => ({
        id: uid(), file: f, name: f.name,
        type: f.type || 'image/jpeg',
        originalSize: f.size, compressedSize: 0, savedPct: 0,
        status: 'pending', blob: null,
        origUrl: URL.createObjectURL(f), compUrl: null, dimensions: null,
      }));
    if (!next.length) { setError('Please upload valid images (JPG, PNG, WebP, GIF, BMP).'); return; }
    setError('');
    setItems(prev => [...prev, ...next]);
    if (stage === 'idle') setStage('ready');
  }, [stage]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, [ingest]);

  /* ── compress single ─────────────────────────────────────── */
  const compressOne = (item, q, fmt, scale) => new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => {
      const sw = Math.round(img.naturalWidth * scale / 100);
      const sh = Math.round(img.naturalHeight * scale / 100);
      const canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (fmt.value === 'jpeg') { ctx.fillStyle='#fff'; ctx.fillRect(0,0,sw,sh); }
      ctx.drawImage(img, 0, 0, sw, sh);
      canvas.toBlob(blob => {
        if (!blob) { resolve({ id:item.id, status:'error' }); return; }
        resolve({
          id: item.id, status:'done',
          compressedSize: blob.size,
          savedPct: pct(item.originalSize, blob.size),
          blob, compUrl: URL.createObjectURL(blob),
          dimensions: { w:sw, h:sh }, outExt: fmt.ext,
        });
      }, fmt.mime, fmt.value==='png' ? undefined : q/100);
    };
    img.onerror = () => resolve({ id:item.id, status:'error' });
    img.src = item.origUrl;
  });

  /* ── process all ─────────────────────────────────────────── */
  const processAll = async () => {
    const pending = items.filter(i => i.status==='pending');
    if (!pending.length) return;
    setStage('processing');
    const fmt   = OUTPUT_FORMATS.find(f => f.value===outFormat);
    const scale = resizeMode==='none' ? 100 : resizeMode==='custom' ? customScale : parseInt(resizeMode);
    let saved = 0;
    for (const item of pending) {
      setItems(prev => prev.map(i => i.id===item.id ? {...i, status:'processing'} : i));
      const res = await compressOne(item, quality, fmt, scale);
      if (res.status==='done') saved += Math.max(0, item.originalSize - res.compressedSize);
      setItems(prev => prev.map(i => i.id===item.id ? {...i, ...res} : i));
    }
    setTotalSaved(s => s + saved);
    setStage('done');
  };

  /* ── downloads ───────────────────────────────────────────── */
  const dlOne = (item) => {
    const url = URL.createObjectURL(item.blob);
    const a   = document.createElement('a');
    a.href = url; a.download = `${item.name.replace(/\.[^/.]+$/,'')}_compressed.${item.outExt||'jpg'}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const dlAll = async () => {
    const done = items.filter(i => i.status==='done' && i.blob);
    if (done.length===1) { dlOne(done[0]); return; }
    const zip = new JSZip();
    for (const item of done)
      zip.file(`${item.name.replace(/\.[^/.]+$/,'')}_compressed.${item.outExt||'jpg'}`, item.blob);
    const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6} });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download='compressed_images.zip';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const removeItem = (id) => {
    const item = items.find(i=>i.id===id);
    if (item?.origUrl) URL.revokeObjectURL(item.origUrl);
    if (item?.compUrl) URL.revokeObjectURL(item.compUrl);
    const next = items.filter(i=>i.id!==id);
    setItems(next);
    if (!next.length) { setStage('idle'); setTotalSaved(0); }
    else if (next.every(i=>i.status==='pending')) setStage('ready');
  };

  const reset = () => {
    items.forEach(i=>{ URL.revokeObjectURL(i.origUrl); if(i.compUrl) URL.revokeObjectURL(i.compUrl); });
    setItems([]); setStage('idle'); setError(''); setTotalSaved(0);
  };

  /* ── derived ─────────────────────────────────────────────── */
  const doneItems    = items.filter(i=>i.status==='done');
  const pendingItems = items.filter(i=>i.status==='pending');
  const totalOrig    = items.reduce((s,i)=>s+i.originalSize, 0);
  const totalComp    = doneItems.reduce((s,i)=>s+i.compressedSize, 0);
  const fmt          = OUTPUT_FORMATS.find(f=>f.value===outFormat);
  const lbItem       = lightbox ? items.find(i=>i.id===lightbox) : null;
  const lbIdx        = lightbox ? items.findIndex(i=>i.id===lightbox) : -1;

  /* ── Settings panel (reused on all breakpoints) ──────────── */
  const SettingsPanel = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* Output format */}
      <Collapsible title="Output Format">
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {OUTPUT_FORMATS.map(f=>(
            <button key={f.value} onClick={()=>setOutFormat(f.value)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 11px', borderRadius:8, cursor:'pointer', border:'none', transition:'all 0.15s',
                outline:`1px solid ${outFormat===f.value?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:outFormat===f.value?'rgba(37,99,235,0.08)':'var(--surface,#111118)' }}>
              <span style={{ fontSize:10, fontWeight:800, fontFamily:'monospace', padding:'2px 7px', borderRadius:4, flexShrink:0,
                background:outFormat===f.value?'var(--accent-blue,#2563EB)':'var(--border)', color:'white' }}>{f.label}</span>
              <span style={{ fontSize:12, color:outFormat===f.value?'var(--text)':'var(--text-muted)', fontWeight:outFormat===f.value?600:400 }}>{f.desc}</span>
              {outFormat===f.value && <div style={{ marginLeft:'auto', width:7, height:7, borderRadius:'50%', background:'var(--accent-blue,#2563EB)', flexShrink:0 }}/>}
            </button>
          ))}
        </div>
      </Collapsible>

      {/* Quality */}
      {outFormat!=='png' && (
        <Collapsible title="Quality">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Level</span>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{quality}%</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:10 }}>
            {QUALITY_PRESETS.map(p=>(
              <button key={p.value} onClick={()=>setQuality(p.value)}
                style={{ padding:'7px 5px', borderRadius:7, cursor:'pointer', textAlign:'center', border:'none', transition:'all 0.15s',
                  outline:`1px solid ${quality===p.value?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                  background:quality===p.value?'rgba(37,99,235,0.08)':'var(--surface,#111118)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:quality===p.value?'var(--accent-blue,#2563EB)':'var(--text)', marginBottom:1 }}>{p.label}</div>
                <div style={{ fontSize:9, color:'var(--text-muted)' }}>{p.desc}</div>
              </button>
            ))}
          </div>
          <input type="range" min={20} max={100} step={1} value={quality} onChange={e=>setQuality(Number(e.target.value))}
            style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginTop:4 }}>
            <span>Smaller</span><span>Balanced</span><span>Best</span>
          </div>
        </Collapsible>
      )}

      {/* Resize */}
      <Collapsible title="Resize" defaultOpen={false}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          {RESIZE_MODES.map(m=>(
            <button key={m.value} onClick={()=>setResizeMode(m.value)}
              style={{ padding:'8px 6px', borderRadius:7, cursor:'pointer', textAlign:'center', border:'none', transition:'all 0.15s', fontSize:11, fontWeight:600,
                outline:`1px solid ${resizeMode===m.value?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:resizeMode===m.value?'rgba(37,99,235,0.08)':'var(--surface,#111118)',
                color:resizeMode===m.value?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
              {m.label}
            </button>
          ))}
        </div>
        {resizeMode==='custom' && (
          <div style={{ marginTop:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>Scale</span>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{customScale}%</span>
            </div>
            <input type="range" min={10} max={100} step={5} value={customScale} onChange={e=>setCustomScale(Number(e.target.value))}
              style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
          </div>
        )}
      </Collapsible>

      {/* Stats */}
      {items.length > 0 && (
        <div style={{ padding:'12px 14px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { l:'FILES',    v:items.length },
              { l:'ORIGINAL', v:fmtBytes(totalOrig) },
              ...(doneItems.length?[
                { l:'COMPRESSED', v:fmtBytes(totalComp), c:'#16a34a' },
                { l:'SAVED',      v:`${pct(doneItems.reduce((s,i)=>s+i.originalSize,0),totalComp)}%`, c:'#16a34a' },
              ]:[]),
            ].map(({l,v,c})=>(
              <div key={l}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:14, fontWeight:800, color:c||'var(--text)', fontFamily:'monospace' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {(stage==='ready'||stage==='done') && pendingItems.length>0 && (
          <button onClick={processAll}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none',
              background:'var(--accent-blue,#2563EB)', color:'white', fontSize:14, fontWeight:600, cursor:'pointer',
              boxShadow:'0 4px 16px rgba(37,99,235,0.3)', transition:'all 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            <Zap size={15}/> Compress {pendingItems.length} Image{pendingItems.length!==1?'s':''}
          </button>
        )}
        {stage==='processing' && (
          <button disabled style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none',
            background:'var(--surface-raised,#18181f)', color:'var(--text-muted)', fontSize:14, fontWeight:600, cursor:'not-allowed' }}>
            <div style={{ width:14, height:14, border:'2px solid rgba(37,99,235,0.2)', borderTopColor:'var(--accent-blue,#2563EB)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            Compressing…
          </button>
        )}
        {doneItems.length > 0 && (
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
        {items.length > 0 && (
          <>
            <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'9px', borderRadius:9,
              border:'1px dashed var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer', transition:'all 0.15s' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-blue,#2563EB)';e.currentTarget.style.color='var(--accent-blue,#2563EB)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)';}}>
              <input ref={addMoreRef} type="file" multiple accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
              <Plus size={13}/> Add More Images
            </label>
            <button onClick={reset}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9,
                border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
              <RotateCcw size={12}/> Start Over
            </button>
          </>
        )}
      </div>
    </div>
  );

  /* ── Image grid ──────────────────────────────────────────── */
  const ImageGrid = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Progress bar */}
      {stage==='processing' && (
        <div style={{ padding:'10px 14px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid rgba(37,99,235,0.3)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'monospace', marginBottom:6 }}>
            <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:700 }}>Compressing…</span>
            <span style={{ color:'var(--text-muted)' }}>{doneItems.length} / {items.length}</span>
          </div>
          <div style={{ height:4, background:'var(--border)', borderRadius:100, overflow:'hidden' }}>
            <div style={{ height:'100%', background:'linear-gradient(90deg,var(--accent-blue,#2563EB),#60a5fa)', borderRadius:100,
              width:`${items.length?Math.round(doneItems.length/items.length*100):0}%`, transition:'width 0.4s ease' }}/>
          </div>
        </div>
      )}

      {/* Cards grid — fewer columns on mobile */}
      <div style={{ display:'grid',
        gridTemplateColumns: isMobile
          ? '1fr'
          : vw < 860
          ? 'repeat(2, 1fr)'
          : 'repeat(auto-fill, minmax(200px,1fr))',
        gap: isMobile ? 10 : 12 }}>
        {items.map(item => (
          <div key={item.id} style={{ borderRadius:12, overflow:'hidden',
            border:`1px solid ${item.status==='processing'?'rgba(37,99,235,0.5)':item.status==='done'?'rgba(22,163,74,0.35)':'var(--border)'}`,
            background:'var(--surface-raised,#18181f)', transition:'all 0.2s' }}>

            {/* Thumbnail */}
            <div onClick={()=>item.status==='done'&&setLightbox(item.id)}
              style={{ position:'relative',
                // On mobile list view, use a fixed height strip rather than square
                height: isMobile ? 120 : undefined,
                aspectRatio: isMobile ? undefined : '4/3',
                overflow:'hidden', background:'#0a0a0f',
                cursor:item.status==='done'?'zoom-in':'default' }}>
              <img src={item.status==='done'&&item.compUrl?item.compUrl:item.origUrl}
                alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>

              {item.status==='processing' && (
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
                  <div style={{ width:28, height:28, border:'2px solid rgba(255,255,255,0.2)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>Compressing…</span>
                </div>
              )}
              {item.status==='done' && (
                <div style={{ position:'absolute', top:7, right:7, padding:'3px 8px', borderRadius:100,
                  background:'rgba(22,163,74,0.9)', color:'white', fontSize:10, fontWeight:700, backdropFilter:'blur(4px)' }}>
                  -{item.savedPct}%
                </div>
              )}
              {item.status==='error' && (
                <div style={{ position:'absolute', inset:0, background:'rgba(239,68,68,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <AlertCircle size={20} color="#ef4444"/>
                </div>
              )}
            </div>

            {/* Card body */}
            <div style={{ padding: isMobile ? '8px 10px' : '10px 12px' }}>
              <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>{item.name}</div>

              {item.status==='done' ? (
                <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontFamily:'monospace', marginBottom:8, flexWrap:'wrap' }}>
                  <span style={{ color:'var(--text-muted)' }}>{fmtBytes(item.originalSize)}</span>
                  <ArrowRight size={9} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
                  <span style={{ color:'#16a34a', fontWeight:700 }}>{fmtBytes(item.compressedSize)}</span>
                  {item.dimensions && !isMobile && <span style={{ color:'var(--text-muted)', marginLeft:'auto' }}>{item.dimensions.w}×{item.dimensions.h}</span>}
                </div>
              ) : (
                <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace', marginBottom:8 }}>
                  {fmtBytes(item.originalSize)} · {item.status==='processing'?'Working…':'Ready'}
                </div>
              )}

              <div style={{ display:'flex', gap:5 }}>
                {item.status==='done' && (
                  <>
                    <button onClick={()=>setLightbox(item.id)}
                      style={{ ...SmBtn, flex:1, gap:5 }}>
                      <ImageIcon size={11}/> {isMobile ? 'Compare' : 'Before/After'}
                    </button>
                    <button onClick={()=>dlOne(item)}
                      style={{ ...SmBtn, background:'rgba(22,163,74,0.1)', borderColor:'rgba(22,163,74,0.3)', color:'#16a34a' }}>
                      <Download size={13}/>
                    </button>
                  </>
                )}
                {item.status==='pending' && (
                  <button onClick={()=>removeItem(item.id)}
                    style={{ ...SmBtn, flex:1, gap:5, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)' }}>
                    <Trash2 size={11}/> Remove
                  </button>
                )}
                {item.status==='error' && (
                  <span style={{ fontSize:11, color:'#ef4444', lineHeight:'28px' }}>Failed</span>
                )}
              </div>
            </div>
          </div>
        ))}
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
            <Upload size={28} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize: isMobile ? 15 : 17, fontWeight:600, marginBottom:6 }}>{drag?'Drop images here':'Compress Images'}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span>
              {!isMobile && ' · JPG, PNG, WebP, GIF, BMP'}
            </div>
            <div style={{ marginTop:10, display:'flex', gap:5, justifyContent:'center', flexWrap:'wrap' }}>
              {['Bulk Compress','JPEG · WebP · PNG','Resize %','Before/After',isMobile?'ZIP':'Single / ZIP'].map(t=>(
                <span key={t} style={{ fontSize:10, padding:'3px 8px', borderRadius:100, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text-muted)', fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>
        </label>
      )}

      {/* ══ ACTIVE STAGES ══ */}
      {stage!=='idle' && (
        isDesktop ? (
          /* Desktop: 2-col grid */
          <div style={{ display:'grid', gridTemplateColumns:'250px 1fr', gap:16, alignItems:'start' }}>
            <div style={{ position:'sticky', top:16 }}><SettingsPanel/></div>
            <ImageGrid/>
          </div>
        ) : (
          /* Mobile / Tablet: stacked */
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Compact action bar at top for mobile */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {(stage==='ready'||stage==='done') && pendingItems.length>0 && (
                <button onClick={processAll}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', borderRadius:9, border:'none',
                    background:'var(--accent-blue,#2563EB)', color:'white', fontSize:13, fontWeight:600, cursor:'pointer', flex: isMobile ? 1 : 'none' }}>
                  <Zap size={13}/> Compress {pendingItems.length}
                </button>
              )}
              {doneItems.length > 0 && (
                <button onClick={dlAll}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', borderRadius:9, border:'none',
                    background:'#16a34a', color:'white', fontSize:13, fontWeight:600, cursor:'pointer', flex: isMobile ? 1 : 'none' }}>
                  {doneItems.length===1?<Download size={13}/>:<Package size={13}/>}
                  {doneItems.length===1?'Download':isMobile?`ZIP (${doneItems.length})`:`ZIP (${doneItems.length})`}
                </button>
              )}
              <label style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', borderRadius:9, border:'1px dashed var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>
                <input type="file" multiple accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
                <Plus size={13}/>
              </label>
              <button onClick={reset}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>
                <RotateCcw size={13}/>
              </button>
            </div>

            {/* Stats strip on mobile */}
            {items.length > 0 && (
              <div style={{ display:'flex', gap:12, padding:'10px 14px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', flexWrap:'wrap' }}>
                {[{l:'FILES',v:items.length},{l:'ORIG',v:fmtBytes(totalOrig)},
                  ...(doneItems.length?[{l:'NEW',v:fmtBytes(totalComp),c:'#16a34a'},{l:'SAVED',v:`${pct(doneItems.reduce((s,i)=>s+i.originalSize,0),totalComp)}%`,c:'#16a34a'}]:[])
                ].map(({l,v,c})=>(
                  <div key={l}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em' }}>{l}</div>
                    <div style={{ fontSize:13, fontWeight:800, color:c||'var(--text)', fontFamily:'monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Collapsible settings on mobile/tablet */}
            <Collapsible title="Compression Settings" defaultOpen={!isMobile}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* Format */}
                <div>
                  <div style={SH}>Output Format</div>
                  <div style={{ display:'flex', gap:5 }}>
                    {OUTPUT_FORMATS.map(f=>(
                      <button key={f.value} onClick={()=>setOutFormat(f.value)}
                        style={{ flex:1, padding:'8px 4px', borderRadius:8, cursor:'pointer', textAlign:'center', border:'none', transition:'all 0.15s',
                          outline:`1px solid ${outFormat===f.value?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                          background:outFormat===f.value?'rgba(37,99,235,0.08)':'var(--surface,#111118)' }}>
                        <div style={{ fontSize:11, fontWeight:800, fontFamily:'monospace', color:outFormat===f.value?'var(--accent-blue,#2563EB)':'var(--text)' }}>{f.label}</div>
                        <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:1 }}>{f.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality */}
                {outFormat!=='png' && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={SH}>Quality</div>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{quality}%</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, marginBottom:8 }}>
                      {QUALITY_PRESETS.map(p=>(
                        <button key={p.value} onClick={()=>setQuality(p.value)}
                          style={{ padding:'6px 4px', borderRadius:7, cursor:'pointer', textAlign:'center', border:'none',
                            outline:`1px solid ${quality===p.value?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                            background:quality===p.value?'rgba(37,99,235,0.08)':'var(--surface,#111118)',
                            fontSize:10, fontWeight:700, color:quality===p.value?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input type="range" min={20} max={100} step={1} value={quality} onChange={e=>setQuality(Number(e.target.value))}
                      style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)' }}/>
                  </div>
                )}

                {/* Resize */}
                <div>
                  <div style={SH}>Resize</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4 }}>
                    {RESIZE_MODES.map(m=>(
                      <button key={m.value} onClick={()=>setResizeMode(m.value)}
                        style={{ padding:'7px 4px', borderRadius:7, cursor:'pointer', textAlign:'center', border:'none', fontSize:10, fontWeight:600,
                          outline:`1px solid ${resizeMode===m.value?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                          background:resizeMode===m.value?'rgba(37,99,235,0.08)':'var(--surface,#111118)',
                          color:resizeMode===m.value?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {resizeMode==='custom' && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>Scale</span>
                        <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{customScale}%</span>
                      </div>
                      <input type="range" min={10} max={100} step={5} value={customScale} onChange={e=>setCustomScale(Number(e.target.value))}
                        style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)' }}/>
                    </div>
                  )}
                </div>
              </div>
            </Collapsible>

            <ImageGrid/>
          </div>
        )
      )}

      {/* ══ LIGHTBOX ══ */}
      {lightbox && lbItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', backdropFilter:'blur(10px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding: isMobile ? 12 : 0 }}
          onClick={()=>setLightbox(null)}>
          <div style={{ maxWidth: isMobile ? '100%' : '90vw', width: isMobile ? '100%' : 740, display:'flex', flexDirection:'column', gap:10 }}
            onClick={e=>e.stopPropagation()}>

            {/* Top bar */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:12, background:'rgba(255,255,255,0.07)', backdropFilter:'blur(10px)' }}>
              <span style={{ fontSize:12, fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lbItem.name}</span>
              <div style={{ display:'flex', gap:4 }}>
                <button onClick={()=>lbIdx>0&&setLightbox(items[lbIdx-1].id)} disabled={lbIdx===0} style={{ ...IB, opacity:lbIdx===0?0.3:1 }}><ChevronLeft size={13}/></button>
                {!isMobile && <span style={{ fontSize:10, color:'var(--text-muted)', padding:'0 5px', lineHeight:'30px', fontFamily:'monospace' }}>{lbIdx+1}/{items.length}</span>}
                <button onClick={()=>lbIdx<items.length-1&&setLightbox(items[lbIdx+1].id)} disabled={lbIdx>=items.length-1} style={{ ...IB, opacity:lbIdx>=items.length-1?0.3:1 }}><ChevronRight size={13}/></button>
                <button onClick={()=>dlOne(lbItem)} style={{ ...IB, background:'rgba(22,163,74,0.15)', borderColor:'rgba(22,163,74,0.4)', color:'#16a34a' }}><Download size={13}/></button>
                <button onClick={()=>setLightbox(null)} style={{ ...IB, color:'#ef4444', borderColor:'rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.1)' }}><X size={13}/></button>
              </div>
            </div>

            {/* Before / After */}
            <div style={{ display:'flex', gap:4, padding:3, background:'rgba(255,255,255,0.07)', borderRadius:10 }}>
              {['before','after'].map(s=>(
                <button key={s} onClick={()=>setLbSide(s)}
                  style={{ flex:1, padding:'8px', borderRadius:7, border:'none', cursor:'pointer', fontSize: isMobile ? 11 : 12, fontWeight:600, transition:'all 0.15s',
                    background:lbSide===s?'rgba(255,255,255,0.12)':'transparent',
                    color:lbSide===s?'white':'rgba(255,255,255,0.45)' }}>
                  {s==='before'
                    ? `Before${isMobile?'':` — ${fmtBytes(lbItem.originalSize)}`}`
                    : `After${isMobile?'':` — ${fmtBytes(lbItem.compressedSize)} (-${lbItem.savedPct}%)`}`}
                </button>
              ))}
            </div>

            {/* Image */}
            <div style={{ borderRadius:12, overflow:'hidden', background:'#111', maxHeight: isMobile ? '55vh' : '65vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img src={lbSide==='before'?lbItem.origUrl:lbItem.compUrl}
                alt={lbSide} style={{ maxWidth:'100%', maxHeight: isMobile ? '55vh' : '65vh', display:'block', objectFit:'contain' }}/>
            </div>

            {/* Meta */}
            <div style={{ display:'flex', gap: isMobile ? 12 : 20, padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,0.05)', fontSize:11, fontFamily:'monospace', flexWrap:'wrap' }}>
              {[
                { l:'ORIGINAL',   v:fmtBytes(lbItem.originalSize) },
                { l:'COMPRESSED', v:fmtBytes(lbItem.compressedSize), c:'#16a34a' },
                { l:'SAVED',      v:`${lbItem.savedPct}%`, c:'#16a34a' },
                { l:'FORMAT',     v:fmt.label },
                ...(lbItem.dimensions&&!isMobile?[{l:'SIZE',v:`${lbItem.dimensions.w}×${lbItem.dimensions.h}`}]:[]),
              ].map(({l,v,c})=>(
                <div key={l}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', letterSpacing:'0.1em', marginBottom:2 }}>{l}</div>
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
const SH    = { fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8, display:'block' };
const SmBtn = { display:'flex', alignItems:'center', justifyContent:'center', padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--surface,#111118)', color:'var(--text-muted)', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s' };