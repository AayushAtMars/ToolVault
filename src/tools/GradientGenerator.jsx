import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Copy, Check, RefreshCw, Shuffle, Plus, Trash2,
  Download, Move, RotateCcw, ChevronUp, ChevronDown
} from 'lucide-react';

/* ─── useWidth ───────────────────────────────────────────── */
function useWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

/* ─── Helpers ────────────────────────────────────────────── */
function randHex() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r}, ${g}, ${b}`;
}

/* ─── Gradient CSS builder ───────────────────────────────── */
function buildGradient(type, angle, radialShape, radialSize, stops) {
  const stopStr = stops.map(s => `${s.color} ${s.position}%`).join(', ');
  if (type === 'linear')  return `linear-gradient(${angle}deg, ${stopStr})`;
  if (type === 'radial')  return `radial-gradient(${radialShape} ${radialSize}, ${stopStr})`;
  if (type === 'conic')   return `conic-gradient(from ${angle}deg, ${stopStr})`;
  return '';
}

/* ─── Preset gradients ───────────────────────────────────── */
const PRESETS = [
  { name: 'Ocean',      type:'linear', angle:135, stops:[{color:'#0ea5e9',position:0},{color:'#6366f1',position:100}] },
  { name: 'Sunset',     type:'linear', angle:45,  stops:[{color:'#f97316',position:0},{color:'#ec4899',position:50},{color:'#8b5cf6',position:100}] },
  { name: 'Forest',     type:'linear', angle:160, stops:[{color:'#14532d',position:0},{color:'#22c55e',position:100}] },
  { name: 'Rose Gold',  type:'linear', angle:135, stops:[{color:'#f43f5e',position:0},{color:'#fb923c',position:100}] },
  { name: 'Midnight',   type:'linear', angle:180, stops:[{color:'#0f172a',position:0},{color:'#1e3a8a',position:100}] },
  { name: 'Peach',      type:'linear', angle:90,  stops:[{color:'#fde68a',position:0},{color:'#fb923c',position:100}] },
  { name: 'Aurora',     type:'linear', angle:120, stops:[{color:'#06b6d4',position:0},{color:'#10b981',position:50},{color:'#8b5cf6',position:100}] },
  { name: 'Candy',      type:'radial', angle:0,   stops:[{color:'#f472b6',position:0},{color:'#a78bfa',position:100}] },
  { name: 'Solar',      type:'conic',  angle:0,   stops:[{color:'#fbbf24',position:0},{color:'#f97316',position:33},{color:'#ef4444',position:66},{color:'#fbbf24',position:100}] },
  { name: 'Neon',       type:'linear', angle:90,  stops:[{color:'#22d3ee',position:0},{color:'#a78bfa',position:50},{color:'#f472b6',position:100}] },
  { name: 'Dusk',       type:'linear', angle:180, stops:[{color:'#1e293b',position:0},{color:'#7c3aed',position:100}] },
  { name: 'Mint',       type:'linear', angle:135, stops:[{color:'#d1fae5',position:0},{color:'#059669',position:100}] },
];

/* ─── CopyBtn ────────────────────────────────────────────── */
function CopyBtn({ getText, label='Copy', small }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(getText()).catch(()=>{}); setOk(true); setTimeout(()=>setOk(false),1500); }}
      style={{
        display:'flex',alignItems:'center',gap:5,
        padding:small?'4px 9px':'7px 13px',borderRadius:8,
        background:ok?'rgba(16,185,129,0.1)':'rgba(255,255,255,0.05)',
        border:`1px solid ${ok?'rgba(16,185,129,0.3)':'var(--border)'}`,
        color:ok?'#10b981':'var(--text-muted)',
        fontFamily:'inherit',fontSize:11,fontWeight:700,
        cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap',
      }}>
      {ok?<Check size={11}/>:<Copy size={11}/>}
      {ok?'Copied!':label}
    </button>
  );
}

/* ─── Stop item ──────────────────────────────────────────── */
function StopRow({ stop, index, total, onUpdate, onRemove, onMove, compact }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap: compact ? 5 : 8 }}>
      {/* Up/down reorder */}
      <div style={{ display:'flex', flexDirection:'column', gap:1, flexShrink:0 }}>
        <button onClick={() => onMove(index, -1)} disabled={index===0} style={{ width:16,height:14,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'none',color:index===0?'rgba(255,255,255,0.1)':'var(--text-muted)',cursor:index===0?'default':'pointer',padding:0,fontFamily:'inherit' }}><ChevronUp size={10}/></button>
        <button onClick={() => onMove(index, 1)} disabled={index===total-1} style={{ width:16,height:14,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'none',color:index===total-1?'rgba(255,255,255,0.1)':'var(--text-muted)',cursor:index===total-1?'default':'pointer',padding:0,fontFamily:'inherit' }}><ChevronDown size={10}/></button>
      </div>

      {/* Color picker */}
      <input type="color" value={stop.color} onChange={e => onUpdate(index,{...stop,color:e.target.value})}
        style={{ width:30, height:30, borderRadius:7, border:'2px solid rgba(255,255,255,0.12)', cursor:'pointer', padding:2, background:'transparent', flexShrink:0 }}
      />

      {/* Hex input — hidden on compact */}
      {!compact && (
        <input
          value={stop.color} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onUpdate(index,{...stop,color:e.target.value}); }}
          style={{ width:76, padding:'5px 7px', borderRadius:7, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text,#f0f0f5)', fontFamily:'"DM Mono",monospace', fontSize:11, fontWeight:700, outline:'none', flexShrink:0 }}
        />
      )}

      {/* Position slider */}
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:5, minWidth:0 }}>
        <input type="range" min={0} max={100} value={stop.position}
          onChange={e => onUpdate(index,{...stop,position:Number(e.target.value)})}
          style={{ flex:1, height:4, borderRadius:99, outline:'none', cursor:'pointer', accentColor:'var(--accent-blue,#2563eb)', minWidth:0 }}
        />
        <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)', minWidth:26, textAlign:'right', flexShrink:0 }}>{stop.position}%</span>
      </div>

      {/* Remove */}
      {total > 2 && (
        <button onClick={() => onRemove(index)} style={{ width:24,height:24,borderRadius:6,border:'1px solid var(--border)',background:'rgba(239,68,68,0.08)',color:'rgba(239,68,68,0.6)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontFamily:'inherit' }}>
          <Trash2 size={10}/>
        </button>
      )}
    </div>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function GradientGenerator() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [type, setType]           = useState('linear');
  const [angle, setAngle]         = useState(135);
  const [radialShape, setRadialShape] = useState('circle');
  const [radialSize, setRadialSize]   = useState('farthest-corner');
  const [stops, setStops]         = useState([
    { color: '#2563eb', position: 0 },
    { color: '#9333ea', position: 100 },
  ]);
  const [previewSize, setPreviewSize] = useState('full'); // 'full' | 'card' | 'text'
  const canvasRef = useRef(null);

  const gradient = buildGradient(type, angle, radialShape, radialSize, stops);
  const css = `background: ${gradient};`;
  const cssMulti = `background: ${gradient};\nbackground: -webkit-${gradient};`;

  /* ── Stop operations ── */
  const updateStop = (i, s)  => setStops(prev => prev.map((x,j) => j===i ? s : x));
  const removeStop = (i)     => setStops(prev => prev.filter((_,j) => j!==i));
  const addStop = () => {
    const mid = Math.round((stops[0].position + stops[stops.length-1].position) / 2);
    setStops(prev => [...prev, { color: randHex(), position: mid }].sort((a,b)=>a.position-b.position));
  };
  const moveStop = (i, dir) => {
    const arr = [...stops];
    const swap = i + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[i], arr[swap]] = [arr[swap], arr[i]];
    setStops(arr);
  };
  const randomizeStops = () => {
    setAngle(Math.floor(Math.random() * 360));
    setStops(stops.map(s => ({ ...s, color: randHex() })));
  };
  const reset = () => { setType('linear'); setAngle(135); setStops([{color:'#2563eb',position:0},{color:'#9333ea',position:100}]); };

  /* ── Load preset ── */
  const loadPreset = (p) => {
    setType(p.type); setAngle(p.angle);
    setStops([...p.stops]);
  };

  /* ── Download as PNG ── */
  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 800; canvas.height = 400;
    const isLinear = type === 'linear';
    if (isLinear || type === 'conic') {
      const rad = (angle - 90) * Math.PI / 180;
      const cx = 400, cy = 200;
      const len = Math.sqrt(800*800 + 400*400);
      const grd = ctx.createLinearGradient(
        cx - Math.cos(rad)*len/2, cy - Math.sin(rad)*len/2,
        cx + Math.cos(rad)*len/2, cy + Math.sin(rad)*len/2,
      );
      stops.forEach(s => grd.addColorStop(s.position/100, s.color));
      ctx.fillStyle = grd;
    } else {
      const grd = ctx.createRadialGradient(400,200,0,400,200,300);
      stops.forEach(s => grd.addColorStop(s.position/100, s.color));
      ctx.fillStyle = grd;
    }
    ctx.fillRect(0,0,800,400);
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href=url; a.download='gradient.png'; a.click();
  };

  const GRADIENT_TYPES = [
    { id:'linear', label:'Linear' },
    { id:'radial', label:'Radial' },
    { id:'conic',  label:'Conic'  },
  ];

  const SidebarContent = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Type */}
      <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Type</div>
        <div style={{ display:'flex', gap:5 }}>
          {GRADIENT_TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} style={{
              flex:1, padding:'7px 0', borderRadius:8, border:`1px solid ${type===t.id?'var(--accent-blue,#2563eb)':'var(--border)'}`,
              background:type===t.id?'rgba(37,99,235,0.12)':'var(--surface,#111118)',
              color:type===t.id?'var(--accent-blue,#2563eb)':'var(--text-muted)',
              fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Angle / shape controls */}
      <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
        {type === 'linear' || type === 'conic' ? (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Angle</span>
              <span style={{ fontSize:11, fontFamily:'monospace', color:'var(--text-muted)' }}>{angle}°</span>
            </div>
            <input type="range" min={0} max={360} value={angle} onChange={e => setAngle(Number(e.target.value))}
              style={{ width:'100%', height:4, borderRadius:99, outline:'none', cursor:'pointer', accentColor:'var(--accent-blue,#2563eb)' }}
            />
            {/* Angle preset buttons */}
            <div style={{ display:'flex', gap:4, marginTop:8, flexWrap:'wrap' }}>
              {[0,45,90,135,180,270].map(a => (
                <button key={a} onClick={() => setAngle(a)} style={{
                  padding:'3px 8px', borderRadius:5, border:`1px solid ${angle===a?'var(--accent-blue,#2563eb)':'var(--border)'}`,
                  background:angle===a?'rgba(37,99,235,0.12)':'var(--surface,#111118)',
                  color:angle===a?'var(--accent-blue,#2563eb)':'var(--text-muted)',
                  fontFamily:'monospace', fontSize:10, fontWeight:700, cursor:'pointer', transition:'all 0.12s',
                }}>{a}°</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Shape</div>
            <div style={{ display:'flex', gap:5, marginBottom:10 }}>
              {['circle','ellipse'].map(s => (
                <button key={s} onClick={() => setRadialShape(s)} style={{
                  flex:1, padding:'6px 0', borderRadius:7, border:`1px solid ${radialShape===s?'var(--accent-blue,#2563eb)':'var(--border)'}`,
                  background:radialShape===s?'rgba(37,99,235,0.12)':'var(--surface,#111118)',
                  color:radialShape===s?'var(--accent-blue,#2563eb)':'var(--text-muted)',
                  fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s', textTransform:'capitalize',
                }}>{s}</button>
              ))}
            </div>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Size</div>
            <select value={radialSize} onChange={e => setRadialSize(e.target.value)} style={{
              width:'100%', padding:'7px 10px', borderRadius:8, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text,#f0f0f5)', fontFamily:'inherit', fontSize:12, outline:'none',
            }}>
              {['closest-side','closest-corner','farthest-side','farthest-corner'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Color stops */}
      <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Color Stops</span>
          <button onClick={addStop} disabled={stops.length >= 6} style={{
            display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:6,
            background:'rgba(37,99,235,0.1)',border:'1px solid rgba(37,99,235,0.25)',
            color:stops.length>=6?'rgba(255,255,255,0.2)':'var(--accent-blue,#2563eb)',
            fontFamily:'inherit',fontSize:10,fontWeight:700,cursor:stops.length>=6?'default':'pointer',
          }}>
            <Plus size={10}/> Add
          </button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {stops.map((s, i) => (
            <StopRow key={i} stop={s} index={i} total={stops.length} onUpdate={updateStop} onRemove={removeStop} onMove={moveStop} compact={!isDesktop}/>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <button onClick={randomizeStops} style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px',borderRadius:10,background:'var(--accent-blue,#2563eb)',border:'none',color:'#fff',fontFamily:'inherit',fontSize:12,fontWeight:700,cursor:'pointer',boxShadow:'0 3px 12px rgba(37,99,235,0.3)',transition:'all 0.15s' }}>
          <Shuffle size={13}/> Randomize Colors
        </button>
        <button onClick={reset} style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'8px',borderRadius:10,background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',color:'var(--text-muted)',fontFamily:'inherit',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.15s' }}>
          <RotateCcw size={12}/> Reset
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .gg * { box-sizing: border-box; }
        .gg { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .gg-fadein { animation:fadeIn 0.2s ease both; }
      `}</style>

      <div className="gg">
        <div style={{ display:'grid', gridTemplateColumns:isDesktop?'1fr 280px':'1fr', gap:16, alignItems:'start' }}>

          {/* ═══ LEFT ═══ */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Main preview */}
            <div style={{ borderRadius:16, overflow:'hidden', border:'1px solid var(--border)', position:'relative' }}>
              {/* Preview area */}
              <div style={{ background:gradient, height: isDesktop ? 280 : 200, transition:'background 0.2s' }}/>

              {/* Preview mode tabs */}
              <div style={{
                position:'absolute', top:10, right:10,
                display:'flex', background:'rgba(0,0,0,0.45)', backdropFilter:'blur(8px)',
                borderRadius:9, padding:3, gap:2, border:'1px solid rgba(255,255,255,0.1)',
              }}>
                {[
                  { id:'full', label:'Full' },
                  { id:'card', label:'Card' },
                  { id:'text', label:'Text' },
                ].map(({ id, label }) => (
                  <button key={id} onClick={() => setPreviewSize(id)} style={{
                    padding:'4px 10px', borderRadius:7, border:'none',
                    background:previewSize===id?'rgba(255,255,255,0.2)':'transparent',
                    color:previewSize===id?'#fff':'rgba(255,255,255,0.5)',
                    fontFamily:'inherit', fontSize:10, fontWeight:700, cursor:'pointer', transition:'all 0.13s',
                  }}>{label}</button>
                ))}
              </div>

              {/* Card preview overlay */}
              {previewSize === 'card' && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:16, padding:'24px 28px', textAlign:'center', maxWidth:260 }}>
                    <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:6 }}>Card Preview</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginBottom:14 }}>See how your gradient looks as a card background</div>
                    <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:8, padding:'7px 16px', fontSize:12, fontWeight:700, color:'#fff', display:'inline-block' }}>Button</div>
                  </div>
                </div>
              )}

              {/* Text preview overlay */}
              {previewSize === 'text' && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize: isDesktop ? 42 : 28, fontWeight:900, background:gradient, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1.1 }}>
                      Gradient<br/>Text
                    </div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:8 }}>Applied as text gradient</div>
                  </div>
                </div>
              )}
            </div>

            {/* Gradient bar with stop indicators */}
            <div style={{ position:'relative', height:32, borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
              <div style={{ position:'absolute', inset:0, background:type==='conic'?`linear-gradient(90deg, ${stops.map(s=>`${s.color} ${s.position}%`).join(',')})`:gradient }}/>
              {type !== 'conic' && stops.map((s, i) => (
                <div key={i} style={{
                  position:'absolute', top:'50%', left:`${s.position}%`,
                  transform:'translate(-50%,-50%)',
                  width:16, height:16, borderRadius:'50%',
                  background:s.color, border:'2px solid #fff',
                  boxShadow:'0 1px 4px rgba(0,0,0,0.5)',
                  cursor:'grab', zIndex:2,
                }}/>
              ))}
            </div>

            {/* CSS output */}
            <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.15)' }}>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>CSS Output</span>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  <CopyBtn getText={() => css} label="Copy" small/>
                  <CopyBtn getText={() => cssMulti} label="+Webkit" small/>
                  <button onClick={downloadPng} style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:7,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',color:'var(--text-muted)',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.15s' }}>
                    <Download size={11}/> PNG
                  </button>
                </div>
              </div>
              <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:6 }}>
                <code style={{ fontFamily:'"DM Mono",monospace', fontSize:12, color:'var(--text,#f0f0f5)', lineHeight:1.6, wordBreak:'break-all', whiteSpace:'pre-wrap' }}>
                  {cssMulti}
                </code>
                {/* Text gradient snippet */}
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:8, marginTop:2 }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5 }}>Text gradient</div>
                  <code style={{ fontFamily:'"DM Mono",monospace', fontSize:11, color:'rgba(240,240,245,0.6)', lineHeight:1.6 }}>
                    {`background: ${gradient};\n-webkit-background-clip: text;\n-webkit-text-fill-color: transparent;`}
                  </code>
                </div>
              </div>
            </div>

            {/* Presets */}
            <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Presets</div>
              <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(6, 1fr)' : 'repeat(4, 1fr)', gap:6 }}>
                {PRESETS.map(p => (
                  <button key={p.name} onClick={() => loadPreset(p)} title={p.name} style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                    padding:'4px', borderRadius:9, border:'1px solid var(--border)',
                    background:'transparent', cursor:'pointer', transition:'all 0.15s',
                  }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-blue,#2563eb)';e.currentTarget.style.transform='scale(1.05)';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='scale(1)';}}
                  >
                    <div style={{ width:'100%', height:32, borderRadius:6, background: buildGradient(p.type, p.angle, 'circle', 'farthest-corner', p.stops) }}/>
                    <span style={{ fontSize:8, fontWeight:600, color:'var(--text-muted)', textAlign:'center', lineHeight:1.2 }}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile sidebar */}
            {!isDesktop && <SidebarContent/>}
          </div>

          {/* ═══ RIGHT SIDEBAR ═══ */}
          {isDesktop && <SidebarContent/>}
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display:'none' }}/>
    </>
  );
}