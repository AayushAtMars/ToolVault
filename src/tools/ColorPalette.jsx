import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Copy, Check, RefreshCw, Shuffle, Lock, Unlock,
  Download, Plus, Minus, Trash2, Eye, Sliders,
  Sun, Moon
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

/* ─── Color math helpers ─────────────────────────────────── */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return { r, g, b };
}

function hexToHsl(hex) {
  let { r, g, b } = hexToRgb(hex);
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hex1), l2 = getLuminance(hex2);
  const bright = Math.max(l1, l2), dark = Math.min(l1, l2);
  return ((bright + 0.05) / (dark + 0.05)).toFixed(2);
}

function isDark(hex) { return getLuminance(hex) < 0.35; }

function hexToCmyk(hex) {
  let { r, g, b } = hexToRgb(hex);
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

function isValidHex(h) { return /^#[0-9A-Fa-f]{6}$/.test(h); }

/* ─── Harmony generators ─────────────────────────────────── */
const HARMONY_TYPES = [
  { id: 'analogous',          label: 'Analogous',          desc: 'Adjacent hues, cohesive & calm' },
  { id: 'complementary',      label: 'Complementary',      desc: 'Opposite hues, high contrast' },
  { id: 'split-complementary', label: 'Split Comp.',       desc: 'One + two adjacent opposites' },
  { id: 'triadic',            label: 'Triadic',            desc: 'Three evenly spaced hues' },
  { id: 'tetradic',           label: 'Tetradic',           desc: 'Four hues, square arrangement' },
  { id: 'monochromatic',      label: 'Monochromatic',      desc: 'Single hue, varied lightness' },
];

function generateHarmony(type, baseHue, count, saturation, lightness) {
  const offsets = {
    'analogous':           Array.from({length: count}, (_, i) => (i - Math.floor(count/2)) * 30),
    'complementary':       [0, 180, 30, -30, 150].slice(0, count),
    'split-complementary': [0, 150, 210, 60, 270, 120].slice(0, count),
    'triadic':             [0, 120, 240, 60, 180, 300].slice(0, count),
    'tetradic':            [0, 90, 180, 270, 45, 135].slice(0, count),
    'monochromatic':       Array.from({length: count}, (_, i) => 0),
  };

  return (offsets[type] || offsets.analogous).map((offset, i) => {
    const h = (baseHue + offset + 360) % 360;
    const s = type === 'monochromatic'
      ? Math.max(20, Math.min(90, saturation - 15 + i * (30 / Math.max(count-1,1))))
      : Math.max(30, Math.min(90, saturation + (Math.random() * 20 - 10)));
    const l = type === 'monochromatic'
      ? Math.max(15, Math.min(85, 20 + i * (60 / Math.max(count-1,1))))
      : Math.max(20, Math.min(80, lightness + (Math.random() * 20 - 10)));
    return makeColor(h, Math.round(s), Math.round(l));
  });
}

function makeColor(h, s, l) {
  return { hex: hslToHex(h, s, l), h, s, l, locked: false };
}

function randomPalette(type, count) {
  const h = Math.floor(Math.random() * 360);
  const s = 50 + Math.floor(Math.random() * 30);
  const l = 40 + Math.floor(Math.random() * 20);
  return generateHarmony(type, h, count, s, l);
}

/* ─── CopyBtn ────────────────────────────────────────────── */
function CopyBtn({ getText, label = 'Copy', small }) {
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

/* ─── Color swatch card ──────────────────────────────────── */
function SwatchCard({ color, index, onUpdate, onLock, onRemove, canRemove }) {
  const [editing, setEditing] = useState(false);
  const [hexInput, setHexInput] = useState(color.hex);
  const dark = isDark(color.hex);
  const textColor = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';
  const mutedColor = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
  const { r, g, b } = hexToRgb(color.hex);
  const cmyk = hexToCmyk(color.hex);
  const contrastW = getContrastRatio(color.hex, '#ffffff');
  const contrastB = getContrastRatio(color.hex, '#000000');

  const commitHex = () => {
    const h = hexInput.startsWith('#') ? hexInput : '#' + hexInput;
    if (isValidHex(h)) {
      const hsl = hexToHsl(h);
      onUpdate({ ...color, hex: h, ...hsl });
    } else {
      setHexInput(color.hex);
    }
    setEditing(false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', flex:1, minWidth: 120 }}>
      {/* Color block */}
      <div style={{
        background: color.hex, flex:1, minHeight: 140,
        display:'flex', flexDirection:'column', justifyContent:'space-between',
        padding:12, position:'relative',
        transition:'background 0.2s',
      }}>
        {/* Top row: lock + remove */}
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <button onClick={() => onLock(index)} title={color.locked ? 'Unlock' : 'Lock color'} style={{
            width:28, height:28, borderRadius:7,
            background:color.locked?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.2)',
            border:'none', color:textColor, display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', backdropFilter:'blur(4px)',
          }}>
            {color.locked ? <Lock size={12}/> : <Unlock size={12}/>}
          </button>
          {canRemove && (
            <button onClick={() => onRemove(index)} title="Remove" style={{
              width:28, height:28, borderRadius:7,
              background:'rgba(239,68,68,0.2)', border:'none', color:'rgba(255,100,100,0.9)',
              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
            }}>
              <Trash2 size={11}/>
            </button>
          )}
        </div>

        {/* Bottom: hex value */}
        <div>
          {editing ? (
            <input
              value={hexInput}
              onChange={e => setHexInput(e.target.value)}
              onBlur={commitHex}
              onKeyDown={e => e.key === 'Enter' && commitHex()}
              autoFocus
              style={{
                width:'100%', background:'rgba(0,0,0,0.3)',
                border:'1px solid rgba(255,255,255,0.3)', borderRadius:6,
                color:'#fff', fontFamily:'"DM Mono",monospace', fontSize:13, fontWeight:700,
                padding:'4px 8px', outline:'none', textAlign:'center',
              }}
            />
          ) : (
            <div
              onClick={() => { setEditing(true); setHexInput(color.hex); }}
              style={{ display:'flex', alignItems:'center', gap:6, cursor:'text' }}
            >
              <span style={{
                fontFamily:'"DM Mono",monospace', fontSize:13, fontWeight:800,
                color: textColor, letterSpacing:'0.04em',
                background:'rgba(0,0,0,0.18)', backdropFilter:'blur(4px)',
                padding:'3px 9px', borderRadius:6,
              }}>
                {color.hex.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Info panel */}
      <div style={{ background:'var(--surface-raised,#18181f)', padding:'10px 12px', display:'flex', flexDirection:'column', gap:5 }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {[
            { label:'RGB', value:`${r},${g},${b}` },
            { label:'HSL', value:`${color.h}°${color.s}%${color.l}%` },
          ].map(({ label, value }) => (
            <button key={label} onClick={() => navigator.clipboard.writeText(value).catch(()=>{})} style={{
              display:'flex', alignItems:'center', gap:3,
              padding:'2px 7px', borderRadius:5, cursor:'pointer',
              background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)',
              fontFamily:'inherit', transition:'all 0.12s',
            }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
            >
              <span style={{ fontSize:8, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>{label}</span>
              <span style={{ fontSize:9, fontFamily:'"DM Mono",monospace', color:'rgba(240,240,245,0.7)' }}>{value}</span>
            </button>
          ))}
        </div>
        {/* Contrast badges */}
        <div style={{ display:'flex', gap:4 }}>
          {[
            { bg:'#fff', fg:'#000', ratio:contrastW, label:'on W' },
            { bg:'#000', fg:'#fff', ratio:contrastB, label:'on B' },
          ].map(({ bg, fg, ratio, label }) => {
            const pass = parseFloat(ratio) >= 4.5;
            return (
              <div key={label} style={{
                display:'flex', alignItems:'center', gap:3,
                padding:'2px 6px', borderRadius:5,
                background: pass ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border:`1px solid ${pass ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
              }}>
                <span style={{ fontSize:8, fontWeight:700, color: pass ? '#10b981' : '#f87171' }}>{ratio} {label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function ColorPalette() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [harmonyType, setHarmonyType] = useState('analogous');
  const [count, setCount]             = useState(5);
  const [palette, setPalette]         = useState(() => randomPalette('analogous', 5));
  const [baseHue, setBaseHue]         = useState(220);
  const [saturation, setSaturation]   = useState(65);
  const [lightness, setLightness]     = useState(50);
  const [previewMode, setPreviewMode] = useState('swatch'); // 'swatch' | 'ui'
  const [uiDark, setUiDark]           = useState(true);

  const regenerate = useCallback(() => {
    setPalette(prev =>
      generateHarmony(harmonyType, baseHue, count, saturation, lightness).map((c, i) =>
        prev[i]?.locked ? prev[i] : c
      )
    );
  }, [harmonyType, baseHue, count, saturation, lightness]);

  const randomize = () => {
    const h = Math.floor(Math.random() * 360);
    const s = 45 + Math.floor(Math.random() * 35);
    const l = 35 + Math.floor(Math.random() * 25);
    setBaseHue(h); setSaturation(s); setLightness(l);
    setPalette(prev =>
      generateHarmony(harmonyType, h, count, s, l).map((c, i) =>
        prev[i]?.locked ? prev[i] : c
      )
    );
  };

  const toggleLock = (i) => {
    setPalette(prev => prev.map((c, j) => j === i ? { ...c, locked: !c.locked } : c));
  };

  const updateColor = (i, updated) => {
    setPalette(prev => prev.map((c, j) => j === i ? updated : c));
  };

  const removeColor = (i) => {
    if (palette.length <= 2) return;
    setPalette(prev => { const n = [...prev]; n.splice(i, 1); return n; });
    setCount(c => c - 1);
  };

  const addColor = () => {
    if (palette.length >= 8) return;
    const h = Math.floor(Math.random() * 360);
    setPalette(prev => [...prev, makeColor(h, saturation, lightness)]);
    setCount(c => c + 1);
  };

  const exportCSS = () => {
    const css = `:root {\n${palette.map((c, i) => `  --color-${i+1}: ${c.hex};`).join('\n')}\n}`;
    navigator.clipboard.writeText(css).catch(()=>{});
  };

  const exportTailwind = () => {
    const tw = `colors: {\n${palette.map((c, i) => `  'palette-${i+1}': '${c.hex}',`).join('\n')}\n}`;
    navigator.clipboard.writeText(tw).catch(()=>{});
  };

  const downloadSvg = () => {
    const w = palette.length * 100, h = 80;
    const rects = palette.map((c, i) => `<rect x="${i*100}" y="0" width="100" height="${h}" fill="${c.hex}"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${rects}</svg>`;
    const url = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'}));
    const a = document.createElement('a'); a.href = url; a.download = 'palette.svg'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .cp * { box-sizing: border-box; }
        .cp { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }
        .cp-slider {
          -webkit-appearance:none; appearance:none;
          width:100%; height:4px; border-radius:99px; outline:none; cursor:pointer;
          border:none;
        }
        .cp-slider::-webkit-slider-thumb {
          -webkit-appearance:none; width:16px; height:16px; border-radius:50%;
          background:#fff; cursor:pointer; border:2px solid rgba(37,99,235,0.8);
          box-shadow:0 1px 4px rgba(0,0,0,0.4);
        }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .cp-fadein { animation:fadeIn 0.2s ease both; }
      `}</style>

      <div className="cp">

        {/* ── Top controls ── */}
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
          <button onClick={randomize} style={{
            display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:9,
            background:'var(--accent-blue,#2563eb)',border:'none',color:'#fff',
            fontFamily:'inherit',fontSize:13,fontWeight:700,cursor:'pointer',
            boxShadow:'0 3px 12px rgba(37,99,235,0.35)',transition:'all 0.15s',
          }}
            onMouseEnter={e=>{e.currentTarget.style.background='#1d4ed8';e.currentTarget.style.transform='translateY(-1px)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='var(--accent-blue,#2563eb)';e.currentTarget.style.transform='translateY(0)';}}
          >
            <Shuffle size={14}/> Randomize
          </button>
          <button onClick={regenerate} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 13px',borderRadius:9,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',color:'var(--text-muted)',fontFamily:'inherit',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.15s' }}>
            <RefreshCw size={13}/> Regenerate
          </button>
          <div style={{ flex:1 }}/>
          {/* Preview mode */}
          <div style={{ display:'flex',background:'var(--surface,#111118)',border:'1px solid var(--border)',borderRadius:9,padding:3,gap:2 }}>
            {[{id:'swatch',label:'Swatches'},{id:'ui',label:'UI Preview'}].map(({id,label}) => (
              <button key={id} onClick={() => setPreviewMode(id)} style={{
                padding:'5px 11px',borderRadius:7,border:'none',
                background:previewMode===id?'var(--accent-blue,#2563eb)':'transparent',
                color:previewMode===id?'#fff':'var(--text-muted)',
                fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:isDesktop?'1fr 260px':'1fr', gap:16, alignItems:'start' }}>

          {/* ═══ LEFT ═══ */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Swatches / UI Preview */}
            {previewMode === 'swatch' ? (
              <div className="cp-fadein">
                <div style={{ display:'flex', gap:10, alignItems:'stretch', flexWrap: isDesktop ? 'nowrap' : 'wrap' }}>
                  {palette.map((color, i) => (
                    <SwatchCard
                      key={`${color.hex}-${i}`}
                      color={color} index={i}
                      onUpdate={(c) => updateColor(i, c)}
                      onLock={toggleLock}
                      onRemove={removeColor}
                      canRemove={palette.length > 2}
                    />
                  ))}
                  {palette.length < 8 && (
                    <button onClick={addColor} style={{
                      display:'flex',alignItems:'center',justifyContent:'center',
                      minWidth:44, borderRadius:14, border:'2px dashed rgba(255,255,255,0.1)',
                      background:'rgba(255,255,255,0.02)', color:'rgba(255,255,255,0.3)',
                      cursor:'pointer', transition:'all 0.15s', flexShrink:0,
                      minHeight:140,
                    }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(37,99,235,0.4)';e.currentTarget.style.color='var(--accent-blue,#2563eb)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.color='rgba(255,255,255,0.3)';}}
                    >
                      <Plus size={20}/>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* UI Preview */
              <div className="cp-fadein" style={{
                borderRadius:14, overflow:'hidden',
                border:'1px solid var(--border)',
                background: uiDark ? '#0f0f13' : '#f8f8fc',
              }}>
                {/* Mock UI navbar */}
                <div style={{ background:palette[0]?.hex, padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:800, fontSize:16, color: isDark(palette[0]?.hex||'#000')?'#fff':'#000' }}>Brand</span>
                  <div style={{ display:'flex', gap:8 }}>
                    {['Home','About','Work'].map(l => <span key={l} style={{ fontSize:12, color:isDark(palette[0]?.hex||'#000')?'rgba(255,255,255,0.7)':'rgba(0,0,0,0.6)', cursor:'pointer' }}>{l}</span>)}
                  </div>
                </div>
                {/* Hero */}
                <div style={{ background:palette[1]?.hex, padding:'28px 20px', textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:800, color:isDark(palette[1]?.hex||'#000')?'#fff':'#000', marginBottom:8 }}>Design with confidence</div>
                  <div style={{ fontSize:13, color:isDark(palette[1]?.hex||'#000')?'rgba(255,255,255,0.6)':'rgba(0,0,0,0.55)', marginBottom:16 }}>See how your palette looks in real UI</div>
                  <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                    <button style={{ padding:'8px 18px', borderRadius:8, background:palette[2]?.hex, color:isDark(palette[2]?.hex||'#000')?'#fff':'#000', border:'none', fontWeight:700, fontSize:12, cursor:'default' }}>Get Started</button>
                    <button style={{ padding:'8px 18px', borderRadius:8, background:'transparent', color:isDark(palette[1]?.hex||'#000')?'rgba(255,255,255,0.8)':'rgba(0,0,0,0.7)', border:`1.5px solid ${isDark(palette[1]?.hex||'#000')?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.2)'}`, fontWeight:700, fontSize:12, cursor:'default' }}>Learn More</button>
                  </div>
                </div>
                {/* Cards */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1 }}>
                  {(palette.slice(2, 5) || []).map((c, i) => (
                    <div key={i} style={{ background:c?.hex, padding:'16px', textAlign:'center' }}>
                      <div style={{ fontSize:20, marginBottom:6 }}>{'✦★◆'[i]}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:isDark(c?.hex||'#000')?'rgba(255,255,255,0.8)':'rgba(0,0,0,0.7)' }}>Feature {i+1}</div>
                    </div>
                  ))}
                </div>
                {/* Dark mode toggle */}
                <div style={{ padding:'8px 12px', display:'flex', justifyContent:'flex-end', background: uiDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)' }}>
                  <button onClick={() => setUiDark(d=>!d)} style={{ display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:6,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',color:'var(--text-muted)',fontFamily:'inherit',fontSize:10,fontWeight:700,cursor:'pointer' }}>
                    {uiDark?<Sun size={10}/>:<Moon size={10}/>} {uiDark?'Light':'Dark'} bg
                  </button>
                </div>
              </div>
            )}

            {/* Export row */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
              <CopyBtn getText={() => palette.map(c=>c.hex).join(', ')} label="Copy all hex"/>
              <button onClick={exportCSS} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',color:'var(--text-muted)',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.15s' }}>
                <Copy size={11}/> CSS vars
              </button>
              <button onClick={exportTailwind} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',color:'var(--text-muted)',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.15s' }}>
                <Copy size={11}/> Tailwind
              </button>
              <button onClick={downloadSvg} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',color:'var(--text-muted)',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.15s' }}>
                <Download size={11}/> SVG
              </button>
            </div>

            {/* Mobile sidebar */}
            {!isDesktop && <SidebarControls {...{harmonyType, setHarmonyType, baseHue, setBaseHue, saturation, setSaturation, lightness, setLightness, count, addColor, removeColor, palette, regenerate}} />}
          </div>

          {/* ═══ RIGHT SIDEBAR ═══ */}
          {isDesktop && <SidebarControls {...{harmonyType, setHarmonyType, baseHue, setBaseHue, saturation, setSaturation, lightness, setLightness, count, addColor, removeColor, palette, regenerate}} />}
        </div>
      </div>
    </>
  );
}

/* ─── Sidebar controls (extracted for reuse on mobile) ───── */
function SidebarControls({ harmonyType, setHarmonyType, baseHue, setBaseHue, saturation, setSaturation, lightness, setLightness, count, addColor, removeColor, palette, regenerate }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Harmony type */}
      <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Harmony</div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {HARMONY_TYPES.map(ht => (
            <button key={ht.id} onClick={() => { setHarmonyType(ht.id); }} style={{
              display:'flex', flexDirection:'column', alignItems:'flex-start',
              padding:'7px 10px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
              border:`1px solid ${harmonyType===ht.id?'var(--accent-blue,#2563eb)':'var(--border)'}`,
              background:harmonyType===ht.id?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
              transition:'all 0.15s', textAlign:'left',
            }}>
              <span style={{ fontSize:11, fontWeight:700, color:harmonyType===ht.id?'var(--accent-blue,#2563eb)':'var(--text-muted)' }}>{ht.label}</span>
              <span style={{ fontSize:9, color:'var(--text-muted)', opacity:0.55, marginTop:1 }}>{ht.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Base color sliders */}
      <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Base Color</div>

        {/* Hue */}
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)' }}>Hue</span>
            <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>{baseHue}°</span>
          </div>
          <input type="range" min={0} max={359} value={baseHue} onChange={e => setBaseHue(Number(e.target.value))}
            className="cp-slider"
            style={{ background:`linear-gradient(to right, hsl(0,70%,55%), hsl(60,70%,55%), hsl(120,70%,55%), hsl(180,70%,55%), hsl(240,70%,55%), hsl(300,70%,55%), hsl(360,70%,55%))` }}
          />
        </div>

        {/* Saturation */}
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)' }}>Saturation</span>
            <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>{saturation}%</span>
          </div>
          <input type="range" min={10} max={100} value={saturation} onChange={e => setSaturation(Number(e.target.value))}
            className="cp-slider"
            style={{ background:`linear-gradient(to right, hsl(${baseHue},10%,50%), hsl(${baseHue},100%,50%))` }}
          />
        </div>

        {/* Lightness */}
        <div style={{ marginBottom:4 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)' }}>Lightness</span>
            <span style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-muted)' }}>{lightness}%</span>
          </div>
          <input type="range" min={15} max={80} value={lightness} onChange={e => setLightness(Number(e.target.value))}
            className="cp-slider"
            style={{ background:`linear-gradient(to right, #111, hsl(${baseHue},${saturation}%,50%), #fff)` }}
          />
        </div>

        <button onClick={regenerate} style={{ marginTop:10, width:'100%', padding:'8px', borderRadius:8, background:'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.25)', color:'var(--accent-blue,#2563eb)', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s' }}>
          Apply changes
        </button>
      </div>

      {/* Count */}
      <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Colors</span>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={() => { if (palette.length > 2) removeColor(palette.length - 1); }} style={{ width:26,height:26,borderRadius:7,border:'1px solid var(--border)',background:'rgba(255,255,255,0.04)',color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontFamily:'inherit' }}><Minus size={11}/></button>
            <span style={{ fontSize:14, fontWeight:800, fontFamily:'monospace', color:'var(--text,#f0f0f5)', minWidth:16, textAlign:'center' }}>{palette.length}</span>
            <button onClick={addColor} disabled={palette.length >= 8} style={{ width:26,height:26,borderRadius:7,border:'1px solid var(--border)',background:'rgba(255,255,255,0.04)',color:palette.length>=8?'rgba(255,255,255,0.2)':'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',cursor:palette.length>=8?'default':'pointer',fontFamily:'inherit' }}><Plus size={11}/></button>
          </div>
        </div>
        <div style={{ marginTop:6, fontSize:10, color:'var(--text-muted)', opacity:0.5 }}>2–8 colors supported</div>
      </div>
    </div>
  );
}