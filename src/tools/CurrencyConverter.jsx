import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpDown,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  CheckCircle2,
  ChevronUp
} from "lucide-react";

const FLAGS = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', INR: '🇮🇳', JPY: '🇯🇵', AUD: '🇦🇺',
  CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', KRW: '🇰🇷', BRL: '🇧🇷', MXN: '🇲🇽',
  SGD: '🇸🇬', HKD: '🇭🇰', SEK: '🇸🇪', NOK: '🇳🇴', NZD: '🇳🇿', ZAR: '🇿🇦',
  AED: '🇦🇪', SAR: '🇸🇦', THB: '🇹🇭', PHP: '🇵🇭', TRY: '🇹🇷', RUB: '🇷🇺',
};

const FALLBACK_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.12, JPY: 149.50, AUD: 1.53,
  CAD: 1.36, CHF: 0.88, CNY: 7.24, KRW: 1330.45, BRL: 4.97, MXN: 17.15,
  SGD: 1.34, HKD: 7.82, SEK: 10.42, NOK: 10.58, NZD: 1.63, ZAR: 18.85,
  AED: 3.67, SAR: 3.75, THB: 35.67, PHP: 56.20, TRY: 29.85, RUB: 92.50,
};

const CURRENCIES = Object.keys(FLAGS).sort();


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

export default function CurrencyConverter() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('INR');
  
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [lastUpdated, setLastUpdated] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      setRates(data.rates);
      setLastUpdated(new Date(data.time_last_updated * 1000).toLocaleString(undefined, {
        dateStyle: 'medium', timeStyle: 'short'
      }));
    } catch (err) {
      console.error(err);
      setError('Failed to fetch live rates. Using fallback offline rates.');
      setRates(FALLBACK_RATES);
      setLastUpdated('Offline mode');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const num = parseFloat(amount || '0');
  const rFrom = rates[from] || 1;
  const rTo = rates[to] || 1;
  const result = !isNaN(num) ? ((num / rFrom) * rTo).toFixed(4) : '0.0000';
  const rate1 = (rTo / rFrom).toFixed(4);
  const rate2 = (rFrom / rTo).toFixed(4);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640, margin: '0 auto' }}>
      
      {/* ── Status Bar ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderRadius: 10,
        background: error ? 'rgba(239,68,68,0.08)' : 'var(--surface-raised, #18181f)',
        border: `1px solid ${error ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {error ? <AlertCircle size={15} color="#ef4444" /> : <CheckCircle2 size={15} color="#16a34a" />}
          <div style={{ fontSize: 13, color: error ? '#ef4444' : 'var(--text-muted)' }}>
            {error || 'Live rates connected'}
            {!error && lastUpdated && <span style={{ opacity: 0.7, marginLeft: 6 }}>· Updated {lastUpdated}</span>}
          </div>
        </div>
        <button onClick={fetchRates} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { if (!loading) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; } }}
          onMouseLeave={e => { if (!loading) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> 
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
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
              placeholder="0.00"
              style={{
                width: '100%', background: 'transparent', border: 'none',
                color: 'var(--text)', fontSize: 24, fontWeight: 600, outline: 'none',
                fontFamily: 'var(--font-mono, monospace)', padding: 0,
              }}
            />
          </div>
          <div style={{ width: 140 }}>
            <label style={labelStyle}>From</label>
            <div style={{ position: 'relative' }}>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ ...inputStyle, paddingRight: 36, cursor: 'pointer', appearance: 'none', fontWeight: 600 }}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{FLAGS[c]} {c}</option>)}
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
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--surface-raised, #18181f)',
            border: '1px solid var(--border)', cursor: 'pointer',
            color: 'var(--accent-blue, #2563EB)', transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <ArrowUpDown size={16} />
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
              color: 'var(--text)', fontSize: 24, fontWeight: 700, 
              fontFamily: 'var(--font-mono, monospace)', display: 'flex', alignItems: 'center',
              wordBreak: 'break-all',
            }}>
              {result}
            </div>
          </div>
          <div style={{ width: 140 }}>
            <label style={{ ...labelStyle, color: 'var(--accent-blue, #2563EB)' }}>To</label>
            <div style={{ position: 'relative' }}>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{
                  ...inputStyle,
                  background: 'var(--surface, #111118)',
                  borderColor: 'rgba(37,99,235,0.3)',
                  paddingRight: 36, cursor: 'pointer', appearance: 'none', fontWeight: 600,
                }}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{FLAGS[c]} {c}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

      </div>

      {/* ── Rates Breakdown ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16,
      }}>
        <div style={{ 
          background: 'var(--surface-raised, #18181f)', padding: '16px 20px', 
          borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>1 {from}</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>
            {rate1} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{to}</span>
          </div>
        </div>
        <div style={{ 
          background: 'var(--surface-raised, #18181f)', padding: '16px 20px', 
          borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>1 {to}</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>
            {rate2} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{from}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
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
  marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%', padding: '10px 12px', background: 'var(--surface-raised, #18181f)',
  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text, #f0f0f5)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit',
};
