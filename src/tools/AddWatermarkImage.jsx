import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Download, Type, Image as ImageIcon, Sliders,
  Trash2, X, RefreshCw, Layers, ChevronDown, ChevronUp,
  Move, RotateCcw, Check, Plus,
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

/* ── position grid ───────────────────────────────────────── */
const POSITIONS = [
  { id:'top-left',       label:'↖' }, { id:'top-center',    label:'↑' }, { id:'top-right',    label:'↗' },
  { id:'middle-left',   label:'←' }, { id:'middle-center', label:'⊕' }, { id:'middle-right', label:'→' },
  { id:'bottom-left',   label:'↙' }, { id:'bottom-center', label:'↓' }, { id:'bottom-right', label:'↘' },
];

/* ── text presets ────────────────────────────────────────── */
const TEXT_PRESETS = [
  { label:'CONFIDENTIAL', color:'#ff3333', outline:true },
  { label:'DRAFT',        color:'#f59e0b', outline:false },
  { label:'© 2025',       color:'#ffffff', outline:false },
  { label:'SAMPLE',       color:'#8b5cf6', outline:true  },
  { label:'DO NOT COPY',  color:'#ef4444', outline:true  },
  { label:'APPROVED',     color:'#22c55e', outline:false },
];

/* ── font families ───────────────────────────────────────── */
const FONTS = [
  'Arial','Georgia','Courier New','Impact','Trebuchet MS','Verdana','Times New Roman',
];

/* ── output formats ──────────────────────────────────────── */
const OUT_FMTS = [
  { v:'png',  l:'PNG',  m:'image/png',  q:null  },
  { v:'jpeg', l:'JPEG', m:'image/jpeg', q:0.93  },
  { v:'webp', l:'WebP', m:'image/webp', q:0.92  },
];

/* ════════════════════════════════════════════════════════ */
export default function AddWatermarkImage() {
  const vw        = useWidth();
  const isMobile  = vw < 640;
  const isDesktop = vw >= 1024;

  // Images
  const [mainImg, setMainImg] = useState(null); // { url, name, size, w, h, el }
  const [logo, setLogo]       = useState(null); // { url, w, h, el }
  const [drag, setDrag]       = useState(false);

  // Mode
  const [wmType, setWmType]   = useState('text'); // 'text' | 'image'

  // Text settings
  const [text,     setText]     = useState('YOUR WATERMARK');
  const [color,    setColor]    = useState('#ffffff');
  const [fontSize, setFontSize] = useState(52);
  const [fontFam,  setFontFam]  = useState('Arial');
  const [bold,     setBold]     = useState(true);
  const [italic,   setItalic]   = useState(false);
  const [outline,  setOutline]  = useState(false);
  const [outlineC, setOutlineC] = useState('#000000');
  const [shadow,   setShadow]   = useState(false);

  // Image (logo) settings
  const [scale, setScale] = useState(25); // % of image width

  // Shared
  const [pos,      setPos]      = useState('middle-center');
  const [opacity,  setOpacity]  = useState(0.5);
  const [rotation, setRotation] = useState(-25);
  const [tiling,   setTiling]   = useState(false);
  const [tileGap,  setTileGap]  = useState(1.5);

  // Output
  const [outFmt,   setOutFmt]   = useState('png');
  const [quality,  setQuality]  = useState(93);

  // State
  const [isWorking, setIsWorking] = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState('');

  const canvasRef = useRef(null);

  /* ── load image helper ───────────────────────────────────── */
  const loadImage = (url) => new Promise((res, rej) => {
    const img = new window.Image();
    img.onload  = () => res(img);
    img.onerror = rej;
    img.crossOrigin = 'anonymous';
    img.src = url;
  });

  /* ── ingest main ─────────────────────────────────────────── */
  const ingestMain = async (file) => {
    if (!file?.type?.startsWith('image/')) { setError('Please upload a valid image file.'); return; }
    setError('');
    const url = URL.createObjectURL(file);
    const el  = await loadImage(url);
    setMainImg({ url, name:file.name, size:file.size, w:el.naturalWidth, h:el.naturalHeight, el });
    setResult(null);
  };

  const onMainFile = (e) => { if (e.target.files?.[0]) ingestMain(e.target.files[0]); };
  const onDrop     = (e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.[0]) ingestMain(e.dataTransfer.files[0]); };

  /* ── ingest logo ─────────────────────────────────────────── */
  const ingestLogo = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url  = URL.createObjectURL(file);
    const el   = await loadImage(url);
    setLogo({ url, w:el.naturalWidth, h:el.naturalHeight, el });
    e.target.value = '';
  };

  /* ── render to canvas ────────────────────────────────────── */
  const render = useCallback(async (canvas) => {
    if (!mainImg) return;
    const W = mainImg.w, H = mainImg.h;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 1. Draw base image
    ctx.drawImage(mainImg.el, 0, 0);

    // 2. Build watermark metrics
    let wmW = 0, wmH = 0;
    let drawFn;

    if (wmType === 'text') {
      const weight = bold ? 'bold' : 'normal';
      const style  = italic ? 'italic' : 'normal';
      ctx.font = `${style} ${weight} ${fontSize}px "${fontFam}"`;
      wmW = ctx.measureText(text).width;
      wmH = fontSize * 1.2;
      drawFn = (ctx2) => {
        ctx2.font = `${style} ${weight} ${fontSize}px "${fontFam}"`;
        ctx2.textAlign    = 'center';
        ctx2.textBaseline = 'middle';
        if (shadow) {
          ctx2.shadowColor   = 'rgba(0,0,0,0.7)';
          ctx2.shadowBlur    = fontSize * 0.15;
          ctx2.shadowOffsetX = fontSize * 0.04;
          ctx2.shadowOffsetY = fontSize * 0.04;
        }
        if (outline) {
          ctx2.strokeStyle = outlineC;
          ctx2.lineWidth   = Math.max(1, fontSize * 0.04);
          ctx2.strokeText(text, 0, 0);
        }
        ctx2.fillStyle = color;
        ctx2.fillText(text, 0, 0);
        // Reset shadow
        ctx2.shadowColor = 'transparent';
        ctx2.shadowBlur  = 0;
        ctx2.shadowOffsetX = 0;
        ctx2.shadowOffsetY = 0;
      };
    } else if (wmType === 'image' && logo) {
      const ratio = logo.w / logo.h;
      wmW = (W * scale) / 100;
      wmH = wmW / ratio;
      drawFn = (ctx2) => {
        ctx2.drawImage(logo.el, -wmW/2, -wmH/2, wmW, wmH);
      };
    }

    if (!drawFn || !wmW) return;

    // 3. Position helper
    const margin = W * 0.04;
    const getPos = (w, h) => {
      let x, y;
      if      (pos.includes('left'))   x = margin + w/2;
      else if (pos.includes('right'))  x = W - margin - w/2;
      else                             x = W/2;
      if      (pos.includes('top'))    y = margin + h/2;
      else if (pos.includes('bottom')) y = H - margin - h/2;
      else                             y = H/2;
      return { x, y };
    };

    // 4. Stamp function
    const stamp = (cx, cy) => {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(cx, cy);
      ctx.rotate((rotation * Math.PI) / 180);
      drawFn(ctx);
      ctx.restore();
    };

    // 5. Tiling or single
    if (tiling) {
      const stepX = wmW  * tileGap;
      const stepY = wmH * tileGap * 2;
      for (let y = stepY/2; y < H + stepY; y += stepY) {
        for (let x = stepX/2; x < W + stepX; x += stepX) {
          stamp(x - stepX/4 * ((Math.round(y/stepY) % 2)), y);
        }
      }
    } else {
      const { x, y } = getPos(wmW, wmH);
      stamp(x, y);
    }
  }, [mainImg, wmType, text, color, fontSize, fontFam, bold, italic, outline, outlineC, shadow, logo, scale, pos, opacity, rotation, tiling, tileGap]);

  /* ── live preview ────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mainImg || result) return;
    render(canvas).catch(console.error);
  }, [render, mainImg, result]);

  /* ── apply / download ────────────────────────────────────── */
  const handleApply = async () => {
    if (!mainImg) return;
    if (wmType==='image' && !logo) { setError('Please upload a logo image first.'); return; }
    setIsWorking(true); setError('');
    try {
      const offscreen = document.createElement('canvas');
      await render(offscreen);
      const fmt  = OUT_FMTS.find(f=>f.v===outFmt);
      const blob = await new Promise(res => offscreen.toBlob(res, fmt.m, fmt.q ?? undefined));
      setResult({ blob, url:URL.createObjectURL(blob), size:blob.size });
    } catch(e) { console.error(e); setError('Failed to apply watermark.'); }
    setIsWorking(false);
  };

  const download = () => {
    if (!result) return;
    const a    = document.createElement('a');
    const base = mainImg.name.replace(/\.[^/.]+$/, '');
    a.href = result.url; a.download = `${base}_watermarked.${outFmt}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const reset = () => { setMainImg(null); setResult(null); setLogo(null); setError(''); };

  /* ── sidebar ─────────────────────────────────────────────── */
  const SidebarContent = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* Mode */}
      <div style={{ display:'flex', gap:4, padding:4, background:'var(--surface-raised,#18181f)', borderRadius:10, border:'1px solid var(--border)' }}>
        {[{id:'text',l:'✦ Text',I:Type},{id:'image',l:'⬛ Logo',I:ImageIcon}].map(({id,l,I})=>(
          <button key={id} onClick={()=>{ setWmType(id); setResult(null); }}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'9px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all 0.15s',
              background:wmType===id?'var(--surface,#111118)':'transparent',
              color:wmType===id?'var(--text,#f0f0f5)':'var(--text-muted)',
              boxShadow:wmType===id?'0 1px 4px rgba(0,0,0,0.2)':'none' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Text settings */}
      {wmType==='text' && (
        <Collapsible title="Text Settings" icon={Type}>
          {/* Quick presets */}
          <div style={{ marginBottom:12 }}>
            <div style={LS}>Quick Presets</div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {TEXT_PRESETS.map(p=>(
                <button key={p.label} onClick={()=>{ setText(p.label); setColor(p.color); setOutline(p.outline); }}
                  style={{ padding:'4px 9px', borderRadius:100, fontSize:10, fontWeight:700, cursor:'pointer', border:`1px solid ${p.color}50`, background:`${p.color}18`, color:p.color }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text input */}
          <div style={{ marginBottom:12 }}>
            <div style={LS}>Text</div>
            <input type="text" value={text} onChange={e=>{ setText(e.target.value); setResult(null); }}
              style={{ ...IN }} placeholder="Watermark text…"/>
          </div>

          {/* Font family */}
          <div style={{ marginBottom:12 }}>
            <div style={LS}>Font</div>
            <select value={fontFam} onChange={e=>{ setFontFam(e.target.value); setResult(null); }} style={{ ...IN, cursor:'pointer', appearance:'none' }}>
              {FONTS.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Font size */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={LS}>Size</div>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{fontSize}px</span>
            </div>
            <input type="range" min={10} max={300} value={fontSize} onChange={e=>{ setFontSize(Number(e.target.value)); setResult(null); }}
              style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
          </div>

          {/* Style row */}
          <div style={{ marginBottom:12 }}>
            <div style={LS}>Style</div>
            <div style={{ display:'flex', gap:5 }}>
              {[
                { l:'B',  s:{ fontWeight:900 }, active:bold,   set:()=>{setBold(v=>!v);setResult(null);}, title:'Bold' },
                { l:'I',  s:{ fontStyle:'italic' }, active:italic, set:()=>{setItalic(v=>!v);setResult(null);}, title:'Italic' },
              ].map(b=>(
                <button key={b.l} onClick={b.set} title={b.title}
                  style={{ ...IB, fontSize:13, ...b.s, color:b.active?'var(--accent-blue,#2563EB)':'var(--text-muted)', background:b.active?'rgba(37,99,235,0.1)':'transparent', outline:b.active?'1px solid var(--accent-blue,#2563EB)':'1px solid var(--border)' }}>
                  {b.l}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <div style={LS}>Text Color</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface,#111118)' }}>
                <input type="color" value={color} onChange={e=>{ setColor(e.target.value); setResult(null); }}
                  style={{ width:24, height:24, border:'none', background:'none', cursor:'pointer', borderRadius:4, padding:0 }}/>
                <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>{color.toUpperCase()}</span>
              </div>
            </div>
            <div>
              <div style={{ ...LS, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>Outline</span>
                <button onClick={()=>{setOutline(v=>!v);setResult(null);}}
                  style={{ width:30, height:16, borderRadius:8, border:'none', cursor:'pointer', transition:'all 0.2s', position:'relative', background:outline?'var(--accent-blue,#2563EB)':'var(--border)' }}>
                  <div style={{ position:'absolute', top:2, left:outline?14:2, width:12, height:12, borderRadius:'50%', background:'white', transition:'all 0.2s' }}/>
                </button>
              </div>
              {outline && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface,#111118)', marginTop:4 }}>
                  <input type="color" value={outlineC} onChange={e=>{ setOutlineC(e.target.value); setResult(null); }}
                    style={{ width:24, height:24, border:'none', background:'none', cursor:'pointer', borderRadius:4, padding:0 }}/>
                  <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>{outlineC.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Shadow */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>Drop Shadow</span>
            <button onClick={()=>{setShadow(v=>!v);setResult(null);}}
              style={{ width:30, height:16, borderRadius:8, border:'none', cursor:'pointer', transition:'all 0.2s', position:'relative', background:shadow?'var(--accent-blue,#2563EB)':'var(--border)' }}>
              <div style={{ position:'absolute', top:2, left:shadow?14:2, width:12, height:12, borderRadius:'50%', background:'white', transition:'all 0.2s' }}/>
            </button>
          </div>
        </Collapsible>
      )}

      {/* Logo settings */}
      {wmType==='image' && (
        <Collapsible title="Logo Settings" icon={ImageIcon}>
          {!logo ? (
            <label style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'24px 20px',
              border:'2px dashed var(--border)', borderRadius:10, cursor:'pointer', background:'var(--surface,#111118)',
              transition:'border-color 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent-blue,#2563EB)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <input type="file" accept="image/*" style={{display:'none'}} onChange={ingestLogo}/>
              <Upload size={22} color="var(--text-muted)"/>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:13, fontWeight:600 }}>Upload Logo</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>PNG with transparency recommended</div>
              </div>
            </label>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'rgba(37,99,235,0.06)', border:'1px solid rgba(37,99,235,0.2)', borderRadius:10, marginBottom:12 }}>
              <img src={logo.url} alt="logo" style={{ width:40, height:40, objectFit:'contain', borderRadius:6, background:'#fff', padding:2 }}/>
              <div style={{ flex:1, fontSize:11, color:'var(--text-muted)' }}>Logo ready · {logo.w}×{logo.h}px</div>
              <button onClick={()=>{ setLogo(null); setResult(null); }} style={{ ...IB, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)' }}><Trash2 size={12}/></button>
            </div>
          )}
          {logo && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <div style={LS}>Logo Scale</div>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{scale}%</span>
              </div>
              <input type="range" min={3} max={80} value={scale} onChange={e=>{ setScale(Number(e.target.value)); setResult(null); }}
                style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
            </div>
          )}
        </Collapsible>
      )}

      {/* Appearance */}
      <Collapsible title="Appearance" icon={Sliders}>
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <div style={LS}>Opacity</div>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{Math.round(opacity*100)}%</span>
          </div>
          <input type="range" min={0.05} max={1} step={0.01} value={opacity} onChange={e=>{ setOpacity(Number(e.target.value)); setResult(null); }}
            style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
        </div>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <div style={LS}>Rotation</div>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{rotation}°</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={()=>{ setRotation(0); setResult(null); }} style={IB} title="Reset"><RotateCcw size={13}/></button>
            <input type="range" min={-180} max={180} value={rotation} onChange={e=>{ setRotation(Number(e.target.value)); setResult(null); }}
              style={{ flex:1, accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
          </div>
        </div>
      </Collapsible>

      {/* Position */}
      <Collapsible title="Position" icon={Move}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:12 }}>
          {POSITIONS.map(p=>(
            <button key={p.id} onClick={()=>{ setPos(p.id); setResult(null); }}
              style={{ padding:'9px 4px', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', border:'none', transition:'all 0.15s',
                outline:`1px solid ${pos===p.id?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:pos===p.id?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                color:pos===p.id?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Tiling */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: tiling?10:0 }}>
          <span style={{ fontSize:12, fontWeight:600, color:tiling?'var(--text)':'var(--text-muted)' }}>Tile / Repeat</span>
          <button onClick={()=>{ setTiling(v=>!v); setResult(null); }}
            style={{ width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', transition:'all 0.2s', position:'relative', background:tiling?'var(--accent-blue,#2563EB)':'var(--border)' }}>
            <div style={{ position:'absolute', top:3, left:tiling?17:3, width:14, height:14, borderRadius:'50%', background:'white', transition:'all 0.2s' }}/>
          </button>
        </div>
        {tiling && (
          <div style={{ marginTop:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <div style={LS}>Tile Spacing</div>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{tileGap.toFixed(1)}×</span>
            </div>
            <input type="range" min={1} max={4} step={0.1} value={tileGap} onChange={e=>{ setTileGap(Number(e.target.value)); setResult(null); }}
              style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
          </div>
        )}
      </Collapsible>

      {/* Output format */}
      <Collapsible title="Output Format" defaultOpen={false}>
        <div style={{ display:'flex', gap:4, marginBottom: outFmt!=='png'?10:0 }}>
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
        {outFmt!=='png' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <div style={LS}>Quality</div>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{quality}%</span>
            </div>
            <input type="range" min={40} max={100} step={1} value={quality} onChange={e=>setQuality(Number(e.target.value))}
              style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
          </div>
        )}
      </Collapsible>

      {/* Actions */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {!result ? (
          <button onClick={handleApply} disabled={isWorking||(wmType==='image'&&!logo)}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:10, border:'none',
              background: (!isWorking&&!(wmType==='image'&&!logo)) ? 'var(--accent-blue,#2563EB)' : 'var(--surface-raised,#18181f)',
              color: (!isWorking&&!(wmType==='image'&&!logo)) ? 'white' : 'var(--text-muted)',
              fontSize:14, fontWeight:600, cursor:(!isWorking&&!(wmType==='image'&&!logo))?'pointer':'not-allowed',
              boxShadow:(!isWorking&&!(wmType==='image'&&!logo))?'0 4px 16px rgba(37,99,235,0.3)':'none', transition:'all 0.15s' }}
            onMouseEnter={e=>{ if(!isWorking) e.currentTarget.style.transform='translateY(-1px)'; }}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            {isWorking
              ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Applying…</>
              : <><Layers size={15}/> Apply Watermark</>}
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
              ← Edit Watermark
            </button>
          </>
        )}
        {mainImg && (
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
          <span style={{ fontSize:13, color:'#ef4444', flex:1 }}>{error}</span>
          <button onClick={()=>setError('')} style={IB}><X size={12}/></button>
        </div>
      )}

      {/* ══ IDLE ══ */}
      {!mainImg && (
        <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14,
            padding: isMobile ? '48px 20px' : '80px 40px',
            border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:16,
            background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.2s' }}>
          <input type="file" accept="image/*" style={{display:'none'}} onChange={onMainFile}/>
          <div style={{ width:72, height:72, borderRadius:20, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
            background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)', transition:'all 0.2s' }}>
            <Layers size={28} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:isMobile?15:17, fontWeight:600, marginBottom:6 }}>{drag?'Drop image here':'Add Watermark to Image'}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span></div>
            <div style={{ marginTop:10, display:'flex', gap:5, justifyContent:'center', flexWrap:'wrap' }}>
              {['Text & Logo','Live Preview','Bold/Italic/Shadow','Outline','Tile Repeat','9 Positions','PNG · JPEG · WebP'].map(t=>(
                <span key={t} style={{ fontSize:10, padding:'3px 8px', borderRadius:100, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text-muted)', fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>
        </label>
      )}

      {/* ══ ACTIVE ══ */}
      {mainImg && (
        <div style={{ display:isDesktop?'grid':'flex', gridTemplateColumns:'1fr 300px', flexDirection:'column', gap:14, alignItems:'start' }}>

          {/* Canvas */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', flex:1 }}>
                {result ? '✓ Watermark Applied' : 'Live Preview'}
              </span>
              <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>{mainImg.w}×{mainImg.h}px · {fmtBytes(mainImg.size)}</span>
              <button onClick={reset} style={{ ...IB, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.05)', fontSize:10 }} title="Change image"><X size={12}/></button>
            </div>

            {/* Canvas / Result */}
            <div style={{ position:'relative', borderRadius:14, background:'#050508', border:'1px solid var(--border)', overflow:'hidden',
              minHeight: isMobile ? 260 : 440, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {result ? (
                <img src={result.url} style={{ maxWidth:'100%', maxHeight: isMobile ? 300 : 500, objectFit:'contain', display:'block' }}/>
              ) : (
                <canvas ref={canvasRef} style={{ maxWidth:'100%', maxHeight: isMobile ? 300 : 500, objectFit:'contain', display:'block' }}/>
              )}
            </div>

            {/* Info strip */}
            {result && (
              <div style={{ display:'flex', gap:16, padding:'10px 14px', borderRadius:10, background:'rgba(22,163,74,0.05)', border:'1px solid rgba(22,163,74,0.2)', fontSize:11, fontFamily:'monospace', flexWrap:'wrap' }}>
                {[{l:'OUTPUT',v:`${outFmt.toUpperCase()}`},{l:'SIZE',v:fmtBytes(result.size)},{l:'DIMS',v:`${mainImg.w}×${mainImg.h}px`}].map(({l,v})=>(
                  <div key={l}><div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:2 }}>{l}</div><div style={{ fontWeight:700, color:'#16a34a' }}>{v}</div></div>
                ))}
              </div>
            )}

            {/* Mobile sidebar */}
            {!isDesktop && (
              <Collapsible title="Watermark Settings">
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
const IN = { width:'100%', padding:'9px 12px', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text,#f0f0f5)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
const LS = { fontSize:10, fontWeight:700, color:'var(--text-muted,#6b6b80)', marginBottom:5, letterSpacing:'0.07em', textTransform:'uppercase', display:'block' };