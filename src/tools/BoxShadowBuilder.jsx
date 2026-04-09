import { useState, useEffect, useCallback } from 'react';
import {
  Copy, Check, Plus, Trash2, Eye, EyeOff,
  RotateCcw, Shuffle, Download, Layers
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
function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${(opacity/100).toFixed(2)})`;
}
function shadowToCss(s) {
  if (!s.enabled) return null;
  return `${s.inset?'inset ':''}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${hexToRgba(s.color, s.opacity)}`;
}
function makeShadow(overrides = {}) {
  return { id: Math.random().toString(36).slice(2), x:0, y:8, blur:24, spread:0, color:'#000000', opacity:15, inset:false, enabled:true, ...overrides };
}

/* ─── Presets ────────────────────────────────────────────── */
const PRESETS = [
  { name:'None',      shadows:[makeShadow({blur:0,y:0,opacity:0})] },
  { name:'Soft',      shadows:[makeShadow({y:4,blur:6,opacity:7})] },
  { name:'Medium',    shadows:[makeShadow({y:8,blur:24,opacity:12})] },
  { name:'Large',     shadows:[makeShadow({y:16,blur:48,opacity:15})] },
  { name:'Sharp',     shadows:[makeShadow({y:2,blur:4,spread:0,opacity:20})] },
  { name:'Glow Blue', shadows:[makeShadow({y:0,blur:20,spread:2,color:'#2563eb',opacity:60})] },
  { name:'Glow Green',shadows:[makeShadow({y:0,blur:20,spread:2,color:'#10b981',opacity:60})] },
  { name:'Glow Rose', shadows:[makeShadow({y:0,blur:20,spread:2,color:'#f43f5e',opacity:60})] },
  { name:'Elevated',  shadows:[makeShadow({y:2,blur:4,opacity:8}),makeShadow({y:12,blur:32,opacity:12})] },
  { name:'Layered',   shadows:[makeShadow({y:1,blur:3,opacity:12}),makeShadow({y:4,blur:16,opacity:8}),makeShadow({y:12,blur:48,opacity:6})] },
  { name:'Inner',     shadows:[makeShadow({y:2,blur:8,spread:-2,opacity:20,inset:true})] },
  { name:'Crisp',     shadows:[makeShadow({x:4,y:4,blur:0,spread:0,opacity:25})] },
];

const PREVIEW_SHAPES = [
  { id:'square',  label:'Square' },
  { id:'pill',    label:'Pill' },
  { id:'circle',  label:'Circle' },
  { id:'card',    label:'Card' },
];

const BG_OPTIONS = [
  { id:'dark',  label:'Dark',  bg:'#0f0f13' },
  { id:'mid',   label:'Mid',   bg:'#1e1e2a' },
  { id:'light', label:'Light', bg:'#f0f0f5' },
  { id:'white', label:'White', bg:'#ffffff' },
];

/* ─── Reusable UI ────────────────────────────────────────── */
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

function Slider({ label, value, onChange, min, max, unit='px' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</span>
        <span style={{ fontSize:11, fontFamily:'"DM Mono",monospace', color:'var(--text,#f0f0f5)' }}>{value}{unit}</span>
      </div>
      <div style={{ position:'relative', height:18, display:'flex', alignItems:'center' }}>
        <div style={{
          position:'absolute', left:0, right:0, height:4,
          borderRadius:99, background:'var(--surface,#111118)',
          border:'1px solid var(--border)', overflow:'hidden',
        }}>
          <div style={{ height:'100%', width:`${Math.max(0,Math.min(100,pct))}%`, background:'linear-gradient(90deg,var(--accent-blue,#2563eb),rgba(37,99,235,0.5))', borderRadius:99 }}/>
        </div>
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ position:'absolute',inset:0,width:'100%',opacity:0,height:18,cursor:'ew-resize',margin:0 }}
        />
      </div>
    </div>
  );
}

/* ─── Single shadow editor ───────────────────────────────── */
function ShadowEditor({ shadow, index, total, onChange, onRemove }) {
  const update = (key, val) => onChange(index, { ...shadow, [key]: val });

  return (
    <div style={{
      background:'var(--surface,#111118)',
      border:`1px solid ${shadow.enabled ? 'rgba(37,99,235,0.25)' : 'var(--border)'}`,
      borderLeft:`3px solid ${shadow.enabled ? 'var(--accent-blue,#2563eb)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius:10, overflow:'hidden',
      opacity: shadow.enabled ? 1 : 0.5,
      transition:'all 0.15s',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', flex:1 }}>
          Layer {index + 1}{shadow.inset ? ' · inset' : ''}
        </span>
        <button onClick={() => update('enabled', !shadow.enabled)} title={shadow.enabled?'Hide':'Show'} style={{ width:26,height:26,borderRadius:6,border:'1px solid var(--border)',background:'rgba(255,255,255,0.04)',color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontFamily:'inherit' }}>
          {shadow.enabled ? <Eye size={12}/> : <EyeOff size={12}/>}
        </button>
        {total > 1 && (
          <button onClick={() => onRemove(index)} title="Remove layer" style={{ width:26,height:26,borderRadius:6,border:'1px solid var(--border)',background:'rgba(239,68,68,0.08)',color:'rgba(239,68,68,0.6)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontFamily:'inherit' }}>
            <Trash2 size={11}/>
          </button>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Slider label="X Offset" value={shadow.x} onChange={v=>update('x',v)} min={-100} max={100}/>
          <Slider label="Y Offset" value={shadow.y} onChange={v=>update('y',v)} min={-100} max={100}/>
          <Slider label="Blur"     value={shadow.blur} onChange={v=>update('blur',v)} min={0} max={200}/>
          <Slider label="Spread"   value={shadow.spread} onChange={v=>update('spread',v)} min={-50} max={100}/>
        </div>

        <Slider label="Opacity" value={shadow.opacity} onChange={v=>update('opacity',v)} min={0} max={100} unit="%"/>

        {/* Color + inset row */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="color" value={shadow.color} onChange={e=>update('color',e.target.value)}
              style={{ width:32,height:32,borderRadius:7,border:'2px solid rgba(255,255,255,0.12)',cursor:'pointer',padding:2,background:'transparent',flexShrink:0 }}
            />
            <input value={shadow.color} onChange={e=>{ if(/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) update('color',e.target.value); }}
              style={{ width:80,padding:'5px 8px',borderRadius:7,background:'var(--surface-raised,#18181f)',border:'1px solid var(--border)',color:'var(--text,#f0f0f5)',fontFamily:'"DM Mono",monospace',fontSize:12,fontWeight:700,outline:'none' }}
            />
          </div>
          <div style={{ flex:1 }}/>
          <label style={{ display:'flex',alignItems:'center',gap:7,cursor:'pointer' }}>
            <div onClick={() => update('inset', !shadow.inset)} style={{
              width:36,height:20,borderRadius:99,
              background:shadow.inset?'var(--accent-blue,#2563eb)':'var(--surface-raised,#18181f)',
              border:`1px solid ${shadow.inset?'var(--accent-blue,#2563eb)':'var(--border)'}`,
              position:'relative',cursor:'pointer',transition:'all 0.2s',flexShrink:0,
            }}>
              <div style={{ position:'absolute',top:2,left:shadow.inset?18:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }}/>
            </div>
            <span style={{ fontSize:11,fontWeight:600,color:'var(--text-muted)' }}>Inset</span>
          </label>
        </div>

        {/* rgba preview */}
        <code style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'rgba(240,240,245,0.4)',lineHeight:1.5 }}>
          {shadowToCss(shadow)}
        </code>
      </div>
    </div>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function BoxShadowBuilder() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [shadows, setShadows] = useState([makeShadow({y:8,blur:24,opacity:12})]);
  const [shape, setShape]     = useState('square');
  const [bgId, setBgId]       = useState('dark');
  const [elBg, setElBg]       = useState('#18181f');

  const activeShadows = shadows.filter(s => s.enabled);
  const combinedCss   = activeShadows.map(s => shadowToCss(s)).filter(Boolean).join(',\n          ');
  const fullCss       = `box-shadow: ${combinedCss || 'none'};`;

  const updateShadow = (i, updated) => setShadows(prev => prev.map((s,j) => j===i ? updated : s));
  const removeShadow = (i)          => setShadows(prev => prev.filter((_,j) => j!==i));
  const addShadow    = ()           => setShadows(prev => [...prev, makeShadow()]);

  const loadPreset = (p) => setShadows(p.shadows.map(s => ({...s, id: Math.random().toString(36).slice(2)})));

  const randomize = () => {
    setShadows([makeShadow({
      x: Math.round((Math.random()-0.5)*20),
      y: Math.round(Math.random()*20+2),
      blur: Math.round(Math.random()*40+8),
      spread: Math.round((Math.random()-0.5)*10),
      color: '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'),
      opacity: Math.round(Math.random()*30+10),
    })]);
  };

  const bgColor = BG_OPTIONS.find(b=>b.id===bgId)?.bg || '#0f0f13';

  const shapeStyle = {
    square: { width:140, height:140, borderRadius:12 },
    pill:   { width:200, height:56,  borderRadius:999 },
    circle: { width:140, height:140, borderRadius:'50%' },
    card:   { width:200, height:120, borderRadius:16 },
  }[shape];

  const SidebarContent = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Shape + BG */}
      <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Preview Shape</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, marginBottom:14 }}>
          {PREVIEW_SHAPES.map(s => (
            <button key={s.id} onClick={() => setShape(s.id)} style={{
              padding:'6px 0', borderRadius:7,
              border:`1px solid ${shape===s.id?'var(--accent-blue,#2563eb)':'var(--border)'}`,
              background:shape===s.id?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
              color:shape===s.id?'var(--accent-blue,#2563eb)':'var(--text-muted)',
              fontFamily:'inherit', fontSize:10, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
            }}>{s.label}</button>
          ))}
        </div>

        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Background</div>
        <div style={{ display:'flex', gap:5 }}>
          {BG_OPTIONS.map(b => (
            <button key={b.id} onClick={() => setBgId(b.id)} title={b.label} style={{
              flex:1, height:24, borderRadius:6,
              background:b.bg,
              border:`2px solid ${bgId===b.id?'var(--accent-blue,#2563eb)':'rgba(255,255,255,0.1)'}`,
              cursor:'pointer', transition:'all 0.13s',
            }}/>
          ))}
        </div>

        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Element Color</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="color" value={elBg} onChange={e=>setElBg(e.target.value)}
              style={{ width:32,height:28,borderRadius:7,border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer',padding:2,background:'transparent' }}
            />
            <input value={elBg} onChange={e=>{ if(/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setElBg(e.target.value); }}
              style={{ flex:1,padding:'5px 8px',borderRadius:7,background:'var(--surface,#111118)',border:'1px solid var(--border)',color:'var(--text,#f0f0f5)',fontFamily:'"DM Mono",monospace',fontSize:12,fontWeight:700,outline:'none' }}
            />
          </div>
        </div>
      </div>

      {/* Presets */}
      <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Presets</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
          {PRESETS.map(p => (
            <button key={p.name} onClick={() => loadPreset(p)} style={{
              padding:'6px 4px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',
              border:'1px solid var(--border)',background:'var(--surface,#111118)',
              color:'var(--text-muted)',fontSize:10,fontWeight:600,transition:'all 0.13s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-blue,#2563eb)';e.currentTarget.style.color='var(--accent-blue,#2563eb)';e.currentTarget.style.background='rgba(37,99,235,0.07)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.background='var(--surface,#111118)';}}
            >{p.name}</button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:6 }}>
        <button onClick={randomize} style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'8px',borderRadius:9,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',color:'var(--text-muted)',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.15s' }}>
          <Shuffle size={12}/> Random
        </button>
        <button onClick={() => setShadows([makeShadow({y:8,blur:24,opacity:12})])} style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'8px',borderRadius:9,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',color:'var(--text-muted)',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.15s' }}>
          <RotateCcw size={12}/> Reset
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .bsb * { box-sizing: border-box; }
        .bsb { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .bsb-fadein { animation:fadeIn 0.2s ease both; }
      `}</style>

      <div className="bsb">
        <div style={{ display:'grid', gridTemplateColumns:isDesktop?'1fr 240px':'1fr', gap:16, alignItems:'start' }}>

          {/* ═══ LEFT ═══ */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Preview */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              padding: isDesktop ? 60 : 40,
              background: bgColor,
              borderRadius:16, border:'1px solid var(--border)',
              minHeight: isDesktop ? 260 : 200,
              transition:'background 0.2s',
            }}>
              <div style={{
                ...shapeStyle,
                background: elBg,
                boxShadow: combinedCss || 'none',
                transition: 'box-shadow 0.12s ease, border-radius 0.2s, width 0.2s, height 0.2s',
              }}/>
            </div>

            {/* Shadow layers */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:-4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Layers size={13} style={{ color:'var(--text-muted)' }}/>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  Shadow Layers ({shadows.length})
                </span>
              </div>
              <button onClick={addShadow} disabled={shadows.length >= 5} style={{
                display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:7,
                background:'rgba(37,99,235,0.1)',border:'1px solid rgba(37,99,235,0.25)',
                color:shadows.length>=5?'rgba(255,255,255,0.2)':'var(--accent-blue,#2563eb)',
                fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:shadows.length>=5?'default':'pointer',
              }}>
                <Plus size={11}/> Add Layer
              </button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {shadows.map((s, i) => (
                <div key={s.id} className="bsb-fadein">
                  <ShadowEditor shadow={s} index={i} total={shadows.length} onChange={updateShadow} onRemove={removeShadow}/>
                </div>
              ))}
            </div>

            {/* CSS Output */}
            <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.15)' }}>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>CSS Output</span>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  <CopyBtn getText={() => fullCss} label="Copy" small/>
                  <CopyBtn getText={() => `${fullCss}\n-webkit-box-shadow: ${combinedCss||'none'};`} label="+Webkit" small/>
                </div>
              </div>
              <div style={{ padding:'12px 16px' }}>
                <code style={{ fontFamily:'"DM Mono",monospace', fontSize:12, color:'var(--text,#f0f0f5)', lineHeight:1.7, wordBreak:'break-all', whiteSpace:'pre-wrap' }}>
                  {`box-shadow:\n  ${shadows.filter(s=>s.enabled).map(s=>shadowToCss(s)).filter(Boolean).join(',\n  ')};`}
                </code>
              </div>
            </div>

            {/* Mobile sidebar */}
            {!isDesktop && (
              <div style={{ marginTop:4 }}>
                <SidebarContent/>
              </div>
            )}
          </div>

          {/* ═══ RIGHT ═══ */}
          {isDesktop && <SidebarContent/>}
        </div>
      </div>
    </>
  );
}