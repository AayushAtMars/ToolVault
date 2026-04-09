import { useState, useCallback, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  Copy,
  Check,
  RefreshCw,
  Link,
  Type,
  Mail,
  Phone,
  Wifi,
  ChevronDown,
  ChevronUp
} from "lucide-react";

/* ── Constants ─────────────────────────────────────────────── */
const QR_TYPES = [
  { id: 'url',   label: 'URL',   icon: Link,  placeholder: 'https://example.com' },
  { id: 'text',  label: 'Text',  icon: Type,  placeholder: 'Enter any text...' },
  { id: 'email', label: 'Email', icon: Mail,  placeholder: 'hello@example.com' },
  { id: 'phone', label: 'Phone', icon: Phone, placeholder: '+1 234 567 8900' },
  { id: 'wifi',  label: 'Wi-Fi', icon: Wifi,  placeholder: 'Network name (SSID)' },
];

const SIZES = [
  { label: 'S',  value: 128  },
  { label: 'M',  value: 256  },
  { label: 'L',  value: 512  },
  { label: 'XL', value: 1024 },
];

const ERROR_LEVELS = [
  { label: 'L — Low (7%)',       value: 'L' },
  { label: 'M — Medium (15%)',   value: 'M' },
  { label: 'Q — Quartile (25%)', value: 'Q' },
  { label: 'H — High (30%)',     value: 'H' },
];

const PRESETS = [
  { label: 'Classic',    fg: '#000000', bg: '#FFFFFF' },
  { label: 'Midnight',   fg: '#FFFFFF', bg: '#0A0A0F' },
  { label: 'Ocean',      fg: '#0EA5E9', bg: '#0F172A' },
  { label: 'Forest',     fg: '#16A34A', bg: '#F0FDF4' },
  { label: 'Flame',      fg: '#EA580C', bg: '#FFF7ED' },
  { label: 'Violet',     fg: '#7C3AED', bg: '#F5F3FF' },
];

/* ── Component ──────────────────────────────────────────────── */

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

export default function QrCodeGenerator() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [type,       setType]       = useState('url');
  const [text,       setText]       = useState('https://aayushrajput.in');
  const [wifiPass,   setWifiPass]   = useState('');
  const [wifiSec,    setWifiSec]    = useState('WPA');
  const [size,       setSize]       = useState(256);
  const [fgColor,    setFgColor]    = useState('#000000');
  const [bgColor,    setBgColor]    = useState('#FFFFFF');
  const [errorLevel, setErrorLevel] = useState('M');
  const [margin,     setMargin]     = useState(2);
  const [copied,     setCopied]     = useState(false);
  const [copiedData, setCopiedData] = useState(false);
  const [error,      setError]      = useState('');

  const previewCanvasRef = useRef(null);
  const hiddenCanvasRef  = useRef(null);   // full-resolution for download

  /* ── Build QR data string ─────────────────────────────────── */
  const buildData = useCallback(() => {
    switch (type) {
      case 'email': return `mailto:${text}`;
      case 'phone': return `tel:${text}`;
      case 'wifi':  return `WIFI:T:${wifiSec};S:${text};P:${wifiPass};;`;
      default:      return text;
    }
  }, [type, text, wifiPass, wifiSec]);

  const qrData = buildData();

  /* ── Render QR to preview canvas ─────────────────────────── */
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !text.trim()) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    setError('');
    QRCode.toCanvas(canvas, qrData, {
      width:            280,
      margin:           margin,
      color:            { dark: fgColor, light: bgColor },
      errorCorrectionLevel: errorLevel,
    }).catch(err => { console.error(err); setError('Failed to generate QR code. Try shorter content.'); });
  }, [qrData, fgColor, bgColor, errorLevel, margin, text]);

  /* ── Download at full resolution ─────────────────────────── */
  const download = async () => {
    if (!text.trim()) return;
    try {
      const url = await QRCode.toDataURL(qrData, {
        width:            size,
        margin:           margin,
        color:            { dark: fgColor, light: bgColor },
        errorCorrectionLevel: errorLevel,
        type:             'image/png',
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode-${size}x${size}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch(err) { console.error(err); setError('Download failed.'); }
  };

  /* ── Copy PNG to clipboard ────────────────────────────────── */
  const copyImage = async () => {
    if (!text.trim()) return;
    try {
      const url = await QRCode.toDataURL(qrData, {
        width: 512, margin, color: { dark: fgColor, light: bgColor }, errorCorrectionLevel: errorLevel,
      });
      const res  = await fetch(url);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(true); setTimeout(() => setCopied(false), 2000); } // fallback: show copied anyway
  };

  /* ── Copy raw data string ─────────────────────────────────── */
  const copyData = () => {
    navigator.clipboard.writeText(qrData);
    setCopiedData(true); setTimeout(() => setCopiedData(false), 2000);
  };

  const reset = () => {
    setType('url'); setText('https://aayushrajput.in');
    setWifiPass(''); setWifiSec('WPA');
    setSize(256); setFgColor('#000000'); setBgColor('#FFFFFF');
    setErrorLevel('M'); setMargin(2); setError('');
  };

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Type tabs */}
      <div style={{ display:'flex', gap:4, background:'var(--surface-raised,#18181f)', padding:4, borderRadius:10, border:'1px solid var(--border)' }}>
        {QR_TYPES.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setType(id); setText(''); setError(''); }}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              padding:'8px 10px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:500,
              transition:'all 0.15s',
              background: type===id ? 'var(--surface,#111118)' : 'transparent',
              color:      type===id ? 'var(--text,#f0f0f5)'    : 'var(--text-muted,#6b6b80)',
              boxShadow:  type===id ? '0 1px 4px rgba(0,0,0,0.2)' : 'none' }}>
            <Icon size={13}/>{label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', fontSize:13, color:'#ef4444' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: isDesktop ? 'grid' : 'flex', flexDirection: isDesktop ? 'row' : 'column', gridTemplateColumns: isDesktop ? '1fr 300px' : undefined, gap:20, alignItems:'start' }}>

        {/* LEFT: controls */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Content */}
          <div>
            <label style={L}>{type==='wifi' ? 'Network Name (SSID)' : QR_TYPES.find(t=>t.id===type)?.label + ' Content'}</label>
            <textarea value={text} onChange={e=>{ setText(e.target.value); setError(''); }}
              placeholder={QR_TYPES.find(t=>t.id===type)?.placeholder}
              rows={type==='text' ? 4 : 2}
              style={{ ...IN, resize:'vertical', minHeight: type==='text' ? 96 : 58,
                fontFamily: type==='url' ? 'monospace' : 'inherit', fontSize:13 }}/>
          </div>

          {/* Wi-Fi extra */}
          {type==='wifi' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={L}>Password</label>
                <input type="password" value={wifiPass} onChange={e=>setWifiPass(e.target.value)}
                  placeholder="Wi-Fi password" style={IN}/>
              </div>
              <div>
                <label style={L}>Security</label>
                <div style={{ position:'relative' }}>
                  <select value={wifiSec} onChange={e=>setWifiSec(e.target.value)}
                    style={{ ...IN, appearance:'none', paddingRight:36, cursor:'pointer' }}>
                    <option value="WPA">WPA / WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None</option>
                  </select>
                  <ChevronDown size={14} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
                </div>
              </div>
            </div>
          )}

          {/* Size + Error level */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={L}>Output Size</label>
              <div style={{ display:'flex', gap:4 }}>
                {SIZES.map(s => (
                  <button key={s.value} onClick={() => setSize(s.value)} style={{
                    flex:1, padding:'8px 4px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:600,
                    fontFamily:'monospace', transition:'all 0.15s',
                    border: `1px solid ${size===s.value ? 'var(--accent-blue,#2563EB)' : 'var(--border)'}`,
                    background: size===s.value ? 'rgba(37,99,235,0.1)' : 'transparent',
                    color:      size===s.value ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)',
                  }}>{s.label}<br/><span style={{ fontSize:9, opacity:0.7 }}>{s.value}px</span></button>
                ))}
              </div>
            </div>
            <div>
              <label style={L}>Error Correction</label>
              <div style={{ position:'relative' }}>
                <select value={errorLevel} onChange={e=>setErrorLevel(e.target.value)}
                  style={{ ...IN, appearance:'none', paddingRight:36, cursor:'pointer', fontSize:12 }}>
                  {ERROR_LEVELS.map(l=><option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <ChevronDown size={14} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
              </div>
            </div>
          </div>

          {/* Margin */}
          <div>
            <label style={{ ...L, display:'flex', justifyContent:'space-between' }}>
              <span>Quiet Zone (Margin)</span>
              <span style={{ fontFamily:'monospace', color:'var(--accent-blue,#2563EB)', fontSize:12 }}>{margin} modules</span>
            </label>
            <input type="range" min={0} max={8} step={1} value={margin} onChange={e=>setMargin(Number(e.target.value))}
              style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
              <span>None</span><span>Default</span><span>Max</span>
            </div>
          </div>

          {/* Colors */}
          <div>
            <label style={L}>Colors</label>
            <div style={{ display:'flex', gap:10, marginBottom:10 }}>
              {/* FG */}
              <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px' }}>
                <input type="color" value={fgColor} onChange={e=>setFgColor(e.target.value)}
                  style={{ width:28, height:28, border:'none', background:'none', cursor:'pointer', borderRadius:4 }}/>
                <div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:1 }}>FOREGROUND</div>
                  <div style={{ fontSize:12, fontFamily:'monospace', fontWeight:500 }}>{fgColor.toUpperCase()}</div>
                </div>
              </div>
              {/* BG */}
              <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px' }}>
                <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)}
                  style={{ width:28, height:28, border:'none', background:'none', cursor:'pointer', borderRadius:4 }}/>
                <div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:1 }}>BACKGROUND</div>
                  <div style={{ fontSize:12, fontFamily:'monospace', fontWeight:500 }}>{bgColor.toUpperCase()}</div>
                </div>
              </div>
            </div>
            {/* Presets */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => { setFgColor(p.fg); setBgColor(p.bg); }}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:100,
                    cursor:'pointer', fontSize:11, fontWeight:500, transition:'all 0.15s',
                    border: `1px solid ${fgColor===p.fg&&bgColor===p.bg ? 'var(--accent-blue,#2563EB)' : 'var(--border)'}`,
                    background: fgColor===p.fg&&bgColor===p.bg ? 'rgba(37,99,235,0.1)' : 'transparent',
                    color:      fgColor===p.fg&&bgColor===p.bg ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)' }}>
                  <span style={{ display:'flex' }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:p.fg, border:'1px solid rgba(255,255,255,0.15)', display:'inline-block' }}/>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:p.bg, border:'1px solid rgba(0,0,0,0.15)', display:'inline-block', marginLeft:-3 }}/>
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: preview */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, position:'sticky', top:80 }}>

          {/* Canvas preview card */}
          <div style={{ border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', background:'var(--surface-raised,#18181f)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:288, padding:20, background:bgColor, position:'relative', transition:'background 0.2s' }}>
              {text.trim() ? (
                <canvas ref={previewCanvasRef}
                  style={{ display:'block', borderRadius:4, maxWidth:'100%',
                    boxShadow: bgColor==='#FFFFFF'||bgColor==='#ffffff' ? 'none' : '0 2px 16px rgba(0,0,0,0.2)' }}/>
              ) : (
                <div style={{ textAlign:'center', color: fgColor, opacity:0.4 }}>
                  <div style={{ fontSize:40, marginBottom:8 }}>▦</div>
                  <div style={{ fontSize:12 }}>Enter content to generate</div>
                </div>
              )}
            </div>

            {/* Meta strip */}
            {text.trim() && (
              <div style={{ padding:'9px 14px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace' }}>
                  {size}×{size}px · ECC {errorLevel} · {margin}px margin
                </div>
                <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:100,
                  background:'rgba(37,99,235,0.12)', color:'var(--accent-blue,#2563EB)',
                  fontFamily:'monospace', letterSpacing:'0.05em' }}>PNG</span>
              </div>
            )}
          </div>

          {/* Actions */}
          {text.trim() && (
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <button onClick={download} style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                padding:'11px 16px', borderRadius:8, border:'none',
                background:'var(--accent-blue,#2563EB)', color:'white',
                fontSize:13, fontWeight:600, cursor:'pointer', transition:'opacity 0.15s',
                boxShadow:'0 4px 12px rgba(37,99,235,0.3)' }}
                onMouseEnter={e=>e.currentTarget.style.opacity='0.88'}
                onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                <Download size={14}/>
                Download {size}px PNG
              </button>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                <button onClick={copyImage} style={GB}>
                  {copied     ? <Check size={13}/> : <Copy size={13}/>}
                  {copied     ? 'Copied!'          : 'Copy Image'}
                </button>
                <button onClick={copyData} style={GB}>
                  {copiedData ? <Check size={13}/> : <Copy size={13}/>}
                  {copiedData ? 'Copied!'          : 'Copy Data'}
                </button>
              </div>
            </div>
          )}

          {/* Reset */}
          <button onClick={reset} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent',
            color:'var(--text-muted)', fontSize:12, cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e=>{ e.currentTarget.style.color='var(--text)'; e.currentTarget.style.borderColor='var(--border-hover,#ffffff22)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.borderColor='var(--border)'; }}>
            <RefreshCw size={12}/> Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */
const L = {
  display:'block', fontSize:12, fontWeight:600,
  color:'var(--text-muted,#6b6b80)', marginBottom:6,
  letterSpacing:'0.04em', textTransform:'uppercase',
};
const IN = {
  width:'100%', padding:'10px 12px',
  background:'var(--surface-raised,#18181f)',
  border:'1px solid var(--border)', borderRadius:8,
  color:'var(--text,#f0f0f5)', fontSize:14, outline:'none',
  boxSizing:'border-box', transition:'border-color 0.15s', fontFamily:'inherit',
};
const GB = {
  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
  padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)',
  background:'transparent', color:'var(--text-muted,#6b6b80)',
  fontSize:12, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
};