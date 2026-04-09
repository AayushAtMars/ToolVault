import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  AlertCircle,
  X,
  Zap,
  Trash2,
  ArrowRight,
  Plus,
  Link,
  Link2Off,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Package,
  Eye,
  Maximize2,
  Percent,
  Crop,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import JSZip from 'jszip';

/* ── helpers ─────────────────────────────────────────────── */
function fmtBytes(b) {
  if (!b) return '—';
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${['B','KB','MB','GB'][i]}`;
}
function uid() { return Math.random().toString(36).slice(2, 11); }

const OUTPUT_FMTS = [
  { value:'original', label:'Original', mime: null, ext: null },
  { value:'jpeg',     label:'JPEG',     mime:'image/jpeg', ext:'jpg'  },
  { value:'png',      label:'PNG',      mime:'image/png',  ext:'png'  },
  { value:'webp',     label:'WebP',     mime:'image/webp', ext:'webp' },
];

const FIT_MODES = [
  { value:'fill',    label:'Stretch',  desc:'Exact dimensions (may distort)' },
  { value:'contain', label:'Contain',  desc:'Fit inside, letterbox if needed' },
  { value:'cover',   label:'Cover',    desc:'Fill & crop to exact size'       },
];

const COMMON_SIZES = [
  { label:'HD',        w:1280, h:720  },
  { label:'Full HD',   w:1920, h:1080 },
  { label:'4K',        w:3840, h:2160 },
  { label:'Instagram', w:1080, h:1080 },
  { label:'Twitter',   w:1200, h:675  },
  { label:'A4 300dpi', w:2480, h:3508 },
];

/* ── resize on canvas ────────────────────────────────────── */
function doResize(img, tw, th, fitMode, outputFmt, quality) {
  return new Promise(resolve => {
    let sw = tw, sh = th;
    let sx = 0, sy = 0, srcW = img.naturalWidth, srcH = img.naturalHeight;
    let offX = 0, offY = 0, drawW = tw, drawH = th;

    if (fitMode === 'contain') {
      const ratio = Math.min(tw / srcW, th / srcH);
      drawW = Math.round(srcW * ratio); drawH = Math.round(srcH * ratio);
      offX  = Math.floor((tw - drawW) / 2); offY = Math.floor((th - drawH) / 2);
    } else if (fitMode === 'cover') {
      const ratio = Math.max(tw / srcW, th / srcH);
      const scaled = { w: srcW * ratio, h: srcH * ratio };
      sx = Math.max(0, (scaled.w - tw) / 2 / ratio);
      sy = Math.max(0, (scaled.h - th) / 2 / ratio);
      srcW = tw / ratio; srcH = th / ratio;
    }

    const canvas = document.createElement('canvas');
    canvas.width = sw; canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (outputFmt === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sw, sh); }
    if (fitMode === 'contain') {
      ctx.drawImage(img, offX, offY, drawW, drawH);
    } else if (fitMode === 'cover') {
      ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, tw, th);
    } else {
      ctx.drawImage(img, 0, 0, tw, th);
    }

    const mime = outputFmt === 'jpeg' ? 'image/jpeg' : outputFmt === 'png' ? 'image/png' : outputFmt === 'webp' ? 'image/webp' : null;
    const finalMime = mime || (img.src.includes('png') ? 'image/png' : 'image/jpeg');
    canvas.toBlob(blob => resolve(blob), finalMime, quality / 100);
  });
}

/* ════════════════════════════════════════════════════════ */

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

export default function ResizeImage() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage, setStage]     = useState('idle');
  const [items, setItems]     = useState([]);
  const [drag, setDrag]       = useState(false);
  const [error, setError]     = useState('');
  const [isReading, setIsReading] = useState(false);

  // Global settings
  const [resizeMode,  setResizeMode]  = useState('pixels'); // pixels | percent
  const [targetW,     setTargetW]     = useState(1920);
  const [targetH,     setTargetH]     = useState(1080);
  const [targetPct,   setTargetPct]   = useState(50);
  const [lockAspect,  setLockAspect]  = useState(true);
  const [fitMode,     setFitMode]     = useState('contain');
  const [outFmt,      setOutFmt]      = useState('original');
  const [quality,     setQuality]     = useState(90);
  const [bgColor,     setBgColor]     = useState('#ffffff');

  // UI
  const [lightbox,    setLightbox]    = useState(null);
  const [lbSide,      setLbSide]      = useState('after');

  const previewCanvasRef = useRef(null);
  const addMoreRef       = useRef(null);

  /* ── ingest ──────────────────────────────────────────────── */
  const ingest = useCallback(async (files) => {
    setIsReading(true);
    await new Promise(r => setTimeout(r, 50));
    const valid = ['image/jpeg','image/png','image/webp','image/gif','image/bmp'];
    const next  = Array.from(files)
      .filter(f => valid.includes(f.type) || f.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i))
      .map(f => ({
        id: uid(), file: f, name: f.name,
        type: f.type || 'image/jpeg',
        origSize: f.size,
        origUrl:  URL.createObjectURL(f),
        status:   'pending',
        origDim:  null,
        newDim:   null,
        newSize:  null,
        blob:     null,
        compUrl:  null,
      }));
    if (!next.length) { setError('Upload valid image files (JPG, PNG, WebP, GIF, BMP).'); setIsReading(false); return; }
    setError('');

    // Load dims async
    next.forEach(item => {
      const img = new window.Image();
      img.onload = () => {
        setItems(prev => prev.map(i =>
          i.id===item.id ? { ...i, origDim:{ w:img.naturalWidth, h:img.naturalHeight } } : i
        ));
      };
      img.src = item.origUrl;
    });

    setItems(prev => [...prev, ...next]);
    if (stage === 'idle') setStage('ready');
    setIsReading(false);
  }, [stage]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, [ingest]);

  /* ── live mini-preview on canvas ───────────────────────── */
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !items.length) return;
    const first = items[0];
    if (!first.origUrl) return;
    const img = new window.Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      const CW = canvas.width = 240, CH = canvas.height = Math.round(CW / ratio);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, CW, CH);
      // Draw a preview-sized version with fitMode applied
      let tw = CW, th = CH;
      if (resizeMode === 'pixels') {
        const previewRatio = Math.min(CW / targetW, CH / targetH);
        tw = Math.round(targetW * previewRatio); th = Math.round(targetH * previewRatio);
      }
      ctx.drawImage(img, 0, 0, tw, th);
      // Overlay text
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, CH-22, CW, 22);
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
      const label = resizeMode==='percent'
        ? `${targetPct}% · ${Math.round(img.naturalWidth*targetPct/100)}×${Math.round(img.naturalHeight*targetPct/100)}`
        : `${targetW}×${targetH} (${fitMode})`;
      ctx.fillText(label, 6, CH-8);
    };
    img.src = first.origUrl;
  }, [items, targetW, targetH, targetPct, resizeMode, fitMode, bgColor]);

  /* ── dimension helpers ──────────────────────────────────── */
  const updateW = (val) => {
    const w = Math.max(1, parseInt(val)||1);
    setTargetW(w);
    if (lockAspect && items[0]?.origDim) {
      setTargetH(Math.round(w / (items[0].origDim.w / items[0].origDim.h)));
    }
  };
  const updateH = (val) => {
    const h = Math.max(1, parseInt(val)||1);
    setTargetH(h);
    if (lockAspect && items[0]?.origDim) {
      setTargetW(Math.round(h * (items[0].origDim.w / items[0].origDim.h)));
    }
  };

  /* ── process ─────────────────────────────────────────────── */
  const processAll = async () => {
    const pending = items.filter(i => i.status==='pending');
    if (!pending.length) return;
    setStage('processing');

    for (const item of pending) {
      setItems(prev => prev.map(i => i.id===item.id ? {...i, status:'processing'} : i));
      const img = new window.Image();
      await new Promise(r => { img.onload=r; img.src=item.origUrl; });

      let tw = targetW, th = targetH;
      if (resizeMode === 'percent') {
        tw = Math.round(img.naturalWidth  * targetPct / 100);
        th = Math.round(img.naturalHeight * targetPct / 100);
      } else if (lockAspect) {
        const ratio = img.naturalWidth / img.naturalHeight;
        th = Math.round(tw / ratio);
      }

      const fmt  = OUTPUT_FMTS.find(f => f.value===outFmt);
      const blob = await doResize(img, tw, th, fitMode, outFmt, quality);
      const compUrl = URL.createObjectURL(blob);
      const outExt  = fmt.ext || item.name.split('.').pop();

      setItems(prev => prev.map(i => i.id===item.id
        ? { ...i, status:'done', blob, compUrl, newDim:{ w:tw, h:th }, newSize:blob.size, outExt }
        : i
      ));
    }
    setStage('done');
  };

  /* ── download ────────────────────────────────────────────── */
  const dlOne = (item) => {
    const a = document.createElement('a');
    const base = item.name.replace(/\.[^/.]+$/, '');
    a.href = item.compUrl; a.download = `${base}_resized.${item.outExt||'jpg'}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const dlAll = async () => {
    const done = items.filter(i => i.status==='done');
    if (done.length === 1) { dlOne(done[0]); return; }
    const zip = new JSZip();
    done.forEach(i => { const base=i.name.replace(/\.[^/.]+$/,''); zip.file(`${base}_resized.${i.outExt||'jpg'}`, i.blob); });
    const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6} });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'resized_images.zip';
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
    items.forEach(i => { URL.revokeObjectURL(i.origUrl); if(i.compUrl) URL.revokeObjectURL(i.compUrl); });
    setItems([]); setStage('idle'); setError('');
  };

  /* ── derived ─────────────────────────────────────────────── */
  const doneItems    = items.filter(i=>i.status==='done');
  const pendingItems = items.filter(i=>i.status==='pending');
  const lbItem       = lightbox ? items.find(i=>i.id===lightbox) : null;
  const lbIdx        = lightbox ? items.findIndex(i=>i.id===lightbox) : -1;

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* ══ READING OVERLAY ══ */}
      {isReading && (
        <div style={OverlayBase}>
          <div style={SpinnerBig} />
          <div style={{ color:'white', fontWeight:600 }}>Reading file...</div>
        </div>
      )}

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
          style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding: isMobile ? '48px 20px' : '80px 40px',
            border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:16,
            background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.2s' }}>
          <input type="file" multiple accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
          <div style={{ width:72, height:72, borderRadius:20, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s', background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)' }}>
            <Maximize2 size={28} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:17, fontWeight:600, marginBottom:6 }}>{drag?'Drop images here':'Resize Images'}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span> · JPG, PNG, WebP, GIF, BMP</div>
            <div style={{ marginTop:10, display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
              {['Pixel / Percent','Fit Modes','Common Presets','Format Convert','Live Preview','ZIP / Direct'].map(t=>(
                <span key={t} style={{ fontSize:10, padding:'3px 9px', borderRadius:100, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text-muted)', fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>
        </label>
      )}

      {/* ══ READY / PROCESSING / DONE ══ */}
      {stage!=='idle' && (
        <div style={{ display: isDesktop ? 'grid' : 'flex', flexDirection: isDesktop ? 'row' : 'column', gridTemplateColumns: isDesktop ? '280px 1fr' : undefined, gap:16, alignItems:'start' }}>

          {/* LEFT: Settings sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:12, position:'sticky', top:16 }}>

            {/* Live canvas preview */}
            {items.length > 0 && (
              <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid var(--border)', background:'var(--surface,#111118)' }}>
                <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase' }}>
                  Preview
                </div>
                <canvas ref={previewCanvasRef} width={240} style={{ display:'block', width:'100%', maxHeight:200, objectFit:'contain' }}/>
              </div>
            )}

            {/* Resize mode tabs */}
            <div style={Card}>
              <div style={SH}>Resize Mode</div>
              <div style={{ display:'flex', gap:5 }}>
                {[{v:'pixels',l:'Pixels',I:Maximize2},{v:'percent',l:'Percent',I:Percent}].map(({v,l,I})=>(
                  <button key={v} onClick={()=>setResizeMode(v)}
                    style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:8, cursor:'pointer', border:'none', transition:'all 0.15s', fontSize:12, fontWeight:600,
                      outline:`1px solid ${resizeMode===v?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                      background:resizeMode===v?'rgba(37,99,235,0.08)':'var(--surface,#111118)',
                      color:resizeMode===v?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                    <I size={13}/>{l}
                  </button>
                ))}
              </div>
            </div>

            {/* Pixel inputs */}
            {resizeMode==='pixels' && (
              <div style={Card}>
                <div style={SH}>Dimensions</div>

                {/* Common presets */}
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:12 }}>
                  {COMMON_SIZES.map(s=>(
                    <button key={s.label} onClick={()=>{ setTargetW(s.w); setTargetH(s.h); setLockAspect(false); }}
                      style={{ padding:'4px 9px', borderRadius:100, fontSize:10, fontWeight:600, cursor:'pointer', transition:'all 0.15s', border:'none',
                        outline:`1px solid ${targetW===s.w&&targetH===s.h?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                        background:targetW===s.w&&targetH===s.h?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                        color:targetW===s.w&&targetH===s.h?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* W × H inputs */}
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={LS}>W (px)</div>
                    <input type="number" value={targetW} min={1} onChange={e=>updateW(e.target.value)}
                      style={{ ...IN, textAlign:'center', fontWeight:700, fontSize:15, padding:'10px' }}/>
                  </div>
                  <button onClick={()=>setLockAspect(v=>!v)} title={lockAspect?'Unlock aspect':'Lock aspect'}
                    style={{ ...IB, marginTop:18, background: lockAspect?'rgba(37,99,235,0.1)':'transparent', borderColor:lockAspect?'rgba(37,99,235,0.4)':'var(--border)', color:lockAspect?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                    {lockAspect ? <Link size={14}/> : <Link2Off size={14}/>}
                  </button>
                  <div style={{ flex:1 }}>
                    <div style={LS}>H (px)</div>
                    <input type="number" value={targetH} min={1} onChange={e=>updateH(e.target.value)}
                      style={{ ...IN, textAlign:'center', fontWeight:700, fontSize:15, padding:'10px' }}/>
                  </div>
                </div>
                <div style={{ marginTop:8, fontSize:10, color:'var(--text-muted)', textAlign:'center', fontFamily:'monospace' }}>
                  {lockAspect?'🔒 Aspect ratio locked':'🔓 Aspect ratio unlocked'}
                </div>

                {/* Fit mode */}
                <div style={{ marginTop:12 }}>
                  <div style={LS}>Fit Mode</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {FIT_MODES.map(m=>(
                      <button key={m.value} onClick={()=>setFitMode(m.value)}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:7, cursor:'pointer', textAlign:'left', border:'none', transition:'all 0.15s',
                          outline:`1px solid ${fitMode===m.value?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                          background:fitMode===m.value?'rgba(37,99,235,0.07)':'var(--surface,#111118)' }}>
                        <div style={{ width:30, height:18, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                          background:fitMode===m.value?'var(--accent-blue,#2563EB)':'var(--border)' }}>
                          <span style={{ fontSize:8, fontWeight:800, color:'white', fontFamily:'monospace' }}>{m.label.slice(0,3).toUpperCase()}</span>
                        </div>
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:fitMode===m.value?'var(--accent-blue,#2563EB)':'var(--text)', marginBottom:1 }}>{m.label}</div>
                          <div style={{ fontSize:9, color:'var(--text-muted)' }}>{m.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Percent inputs */}
            {resizeMode==='percent' && (
              <div style={Card}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={SH}>Scale Factor</div>
                  <span style={{ fontSize:18, fontWeight:800, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{targetPct}%</span>
                </div>
                <input type="range" min={5} max={200} step={5} value={targetPct} onChange={e=>setTargetPct(Number(e.target.value))}
                  style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer', marginBottom:10 }}/>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {[25,50,75,100,150,200].map(p=>(
                    <button key={p} onClick={()=>setTargetPct(p)}
                      style={{ flex:1, minWidth:38, padding:'6px 4px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700, border:'none', transition:'all 0.15s', fontFamily:'monospace',
                        outline:`1px solid ${targetPct===p?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                        background:targetPct===p?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                        color:targetPct===p?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                      {p}%
                    </button>
                  ))}
                </div>
                {items[0]?.origDim && (
                  <div style={{ marginTop:10, fontSize:11, color:'var(--text-muted)', fontFamily:'monospace', textAlign:'center' }}>
                    {items[0].origDim.w}×{items[0].origDim.h} → {Math.round(items[0].origDim.w*targetPct/100)}×{Math.round(items[0].origDim.h*targetPct/100)}
                  </div>
                )}
              </div>
            )}

            {/* Output format + quality */}
            <div style={Card}>
              <div style={SH}>Output Format</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom: outFmt!=='png'?12:0 }}>
                {OUTPUT_FMTS.map(f=>(
                  <button key={f.value} onClick={()=>setOutFmt(f.value)}
                    style={{ padding:'7px 5px', borderRadius:7, cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'monospace', border:'none', transition:'all 0.15s',
                      outline:`1px solid ${outFmt===f.value?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                      background:outFmt===f.value?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                      color:outFmt===f.value?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                    {f.label}
                  </button>
                ))}
              </div>
              {outFmt!=='png' && outFmt!=='original' && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <div style={LS}>Quality</div>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{quality}%</span>
                  </div>
                  <input type="range" min={30} max={100} step={1} value={quality} onChange={e=>setQuality(Number(e.target.value))}
                    style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
                </div>
              )}
            </div>

            {/* Background (for contain mode) */}
            {fitMode==='contain' && resizeMode==='pixels' && (
              <div style={Card}>
                <div style={SH}>Letterbox Color</div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {['#ffffff','#000000','#1a1a2e','#f3f4f6'].map(c=>(
                    <button key={c} onClick={()=>setBgColor(c)}
                      style={{ width:28, height:28, borderRadius:7, cursor:'pointer', background:c, border:'none', transition:'all 0.15s',
                        outline:bgColor===c?'2px solid var(--accent-blue,#2563EB)':'1px solid var(--border)', outlineOffset:2 }}/>
                  ))}
                  <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)}
                    style={{ width:28, height:28, border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', padding:0, background:'none' }}/>
                </div>
              </div>
            )}

            {/* Stats */}
            {doneItems.length > 0 && (
              <div style={{ padding:'12px 14px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid rgba(22,163,74,0.2)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[{l:'DONE',v:`${doneItems.length}/${items.length}`},{l:'ORIG',v:fmtBytes(items.reduce((s,i)=>s+i.origSize,0))},
                    {l:'NEW',v:fmtBytes(doneItems.reduce((s,i)=>s+(i.newSize||0),0)),c:'#16a34a'},
                    {l:'SAVED',v:(() => {
                      const o=doneItems.reduce((s,i)=>s+i.origSize,0), n=doneItems.reduce((s,i)=>s+(i.newSize||0),0);
                      return `${Math.max(0,Math.round((1-n/o)*100))}%`;
                    })(),c:'#16a34a'},
                  ].map(({l,v,c})=>(
                    <div key={l}><div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:2 }}>{l}</div><div style={{ fontSize:13, fontWeight:800, color:c||'var(--text)', fontFamily:'monospace' }}>{v}</div></div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {pendingItems.length > 0 && stage!=='processing' && (
                <button onClick={processAll}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none',
                    background:'var(--accent-blue,#2563EB)', color:'white', fontSize:14, fontWeight:600, cursor:'pointer',
                    boxShadow:'0 4px 16px rgba(37,99,235,0.3)', transition:'all 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  <Zap size={15}/> Resize {pendingItems.length} Image{pendingItems.length!==1?'s':''}
                </button>
              )}
              {stage==='processing' && (
                <button disabled style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none', background:'var(--surface-raised,#18181f)', color:'var(--text-muted)', fontSize:14, fontWeight:600, cursor:'not-allowed' }}>
                  <div style={{ width:14, height:14, border:'2px solid rgba(37,99,235,0.2)', borderTopColor:'var(--accent-blue,#2563EB)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                  Resizing…
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
                  {doneItems.length===1 ? 'Download Image' : `Download ZIP (${doneItems.length})`}
                </button>
              )}
              <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px', borderRadius:9, border:'1px dashed var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-blue,#2563EB)';e.currentTarget.style.color='var(--accent-blue,#2563EB)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)';}}>
                <input ref={addMoreRef} type="file" multiple accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
                <Plus size={13}/> Add More
              </label>
              <button onClick={reset} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                <RotateCcw size={12}/> Start Over
              </button>
            </div>
          </div>

          {/* RIGHT: Image cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Progress bar */}
            {stage==='processing' && (
              <div style={{ padding:'10px 14px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid rgba(37,99,235,0.3)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'monospace', marginBottom:6 }}>
                  <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:700 }}>Resizing…</span>
                  <span style={{ color:'var(--text-muted)' }}>{doneItems.length}/{items.length} done</span>
                </div>
                <div style={{ height:4, background:'var(--border)', borderRadius:100, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:100, background:'linear-gradient(90deg,var(--accent-blue,#2563EB),#60a5fa)',
                    width:`${items.length?Math.round(doneItems.length/items.length*100):0}%`, transition:'width 0.4s ease' }}/>
                </div>
              </div>
            )}

            {/* Cards */}
            <div style={{ display:'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? Math.min(140, 200) : 200}px,1fr))`, gap:10 }}>
              {items.map(item => (
                <div key={item.id} style={{ borderRadius:12, overflow:'hidden', border:`1px solid ${item.status==='done'?'rgba(22,163,74,0.3)':item.status==='processing'?'rgba(37,99,235,0.4)':'var(--border)'}`,
                  background:'var(--surface-raised,#18181f)', transition:'all 0.2s' }}>

                  {/* Thumbnail */}
                  <div style={{ position:'relative', aspectRatio:'4/3', overflow:'hidden', background:'#0a0a0f',
                    cursor:item.status==='done'?'zoom-in':'default' }}
                    onClick={()=>item.status==='done'&&setLightbox(item.id)}>
                    <img src={item.status==='done'&&item.compUrl?item.compUrl:item.origUrl}
                      alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>

                    {item.status==='processing' && (
                      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
                        <div style={{ width:28, height:28, border:'2px solid rgba(255,255,255,0.15)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                        <span style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>Resizing…</span>
                      </div>
                    )}
                    {item.status==='done' && item.newDim && (
                      <div style={{ position:'absolute', bottom:6, right:6, padding:'3px 7px', borderRadius:100, background:'rgba(22,163,74,0.9)', color:'white', fontSize:9, fontWeight:700, fontFamily:'monospace', backdropFilter:'blur(4px)' }}>
                        {item.newDim.w}×{item.newDim.h}
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div style={{ padding:'10px 12px' }}>
                    <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:5 }}>{item.name}</div>

                    {item.status==='done' ? (
                      <div style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)', marginBottom:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                          <span>{item.origDim?`${item.origDim.w}×${item.origDim.h}`:'—'}</span>
                          <ArrowRight size={9}/>
                          <span style={{ color:'#16a34a', fontWeight:700 }}>{item.newDim?`${item.newDim.w}×${item.newDim.h}`:'—'}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span>{fmtBytes(item.origSize)}</span>
                          <ArrowRight size={9}/>
                          <span style={{ color:'#16a34a', fontWeight:700 }}>{fmtBytes(item.newSize)}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace', marginBottom:8 }}>
                        {item.origDim?`${item.origDim.w}×${item.origDim.h}`:'Loading…'} · {fmtBytes(item.origSize)}
                      </div>
                    )}

                    <div style={{ display:'flex', gap:5 }}>
                      {item.status==='done' && (
                        <>
                          <button onClick={()=>setLightbox(item.id)}
                            style={{ ...SmBtn, flex:1, gap:5 }}><Eye size={11}/> Preview</button>
                          <button onClick={()=>dlOne(item)}
                            style={{ ...SmBtn, background:'rgba(22,163,74,0.1)', borderColor:'rgba(22,163,74,0.3)', color:'#16a34a' }}>
                            <Download size={12}/>
                          </button>
                        </>
                      )}
                      {item.status==='pending' && (
                        <button onClick={()=>removeItem(item.id)} style={{ ...SmBtn, flex:1, gap:5, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)' }}>
                          <Trash2 size={11}/> Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ LIGHTBOX ══ */}
      {lightbox && lbItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', backdropFilter:'blur(10px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setLightbox(null)}>
          <div style={{ maxWidth:'90vw', width:760, display:'flex', flexDirection:'column', gap:12 }} onClick={e=>e.stopPropagation()}>

            {/* Top bar */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderRadius:12, background:'rgba(255,255,255,0.07)', backdropFilter:'blur(10px)' }}>
              <span style={{ fontSize:13, fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lbItem.name}</span>
              <div style={{ display:'flex', gap:5 }}>
                <button onClick={()=>{ if(lbIdx>0) setLightbox(items[lbIdx-1].id); }} disabled={lbIdx===0} style={{ ...IB, opacity:lbIdx===0?0.3:1 }}><ChevronLeft size={14}/></button>
                <span style={{ fontSize:11, color:'var(--text-muted)', padding:'0 6px', lineHeight:'30px', fontFamily:'monospace' }}>{lbIdx+1}/{items.length}</span>
                <button onClick={()=>{ if(lbIdx<items.length-1) setLightbox(items[lbIdx+1].id); }} disabled={lbIdx>=items.length-1} style={{ ...IB, opacity:lbIdx>=items.length-1?0.3:1 }}><ChevronRight size={14}/></button>
                <button onClick={()=>dlOne(lbItem)} style={{ ...IB, background:'rgba(22,163,74,0.15)', borderColor:'rgba(22,163,74,0.4)', color:'#16a34a' }}><Download size={13}/></button>
                <button onClick={()=>setLightbox(null)} style={{ ...IB, color:'#ef4444', borderColor:'rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.1)' }}><X size={13}/></button>
              </div>
            </div>

            {/* Before / After tabs */}
            <div style={{ display:'flex', gap:5, padding:4, background:'rgba(255,255,255,0.06)', borderRadius:10 }}>
              {['before','after'].map(s=>(
                <button key={s} onClick={()=>setLbSide(s)}
                  style={{ flex:1, padding:'8px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, transition:'all 0.15s', textTransform:'capitalize',
                    background:lbSide===s?'rgba(255,255,255,0.12)':'transparent',
                    color:lbSide===s?'white':'rgba(255,255,255,0.45)' }}>
                  {s==='before'?`Before — ${lbItem.origDim?`${lbItem.origDim.w}×${lbItem.origDim.h}`:''}  ${fmtBytes(lbItem.origSize)}`
                    :`After — ${lbItem.newDim?`${lbItem.newDim.w}×${lbItem.newDim.h}`:''}  ${fmtBytes(lbItem.newSize)}`}
                </button>
              ))}
            </div>

            {/* Image */}
            <div style={{ borderRadius:12, overflow:'hidden', background:'#111', maxHeight:'65vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img src={lbSide==='before'?lbItem.origUrl:lbItem.compUrl}
                alt={lbSide} style={{ maxWidth:'100%', maxHeight:'65vh', display:'block', objectFit:'contain' }}/>
            </div>

            {/* Meta */}
            <div style={{ display:'flex', gap:16, padding:'10px 16px', borderRadius:10, background:'rgba(255,255,255,0.05)', fontSize:11, fontFamily:'monospace', flexWrap:'wrap' }}>
              {[
                { l:'ORIG DIM',  v:lbItem.origDim?`${lbItem.origDim.w}×${lbItem.origDim.h}`:'—' },
                { l:'NEW DIM',   v:lbItem.newDim?`${lbItem.newDim.w}×${lbItem.newDim.h}`:'—', c:'#16a34a' },
                { l:'ORIG SIZE', v:fmtBytes(lbItem.origSize) },
                { l:'NEW SIZE',  v:fmtBytes(lbItem.newSize), c:'#16a34a' },
                { l:'FORMAT',    v:(OUTPUT_FMTS.find(f=>f.value===outFmt)?.label||'—').toUpperCase() },
                { l:'FIT',       v:fitMode.toUpperCase() },
              ].map(({l,v,c})=>(
                <div key={l}><div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', letterSpacing:'0.1em', marginBottom:3 }}>{l}</div><div style={{ fontWeight:700, color:c||'white' }}>{v}</div></div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const OverlayBase = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', backdropFilter: 'blur(4px)' };
const SpinnerBig = { width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 };

const IB    = { display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:7, flexShrink:0, border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)', color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s' };
const IN    = { width:'100%', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13, outline:'none', boxSizing:'border-box', padding:'8px 10px', fontFamily:'monospace' };
const Card  = { padding:'14px', borderRadius:12, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)' };
const SH    = { fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10, display:'block' };
const LS    = { fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:6, display:'block' };
const SmBtn = { display:'flex', alignItems:'center', justifyContent:'center', padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--surface,#111118)', color:'var(--text-muted)', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s' };