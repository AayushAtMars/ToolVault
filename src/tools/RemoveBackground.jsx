import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download, AlertCircle, RefreshCw, Scissors, Sparkles,
  Image as ImageIcon, X, ChevronUp, ChevronDown, Layers,
  Palette, ChevronLeft, ChevronRight, Check, Package, Plus,
  Settings2, Sliders,
} from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';

/* ── helpers ─────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 9); }
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

/* ── EDGE REFINEMENT ─────────────────────────────────────────
   Fixes white fringe / edge artifacts from AI bg removal.
   Steps:
   1. Erode alpha slightly (shrink mask inward)
   2. Despill: if pixel is semi-transparent and too bright (white spill),
      push RGB toward a neutral tone
   3. Feather edges with a small blur
───────────────────────────────────────────────────────────── */
async function refineEdges(blob, opts = {}) {
  const {
    erodeRadius    = 1,    // px to shrink mask inward (removes fringe)
    despillStrength= 0.6,  // 0–1, how aggressively to remove white spill
    featherRadius  = 1,    // 0–2, edge softness
    edgeThreshold  = 15,   // alpha below this = fully transparent
  } = opts;

  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight;
      const cvs = document.createElement('canvas');
      cvs.width = W; cvs.height = H;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, W, H);
      const d         = imageData.data;

      // ── Step 1: Erode alpha (shrink mask) ──────────────────
      if (erodeRadius > 0) {
        const alpha = new Float32Array(W * H);
        for (let i = 0; i < W * H; i++) alpha[i] = d[i*4+3];

        const eroded = new Float32Array(W * H);
        const r      = Math.round(erodeRadius);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            let minA = 255;
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                const nx = x+dx, ny = y+dy;
                if (nx<0||nx>=W||ny<0||ny>=H) { minA=0; continue; }
                minA = Math.min(minA, alpha[ny*W+nx]);
              }
            }
            eroded[y*W+x] = minA;
          }
        }
        for (let i = 0; i < W * H; i++) d[i*4+3] = eroded[i];
      }

      // ── Step 2: Hard-cut very low alpha ────────────────────
      for (let i = 0; i < W * H; i++) {
        if (d[i*4+3] < edgeThreshold) d[i*4+3] = 0;
      }

      // ── Step 3: Despill white fringe ──────────────────────
      // Semi-transparent pixels that are very bright (white spill)
      // get their RGB pushed down proportional to how transparent they are.
      for (let i = 0; i < W * H; i++) {
        const idx = i * 4;
        const a   = d[idx+3];
        if (a === 0 || a === 255) continue; // skip fully opaque/transparent

        const r = d[idx], g = d[idx+1], b = d[idx+2];
        // Brightness 0-255
        const brightness = (r + g + b) / 3;
        // White spill factor: how white is this pixel?
        const whiteness  = brightness / 255;
        // How semi-transparent it is (most fringe lives in 64–200 range)
        const edgeness   = 1 - (a / 255);
        const factor     = whiteness * edgeness * despillStrength;

        // Pull RGB toward a neutral mid-grey (prevents colour casts)
        d[idx]   = Math.round(r   - (r   - 128) * factor * 0.5);
        d[idx+1] = Math.round(g   - (g   - 128) * factor * 0.5);
        d[idx+2] = Math.round(b   - (b   - 128) * factor * 0.5);

        // Also reduce alpha proportionally for very white semi-pixels
        if (brightness > 200) {
          d[idx+3] = Math.round(a * (1 - whiteness * edgeness * 0.4));
        }
      }

      // ── Step 4: Feather edges ─────────────────────────────
      if (featherRadius > 0) {
        // Simple box-blur of the alpha channel only
        const alphaIn  = new Float32Array(W * H);
        const alphaOut = new Float32Array(W * H);
        for (let i = 0; i < W * H; i++) alphaIn[i] = d[i*4+3];

        const fr = Math.round(featherRadius);
        const kernelSize = (2*fr+1) * (2*fr+1);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            let sum = 0;
            for (let dy = -fr; dy <= fr; dy++) {
              for (let dx = -fr; dx <= fr; dx++) {
                const nx = Math.max(0, Math.min(W-1, x+dx));
                const ny = Math.max(0, Math.min(H-1, y+dy));
                sum += alphaIn[ny*W+nx];
              }
            }
            alphaOut[y*W+x] = sum / kernelSize;
          }
        }
        for (let i = 0; i < W * H; i++) d[i*4+3] = alphaOut[i];
      }

      ctx.putImageData(imageData, 0, 0);
      cvs.toBlob(b => resolve(b), 'image/png');
    };
    img.onerror = () => resolve(blob); // fallback to original if fail
    img.src = URL.createObjectURL(blob);
  });
}

/* ── drag-compare slider ─────────────────────────────────── */
function CompareSlider({ origUrl, cutoutUrl, bgStyle, style }) {
  const [pos, setPos]   = useState(50);
  const ref             = useRef(null);
  const dragging        = useRef(false);

  const move = (e) => {
    if (!dragging.current || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    setPos(Math.min(100, Math.max(0, (x / r.width) * 100)));
  };

  return (
    <div ref={ref} style={{ position:'relative', overflow:'hidden', cursor:'col-resize', userSelect:'none', ...style }}
      onMouseDown={()=>{ dragging.current=true; }} onMouseMove={move}
      onMouseUp={()=>{ dragging.current=false; }} onMouseLeave={()=>{ dragging.current=false; }}
      onTouchStart={()=>{ dragging.current=true; }} onTouchMove={move} onTouchEnd={()=>{ dragging.current=false; }}>

      {/* Right: cutout on chosen bg */}
      <div style={{ position:'absolute', inset:0, ...bgStyle }}/>
      <img src={cutoutUrl} style={{ position:'relative', width:'100%', height:'100%', objectFit:'contain', display:'block', zIndex:1 }}/>

      {/* Left: original clipped */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden', width:`${pos}%`, zIndex:2 }}>
        <img src={origUrl} style={{ width:`${10000/pos}%`, height:'100%', objectFit:'contain', display:'block' }}/>
      </div>

      {/* Divider */}
      <div style={{ position:'absolute', top:0, bottom:0, left:`${pos}%`, width:2, background:'white', transform:'translateX(-50%)', boxShadow:'0 0 10px rgba(0,0,0,0.5)', zIndex:3 }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:34, height:34, borderRadius:'50%', background:'white', boxShadow:'0 2px 14px rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:2 }}>
          <ChevronLeft size={11} style={{ color:'#333' }}/><ChevronRight size={11} style={{ color:'#333' }}/>
        </div>
      </div>

      <div style={{ position:'absolute', top:10, left:10, padding:'3px 9px', borderRadius:100, background:'rgba(0,0,0,0.65)', color:'white', fontSize:9, fontWeight:700, zIndex:4 }}>ORIGINAL</div>
      <div style={{ position:'absolute', top:10, right:10, padding:'3px 9px', borderRadius:100, background:'rgba(37,99,235,0.85)', color:'white', fontSize:9, fontWeight:700, zIndex:4 }}>CUTOUT</div>
    </div>
  );
}

/* ── background presets ──────────────────────────────────── */
const BG_PRESETS = [
  { id:'transparent', label:'None',   style:{ ...checkerStyle() } },
  { id:'#ffffff',     label:'White',  style:{ background:'#ffffff' } },
  { id:'#000000',     label:'Black',  style:{ background:'#000000' } },
  { id:'#1e293b',     label:'Dark',   style:{ background:'#1e293b' } },
  { id:'#f1f5f9',     label:'Light',  style:{ background:'#f1f5f9' } },
  { id:'grad-sunset', label:'Sunset', style:{ background:'linear-gradient(135deg,#f97316,#ec4899)' } },
  { id:'grad-sky',    label:'Sky',    style:{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)' } },
  { id:'grad-mint',   label:'Mint',   style:{ background:'linear-gradient(135deg,#10b981,#3b82f6)' } },
  { id:'grad-rose',   label:'Rose',   style:{ background:'linear-gradient(135deg,#f43f5e,#fb923c)' } },
  { id:'grad-gold',   label:'Gold',   style:{ background:'linear-gradient(135deg,#f59e0b,#84cc16)' } },
];

function checkerStyle() {
  return {
    backgroundColor:'#111118',
    backgroundImage:'linear-gradient(45deg,#1a1a24 25%,transparent 25%,transparent 75%,#1a1a24 75%),linear-gradient(45deg,#1a1a24 25%,transparent 25%,transparent 75%,#1a1a24 75%)',
    backgroundSize:'20px 20px', backgroundPosition:'0 0,10px 10px',
  };
}

async function renderWithBg(cutoutObjectUrl, bgId) {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => {
      const W=img.naturalWidth, H=img.naturalHeight;
      const cvs=document.createElement('canvas'); cvs.width=W; cvs.height=H;
      const ctx=cvs.getContext('2d');
      if (bgId!=='transparent') {
        const GRADS = {
          'grad-sunset':['#f97316','#ec4899'],'grad-sky':['#3b82f6','#8b5cf6'],
          'grad-mint':['#10b981','#3b82f6'],'grad-rose':['#f43f5e','#fb923c'],
          'grad-gold':['#f59e0b','#84cc16'],
        };
        if (GRADS[bgId]) {
          const [c1,c2]=GRADS[bgId];
          const grd=ctx.createLinearGradient(0,0,W,H);
          grd.addColorStop(0,c1); grd.addColorStop(1,c2);
          ctx.fillStyle=grd;
        } else { ctx.fillStyle=bgId; }
        ctx.fillRect(0,0,W,H);
      }
      ctx.drawImage(img,0,0);
      cvs.toBlob(b=>resolve(b),'image/png');
    };
    img.onerror=()=>resolve(null);
    img.src=cutoutObjectUrl;
  });
}

/* ════════════════════════════════════════════════════════ */
export default function RemoveBackground() {
  const vw        = useWidth();
  const isMobile  = vw < 640;
  const isDesktop = vw >= 1024;

  const [items, setItems]         = useState([]);
  const [activeId, setActiveId]   = useState(null);
  const [drag, setDrag]           = useState(false);
  const [error, setError]         = useState(null);

  // Settings
  const [bgId,         setBgId]         = useState('transparent');
  const [customBg,     setCustomBg]     = useState('#3b82f6');
  const [exportFmt,    setExportFmt]    = useState('png');
  const [showCompare,  setShowCompare]  = useState(false);

  // Edge refinement settings
  const [erode,        setErode]        = useState(1);
  const [despill,      setDespill]      = useState(0.6);
  const [feather,      setFeather]      = useState(1);
  const [edgeCut,      setEdgeCut]      = useState(15);
  const [autoRefine,   setAutoRefine]   = useState(true);

  const effectiveBgId = bgId==='custom' ? customBg : bgId;
  const bgStyleObj    = BG_PRESETS.find(p=>p.id===effectiveBgId)?.style
                        || { background: effectiveBgId };

  /* ── process one item ────────────────────────────────────── */
  const processItem = useCallback(async (item, refineOpts) => {
    setItems(prev=>prev.map(i=>i.id===item.id?{...i,status:'processing',progress:'Loading AI model…'}:i));
    try {
      // Step 1: AI background removal
      const rawBlob = await removeBackground(item.file, {
        progress: (key, cur, total) => {
          if (total>0) {
            const p=Math.round(cur/total*100);
            setItems(prev=>prev.map(i=>i.id===item.id?{...i,progress:`${key==='compute:inference'?'Running AI':'Downloading model'} ${p}%`}:i));
          }
        }
      });

      // Step 2: Edge refinement (our post-processing)
      let finalBlob = rawBlob;
      if (autoRefine || refineOpts) {
        setItems(prev=>prev.map(i=>i.id===item.id?{...i,progress:'Refining edges…'}:i));
        finalBlob = await refineEdges(rawBlob, {
          erodeRadius:    refineOpts?.erode    ?? erode,
          despillStrength:refineOpts?.despill  ?? despill,
          featherRadius:  refineOpts?.feather  ?? feather,
          edgeThreshold:  refineOpts?.edgeCut  ?? edgeCut,
        });
      }

      const url = URL.createObjectURL(finalBlob);
      setItems(prev=>prev.map(i=>i.id===item.id
        ?{...i,status:'done',cutoutUrl:url,cutoutBlob:finalBlob,rawBlob,progress:'',outSize:finalBlob.size}
        :i));
    } catch(err) {
      console.error(err);
      setItems(prev=>prev.map(i=>i.id===item.id?{...i,status:'error',progress:''}:i));
    }
  }, [autoRefine, erode, despill, feather, edgeCut]);

  /* ── re-refine without re-running AI ────────────────────── */
  const reRefine = async (item) => {
    if (!item?.rawBlob) return;
    setItems(prev=>prev.map(i=>i.id===item.id?{...i,status:'processing',progress:'Re-refining edges…'}:i));
    try {
      const refined = await refineEdges(item.rawBlob, { erodeRadius:erode, despillStrength:despill, featherRadius:feather, edgeThreshold:edgeCut });
      const url = URL.createObjectURL(refined);
      setItems(prev=>prev.map(i=>i.id===item.id
        ?{...i,status:'done',cutoutUrl:url,cutoutBlob:refined,progress:'',outSize:refined.size}
        :i));
    } catch(e){ setItems(prev=>prev.map(i=>i.id===item.id?{...i,status:'done'}:i)); }
  };

  /* ── ingest ──────────────────────────────────────────────── */
  const ingest = useCallback((files) => {
    const imgs = Array.from(files).filter(f=>f.type.startsWith('image/'));
    if (!imgs.length) { setError('Please select valid image files.'); return; }
    setError(null);
    const newItems = imgs.map(f=>({
      id:uid(), file:f, name:f.name,
      origUrl:URL.createObjectURL(f),
      cutoutUrl:null, cutoutBlob:null, rawBlob:null,
      status:'pending', progress:'', origSize:f.size, outSize:null,
    }));
    setItems(prev=>{
      const next=[...prev,...newItems];
      if (!activeId&&next.length>0) setActiveId(next[0].id);
      return next;
    });
    if (!activeId&&newItems.length>0) setActiveId(newItems[0].id);
    newItems.forEach(item=>processItem(item));
  }, [activeId, processItem]);

  const onDrop = (e) => { e.preventDefault(); setDrag(false); if(e.dataTransfer.files?.length) ingest(e.dataTransfer.files); };
  const removeItem = (id) => {
    setItems(prev=>{const next=prev.filter(i=>i.id!==id); if(activeId===id)setActiveId(next[0]?.id||null); return next;});
  };
  const reset = () => { setItems([]); setActiveId(null); setError(null); };

  /* ── derived ─────────────────────────────────────────────── */
  const active    = items.find(i=>i.id===activeId);
  const doneItems = items.filter(i=>i.status==='done');

  /* ── download ────────────────────────────────────────────── */
  const dlOne = async (item) => {
    if (!item?.cutoutUrl) return;
    const blob = effectiveBgId==='transparent' ? item.cutoutBlob : await renderWithBg(item.cutoutUrl, effectiveBgId);
    if (!blob) return;
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    const base=item.name.replace(/\.[^/.]+$/,'');
    a.href=url; a.download=`${base}_nobg.${exportFmt==='webp'?'webp':exportFmt==='jpg'?'jpg':'png'}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const dlAll = async () => {
    if (!doneItems.length) return;
    if (doneItems.length===1) { dlOne(doneItems[0]); return; }
    const { default: JSZip } = await import('jszip');
    const zip=new JSZip();
    for (const item of doneItems) {
      const blob=effectiveBgId==='transparent'?item.cutoutBlob:await renderWithBg(item.cutoutUrl,effectiveBgId);
      if (blob) { const base=item.name.replace(/\.[^/.]+$/,''); zip.file(`${base}_nobg.png`,blob); }
    }
    const zb=await zip.generateAsync({type:'blob'});
    const url=URL.createObjectURL(zb),a=document.createElement('a');
    a.href=url; a.download='removed_backgrounds.zip';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Error */}
      {error && (
        <div style={{ display:'flex', gap:10, alignItems:'center', padding:'11px 16px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={15} style={{ color:'#ef4444', flexShrink:0 }}/>
          <div style={{ flex:1, fontSize:13, color:'#ef4444' }}>{error}</div>
          <button onClick={()=>setError(null)} style={IB}><X size={12}/></button>
        </div>
      )}

      {/* ══ IDLE ══ */}
      {items.length===0 && (
        <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14,
            padding:isMobile?'48px 20px':'80px 40px',
            border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:16,
            background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.2s' }}>
          <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
          <div style={{ width:72, height:72, borderRadius:20, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
            background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)', transition:'all 0.2s' }}>
            <Scissors size={28} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:isMobile?15:17, fontWeight:600, marginBottom:6 }}>{drag?'Drop here':'Remove Background — AI + Edge Refinement'}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span></div>
            <div style={{ marginTop:10, display:'flex', gap:5, justifyContent:'center', flexWrap:'wrap' }}>
              {['AI On-Device','Edge Refinement','Despill Fix','Batch','10 Backgrounds','Compare Slider'].map(t=>(
                <span key={t} style={{ fontSize:10, padding:'3px 8px', borderRadius:100, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text-muted)', fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>
        </label>
      )}

      {/* ══ ACTIVE ══ */}
      {items.length>0 && (
        <div style={{ display:isDesktop?'grid':'flex', gridTemplateColumns:'300px 1fr', flexDirection:'column', gap:14, alignItems:'start' }}>

          {/* ── SIDEBAR ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Queue */}
            <Collapsible title={`Images (${items.length})`} icon={ImageIcon}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {items.map(item=>(
                  <div key={item.id} onClick={()=>setActiveId(item.id)}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:9, cursor:'pointer', transition:'all 0.15s',
                      outline:`1px solid ${activeId===item.id?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                      background:activeId===item.id?'rgba(37,99,235,0.07)':'var(--surface,#111118)' }}>
                    <div style={{ width:36, height:36, borderRadius:7, overflow:'hidden', flexShrink:0, ...checkerStyle(), backgroundSize:'8px 8px', backgroundPosition:'0 0,4px 4px' }}>
                      {item.cutoutUrl
                        ?<img src={item.cutoutUrl} style={{ width:'100%',height:'100%',objectFit:'contain' }}/>
                        :<img src={item.origUrl} style={{ width:'100%',height:'100%',objectFit:'cover',opacity:0.5 }}/>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>{item.name}</div>
                      <div style={{ fontSize:9, fontFamily:'monospace', color:'var(--text-muted)' }}>
                        {item.status==='processing'
                          ?<span style={{ color:'var(--accent-blue,#2563EB)' }}>{item.progress||'Processing…'}</span>
                          :item.status==='done'?<span style={{ color:'#16a34a' }}>✓ {fmtBytes(item.outSize)}</span>
                          :item.status==='error'?<span style={{ color:'#ef4444' }}>✗ Failed</span>
                          :'Pending…'}
                      </div>
                    </div>
                    <div style={{ flexShrink:0 }}>
                      {item.status==='processing'&&<div style={{ width:14, height:14, border:'2px solid rgba(37,99,235,0.2)', borderTopColor:'var(--accent-blue,#2563EB)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
                      {item.status==='done'&&<Check size={14} color="#16a34a"/>}
                      {item.status==='error'&&<AlertCircle size={14} color="#ef4444"/>}
                    </div>
                    <button onClick={e=>{e.stopPropagation();removeItem(item.id);}} style={{ ...IB, width:22, height:22, borderRadius:5 }}><X size={10}/></button>
                  </div>
                ))}
                <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9,
                  border:'1px dashed var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer', marginTop:2 }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-blue,#2563EB)';e.currentTarget.style.color='var(--accent-blue,#2563EB)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)';}}>
                  <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
                  <Plus size={13}/> Add More
                </label>
              </div>
            </Collapsible>

            {/* ── EDGE REFINEMENT SETTINGS ── */}
            <Collapsible title="Edge Refinement" icon={Sliders}>
              <div style={{ marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.5 }}>
                  Fixes white fringe & edge artifacts
                </span>
                <button onClick={()=>setAutoRefine(v=>!v)}
                  style={{ width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', transition:'all 0.2s', position:'relative', flexShrink:0,
                    background:autoRefine?'var(--accent-blue,#2563EB)':'var(--border)' }}>
                  <div style={{ position:'absolute', top:3, left:autoRefine?19:3, width:14, height:14, borderRadius:'50%', background:'white', transition:'all 0.2s' }}/>
                </button>
              </div>

              {[
                { l:'Erode (fringe removal)', v:erode,   set:setErode,   min:0, max:3, step:0.5, tip:'Shrinks mask inward to remove fringe. 1–2 is ideal.' },
                { l:'Despill (white removal)', v:despill, set:setDespill, min:0, max:1, step:0.1, tip:'Removes white colour cast from semi-transparent edges.' },
                { l:'Feather (edge softness)', v:feather, set:setFeather, min:0, max:3, step:0.5, tip:'Blurs the alpha edge for smoother look.' },
                { l:'Alpha cutoff',            v:edgeCut, set:setEdgeCut, min:0, max:50, step:1,  tip:'Alpha values below this become fully transparent.' },
              ].map(({ l, v, set, min, max, step, tip }) => (
                <div key={l} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.05em', textTransform:'uppercase' }}>{l}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{v}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={v} onChange={e=>set(Number(e.target.value))}
                    style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }} disabled={!autoRefine}/>
                  <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:3, lineHeight:1.4 }}>{tip}</div>
                </div>
              ))}

              {active?.rawBlob && (
                <button onClick={()=>reRefine(active)}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9, border:'none',
                    background:'rgba(37,99,235,0.1)', color:'var(--accent-blue,#2563EB)', fontSize:12, fontWeight:600, cursor:'pointer', width:'100%', transition:'all 0.15s' }}>
                  <RefreshCw size={12}/> Re-apply Refinement
                </button>
              )}
            </Collapsible>

            {/* Background */}
            <Collapsible title="Background" icon={Palette}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:10 }}>
                {BG_PRESETS.map(p=>(
                  <div key={p.id} onClick={()=>setBgId(p.id)} title={p.label}
                    style={{ height:30, borderRadius:7, cursor:'pointer', transition:'all 0.15s', position:'relative',
                      outline:`2px solid ${bgId===p.id?'var(--accent-blue,#2563EB)':'transparent'}`, outlineOffset:2, ...p.style }}>
                    {bgId===p.id&&<div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Check size={11} style={{ color:'white', filter:'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}/>
                    </div>}
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ flex:1, fontSize:11, color:'var(--text-muted)' }}>Custom colour</span>
                <div style={{ position:'relative' }}>
                  <div style={{ width:28, height:28, borderRadius:7, background:customBg, border:'1px solid var(--border)', cursor:'pointer' }}/>
                  <input type="color" value={customBg} onChange={e=>{setCustomBg(e.target.value);setBgId('custom');}}
                    style={{ position:'absolute', inset:0, opacity:0, width:'100%', height:'100%', cursor:'pointer' }}/>
                </div>
              </div>
            </Collapsible>

            {/* Export format */}
            <Collapsible title="Export Format" defaultOpen={false}>
              <div style={{ display:'flex', gap:5, marginBottom:8 }}>
                {[{v:'png',l:'PNG',d:'Lossless'},{v:'webp',l:'WebP',d:'Modern'},{v:'jpg',l:'JPG',d:'Smaller'}].map(f=>(
                  <button key={f.v} onClick={()=>setExportFmt(f.v)}
                    style={{ flex:1, padding:'8px 4px', borderRadius:8, cursor:'pointer', textAlign:'center', border:'none', fontSize:10, fontWeight:700, fontFamily:'monospace', transition:'all 0.15s',
                      outline:`1px solid ${exportFmt===f.v?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                      background:exportFmt===f.v?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                      color:exportFmt===f.v?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                    <div>{f.l}</div><div style={{ fontSize:8, marginTop:1, opacity:0.7 }}>{f.d}</div>
                  </button>
                ))}
              </div>
              {exportFmt==='jpg'&&<div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', fontSize:11, color:'#f59e0b', lineHeight:1.5 }}>⚠ JPG doesn't support transparency — a background will be applied.</div>}
            </Collapsible>

            {/* Actions */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {active?.status==='done'&&(
                <button onClick={()=>dlOne(active)}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px', borderRadius:10, border:'none',
                    background:'var(--accent-blue,#2563EB)', color:'white', fontSize:13, fontWeight:600, cursor:'pointer',
                    boxShadow:'0 4px 14px rgba(37,99,235,0.3)', transition:'all 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  <Download size={14}/> Download .{exportFmt.toUpperCase()}
                </button>
              )}
              {doneItems.length>1&&(
                <button onClick={dlAll}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px', borderRadius:10, border:'none',
                    background:'#16a34a', color:'white', fontSize:13, fontWeight:600, cursor:'pointer',
                    boxShadow:'0 4px 14px rgba(22,163,74,0.3)', transition:'all 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  <Package size={14}/> Download All ({doneItems.length}) ZIP
                </button>
              )}
              <button onClick={reset} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                <RefreshCw size={12}/> Start Over
              </button>
            </div>
          </div>

          {/* ── PREVIEW ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', flex:1 }}>
                {active?active.name:'Preview'}
              </span>
              {active?.status==='done'&&(
                <>
                  <button onClick={()=>setShowCompare(v=>!v)}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600, border:'none', transition:'all 0.15s',
                      outline:`1px solid ${showCompare?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                      background:showCompare?'rgba(37,99,235,0.1)':'transparent',
                      color:showCompare?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                    <Layers size={12}/> {showCompare?'Comparing':'Compare'}
                  </button>
                  {doneItems.length>1&&(
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <button onClick={()=>{const i=doneItems.findIndex(d=>d.id===activeId);if(i>0)setActiveId(doneItems[i-1].id);}} style={IB}><ChevronLeft size={13}/></button>
                      <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>{doneItems.findIndex(d=>d.id===activeId)+1}/{doneItems.length}</span>
                      <button onClick={()=>{const i=doneItems.findIndex(d=>d.id===activeId);if(i<doneItems.length-1)setActiveId(doneItems[i+1].id);}} style={IB}><ChevronRight size={13}/></button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Canvas */}
            <div style={{ borderRadius:14, overflow:'hidden', border:'1px solid var(--border)', minHeight:400, position:'relative',
              display:'flex', alignItems:'center', justifyContent:'center',
              ...(active?.status==='done'&&!showCompare?bgStyleObj:checkerStyle()) }}>

              {/* Processing */}
              {active?.status==='processing'&&(
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, zIndex:10 }}>
                  <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(37,99,235,0.1)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                    <Sparkles size={24} color="var(--accent-blue,#2563EB)"/>
                    <svg style={{ position:'absolute', inset:-6, width:76, height:76, animation:'spin 2s linear infinite' }} viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(37,99,235,0.2)" strokeWidth="4"/>
                      <circle cx="50" cy="50" r="44" fill="none" stroke="var(--accent-blue,#2563EB)" strokeWidth="4" strokeDasharray="80 200" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:15, fontWeight:600, color:'white', marginBottom:4 }}>Removing Background…</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', fontFamily:'monospace' }}>{active.progress}</div>
                  </div>
                  {active.origUrl&&<img src={active.origUrl} style={{ maxWidth:'70%', maxHeight:200, objectFit:'contain', opacity:0.3, borderRadius:8 }}/>}
                </div>
              )}

              {!active&&<div style={{ textAlign:'center', padding:40 }}><ImageIcon size={32} style={{ color:'var(--text-muted)', marginBottom:10 }}/><div style={{ fontSize:13, color:'var(--text-muted)' }}>Select an image</div></div>}
              {active?.status==='pending'&&<div style={{ padding:40 }}><img src={active.origUrl} style={{ maxWidth:'100%', maxHeight:360, objectFit:'contain', opacity:0.35, borderRadius:8 }}/></div>}

              {active?.status==='done'&&showCompare&&(
                <CompareSlider origUrl={active.origUrl} cutoutUrl={active.cutoutUrl} bgStyle={bgStyleObj} style={{ width:'100%', height:'min(60vh,520px)' }}/>
              )}
              {active?.status==='done'&&!showCompare&&(
                <div style={{ width:'100%', minHeight:360, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
                  <img src={active.cutoutUrl} style={{ maxWidth:'100%', maxHeight:'60vh', objectFit:'contain', display:'block' }}/>
                </div>
              )}

              {active?.status==='error'&&(
                <div style={{ padding:40, textAlign:'center' }}>
                  <AlertCircle size={32} color="#ef4444" style={{ marginBottom:10 }}/>
                  <div style={{ fontSize:13, color:'#ef4444', marginBottom:12 }}>Background removal failed.</div>
                  <button onClick={()=>processItem(active)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#ef4444', fontSize:12, cursor:'pointer' }}>Retry</button>
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {doneItems.length>1&&(
              <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
                {doneItems.map(item=>(
                  <div key={item.id} onClick={()=>setActiveId(item.id)}
                    style={{ flexShrink:0, width:68, height:68, borderRadius:9, overflow:'hidden', cursor:'pointer',
                      outline:`2px solid ${activeId===item.id?'var(--accent-blue,#2563EB)':'transparent'}`, outlineOffset:2,
                      transition:'all 0.15s', ...checkerStyle(), backgroundSize:'8px 8px', backgroundPosition:'0 0,4px 4px' }}>
                    <img src={item.cutoutUrl} style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const IB = { display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:7, flexShrink:0, border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)', color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s' };