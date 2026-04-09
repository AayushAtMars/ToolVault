import { useState, useEffect } from 'react';
import {
  RefreshCw,
  ArrowLeftRight,
  Type,
  AlignLeft,
  Moon,
  Sun,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const FONTS = [
  'Playfair Display', 'Source Sans 3', 'Montserrat', 'Merriweather',
  'Oswald', 'Lato', 'Raleway', 'Roboto', 'Poppins', 'Inter',
  'Libre Baskerville', 'Nunito Sans', 'Space Grotesk', 'DM Sans',
  'Bitter', 'Work Sans', 'Archivo Black', 'Roboto Slab',
  'Cormorant Garamond', 'Fira Sans', 'Outfit', 'Lora',
  'Rubik', 'Noto Serif', 'Crimson Text', 'Quicksand'
].sort();

const PAIRINGS = [
  { heading: 'Playfair Display', body: 'Source Sans 3', style: 'Elegant Serif + Clean Sans', headingW: 700, bodyW: 400 },
  { heading: 'Montserrat', body: 'Merriweather', style: 'Modern Geo + Classic Serif', headingW: 800, bodyW: 400 },
  { heading: 'Oswald', body: 'Lato', style: 'Bold Condensed + Friendly Sans', headingW: 700, bodyW: 400 },
  { heading: 'Raleway', body: 'Roboto', style: 'Thin Elegant + Neutral Sans', headingW: 800, bodyW: 400 },
  { heading: 'Poppins', body: 'Inter', style: 'Rounded Modern + Clean System', headingW: 700, bodyW: 400 },
  { heading: 'Libre Baskerville', body: 'Nunito Sans', style: 'Traditional Serif + Soft Sans', headingW: 700, bodyW: 400 },
  { heading: 'Space Grotesk', body: 'DM Sans', style: 'Techy Grotesk + Minimal Sans', headingW: 700, bodyW: 400 },
  { heading: 'Bitter', body: 'Work Sans', style: 'Slab Serif + Geometric Sans', headingW: 700, bodyW: 400 },
  { heading: 'Archivo Black', body: 'Roboto Slab', style: 'Bold Impact + Balanced Slab', headingW: 400, bodyW: 400 },
  { heading: 'Cormorant Garamond', body: 'Fira Sans', style: 'Refined Serif + Tech Sans', headingW: 600, bodyW: 400 },
  { heading: 'Outfit', body: 'Roboto', style: 'Geometric + Technical', headingW: 700, bodyW: 400 },
  { heading: 'Lora', body: 'Inter', style: 'Contemporary Serif + Neo-grotesque', headingW: 600, bodyW: 400 }
];


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

export default function FontPairing() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [index, setIndex] = useState(0);
  
  const [headingFont, setHeadingFont] = useState(PAIRINGS[0].heading);
  const [bodyFont, setBodyFont] = useState(PAIRINGS[0].body);
  
  const [headingText, setHeadingText] = useState('Build better products, faster.');
  const [bodyText, setBodyText] = useState('Typography is the art and technique of arranging type to make written language legible, readable, and appealing when displayed. The arrangement of type involves selecting typefaces, point sizes, line lengths, line-spacing, and letter-spacing.');
  
  const [previewTheme, setPreviewTheme] = useState('dark');

  // Load fonts whenever they change
  useEffect(() => {
    const loadFont = (name) => {
      if (!name) return;
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@400;500;600;700;800&display=swap`;
      link.rel = 'stylesheet';
      if (!document.querySelector(`link[href="${link.href}"]`)) {
        document.head.appendChild(link);
      }
    };
    loadFont(headingFont);
    loadFont(bodyFont);
  }, [headingFont, bodyFont]);

  // Sync state if relying on presets
  const setPreset = (i) => {
    setIndex(i);
    setHeadingFont(PAIRINGS[i].heading);
    setBodyFont(PAIRINGS[i].body);
  };

  const next = () => setPreset((index + 1) % PAIRINGS.length);
  const prev = () => setPreset((index - 1 + PAIRINGS.length) % PAIRINGS.length);
  const random = () => setPreset(Math.floor(Math.random() * PAIRINGS.length));

  const swapFonts = () => {
    const temp = headingFont;
    setHeadingFont(bodyFont);
    setBodyFont(temp);
  };

  const isPreset = PAIRINGS.some(p => p.heading === headingFont && p.body === bodyFont);
  const customStyleName = isPreset 
    ? PAIRINGS.find(p => p.heading === headingFont && p.body === bodyFont).style 
    : 'Custom Pairing';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      
      {/* ── Control Bar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between',
        padding: 16, background: 'var(--surface-raised, #18181f)', border: '1px solid var(--border)', borderRadius: 12
      }}>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            <label style={labelStyle}>Heading Font</label>
            <div style={{ position: 'relative' }}>
              <select style={inputStyle} value={headingFont} onChange={e => setHeadingFont(e.target.value)}>
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <ChevronDown size={14} style={chevronStyle} />
            </div>
          </div>
          
          <button 
            onClick={swapFonts}
            style={{ 
              marginTop: 20, width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'rgba(37,99,235,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            title="Swap Fonts"
          >
            <ArrowLeftRight size={16} />
          </button>
          
          <div>
            <label style={labelStyle}>Body Font</label>
            <div style={{ position: 'relative' }}>
              <select style={inputStyle} value={bodyFont} onChange={e => setBodyFont(e.target.value)}>
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <ChevronDown size={14} style={chevronStyle} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={prev} style={navBtnStyle}>← Prev</button>
          <button onClick={next} style={navBtnStyle}>Next →</button>
          <button onClick={random} style={{ ...navBtnStyle, background: 'var(--accent-blue)', color: '#fff', border: 'none' }}>
            <RefreshCw size={14} style={{ marginRight: 6 }} /> Random Pair
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 4px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue, #2563EB)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {customStyleName}
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-raised)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
          <button
            onClick={() => setPreviewTheme('light')}
            style={{ ...themeBtnStyle, background: previewTheme === 'light' ? '#ffffff' : 'transparent', color: previewTheme === 'light' ? '#000' : 'var(--text-muted)' }}
          >
            <Sun size={14} /> Light
          </button>
          <button
            onClick={() => setPreviewTheme('dark')}
            style={{ ...themeBtnStyle, background: previewTheme === 'dark' ? '#0a0a0f' : 'transparent', color: previewTheme === 'dark' ? '#fff' : 'var(--text-muted)' }}
          >
            <Moon size={14} /> Dark
          </button>
        </div>
      </div>

      {/* ── Live Preview Area ── */}
      <div style={{
        padding: '60px 48px',
        background: previewTheme === 'dark' ? '#0a0a0f' : '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: 16,
        transition: 'background 0.3s',
        boxShadow: previewTheme === 'dark' ? 'none' : 'inset 0 0 20px rgba(0,0,0,0.02)',
      }}>
        {/* Editable Heading */}
        <input
          value={headingText}
          onChange={(e) => setHeadingText(e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: `'${headingFont}', serif`,
            fontWeight: 700,
            fontSize: 48,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: 24,
            color: previewTheme === 'dark' ? '#ffffff' : '#111827',
            transition: 'color 0.3s'
          }}
        />

        {/* Editable Body */}
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 640,
            minHeight: 150,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: `'${bodyFont}', sans-serif`,
            fontWeight: 400,
            fontSize: 18,
            lineHeight: 1.7,
            color: previewTheme === 'dark' ? '#9ca3af' : '#4b5563',
            resize: 'none',
            transition: 'color 0.3s'
          }}
        />
        
        {/* Fake UI component purely for previewing the fonts together in context */}
        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <div style={{ 
            padding: '12px 24px', borderRadius: 8, background: previewTheme === 'dark' ? '#ffffff' : '#111827', 
            color: previewTheme === 'dark' ? '#000000' : '#ffffff', fontFamily: `'${bodyFont}', sans-serif`, 
            fontWeight: 600, fontSize: 14, cursor: 'default'
          }}>
            Get Started
          </div>
          <div style={{ 
            padding: '12px 24px', borderRadius: 8, border: `1px solid ${previewTheme === 'dark' ? '#374151' : '#e5e7eb'}`, 
            color: previewTheme === 'dark' ? '#ffffff' : '#111827', fontFamily: `'${bodyFont}', sans-serif`, 
            fontWeight: 500, fontSize: 14, cursor: 'default'
          }}>
            Learn More
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Shared styles ──
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #6b6b80)',
  marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase',
};

const inputStyle = {
  width: 200, padding: '9px 12px', background: 'var(--surface, #111118)',
  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text, #f0f0f5)',
  fontSize: 13, outline: 'none', cursor: 'pointer', appearance: 'none',
  fontWeight: 500, transition: 'border-color 0.15s'
};

const chevronStyle = {
  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
  color: 'var(--text-muted)', pointerEvents: 'none'
};

const navBtnStyle = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s'
};

const themeBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
  borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.2s'
};
