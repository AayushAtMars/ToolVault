import { useState, useCallback , useEffect} from 'react';
import {
  Copy,
  Check,
  Calculator,
  Hash,
  Binary,
  Octagon,
  RotateCcw,
  AlertCircle,
  ChevronUp,
  ChevronDown
} from "lucide-react";

const BASES = [
  { id: 10, label: 'Decimal',     icon: Calculator, short: 'DEC (10)', placeholder: 'e.g. 255' },
  { id: 16, label: 'Hexadecimal', icon: Hash,       short: 'HEX (16)', placeholder: 'e.g. FF' },
  { id: 2,  label: 'Binary',      icon: Binary,     short: 'BIN (2)',  placeholder: 'e.g. 11111111' },
  { id: 8,  label: 'Octal',       icon: Octagon,    short: 'OCT (8)',  placeholder: 'e.g. 377' },
];

function isValidForBase(val, base) {
  if (!val) return true;
  if (base === 2) return /^[01\s]+$/.test(val);
  if (base === 8) return /^[0-7\s]+$/.test(val);
  if (base === 10) return /^[0-9\s]+$/.test(val);
  if (base === 16) return /^[0-9A-Fa-f\s]+$/.test(val);
  return false;
}

function convertBigInt(value, fromBase, toBase) {
  const cleanVal = value.replace(/\s+/g, '');
  if (!cleanVal) return '';
  try {
    let bigIntVal;
    if (fromBase === 16) bigIntVal = BigInt('0x' + cleanVal);
    else if (fromBase === 2) bigIntVal = BigInt('0b' + cleanVal);
    else if (fromBase === 8) bigIntVal = BigInt('0o' + cleanVal);
    else bigIntVal = BigInt(cleanVal);
    
    // Grouping for readability
    let res = bigIntVal.toString(toBase).toUpperCase();
    if (toBase === 2 || toBase === 16) {
      const match = res.match(new RegExp(`.{1,${toBase === 2 ? 4 : 4}}`, 'g'));
      if (res.length > 4 && match) {
        // We shouldn't format it forcibly, let's keep it raw but allow formatting later if we want.
        // Actually, just returning raw string is safer for copying.
      }
    }
    return res;
  } catch {
    return '';
  }
}


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

export default function NumberBaseConverter() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [inputBase, setInputBase] = useState(10);
  const [inputVal, setInputVal]   = useState('255');
  const [copied, setCopied]       = useState(null);

  const isInvalid = !isValidForBase(inputVal, inputBase);

  const handleCopy = (val, id) => {
    navigator.clipboard.writeText(val);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const results = BASES.filter(b => b.id !== inputBase).map((b) => ({
    ...b,
    result: isInvalid ? '' : convertBigInt(inputVal, inputBase, b.id),
  }));

  const reset = () => {
    setInputBase(10);
    setInputVal('255');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Tabs for Input Base ── */}
      <div style={{
        display: 'flex', gap: 4,
        background: 'var(--surface-raised, #18181f)',
        padding: 4, borderRadius: 10,
        border: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}>
        {BASES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              if (inputBase !== id) {
                // Optionally convert current value to new base to keep it
                const converted = isInvalid ? '' : convertBigInt(inputVal, inputBase, id);
                setInputBase(id);
                setInputVal(converted);
              }
            }}
            style={{
              flex: 1, minWidth: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 10px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 0.15s',
              background: inputBase === id ? 'var(--surface, #111118)' : 'transparent',
              color: inputBase === id ? 'var(--text, #f0f0f5)' : 'var(--text-muted, #6b6b80)',
              boxShadow: inputBase === id ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
        
        {/* INPUT AREA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {BASES.find(b => b.id === inputBase)?.icon && (
                <span style={{ display: 'flex' }}>
                  {(() => {
                    const Ico = BASES.find(b => b.id === inputBase)?.icon;
                    return <Ico size={14} />;
                  })()}
                </span>
              )}
              Input: {BASES.find(b => b.id === inputBase)?.label} Base
            </label>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
              <span>{inputVal.replace(/\s+/g, '').length} chars</span>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <textarea
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value.toUpperCase())}
              placeholder={BASES.find(b => b.id === inputBase)?.placeholder}
              style={{
                ...inputStyle,
                borderColor: isInvalid ? '#ef4444' : 'var(--border)',
                minHeight: 120,
                resize: 'vertical',
                fontSize: 16,
                fontFamily: 'var(--font-mono, monospace)',
                lineHeight: 1.5,
                padding: '16px',
                wordBreak: 'break-all',
              }}
            />
          </div>

          {isInvalid && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444',
              fontSize: 13,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>Invalid characters for {BASES.find(b => b.id === inputBase)?.label} base.</span>
            </div>
          )}
        </div>

        {/* RESULTS AREA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Conversions</label>
            <button onClick={reset} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {results.map((r) => (
              <div key={r.id} style={{
                display: 'flex', flexDirection: 'column',
                background: 'var(--surface-raised, #18181f)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.1)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                    <r.icon size={13} />
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {r.short}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(r.result, r.id)}
                    disabled={!r.result}
                    style={{
                      ...ghostBtnStyle,
                      padding: '4px 8px', borderRadius: 6,
                      fontSize: 11, gap: 4,
                      opacity: r.result ? 1 : 0.5,
                      cursor: r.result ? 'pointer' : 'default',
                      color: copied === r.id ? '#16a34a' : 'var(--text-muted)',
                      borderColor: copied === r.id ? 'rgba(22,163,74,0.4)' : 'var(--border)',
                      background: copied === r.id ? 'rgba(22,163,74,0.08)' : 'transparent',
                    }}
                  >
                    {copied === r.id ? <Check size={12} /> : <Copy size={12} />}
                    {copied === r.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                
                <div style={{
                  padding: 16,
                  fontSize: 15,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: r.result ? 'var(--text)' : 'var(--text-muted)',
                  wordBreak: 'break-all',
                  minHeight: 60,
                  display: 'flex', alignItems: 'center',
                }}>
                  {r.result || (isInvalid ? '—' : 'Enter value')}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Shared styles ──
const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-muted, #6b6b80)',
  marginBottom: 6,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%',
  background: 'var(--surface-raised, #18181f)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text, #f0f0f5)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const ghostBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)',
  background: 'transparent',
  fontWeight: 500,
  transition: 'all 0.15s',
};
