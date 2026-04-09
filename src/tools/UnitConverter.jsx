import { useState, useCallback, useEffect } from 'react';
import {
  ArrowUpDown,
  Ruler,
  Scale,
  Thermometer,
  BoxSelect,
  Droplet,
  Gauge,
  HardDrive,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const UNITS = {
  Length: {
    icon: Ruler,
    rates: { meter: 1, kilometer: 1000, centimeter: 0.01, millimeter: 0.001, micrometer: 1e-6, nanometer: 1e-9, mile: 1609.344, yard: 0.9144, foot: 0.3048, inch: 0.0254, 'nautical mile': 1852 }
  },
  Weight: {
    icon: Scale,
    rates: { kilogram: 1, gram: 0.001, milligram: 1e-6, metric_ton: 1000, pound: 0.45359237, ounce: 0.02834952, stone: 6.35029318 }
  },
  Temperature: {
    icon: Thermometer,
    isTemp: true,
    rates: { celsius: 'c', fahrenheit: 'f', kelvin: 'k' },
  },
  Area: {
    icon: BoxSelect,
    rates: { 'sq meter': 1, 'sq kilometer': 1e6, hectare: 10000, acre: 4046.85642, 'sq foot': 0.09290304, 'sq inch': 0.00064516, 'sq mile': 2589988.11 }
  },
  Volume: {
    icon: Droplet,
    rates: { liter: 1, milliliter: 0.001, 'cubic meter': 1000, gallon: 3.78541178, quart: 0.946352946, pint: 0.473176473, cup: 0.236588236, 'fluid oz': 0.0295735296, tablespoon: 0.0147867648, teaspoon: 0.00492892159 }
  },
  Speed: {
    icon: Gauge,
    rates: { 'm/s': 1, 'km/h': 1/3.6, mph: 0.44704, knot: 0.514444444 }
  },
  Data: {
    icon: HardDrive,
    rates: { bit: 0.125, byte: 1, kilobyte: 1024, megabyte: 1048576, gigabyte: 1073741824, terabyte: 1099511627776, petabyte: 1125899906842624 }
  },
  Time: {
    icon: Clock,
    rates: { millisecond: 0.001, second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2628000, year: 31536000 }
  },
  Energy: {
    icon: Zap,
    rates: { joule: 1, kilojoule: 1000, calorie: 4.184, kilocalorie: 4184, 'watt-hour': 3600, 'kwh': 3600000, 'electron-volt': 1.602176634e-19 }
  }
};

function convertTemp(val, from, to) {
  let c;
  if (from === 'celsius') c = val;
  else if (from === 'fahrenheit') c = (val - 32) * 5 / 9;
  else c = val - 273.15;
  if (to === 'celsius') return c;
  if (to === 'fahrenheit') return c * 9 / 5 + 32;
  return c + 273.15;
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

export default function UnitConverter() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [category, setCategory] = useState('Length');
  const [amount, setAmount] = useState('1');
  
  const activeKeys = Object.keys(UNITS[category].rates);
  const [from, setFrom] = useState(activeKeys[0]);
  const [to, setTo] = useState(activeKeys[1]);

  // When category changes, reset the default from/to
  const handleCategoryChange = (cat) => {
    setCategory(cat);
    const keys = Object.keys(UNITS[cat].rates);
    setFrom(keys[0]);
    setTo(keys[1]);
    setAmount('1');
  };

  const num = parseFloat(amount || '0');
  let resultNum = 0;
  
  if (!isNaN(num)) {
    if (UNITS[category].isTemp) {
      resultNum = convertTemp(num, from, to);
    } else {
      const rates = UNITS[category].rates;
      resultNum = (num * rates[from]) / rates[to];
    }
  }

  // Format nicely (remove excessive trailing zeros)
  const formatResult = (val) => {
    if (Math.abs(val) < 0.000001 && val !== 0) return val.toExponential(4);
    return parseFloat(val.toFixed(6)).toString();
  };

  const resultStr = isNaN(num) ? '0' : formatResult(resultNum);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 700, margin: '0 auto' }}>
      
      {/* ── Category Tabs ── */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        background: 'var(--surface-raised, #18181f)',
        padding: 4, borderRadius: 10,
        border: '1px solid var(--border)',
      }}>
        {Object.keys(UNITS).map((catName) => {
          const cat = UNITS[catName];
          const Icon = cat.icon;
          const isActive = category === catName;
          return (
            <button
              key={catName}
              onClick={() => handleCategoryChange(catName)}
              style={{
                flex: '1 1 auto', minWidth: 90,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 10px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                transition: 'all 0.15s',
                background: isActive ? 'var(--surface, #111118)' : 'transparent',
                color: isActive ? 'var(--text, #f0f0f5)' : 'var(--text-muted, #6b6b80)',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
              }}
            >
              <Icon size={14} />
              {catName}
            </button>
          );
        })}
      </div>

      {/* ── Converter Box ── */}
      <div style={{
        padding: 24, borderRadius: 16,
        background: 'var(--surface-raised, #18181f)',
        border: '1px solid var(--border)',
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        
        {/* FROM */}
        <div style={{
          display: 'flex', gap: 16,
          background: 'var(--surface, #111118)', padding: 16, borderRadius: 12,
          border: '1px solid var(--border)',
        }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              style={{
                width: '100%', background: 'transparent', border: 'none',
                color: 'var(--text)', fontSize: 28, fontWeight: 600, outline: 'none',
                fontFamily: 'var(--font-mono, monospace)', padding: 0,
              }}
            />
          </div>
          <div style={{ width: 160 }}>
            <label style={labelStyle}>From Unit</label>
            <div style={{ position: 'relative' }}>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ ...inputStyle, paddingRight: 36, cursor: 'pointer', appearance: 'none', fontWeight: 600, textTransform: 'capitalize' }}
              >
                {activeKeys.map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        {/* SWAP BUTTON */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', 
          transform: 'translate(-50%, -50%)', zIndex: 10,
          background: 'var(--background, #0a0a0f)', borderRadius: '50%', padding: 4,
        }}>
          <button onClick={swap} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--surface-raised, #18181f)',
            border: '1px solid var(--border)', cursor: 'pointer',
            color: 'var(--accent-blue, #2563EB)', transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <ArrowUpDown size={18} />
          </button>
        </div>

        {/* TO */}
        <div style={{
          display: 'flex', gap: 16,
          background: 'rgba(37,99,235,0.06)', padding: 16, borderRadius: 12,
          border: '1px solid rgba(37,99,235,0.2)',
        }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <label style={{ ...labelStyle, color: 'var(--accent-blue, #2563EB)' }}>Converted</label>
            <div style={{
              color: 'var(--text)', fontSize: 28, fontWeight: 700, 
              fontFamily: 'var(--font-mono, monospace)', display: 'flex', alignItems: 'center',
              wordBreak: 'break-all',
            }}>
              {resultStr}
            </div>
          </div>
          <div style={{ width: 160 }}>
            <label style={{ ...labelStyle, color: 'var(--accent-blue, #2563EB)' }}>To Unit</label>
            <div style={{ position: 'relative' }}>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{
                  ...inputStyle,
                  background: 'var(--surface, #111118)',
                  borderColor: 'rgba(37,99,235,0.3)',
                  paddingRight: 36, cursor: 'pointer', appearance: 'none', fontWeight: 600, textTransform: 'capitalize'
                }}
              >
                {activeKeys.map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

      </div>

      <style>{`
        /* Hide number input arrows */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none; margin: 0;
        }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}

// ── Shared styles ──
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #6b6b80)',
  marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%', padding: '10px 12px', background: 'var(--surface-raised, #18181f)',
  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text, #f0f0f5)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit',
};
