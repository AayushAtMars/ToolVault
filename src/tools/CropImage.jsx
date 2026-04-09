import { useState, useRef, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import {
  Upload, Download, Scissors, RefreshCw, RotateCcw,
  Image as ImageIcon, X, Layout, ChevronUp, ChevronDown,
  FlipHorizontal, FlipVertical, ZoomIn, ZoomOut,
  Maximize2, Instagram, Twitter, Monitor, Smartphone,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────── */
function fmtBytes(b) {
  if (!b) return '—';
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${['B','KB','MB','GB'][i]}`;
}

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
        style={{ width:'100%', display:'flex', alignItems:'center', gap:7, padding:'10px 14px', background:'transparent', border:'none', cursor:'pointer' }}>
        {Icon && <Icon size={12} style={{ color:'var(--text-muted)' }}/>}
        <span style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'left' }}>{title}</span>
        {open ? <ChevronUp size={13} style={{ color:'var(--text-muted)' }}/> : <ChevronDown size={13} style={{ color:'var(--text-muted)' }}/>}
      </button>
      {open && <div style={{ padding:'0 14px 14px' }}>{children}</div>}
    </div>
  );
}

/* ── aspect ratio presets ────────────────────────────────── */
const PRESETS = [
  { id:'free',   label:'Free',    value:null,    icon:'⊞',  group:'basic' },
  { id:'1:1',    label:'Square',  value:1,       icon:'□',  group:'basic' },
  { id:'4:3',    label:'4:3',     value:4/3,     icon:'▭',  group:'basic' },
  { id:'3:4',    label:'3:4',     value:3/4,     icon:'▯',  group:'basic' },
  { id:'16:9',   label:'16:9 HD', value:16/9,    icon:'▬',  group:'basic' },
  { id:'9:16',   label:'9:16',    value:9/16,    icon:'▮',  group:'basic' },
  { id:'3:2',    label:'3:2',     value:3/2,     icon:'▭',  group:'basic' },
  { id:'2:3',    label:'2:3',     value:2/3,     icon:'▯',  group:'basic' },
  { id:'ig-sq',  label:'IG Post', value:1,       icon:'📷', group:'social', desc:'1080×1080' },
  { id:'ig-port',label:'IG Port', value:4/5,     icon:'📷', group:'social', desc:'1080×1350' },
  { id:'ig-land',label:'IG Land', value:1.91,    icon:'📷', group:'social', desc:'1080×566'  },
  { id:'ig-story',label:'Story',  value:9/16,    icon:'📱', group:'social', desc:'1080×1920' },
  { id:'tw-post',label:'X Post',  value:16/9,    icon:'🐦', group:'social', desc:'1200×675'  },
  { id:'tw-head',label:'X Header',value:3,       icon:'🐦', group:'social', desc:'1500×500'  },
  { id:'yt',     label:'YouTube', value:16/9,    icon:'▶', group:'social', desc:'1280×720'  },
  { id:'fb-cover',label:'FB Cover',value:820/312,icon:'👥', group:'social', desc:'820×312'   },
];

const OUTPUT_FMTS = [
  { value:'png',  label:'PNG',  mime:'image/png',  quality:null, desc:'Lossless' },
  { value:'jpeg', label:'JPEG', mime:'image/jpeg', quality:0.93, desc:'Smaller'  },
  { value:'webp', label:'WebP', mime:'image/webp', quality:0.92, desc:'Modern'   },
];

/* ── canvas crop ─────────────────────────────────────────── */
async function cropCanvas(imgSrc, pixelCrop, rotation, flipH, flipV, outFmt, maxW, maxH) {
  const image = await new Promise((res, rej) => {
    const img = new window.Image();
    img.onload  = () => res(img);
    img.onerror = rej;
    img.crossOrigin = 'anonymous';
    img.src = imgSrc;
  });

  const rotRad = (rotation * Math.PI) / 180;
  const bw = Math.abs(Math.cos(rotRad)*image.width) + Math.abs(Math.sin(rotRad)*image.height);
  const bh = Math.abs(Math.sin(rotRad)*image.width) + Math.abs(Math.cos(rotRad)*image.height);

  // Rotation + flip canvas
  const rotCvs = document.createElement('canvas');
  rotCvs.width  = bw; rotCvs.height = bh;
  const rotCtx  = rotCvs.getContext('2d');
  rotCtx.translate(bw/2, bh/2);
  rotCtx.rotate(rotRad);
  rotCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  rotCtx.drawImage(image, -image.width/2, -image.height/2);

  // Crop region
  let cw = pixelCrop.width, ch = pixelCrop.height;
  // Optionally scale down to maxW/maxH
  if (maxW && cw > maxW) { const r=maxW/cw; cw=maxW; ch=Math.round(ch*r); }
  if (maxH && ch > maxH) { const r=maxH/ch; ch=maxH; cw=Math.round(cw*r); }

  const cropCvs = document.createElement('canvas');
  cropCvs.width = cw; cropCvs.height = ch;
  const cropCtx = cropCvs.getContext('2d');
  cropCtx.drawImage(rotCvs, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, cw, ch);

  return new Promise(resolve => {
    cropCvs.toBlob(blob => {
      resolve({ blob, url: URL.createObjectURL(blob), w:cw, h:ch });
    }, outFmt.mime, outFmt.quality ?? undefined);
  });
}

/* ════════════════════════════════════════════════════════ */
export default function CropImage() {
  const vw        = useWidth();
  const isMobile  = vw < 640;
  const isDesktop = vw >= 1024;

  const [orig, setOrig]         = useState(null);  // { url, name, size, w, h }
  const [crop, setCrop]         = useState({ x:0, y:0 });
  const [zoom, setZoom]         = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH]       = useState(false);
  const [flipV, setFlipV]       = useState(false);
  const [aspect, setAspect]     = useState(PRESETS[0]);
  const [pixelCrop, setPixelCrop] = useState(null);
  const [cropInfo, setCropInfo] = useState(null);   // { width, height }
  const [isWorking, setIsWorking] = useState(false);
  const [result, setResult]     = useState(null);   // { url, blob, size, w, h }
  const [drag, setDrag]         = useState(false);
  const [activeGroup, setActiveGroup] = useState('basic'); // basic | social

  // Output settings
  const [outFmt,  setOutFmt]  = useState('png');
  const [maxW,    setMaxW]    = useState('');
  const [maxH,    setMaxH]    = useState('');
  const [quality, setQuality] = useState(93);

  const fileInputRef = useRef(null);

  /* ── ingest ──────────────────────────────────────────────── */
  const ingest = (file) => {
    if (!file?.type?.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setOrig({ url, name:file.name, size:file.size, w:img.naturalWidth, h:img.naturalHeight });
    };
    img.src = url;
    setResult(null); setZoom(1); setRotation(0); setFlipH(false); setFlipV(false);
    setCrop({ x:0, y:0 });
  };

  const onFilePick = (e) => { if (e.target.files?.[0]) ingest(e.target.files[0]); };
  const onDrop     = (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) ingest(f);
  };

  /* ── crop complete callback ──────────────────────────────── */
  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setPixelCrop(croppedAreaPixels);
    setCropInfo({ width:croppedAreaPixels.width, height:croppedAreaPixels.height });
  }, []);

  /* ── run crop ────────────────────────────────────────────── */
  const handleCrop = async () => {
    if (!pixelCrop || !orig) return;
    setIsWorking(true);
    try {
      const fmt = OUTPUT_FMTS.find(f => f.value===outFmt);
      const mw  = maxW ? parseInt(maxW) : null;
      const mh  = maxH ? parseInt(maxH) : null;
      const q   = fmt.value!=='png' ? quality/100 : null;
      const res = await cropCanvas(orig.url, pixelCrop, rotation, flipH, flipV,
        { ...fmt, quality: q }, mw, mh);
      setResult({ ...res, size:res.blob.size });
    } catch(e) { console.error(e); }
    finally    { setIsWorking(false); }
  };

  /* ── download ────────────────────────────────────────────── */
  const download = () => {
    if (!result) return;
    const a   = document.createElement('a');
    const base = orig.name.replace(/\.[^/.]+$/, '');
    a.href = result.url; a.download = `${base}_cropped.${outFmt}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const reset = () => {
    setOrig(null); setResult(null);
    setZoom(1); setRotation(0); setFlipH(false); setFlipV(false);
    setCrop({ x:0, y:0 }); setAspect(PRESETS[0]);
  };

  const fmt = OUTPUT_FMTS.find(f => f.value===outFmt);

  /* ── sidebar content ─────────────────────────────────────── */
  const SidebarContent = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* File info */}
      {orig && (
        <Collapsible title="Image Info" icon={ImageIcon} defaultOpen={false}>
          <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:11 }}>
            {[
              { l:'File',   v:orig.name },
              { l:'Size',   v:fmtBytes(orig.size) },
              { l:'Dims',   v:orig.w&&orig.h?`${orig.w}×${orig.h}px`:'—' },
              ...(cropInfo?[{ l:'Crop',  v:`${cropInfo.width}×${cropInfo.height}px` }]:[]),
              ...(result?[{ l:'Output', v:`${result.w}×${result.h}px · ${fmtBytes(result.size)}`, c:'#16a34a' }]:[]),
            ].map(({l,v,c})=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                <span style={{ color:'var(--text-muted)' }}>{l}</span>
                <span style={{ color:c||'var(--text)', fontWeight:600, fontFamily:'monospace', fontSize:10, textAlign:'right', wordBreak:'break-all' }}>{v}</span>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Aspect ratio */}
      {!result && (
        <Collapsible title="Aspect Ratio" icon={Layout}>
          {/* Group tabs */}
          <div style={{ display:'flex', gap:4, marginBottom:10 }}>
            {['basic','social'].map(g=>(
              <button key={g} onClick={()=>setActiveGroup(g)}
                style={{ flex:1, padding:'6px', borderRadius:7, cursor:'pointer', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', border:'none', transition:'all 0.15s',
                  outline:`1px solid ${activeGroup===g?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                  background:activeGroup===g?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                  color:activeGroup===g?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                {g}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {PRESETS.filter(p=>p.group===activeGroup).map(p=>(
              <button key={p.id} onClick={()=>setAspect(p)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', border:'none', transition:'all 0.15s',
                  outline:`1px solid ${aspect.id===p.id?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                  background:aspect.id===p.id?'rgba(37,99,235,0.08)':'var(--surface,#111118)' }}>
                <span style={{ fontSize:14, flexShrink:0, width:20, textAlign:'center' }}>{p.icon}</span>
                <span style={{ flex:1, fontSize:12, fontWeight:600, color:aspect.id===p.id?'var(--accent-blue,#2563EB)':'var(--text)', textAlign:'left' }}>{p.label}</span>
                {p.desc && <span style={{ fontSize:9, color:'var(--text-muted)', fontFamily:'monospace' }}>{p.desc}</span>}
                {aspect.id===p.id && <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-blue,#2563EB)', flexShrink:0 }}/>}
              </button>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Transform — only in crop mode */}
      {!result && orig && (
        <Collapsible title="Transform">
          {/* Zoom */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={LS}>Zoom</span>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{zoom.toFixed(2)}×</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={()=>setZoom(z=>Math.max(1,z-0.1))} style={IB}><ZoomOut size={13}/></button>
              <input type="range" min={1} max={5} step={0.05} value={zoom} onChange={e=>setZoom(Number(e.target.value))}
                style={{ flex:1, accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
              <button onClick={()=>setZoom(z=>Math.min(5,z+0.1))} style={IB}><ZoomIn size={13}/></button>
            </div>
          </div>

          {/* Rotation */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={LS}>Rotation</span>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{rotation}°</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={()=>setRotation(r=>(r-90+360)%360)} style={IB}><RotateCcw size={13}/></button>
              <input type="range" min={-180} max={180} step={1} value={rotation} onChange={e=>setRotation(Number(e.target.value))}
                style={{ flex:1, accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
              <button onClick={()=>setRotation(r=>(r+90)%360)} style={{ ...IB, transform:'scaleX(-1)' }}><RotateCcw size={13}/></button>
            </div>
          </div>

          {/* Flip */}
          <div>
            <div style={LS}>Flip</div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>setFlipH(v=>!v)}
                style={{ ...IB, flex:1, width:'auto', gap:6, fontSize:11, fontWeight:600, padding:'0 10px',
                  outline:flipH?'1px solid var(--accent-blue,#2563EB)':'1px solid var(--border)',
                  background:flipH?'rgba(37,99,235,0.1)':'transparent',
                  color:flipH?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                <FlipHorizontal size={13}/> H
              </button>
              <button onClick={()=>setFlipV(v=>!v)}
                style={{ ...IB, flex:1, width:'auto', gap:6, fontSize:11, fontWeight:600, padding:'0 10px',
                  outline:flipV?'1px solid var(--accent-blue,#2563EB)':'1px solid var(--border)',
                  background:flipV?'rgba(37,99,235,0.1)':'transparent',
                  color:flipV?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                <FlipVertical size={13}/> V
              </button>
              <button onClick={()=>{ setZoom(1); setRotation(0); setFlipH(false); setFlipV(false); }}
                style={{ ...IB, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.05)' }} title="Reset all">
                <RefreshCw size={13}/>
              </button>
            </div>
          </div>
        </Collapsible>
      )}

      {/* Output settings */}
      <Collapsible title="Output Settings" defaultOpen={false}>
        {/* Format */}
        <div style={{ marginBottom:14 }}>
          <div style={LS}>Format</div>
          <div style={{ display:'flex', gap:4 }}>
            {OUTPUT_FMTS.map(f=>(
              <button key={f.value} onClick={()=>setOutFmt(f.value)}
                style={{ flex:1, padding:'8px 4px', borderRadius:8, cursor:'pointer', textAlign:'center', border:'none', fontSize:10, fontWeight:700, fontFamily:'monospace', transition:'all 0.15s',
                  outline:`1px solid ${outFmt===f.value?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                  background:outFmt===f.value?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                  color:outFmt===f.value?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                <div>{f.label}</div>
                <div style={{ fontSize:8, marginTop:1, opacity:0.7 }}>{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Quality (lossy only) */}
        {outFmt!=='png' && (
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={LS}>Quality</span>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{quality}%</span>
            </div>
            <input type="range" min={30} max={100} step={1} value={quality} onChange={e=>setQuality(Number(e.target.value))}
              style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
          </div>
        )}

        {/* Max output size */}
        <div>
          <div style={LS}>Max Output Size (optional)</div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input type="number" placeholder="Width" value={maxW} onChange={e=>setMaxW(e.target.value)}
              style={{ ...IN, flex:1, textAlign:'center', padding:'7px 8px', fontSize:12 }}/>
            <span style={{ color:'var(--text-muted)', fontSize:12 }}>×</span>
            <input type="number" placeholder="Height" value={maxH} onChange={e=>setMaxH(e.target.value)}
              style={{ ...IN, flex:1, textAlign:'center', padding:'7px 8px', fontSize:12 }}/>
            <span style={{ fontSize:10, color:'var(--text-muted)' }}>px</span>
          </div>
          <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:5, lineHeight:1.5 }}>Leave blank to keep original crop resolution</div>
        </div>
      </Collapsible>

      {/* Action buttons */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {!result ? (
          <button onClick={handleCrop} disabled={isWorking||!pixelCrop}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none',
              background: pixelCrop&&!isWorking ? 'var(--accent-blue,#2563EB)' : 'var(--surface-raised,#18181f)',
              color: pixelCrop&&!isWorking ? 'white' : 'var(--text-muted)',
              fontSize:14, fontWeight:600, cursor: pixelCrop&&!isWorking ? 'pointer' : 'not-allowed',
              boxShadow: pixelCrop&&!isWorking ? '0 4px 16px rgba(37,99,235,0.3)' : 'none', transition:'all 0.15s' }}
            onMouseEnter={e=>{ if(pixelCrop&&!isWorking) e.currentTarget.style.transform='translateY(-1px)'; }}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            {isWorking ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Processing…</> : <><Scissors size={15}/> Crop Image</>}
          </button>
        ) : (
          <>
            <button onClick={download}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none',
                background:'#16a34a', color:'white', fontSize:14, fontWeight:600, cursor:'pointer',
                boxShadow:'0 4px 16px rgba(22,163,74,0.3)', transition:'all 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <Download size={15}/> Download .{outFmt.toUpperCase()}
            </button>
            <button onClick={()=>setResult(null)}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>
              <Scissors size={13}/> Edit Crop
            </button>
          </>
        )}
        <button onClick={reset}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9, border:'none', background:'transparent', color:'#ef4444', fontSize:12, cursor:'pointer' }}>
          <X size={12}/> Cancel & Clear
        </button>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ══ IDLE ══ */}
      {!orig && (
        <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14,
            padding: isMobile ? '48px 20px' : '80px 40px',
            border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:16,
            background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.2s' }}>
          <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={onFilePick}/>
          <div style={{ width:72, height:72, borderRadius:20, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
            background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)', transition:'all 0.2s' }}>
            <Scissors size={28} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:isMobile?15:17, fontWeight:600, marginBottom:6 }}>{drag?'Drop image here':'Crop Image'}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span></div>
            <div style={{ marginTop:10, display:'flex', gap:5, justifyContent:'center', flexWrap:'wrap' }}>
              {['Free Crop','Aspect Presets','Social Sizes','Flip','Rotate','PNG · JPEG · WebP','Max Output Size'].map(t=>(
                <span key={t} style={{ fontSize:10, padding:'3px 8px', borderRadius:100, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text-muted)', fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>
        </label>
      )}

      {/* ══ ACTIVE ══ */}
      {orig && (
        <div style={{ display:isDesktop?'grid':'flex', gridTemplateColumns:'1fr 290px', flexDirection:'column', gap:14, alignItems:'start' }}>

          {/* Canvas area */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', flex:1 }}>
                {result ? '✓ Cropped Result' : `Cropping: ${aspect.label}${cropInfo?` · ${cropInfo.width}×${cropInfo.height}px`:''}`}
              </span>
              {!result && (
                <div style={{ display:'flex', gap:5 }}>
                  <button onClick={()=>setFlipH(v=>!v)} title="Flip horizontal"
                    style={{ ...IB, color:flipH?'var(--accent-blue,#2563EB)':'var(--text-muted)', background:flipH?'rgba(37,99,235,0.1)':'transparent' }}>
                    <FlipHorizontal size={13}/>
                  </button>
                  <button onClick={()=>setFlipV(v=>!v)} title="Flip vertical"
                    style={{ ...IB, color:flipV?'var(--accent-blue,#2563EB)':'var(--text-muted)', background:flipV?'rgba(37,99,235,0.1)':'transparent' }}>
                    <FlipVertical size={13}/>
                  </button>
                  <button onClick={()=>setRotation(r=>(r-90+360)%360)} title="Rotate 90° left" style={IB}><RotateCcw size={13}/></button>
                  <button onClick={()=>setRotation(r=>(r+90)%360)} title="Rotate 90° right" style={{ ...IB, transform:'scaleX(-1)' }}><RotateCcw size={13}/></button>
                </div>
              )}
              {result && (
                <div style={{ display:'flex', gap:5 }}>
                  <span style={{ fontSize:10, fontFamily:'monospace', color:'#16a34a', fontWeight:700 }}>{result.w}×{result.h} · {fmtBytes(result.size)}</span>
                  <button onClick={download} style={{ ...IB, background:'rgba(22,163,74,0.1)', borderColor:'rgba(22,163,74,0.3)', color:'#16a34a' }}><Download size={13}/></button>
                </div>
              )}
            </div>

            {/* Main canvas */}
            <div style={{ position:'relative', height: isMobile ? 320 : 520,
              background:'#050508', borderRadius:14, overflow:'hidden', border:'1px solid var(--border)' }}>
              {result ? (
                /* Result preview with checkered bg */
                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:24,
                  backgroundColor:'#111118', backgroundImage:'linear-gradient(45deg,#18181f 25%,transparent 25%,transparent 75%,#18181f 75%),linear-gradient(45deg,#18181f 25%,transparent 25%,transparent 75%,#18181f 75%)',
                  backgroundSize:'20px 20px', backgroundPosition:'0 0,10px 10px' }}>
                  <img src={result.url} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:8, boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}/>
                </div>
              ) : (
                <Cropper
                  image={orig.url}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect.value ?? undefined}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  style={{ containerStyle:{ background:'#050508' }, cropAreaStyle:{ border:'2px solid rgba(37,99,235,0.8)', boxShadow:'0 0 0 9999px rgba(0,0,0,0.55)' } }}
                />
              )}
            </div>

            {/* Zoom quick bar (below canvas, only in crop mode, desktop) */}
            {!result && isDesktop && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)' }}>
                <ZoomOut size={13} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
                <input type="range" min={1} max={5} step={0.05} value={zoom} onChange={e=>setZoom(Number(e.target.value))}
                  style={{ flex:1, accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
                <ZoomIn size={13} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace', minWidth:40, textAlign:'right' }}>{zoom.toFixed(2)}×</span>
                <div style={{ width:1, height:16, background:'var(--border)' }}/>
                <input type="range" min={-180} max={180} step={1} value={rotation} onChange={e=>setRotation(Number(e.target.value))}
                  style={{ width:120, accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace', minWidth:36, textAlign:'right' }}>{rotation}°</span>
              </div>
            )}

            {/* Mobile sidebar */}
            {!isDesktop && (
              <Collapsible title="Settings & Actions">
                <SidebarContent/>
              </Collapsible>
            )}
          </div>

          {/* Desktop sidebar */}
          {isDesktop && <SidebarContent/>}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const IB = { display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:7, flexShrink:0, border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)', color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s' };
const IN = { background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13, outline:'none', boxSizing:'border-box', width:'100%', padding:'8px 10px' };
const LS = { fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:6, display:'block' };