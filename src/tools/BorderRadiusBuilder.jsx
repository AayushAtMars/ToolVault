import { useState, useCallback, useEffect, useRef } from 'react';
import { Copy, Check, Link, Link2Off, RotateCcw, Shuffle } from 'lucide-react';

/* ─── Presets ────────────────────────────────────────────── */
const PRESETS = [
  { name: 'Sharp',    vals: [0,0,0,0],        thumb: [0,0,0,0] },
  { name: 'Subtle',   vals: [4,4,4,4],         thumb: [3,3,3,3] },
  { name: 'Rounded',  vals: [12,12,12,12],      thumb: [6,6,6,6] },
  { name: 'Pill',     vals: [999,999,999,999],  thumb: [14,14,14,14] },
  { name: 'Squircle', vals: [30,30,30,30],      thumb: [10,10,10,10] },
  { name: 'Ticket',   vals: [0,999,999,0],      thumb: [0,14,14,0] },
  { name: 'Leaf',     vals: [0,60,0,60],        thumb: [0,12,0,12] },
  { name: 'Dialog',   vals: [16,16,16,4],       thumb: [7,7,7,2] },
  { name: 'Badge',    vals: [4,16,16,4],        thumb: [2,7,7,2] },
  { name: 'Bubble',   vals: [20,20,4,20],       thumb: [8,8,2,8] },
  { name: 'Skewed',   vals: [40,8,40,8],        thumb: [11,3,11,3] },
  { name: 'Coin',     vals: [50,50,50,50],      thumb: [14,14,14,14] },
];

const SHAPE_COLORS = [
  { id: 'blue',   bg: 'rgba(37,99,235,0.18)',  border: 'rgba(37,99,235,0.35)',  fill: '#2563eb' },
  { id: 'green',  bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', fill: '#10b981' },
  { id: 'amber',  bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', fill: '#f59e0b' },
  { id: 'rose',   bg: 'rgba(244,63,94,0.15)',  border: 'rgba(244,63,94,0.3)',  fill: '#f43f5e' },
  { id: 'violet', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)', fill: '#8b5cf6' },
];

const SHAPE_SIZES = [80, 120, 160, 200, 240];

/* ─── useWidth hook ──────────────────────────────────────── */
function useWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

/* ─── Corner drag handle ─────────────────────────────────── */
function CornerHandle({ position, value, onChange }) {
  const posStyles = {
    tl: { top: -15, left: -15, cursor: 'nw-resize' },
    tr: { top: -15, right: -15, cursor: 'ne-resize' },
    br: { bottom: -15, right: -15, cursor: 'se-resize' },
    bl: { bottom: -15, left: -15, cursor: 'sw-resize' },
  };
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY, startVal = value;
    const onMove = (me) => {
      const delta = Math.round(((me.clientX - startX) + -(me.clientY - startY)) / 2);
      onChange(Math.max(0, Math.min(999, startVal + delta)));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [value, onChange]);

  return (
    <div onMouseDown={onMouseDown} title={`Drag to adjust (${value}px)`} style={{
      position: 'absolute', width: 30, height: 30, borderRadius: '50%',
      background: 'var(--surface,#111118)',
      border: '2px solid var(--accent-blue,#2563eb)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 800, color: 'var(--accent-blue,#2563eb)',
      fontFamily: 'monospace', userSelect: 'none', zIndex: 10,
      boxShadow: '0 2px 10px rgba(37,99,235,0.4)',
      ...posStyles[position],
    }}>
      {value > 99 ? '∞' : value}
    </div>
  );
}

/* ─── Single corner slider row ───────────────────────────── */
function CornerRow({ label, value, onChange, accentColor }) {
  const pct = Math.min(100, Math.round((value / 100) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Label */}
      <span style={{
        width: 88, flexShrink: 0,
        fontSize: 11, fontWeight: 600,
        color: 'var(--text-muted,#6b6b80)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </span>

      {/* Slider track */}
      <div style={{ flex: 1, position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4,
          borderRadius: 99, overflow: 'hidden',
          background: 'var(--surface,#111118)',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}77)`,
            borderRadius: 99, transition: 'width 0.04s',
          }} />
        </div>
        <input type="range" min={0} max={100} value={Math.min(value, 100)}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, height: 20, cursor: 'ew-resize', margin: 0 }}
        />
      </div>

      {/* Number input + unit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <input type="number" min={0} max={999} value={value}
          onChange={e => onChange(Math.max(0, Math.min(999, Number(e.target.value))))}
          style={{
            width: 56, padding: '5px 8px', borderRadius: 7, outline: 'none',
            background: 'var(--surface,#111118)',
            border: '1px solid var(--border)',
            color: accentColor,
            fontSize: 12, fontFamily: '"DM Mono", monospace',
            fontWeight: 700, textAlign: 'right',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.4 }}>px</span>
      </div>
    </div>
  );
}

/* ─── Responsive Preview Canvas ─────────────────────────── */
function PreviewCanvas({ tl, tr, br, bl, shapeSize, previewContent, currentColor, previewRadius, updateCorner, setTl, setTr, setBr, setBl }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const available = el.clientWidth - 80; // 40px padding each side
      const needed = shapeSize + 30; // shape + handle overflow
      setScale(available < needed ? available / needed : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shapeSize]);

  const base = {
    borderRadius: previewRadius,
    transition: 'border-radius 0.12s ease',
    background: currentColor.bg,
    border: `2px solid ${currentColor.border}`,
  };

  const Shape = () => {
    if (previewContent === 'card') return (
      <div style={{ ...base, width: shapeSize, minHeight: shapeSize * 0.75, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 10, borderRadius: 4, background: currentColor.fill, opacity: 0.6, width: '60%' }} />
        <div style={{ height: 7,  borderRadius: 4, background: currentColor.fill, opacity: 0.3, width: '90%' }} />
        <div style={{ height: 7,  borderRadius: 4, background: currentColor.fill, opacity: 0.3, width: '75%' }} />
        <div style={{ marginTop: 'auto', height: 28, borderRadius: 6, background: currentColor.fill, opacity: 0.5 }} />
      </div>
    );
    if (previewContent === 'button') return (
      <div style={{ ...base, width: shapeSize, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', background: currentColor.fill, border: 'none' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'inherit' }}>Click me</span>
      </div>
    );
    if (previewContent === 'image') return (
      <div style={{ ...base, width: shapeSize, height: shapeSize, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg,${currentColor.fill}55,${currentColor.fill}22,${currentColor.fill}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 40, opacity: 0.4 }}>🖼</span>
        </div>
      </div>
    );
    return <div style={{ ...base, width: shapeSize, height: shapeSize }} />;
  };

  return (
    <div ref={containerRef} style={{
      background: 'var(--surface-raised,#18181f)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      minHeight: 220,
      padding: '40px 24px',
      overflow: 'hidden',
    }}>
      {/* Corner value labels */}
      {[{k:'tl',v:tl,s:{top:10,left:14}},{k:'tr',v:tr,s:{top:10,right:14}},{k:'br',v:br,s:{bottom:10,right:14}},{k:'bl',v:bl,s:{bottom:10,left:14}}].map(({k,v,s}) => (
        <div key={k} style={{ position:'absolute',...s, fontSize:10, fontFamily:'monospace', fontWeight:700, color:'var(--text-muted)', opacity:0.4, userSelect:'none' }}>{v}px</div>
      ))}
      {/* Shape wrapper — scales down on small screens */}
      <div style={{
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        transition: 'transform 0.15s ease',
        position: 'relative',
        width: shapeSize + 30,
        height: shapeSize + 30,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <CornerHandle position="tl" value={tl} onChange={updateCorner(setTl)}/>
          <CornerHandle position="tr" value={tr} onChange={updateCorner(setTr)}/>
          <CornerHandle position="br" value={br} onChange={updateCorner(setBr)}/>
          <CornerHandle position="bl" value={bl} onChange={updateCorner(setBl)}/>
          <Shape/>
        </div>
      </div>
    </div>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function BorderRadiusBuilder() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [tl, setTl] = useState(12);
  const [tr, setTr] = useState(12);
  const [br, setBr] = useState(12);
  const [bl, setBl] = useState(12);
  const [linked, setLinked] = useState(true);
  const [copied, setCopied] = useState(null);
  const [colorId, setColorId] = useState('blue');
  const [shapeSize, setShapeSize] = useState(160);
  const [unit, setUnit] = useState('px');
  const [previewContent, setPreviewContent] = useState('shape');

  const setAll = (v) => { setTl(v); setTr(v); setBr(v); setBl(v); };
  const updateCorner = useCallback((setter) => (v) => {
    if (linked) setAll(v); else setter(v);
  }, [linked]);

  const toUnit = (v) => unit === '%' ? `${Math.min(50, Math.round((v / 200) * 100))}%` : `${v}px`;
  const r = { tl: toUnit(tl), tr: toUnit(tr), br: toUnit(br), bl: toUnit(bl) };
  const isUniform = r.tl === r.tr && r.tr === r.br && r.br === r.bl;
  const shorthand = isUniform ? r.tl : `${r.tl} ${r.tr} ${r.br} ${r.bl}`;
  const cssProp = `border-radius: ${shorthand};`;

  const tailwindGuess = (() => {
    const avg = (tl + tr + br + bl) / 4;
    if (avg === 0) return 'rounded-none';
    if (avg <= 2)  return 'rounded-sm';
    if (avg <= 4)  return 'rounded';
    if (avg <= 6)  return 'rounded-md';
    if (avg <= 8)  return 'rounded-lg';
    if (avg <= 12) return 'rounded-xl';
    if (avg <= 16) return 'rounded-2xl';
    if (avg <= 24) return 'rounded-3xl';
    return 'rounded-full';
  })();

  const pctProp = `border-radius: ${Math.min(50,Math.round(tl/2))}% ${Math.min(50,Math.round(tr/2))}% ${Math.min(50,Math.round(br/2))}% ${Math.min(50,Math.round(bl/2))}%;`;

  const currentColor = SHAPE_COLORS.find(c => c.id === colorId);
  const previewRadius = `${tl}px ${tr}px ${br}px ${bl}px`;

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const randomize = () => {
    if (linked) setAll(Math.floor(Math.random() * 60));
    else { setTl(Math.floor(Math.random()*80)); setTr(Math.floor(Math.random()*80)); setBr(Math.floor(Math.random()*80)); setBl(Math.floor(Math.random()*80)); }
  };

  /* ─── Panel wrapper ─── */
  const Panel = ({ title, children }) => (
    <div style={{ background: 'var(--surface-raised,#18181f)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
      {title && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{title}</div>}
      {children}
    </div>
  );

  /* ─── Output code row ─── */
  const CopyRow = ({ tag, tagColor, value, copyKey }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface,#111118)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0, minWidth: 28 }}>{tag}</span>
      <code style={{ flex: 1, fontFamily: '"DM Mono", monospace', fontSize: 12, color: tagColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</code>
      <button onClick={() => copyText(value, copyKey)} style={{
        display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
        padding: '5px 10px', borderRadius: 7,
        background: copied === copyKey ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${copied === copyKey ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
        color: copied === copyKey ? '#10b981' : 'var(--text-muted)',
        fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}>
        {copied === copyKey ? <Check size={11}/> : <Copy size={11}/>}
        {copied === copyKey ? 'Copied' : 'Copy'}
      </button>
    </div>
  );

  /* ─── Sidebar panels (reused on mobile in-flow) ─── */
  const SidebarPanels = () => (
    <>
      {/* Preview as */}
      <Panel title="Preview As">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
          {[{id:'shape',label:'Shape',emoji:'◼'},{id:'card',label:'Card',emoji:'▤'},{id:'button',label:'Button',emoji:'⬜'},{id:'image',label:'Image',emoji:'🖼'}].map(p => (
            <button key={p.id} onClick={() => setPreviewContent(p.id)} style={{
              display:'flex',flexDirection:'column',alignItems:'center',gap:3,
              padding:'8px 4px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',
              border:`1px solid ${previewContent===p.id?'var(--accent-blue,#2563eb)':'var(--border)'}`,
              background:previewContent===p.id?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
              color:previewContent===p.id?'var(--accent-blue,#2563eb)':'var(--text-muted)',
              fontSize:15,transition:'all 0.15s',
            }}>
              <span>{p.emoji}</span>
              <span style={{fontSize:9,fontWeight:700}}>{p.label}</span>
            </button>
          ))}
        </div>
      </Panel>

      {/* Color + Size in a row on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr' : '1fr 1fr', gap: 12 }}>
        <Panel title="Accent Color">
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            {SHAPE_COLORS.map(c => (
              <button key={c.id} onClick={() => setColorId(c.id)} style={{
                width:22,height:22,borderRadius:'50%',cursor:'pointer',padding:0,flexShrink:0,
                background:c.fill,
                border:`2.5px solid ${colorId===c.id?'var(--text,#f0f0f5)':'transparent'}`,
                transform:colorId===c.id?'scale(1.2)':'scale(1)',
                transition:'all 0.15s',
              }}/>
            ))}
          </div>
        </Panel>

        <Panel>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <span style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Size</span>
            <span style={{fontSize:11,fontFamily:'monospace',color:'var(--text-muted)'}}>{shapeSize}px</span>
          </div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {SHAPE_SIZES.map(s => (
              <button key={s} onClick={() => setShapeSize(s)} style={{
                flex:1,minWidth:30,padding:'6px 0',borderRadius:7,cursor:'pointer',fontFamily:'inherit',
                border:`1px solid ${shapeSize===s?'var(--accent-blue,#2563eb)':'var(--border)'}`,
                background:shapeSize===s?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                color:shapeSize===s?'var(--accent-blue,#2563eb)':'var(--text-muted)',
                fontSize:10,fontWeight:700,transition:'all 0.15s',
              }}>{s}</button>
            ))}
          </div>
        </Panel>
      </div>

      {/* Presets */}
      <Panel title="Presets">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
          {PRESETS.map(p => {
            const isActive = tl===p.vals[0]&&tr===p.vals[1]&&br===p.vals[2]&&bl===p.vals[3];
            const t = p.thumb;
            return (
              <button key={p.name} onClick={() => {setTl(p.vals[0]);setTr(p.vals[1]);setBr(p.vals[2]);setBl(p.vals[3]);setLinked(false);}}
                style={{
                  display:'flex',flexDirection:'column',alignItems:'center',gap:6,
                  padding:'10px 6px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
                  background:isActive?'rgba(37,99,235,0.12)':'var(--surface,#111118)',
                  border:`1px solid ${isActive?'var(--accent-blue,#2563eb)':'var(--border)'}`,
                  transition:'all 0.15s ease',
                }}
              >
                <div style={{
                  width:28,height:28,flexShrink:0,
                  borderRadius:`${t[0]}px ${t[1]}px ${t[2]}px ${t[3]}px`,
                  background:isActive?currentColor.bg:'rgba(255,255,255,0.05)',
                  border:`1.5px solid ${isActive?currentColor.border:'rgba(255,255,255,0.1)'}`,
                  transition:'all 0.15s',
                }}/>
                <span style={{fontSize:9,fontWeight:700,color:isActive?'var(--accent-blue,#2563eb)':'var(--text-muted)',textAlign:'center',lineHeight:1}}>
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .brb * { box-sizing: border-box; }
        .brb { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }
        .brb input[type=number]::-webkit-inner-spin-button,
        .brb input[type=number]::-webkit-outer-spin-button { opacity: 1; }
        @keyframes fadeIn { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
        .brb-fadein { animation: fadeIn 0.2s ease both; }
      `}</style>

      <div className="brb">
        {/* ─── Top action bar ─── */}
        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:16 }}>
          <button onClick={() => setAll(12)} title="Reset" style={{
            width:32,height:32,borderRadius:8,cursor:'pointer',fontFamily:'inherit',
            background:'var(--surface,#111118)',border:'1px solid var(--border)',
            color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',
            transition:'all 0.15s',
          }}><RotateCcw size={14}/></button>
          <button onClick={randomize} title="Randomize" style={{
            width:32,height:32,borderRadius:8,cursor:'pointer',fontFamily:'inherit',
            background:'var(--surface,#111118)',border:'1px solid var(--border)',
            color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',
            transition:'all 0.15s',
          }}><Shuffle size={14}/></button>
          <div style={{flex:1}}/>
          {/* Unit toggle */}
          <div style={{ display:'flex', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:99, padding:3, gap:2 }}>
            {['px','%'].map(u => (
              <button key={u} onClick={() => setUnit(u)} style={{
                padding:'5px 12px',borderRadius:99,background:unit===u?'var(--accent-blue,#2563eb)':'transparent',
                border:'none',fontFamily:'inherit',fontSize:11,fontWeight:700,
                color:unit===u?'#fff':'var(--text-muted)',cursor:'pointer',transition:'all 0.15s',
              }}>{u}</button>
            ))}
          </div>
        </div>

        {/* ─── Main layout ─── */}
        <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 290px' : '1fr', gap:20, alignItems:'start' }}>

          {/* LEFT */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Preview canvas */}
            <PreviewCanvas
              tl={tl} tr={tr} br={br} bl={bl}
              shapeSize={shapeSize}
              previewContent={previewContent}
              currentColor={currentColor}
              previewRadius={previewRadius}
              updateCorner={updateCorner}
              setTl={setTl} setTr={setTr} setBr={setBr} setBl={setBl}
            />

            {/* Corners section */}
            <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
              {/* Section header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  Corners
                </span>
                <button onClick={() => setLinked(l => !l)} style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'5px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                  fontSize:11, fontWeight:700, transition:'all 0.15s',
                  background: linked ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.04)',
                  border:`1px solid ${linked ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
                  color: linked ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
                }}>
                  {linked ? <Link size={11}/> : <Link2Off size={11}/>}
                  {linked ? 'Linked' : 'Independent'}
                </button>
              </div>

              {/* 4 rows — one per corner */}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { label:'Top Left',     val:tl, set:setTl },
                  { label:'Top Right',    val:tr, set:setTr },
                  { label:'Bottom Right', val:br, set:setBr },
                  { label:'Bottom Left',  val:bl, set:setBl },
                ].map(({ label, val, set }) => (
                  <CornerRow
                    key={label} label={label} value={val}
                    onChange={updateCorner(set)}
                    accentColor={currentColor.fill}
                  />
                ))}
              </div>
            </div>

            {/* Output rows */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <CopyRow tag="CSS" tagColor="var(--text,#f0f0f5)" value={cssProp}       copyKey="css"/>
              <CopyRow tag="TW"  tagColor="#38bdf8"             value={tailwindGuess} copyKey="tw"/>
              <CopyRow tag="%"   tagColor="#a78bfa"             value={pctProp}       copyKey="pct"/>
            </div>

            {/* On mobile, sidebar panels go here */}
            {!isDesktop && (
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:4 }}>
                <SidebarPanels/>
              </div>
            )}
          </div>

          {/* RIGHT — only on desktop */}
          {isDesktop && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <SidebarPanels/>
            </div>
          )}
        </div>
      </div>
    </>
  );
}