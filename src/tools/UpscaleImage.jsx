import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Download, Maximize2, RefreshCw, X, Sliders,
  Zap, Info, Image as ImageIcon, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Check, Eye, BarChart2,
} from 'lucide-react';
import Pica from 'pica';

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
        style={{ width:'100%', display:'flex', alignItems:'center', gap:7, padding:'11px 14px', background:'transparent', border:'none', cursor:'pointer' }}>
        {Icon && <Icon size={12} style={{ color:'var(--text-muted)', flexShrink:0 }}/>}
        <span style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'left' }}>{title}</span>
        {open ? <ChevronUp size={13} style={{ color:'var(--text-muted)' }}/> : <ChevronDown size={13} style={{ color:'var(--text-muted)' }}/>}
      </button>
      {open && <div style={{ padding:'0 14px 14px' }}>{children}</div>}
    </div>
  );
}

/* ── drag-compare slider ─────────────────────────────────── */
function CompareSlider({ origUrl, resultUrl, style }) {
  const [pos, setPos]  = useState(50);
  const ref            = useRef(null);
  const dragging       = useRef(false);
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
      <img src={resultUrl} alt="result" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block', background:'#050508' }}/>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', width:`${pos}%` }}>
        <img src={origUrl} alt="original" style={{ width:`${10000/pos}%`, height:'100%', objectFit:'contain', display:'block', background:'#050508' }}/>
      </div>
      <div style={{ position:'absolute', top:0, bottom:0, left:`${pos}%`, width:2, background:'white', transform:'translateX(-50%)', boxShadow:'0 0 10px rgba(0,0,0,0.6)', zIndex:3 }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:32, height:32, borderRadius:'50%', background:'white', boxShadow:'0 2px 12px rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:1 }}>
          <ChevronLeft size={11} style={{ color:'#333' }}/><ChevronRight size={11} style={{ color:'#333' }}/>
        </div>
      </div>
      <div style={{ position:'absolute', top:10, left:10, padding:'3px 9px', borderRadius:100, background:'rgba(0,0,0,0.65)', color:'white', fontSize:9, fontWeight:700, zIndex:4 }}>ORIGINAL</div>
      <div style={{ position:'absolute', top:10, right:10, padding:'3px 9px', borderRadius:100, background:'rgba(37,99,235,0.85)', color:'white', fontSize:9, fontWeight:700, zIndex:4 }}>ENHANCED</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TRUE HIGH-QUALITY UPSCALING PIPELINE
   1. Pica Lanczos3 — fastest, good for 2x
   2. Progressive 2-step Pica — for 4x+, each step 2x with
      unsharp masking to preserve edge sharpness
   3. Post-processing: unsharp mask + edge enhancement pass
══════════════════════════════════════════════════════════ */
async function upscaleCanvas(srcCanvas, targetW, targetH, opts, onProgress) {
  const pica       = new Pica({ features:['js','wasm','cib'] });
  const srcW       = srcCanvas.width;
  const srcH       = srcCanvas.height;
  const stepFactor = Math.max(targetW/srcW, targetH/srcH);

  onProgress(10);

  // ── Strategy: progressive 2-step for large upscales ──
  // Each Lanczos3 pass is best at ≤2x. Chaining 2 passes
  // for 4x gives visibly sharper results than a single 4x pass.
  const makeCanvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  let current = srcCanvas;

  if (stepFactor > 2.5) {
    // Step 1: upscale to intermediate (50% of final)
    const midW = Math.round(targetW * 0.5);
    const midH = Math.round(targetH * 0.5);
    const midCanvas = makeCanvas(midW, midH);
    await pica.resize(current, midCanvas, {
      quality: 3,
      alpha: true,
      unsharpAmount: opts.unsharp ? 60 : 0,
      unsharpRadius: 0.5,
      unsharpThreshold: 2,
    });
    current = midCanvas;
    onProgress(40);
  }

  // Final resize pass
  const outCanvas = makeCanvas(targetW, targetH);
  await pica.resize(current, outCanvas, {
    quality: 3,        // Lanczos3 — highest quality
    alpha: true,
    unsharpAmount: opts.unsharp ? Math.round(opts.unsharpAmount) : 0,
    unsharpRadius: opts.unsharp ? opts.unsharpRadius : 0,
    unsharpThreshold: opts.unsharp ? opts.unsharpThreshold : 0,
  });
  onProgress(70);

  // ── Post-processing: pixel-level sharpening ──────────────
  if (opts.sharpen || opts.denoise) {
    const ctx = outCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, outCanvas.width, outCanvas.height);
    const d = imgData.data;
    const W = outCanvas.width, H = outCanvas.height;

    if (opts.denoise) {
      // Box-blur 3×3 on RGB (simple noise reduction)
      const blurred = new Uint8ClampedArray(d.length);
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++)
                sum += d[((y+dy)*W+(x+dx))*4+c];
            blurred[(y*W+x)*4+c] = sum / 9;
          }
          blurred[(y*W+x)*4+3] = d[(y*W+x)*4+3]; // preserve alpha
        }
      }
      for (let i = 0; i < d.length; i++) d[i] = blurred[i];
    }

    if (opts.sharpen) {
      // Unsharp mask: output = original + amount*(original - blurred)
      const amount = opts.sharpenAmount; // 0–1
      const blurred2 = new Uint8ClampedArray(d.length);
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++)
                sum += d[((y+dy)*W+(x+dx))*4+c];
            blurred2[(y*W+x)*4+c] = sum / 9;
          }
          blurred2[(y*W+x)*4+3] = d[(y*W+x)*4+3];
        }
      }
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          for (let c = 0; c < 3; c++) {
            const idx = (y*W+x)*4+c;
            const diff = d[idx] - blurred2[idx];
            d[idx] = Math.min(255, Math.max(0, Math.round(d[idx] + amount * diff * 2)));
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  onProgress(90);
  return outCanvas;
}

/* ── preset scales ───────────────────────────────────────── */
const SCALE_PRESETS = [
  { id:1.5, label:'1.5×',  desc:'Subtle boost'    },
  { id:2,   label:'2×',    desc:'Standard HD'     },
  { id:3,   label:'3×',    desc:'High resolution' },
  { id:4,   label:'4×',    desc:'Ultra HD'        },
  { id:'custom', label:'Custom', desc:'Set exact size' },
];

/* ── output formats ──────────────────────────────────────── */
const OUT_FMTS = [
  { v:'png',  l:'PNG',  m:'image/png',  q:null },
  { v:'jpeg', l:'JPEG', m:'image/jpeg', q:0.95 },
  { v:'webp', l:'WebP', m:'image/webp', q:0.95 },
];

/* ════════════════════════════════════════════════════════ */
export default function UpscaleImage() {
  const vw        = useWidth();
  const isMobile  = vw < 640;
  const isDesktop = vw >= 1024;

  const [orig,      setOrig]      = useState(null);
  const [drag,      setDrag]      = useState(false);
  const [scaleMode, setScaleMode] = useState(2);
  const [customW,   setCustomW]   = useState('');
  const [customH,   setCustomH]   = useState('');
  const [lockAspect,setLockAspect]= useState(true);

  // Enhancement options
  const [unsharp,          setUnsharp]          = useState(true);
  const [unsharpAmount,    setUnsharpAmount]    = useState(80);
  const [unsharpRadius,    setUnsharpRadius]    = useState(0.6);
  const [unsharpThreshold, setUnsharpThreshold] = useState(2);
  const [sharpen,          setSharpen]          = useState(true);
  const [sharpenAmount,    setSharpenAmount]    = useState(0.4);
  const [denoise,          setDenoise]          = useState(false);
  const [outFmt,           setOutFmt]           = useState('png');

  // State
  const [isWorking,  setIsWorking]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [progressMsg,setProgressMsg]= useState('');
  const [result,     setResult]     = useState(null);
  const [compareMode,setCompareMode]= useState(false);
  const [error,      setError]      = useState('');

  /* ── ingest ──────────────────────────────────────────────── */
  const ingest = (file) => {
    if (!file?.type?.startsWith('image/')) { setError('Please upload a valid image.'); return; }
    setError('');
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setOrig({ url, name:file.name, size:file.size, w:img.naturalWidth, h:img.naturalHeight, el:img });
      setResult(null);
      setCustomW(img.naturalWidth * 2);
      setCustomH(img.naturalHeight * 2);
    };
    img.src = url;
  };

  const onFile = (e) => { if (e.target.files?.[0]) ingest(e.target.files[0]); };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.[0]) ingest(e.dataTransfer.files[0]); };

  /* ── dimension helpers ───────────────────────────────────── */
  const targetDims = () => {
    if (!orig) return { w:0, h:0 };
    if (scaleMode === 'custom') return { w:parseInt(customW)||0, h:parseInt(customH)||0 };
    return { w:Math.round(orig.w * scaleMode), h:Math.round(orig.h * scaleMode) };
  };

  const updateCustomW = (val) => {
    const w = parseInt(val)||0;
    setCustomW(w);
    if (lockAspect && orig) setCustomH(Math.round(w / (orig.w / orig.h)));
  };
  const updateCustomH = (val) => {
    const h = parseInt(val)||0;
    setCustomH(h);
    if (lockAspect && orig) setCustomW(Math.round(h * (orig.w / orig.h)));
  };

  /* ── upscale ─────────────────────────────────────────────── */
  const handleUpscale = async () => {
    if (!orig) return;
    const { w:tW, h:tH } = targetDims();
    if (!tW || !tH || tW < 1 || tH < 1) { setError('Invalid target dimensions.'); return; }
    if (tW > 16000 || tH > 16000) { setError('Target size too large (max 16000px per side).'); return; }

    setIsWorking(true); setProgress(5); setError('');
    setProgressMsg('Preparing source…');

    try {
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width  = orig.w;
      srcCanvas.height = orig.h;
      srcCanvas.getContext('2d').drawImage(orig.el, 0, 0);

      setProgressMsg('Running Lanczos3 upscale…');

      const outCanvas = await upscaleCanvas(srcCanvas, tW, tH, {
        unsharp, unsharpAmount, unsharpRadius, unsharpThreshold,
        sharpen, sharpenAmount, denoise,
      }, (p) => {
        setProgress(p);
        if (p < 40) setProgressMsg('Lanczos3 pass 1…');
        else if (p < 70) setProgressMsg('Lanczos3 pass 2…');
        else setProgressMsg('Post-processing sharpness…');
      });

      setProgressMsg('Encoding output…');
      const fmt  = OUT_FMTS.find(f=>f.v===outFmt);
      const blob = await new Promise(res => outCanvas.toBlob(res, fmt.m, fmt.q ?? undefined));
      const url  = URL.createObjectURL(blob);

      setResult({ url, w:tW, h:tH, size:blob.size, blob });
      setProgress(100);
      setCompareMode(true);
    } catch(e) {
      console.error(e); setError('Upscaling failed: ' + e.message);
    } finally {
      setIsWorking(false); setProgress(0); setProgressMsg('');
    }
  };

  /* ── download ────────────────────────────────────────────── */
  const download = () => {
    if (!result) return;
    const a    = document.createElement('a');
    const base = orig.name.replace(/\.[^/.]+$/, '');
    const fmt  = OUT_FMTS.find(f=>f.v===outFmt);
    a.href = result.url; a.download = `${base}_${targetDims().w}x${targetDims().h}.${fmt.v}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const reset = () => { setOrig(null); setResult(null); setError(''); setCompareMode(false); };

  const { w:tW, h:tH } = targetDims();
  const fmt = OUT_FMTS.find(f=>f.v===outFmt);

  /* ── sidebar ─────────────────────────────────────────────── */
  const SidebarPane = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* Scale presets */}
      <Collapsible title="Upscale Factor" icon={Maximize2}>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom: scaleMode==='custom'?12:0 }}>
          {SCALE_PRESETS.map(p=>(
            <button key={p.id} onClick={()=>{ setScaleMode(p.id); setResult(null); }}
              style={{ flex:'1 1 auto', minWidth:52, padding:'9px 6px', borderRadius:8, cursor:'pointer', textAlign:'center', border:'none', transition:'all 0.15s',
                outline:`1px solid ${scaleMode===p.id?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:scaleMode===p.id?'rgba(37,99,235,0.1)':'var(--surface,#111118)' }}>
              <div style={{ fontSize:13, fontWeight:800, color:scaleMode===p.id?'var(--accent-blue,#2563EB)':'var(--text)', fontFamily:'monospace' }}>{p.label}</div>
              <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:2 }}>{p.desc}</div>
            </button>
          ))}
        </div>

        {scaleMode==='custom' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'end' }}>
              <div>
                <div style={LS}>Width (px)</div>
                <input type="number" value={customW} onChange={e=>updateCustomW(e.target.value)} style={{ ...IN, textAlign:'center', fontFamily:'monospace', fontWeight:700, fontSize:14 }}/>
              </div>
              <button onClick={()=>setLockAspect(v=>!v)} title={lockAspect?'Unlock aspect':'Lock aspect'}
                style={{ ...IB, marginBottom:0, background:lockAspect?'rgba(37,99,235,0.1)':'transparent', borderColor:lockAspect?'rgba(37,99,235,0.4)':'var(--border)', color:lockAspect?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                {lockAspect ? '🔒' : '🔓'}
              </button>
              <div>
                <div style={LS}>Height (px)</div>
                <input type="number" value={customH} onChange={e=>updateCustomH(e.target.value)} style={{ ...IN, textAlign:'center', fontFamily:'monospace', fontWeight:700, fontSize:14 }}/>
              </div>
            </div>
            <div style={{ fontSize:10, color:'var(--text-muted)', textAlign:'center', fontFamily:'monospace' }}>
              {lockAspect ? '🔒 Aspect ratio locked' : '🔓 Free dimensions'}
            </div>
          </div>
        )}
      </Collapsible>

      {/* Enhancement */}
      <Collapsible title="Enhancement" icon={Sliders}>
        {/* Unsharp mask (Pica's built-in) */}
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>Lanczos Unsharp Mask</span>
            <button onClick={()=>setUnsharp(v=>!v)}
              style={{ width:34, height:18, borderRadius:9, border:'none', cursor:'pointer', transition:'all 0.2s', position:'relative', background:unsharp?'var(--accent-blue,#2563EB)':'var(--border)' }}>
              <div style={{ position:'absolute', top:2, left:unsharp?16:2, width:14, height:14, borderRadius:'50%', background:'white', transition:'all 0.2s' }}/>
            </button>
          </div>
          {unsharp && (
            <div style={{ display:'flex', flexDirection:'column', gap:8, paddingLeft:4 }}>
              {[
                { l:'Amount',    v:unsharpAmount,    set:setUnsharpAmount,    min:0, max:200, step:1   },
                { l:'Radius',    v:unsharpRadius,    set:setUnsharpRadius,    min:0, max:2,   step:0.1 },
                { l:'Threshold', v:unsharpThreshold, set:setUnsharpThreshold, min:0, max:10,  step:0.5 },
              ].map(({l,v,set,min,max,step})=>(
                <div key={l}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{l}</span>
                    <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--accent-blue,#2563EB)', fontWeight:700 }}>{v}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={v} onChange={e=>set(Number(e.target.value))}
                    style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pixel-level sharpening */}
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>Edge Sharpening</span>
            <button onClick={()=>setSharpen(v=>!v)}
              style={{ width:34, height:18, borderRadius:9, border:'none', cursor:'pointer', transition:'all 0.2s', position:'relative', background:sharpen?'var(--accent-blue,#2563EB)':'var(--border)' }}>
              <div style={{ position:'absolute', top:2, left:sharpen?16:2, width:14, height:14, borderRadius:'50%', background:'white', transition:'all 0.2s' }}/>
            </button>
          </div>
          {sharpen && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Strength</span>
                <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--accent-blue,#2563EB)', fontWeight:700 }}>{sharpenAmount.toFixed(1)}</span>
              </div>
              <input type="range" min={0.1} max={1} step={0.05} value={sharpenAmount} onChange={e=>setSharpenAmount(Number(e.target.value))}
                style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
            </div>
          )}
        </div>

        {/* Denoise */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>Noise Reduction</span>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>3×3 smoothing pass</div>
          </div>
          <button onClick={()=>setDenoise(v=>!v)}
            style={{ width:34, height:18, borderRadius:9, border:'none', cursor:'pointer', transition:'all 0.2s', position:'relative', background:denoise?'var(--accent-blue,#2563EB)':'var(--border)' }}>
            <div style={{ position:'absolute', top:2, left:denoise?16:2, width:14, height:14, borderRadius:'50%', background:'white', transition:'all 0.2s' }}/>
          </button>
        </div>
      </Collapsible>

      {/* Output format */}
      <Collapsible title="Output Format" defaultOpen={false}>
        <div style={{ display:'flex', gap:5 }}>
          {OUT_FMTS.map(f=>(
            <button key={f.v} onClick={()=>setOutFmt(f.v)}
              style={{ flex:1, padding:'8px 4px', borderRadius:8, cursor:'pointer', textAlign:'center', border:'none', fontSize:10, fontWeight:700, fontFamily:'monospace', transition:'all 0.15s',
                outline:`1px solid ${outFmt===f.v?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:outFmt===f.v?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                color:outFmt===f.v?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
              {f.l}
            </button>
          ))}
        </div>
        {outFmt==='jpeg' && (
          <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', fontSize:11, color:'#f59e0b' }}>
            ⚠ JPEG doesn't support transparency
          </div>
        )}
      </Collapsible>

      {/* Expected result info */}
      <div style={{ padding:'12px 14px', borderRadius:10, background:'rgba(37,99,235,0.05)', border:'1px solid rgba(37,99,235,0.2)' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-blue,#2563EB)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:8 }}>Expected Output</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[
            { l:'FROM', v:orig?`${orig.w}×${orig.h}`:'-' },
            { l:'TO',   v:tW&&tH?`${tW}×${tH}`:'-', c:'var(--accent-blue,#2563EB)' },
            { l:'SCALE',v:scaleMode==='custom'?`${orig?(tW/orig.w).toFixed(1):'-'}×`:`${scaleMode}×`, c:'#16a34a' },
            { l:'FORMAT',v:outFmt.toUpperCase() },
          ].map(({l,v,c})=>(
            <div key={l}>
              <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:2 }}>{l}</div>
              <div style={{ fontSize:12, fontWeight:700, color:c||'var(--text)', fontFamily:'monospace' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {!result ? (
          <button onClick={handleUpscale} disabled={isWorking||!orig}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none',
              background: orig&&!isWorking ? 'var(--accent-blue,#2563EB)' : 'var(--surface-raised,#18181f)',
              color: orig&&!isWorking ? 'white' : 'var(--text-muted)',
              fontSize:14, fontWeight:600, cursor:orig&&!isWorking?'pointer':'not-allowed',
              boxShadow:orig&&!isWorking?'0 4px 16px rgba(37,99,235,0.3)':'none', transition:'all 0.15s' }}
            onMouseEnter={e=>{ if(orig&&!isWorking) e.currentTarget.style.transform='translateY(-1px)'; }}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            {isWorking
              ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> {progressMsg||'Upscaling…'}</>
              : <><Maximize2 size={15}/> Upscale Image</>}
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
            <button onClick={()=>{ setResult(null); setCompareMode(false); }}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
              <Sliders size={12}/> Change Settings
            </button>
          </>
        )}
        {orig && (
          <button onClick={reset} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9, border:'none', background:'transparent', color:'#ef4444', fontSize:12, cursor:'pointer' }}>
            <X size={12}/> Start Over
          </button>
        )}
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Error */}
      {error && (
        <div style={{ display:'flex', gap:10, alignItems:'center', padding:'11px 16px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)' }}>
          <span style={{ flex:1, fontSize:13, color:'#ef4444' }}>{error}</span>
          <button onClick={()=>setError('')} style={IB}><X size={12}/></button>
        </div>
      )}

      {/* ══ IDLE ══ */}
      {!orig && (
        <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14,
            padding:isMobile?'48px 20px':'80px 40px',
            border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:16,
            background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.2s' }}>
          <input type="file" accept="image/*" style={{display:'none'}} onChange={onFile}/>
          <div style={{ width:72, height:72, borderRadius:20, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
            background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)', transition:'all 0.2s' }}>
            <Maximize2 size={28} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:isMobile?15:17, fontWeight:600, marginBottom:6 }}>{drag?'Drop image here':'Upscale Image — High Quality'}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span></div>
            <div style={{ marginTop:10, display:'flex', gap:5, justifyContent:'center', flexWrap:'wrap' }}>
              {['Lanczos3 2-Step','Unsharp Mask','Edge Sharpening','Noise Reduction','Up to 4×','Drag Compare'].map(t=>(
                <span key={t} style={{ fontSize:10, padding:'3px 8px', borderRadius:100, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text-muted)', fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>
        </label>
      )}

      {/* ══ ACTIVE ══ */}
      {orig && (
        <div style={{ display:isDesktop?'grid':'flex', gridTemplateColumns:'1fr 280px', flexDirection:'column', gap:14, alignItems:'start' }}>

          {/* Preview */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', flex:1 }}>
                {result ? `✓ ${result.w}×${result.h} · ${fmtBytes(result.size)}` : `Original: ${orig.w}×${orig.h} · ${fmtBytes(orig.size)}`}
              </span>
              {result && (
                <button onClick={()=>setCompareMode(v=>!v)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600, border:'none', transition:'all 0.15s',
                    outline:`1px solid ${compareMode?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                    background:compareMode?'rgba(37,99,235,0.1)':'transparent',
                    color:compareMode?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
                  <Eye size={12}/> {compareMode?'Comparing':'Compare'}
                </button>
              )}
              <button onClick={reset} style={{ ...IB, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.05)' }} title="Change image"><X size={13}/></button>
            </div>

            {/* Canvas */}
            <div style={{ position:'relative', borderRadius:14, overflow:'hidden', border:'1px solid var(--border)',
              background:'#050508', minHeight: isMobile?260:440,
              display:'flex', alignItems:'center', justifyContent:'center' }}>

              {/* Processing overlay */}
              {isWorking && (
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, zIndex:10, backdropFilter:'blur(4px)' }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(37,99,235,0.1)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                    <Maximize2 size={22} color="var(--accent-blue,#2563EB)"/>
                    <svg style={{ position:'absolute', inset:-6, width:68, height:68, animation:'spin 2s linear infinite' }} viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(37,99,235,0.2)" strokeWidth="5"/>
                      <circle cx="50" cy="50" r="44" fill="none" stroke="var(--accent-blue,#2563EB)" strokeWidth="5" strokeDasharray="80 200" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:15, fontWeight:600, color:'white', marginBottom:4 }}>Upscaling with Lanczos3…</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', fontFamily:'monospace', marginBottom:12 }}>{progressMsg}</div>
                    <div style={{ width:220, height:4, background:'rgba(255,255,255,0.1)', borderRadius:100, overflow:'hidden', margin:'0 auto' }}>
                      <div style={{ height:'100%', background:'var(--accent-blue,#2563EB)', borderRadius:100, width:`${progress}%`, transition:'width 0.4s ease' }}/>
                    </div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:6, fontFamily:'monospace' }}>{progress}%</div>
                  </div>
                </div>
              )}

              {/* Compare mode */}
              {result && compareMode && (
                <CompareSlider origUrl={orig.url} resultUrl={result.url} style={{ width:'100%', height: isMobile?260:480 }}/>
              )}

              {/* Result only */}
              {result && !compareMode && (
                <div style={{ width:'100%', height: isMobile?260:480, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                  <img src={result.url} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', display:'block' }}/>
                </div>
              )}

              {/* Original only */}
              {!result && !isWorking && (
                <div style={{ width:'100%', height: isMobile?260:480, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                  <img src={orig.url} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', display:'block' }}/>
                  <div style={{ position:'absolute', top:12, left:12, padding:'4px 10px', borderRadius:100, background:'rgba(0,0,0,0.65)', color:'white', fontSize:9, fontWeight:700 }}>ORIGINAL</div>
                </div>
              )}
            </div>

            {/* Result stats */}
            {result && (
              <div style={{ display:'flex', gap:14, padding:'10px 14px', borderRadius:10, background:'rgba(22,163,74,0.05)', border:'1px solid rgba(22,163,74,0.2)', flexWrap:'wrap' }}>
                {[
                  { l:'INPUT',  v:`${orig.w}×${orig.h}px` },
                  { l:'OUTPUT', v:`${result.w}×${result.h}px`, c:'#16a34a' },
                  { l:'SCALE',  v:`${scaleMode==='custom'?(result.w/orig.w).toFixed(2):scaleMode}×`, c:'var(--accent-blue,#2563EB)' },
                  { l:'SIZE',   v:fmtBytes(result.size) },
                ].map(({l,v,c})=>(
                  <div key={l}>
                    <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:2, letterSpacing:'0.07em' }}>{l}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:c||'var(--text)', fontFamily:'monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Mobile sidebar */}
            {!isDesktop && (
              <Collapsible title="Settings">
                <SidebarPane/>
              </Collapsible>
            )}
          </div>

          {/* Desktop sidebar */}
          {isDesktop && <SidebarPane/>}
        </div>
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

const IN  = { width:'100%', padding:'9px 12px', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text,#f0f0f5)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
const LS  = { fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:5, display:'block' };
const IB  = { display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:7, flexShrink:0, border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)', color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s' };