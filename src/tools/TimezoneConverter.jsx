import { useState, useMemo, useEffect } from 'react';
import {
  Globe,
  Clock,
  ChevronDown,
  RotateCcw,
  CalendarClock,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  MapPin,
  ChevronUp
} from "lucide-react";

const TIMEZONES = [
  { id: 'utc',  label: 'UTC',              offset: 0,   region: 'Global' },
  { id: 'est',  label: 'EST (New York)',   offset: -5,  region: 'Americas' },
  { id: 'cst',  label: 'CST (Chicago)',    offset: -6,  region: 'Americas' },
  { id: 'mst',  label: 'MST (Denver)',     offset: -7,  region: 'Americas' },
  { id: 'pst',  label: 'PST (Los Angeles)',offset: -8,  region: 'Americas' },
  { id: 'gmt',  label: 'GMT (London)',     offset: 0,   region: 'Europe' },
  { id: 'cet',  label: 'CET (Paris)',      offset: 1,   region: 'Europe' },
  { id: 'eet',  label: 'EET (Athens)',     offset: 2,   region: 'Europe' },
  { id: 'ist',  label: 'IST (Mumbai)',     offset: 5.5, region: 'Asia' },
  { id: 'cst2', label: 'CST (Shanghai)',   offset: 8,   region: 'Asia' },
  { id: 'jst',  label: 'JST (Tokyo)',      offset: 9,   region: 'Asia' },
  { id: 'kst',  label: 'KST (Seoul)',      offset: 9,   region: 'Asia' },
  { id: 'aest', label: 'AEST (Sydney)',    offset: 10,  region: 'Oceania' },
  { id: 'nzst', label: 'NZST (Auckland)',  offset: 12,  region: 'Oceania' },
  { id: 'ast',  label: 'AST (Riyadh)',     offset: 3,   region: 'Middle East' },
  { id: 'sgt',  label: 'SGT (Singapore)',  offset: 8,   region: 'Asia' },
  { id: 'brt',  label: 'BRT (São Paulo)',  offset: -3,  region: 'Americas' },
  { id: 'wast', label: 'WAST (Lagos)',     offset: 1,   region: 'Africa' },
];

function getTimeIcon(h) {
  if (h >= 5 && h < 8)   return <Sunrise size={18} color="#fbbf24" />;
  if (h >= 8 && h < 17)  return <Sun size={18} color="#fcd34d" />;
  if (h >= 17 && h < 20) return <Sunset size={18} color="#f97316" />;
  return <Moon size={18} color="#a78bfa" />;
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

export default function TimezoneConverter() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [fromTz, setFromTz] = useState('utc');
  const [hours, setHours]   = useState(new Date().getHours());
  const [minutes, setMinutes] = useState(new Date().getMinutes());

  const sourceTz = useMemo(() => TIMEZONES.find(t => t.id === fromTz) || TIMEZONES[0], [fromTz]);

  const conversions = useMemo(() => {
    return TIMEZONES.map((tz) => {
      const diff = tz.offset - sourceTz.offset;
      let h = hours + diff;
      let m = minutes + (diff % 1) * 60;
      
      if (m >= 60) { h++; m -= 60; }
      if (m < 0)   { h--; m += 60; }
      
      let dayOffset = 0;
      if (h >= 24) { h -= 24; dayOffset = 1; }
      if (h < 0)   { h += 24; dayOffset = -1; }
      
      // Fix floating point precision
      m = Math.round(m);
      if (m === 60) { h++; m = 0; }
      if (h >= 24) { h -= 24; dayOffset++; }
      
      const formatted = `${String(Math.floor(h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      
      let dayStr = '';
      if (dayOffset === 1) dayStr = 'Tomorrow';
      else if (dayOffset === -1) dayStr = 'Yesterday';
      else if (dayOffset > 1) dayStr = `+${dayOffset} days`;
      else if (dayOffset < -1) dayStr = `${dayOffset} days`;

      return {
        ...tz,
        timeStr: formatted,
        hourVal: Math.floor(h),
        dayStr,
        isCurrent: tz.id === sourceTz.id
      };
    });
  }, [fromTz, sourceTz, hours, minutes]);

  const resetToLocal = () => {
    const d = new Date();
    setHours(d.getHours());
    setMinutes(d.getMinutes());
    // Guess timezone based on offset:
    const offsetCalc = -(d.getTimezoneOffset() / 60);
    const closest = TIMEZONES.reduce((prev, curr) => 
      Math.abs(curr.offset - offsetCalc) < Math.abs(prev.offset - offsetCalc) ? curr : prev
    );
    setFromTz(closest.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── CONTROLS AREA ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end',
        background: 'var(--surface-raised, #18181f)',
        padding: 20, borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        
        {/* Source Timezone */}
        <div style={{ flex: '1 1 240px' }}>
          <label style={labelStyle}><Globe size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} /> Base Timezone</label>
          <div style={{ position: 'relative' }}>
            <select
              value={fromTz}
              onChange={(e) => setFromTz(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', paddingRight: 36, cursor: 'pointer' }}
            >
              <optgroup label="Select Source Timezone">
                {TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label} (UTC{tz.offset >= 0 ? '+' : ''}{tz.offset})
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Time Inputs */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ width: 80 }}>
            <label style={labelStyle}>Hour (24h)</label>
            <input
              type="number" min={0} max={23}
              value={hours}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 0 && v <= 23) setHours(v);
              }}
              style={{ ...inputStyle, textAlign: 'center', fontFamily: 'var(--font-mono, monospace)', fontSize: 16 }}
            />
          </div>
          <div style={{ width: 80 }}>
            <label style={labelStyle}>Minute</label>
            <input
              type="number" min={0} max={59}
              value={minutes}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 0 && v <= 59) setMinutes(v);
              }}
              style={{ ...inputStyle, textAlign: 'center', fontFamily: 'var(--font-mono, monospace)', fontSize: 16 }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={resetToLocal} style={{
            ...ghostBtnStyle,
            height: 42, padding: '0 16px',
          }} title="Use current local time">
            <Clock size={14} /> Local Time
          </button>
        </div>
      </div>

      {/* ── RESULTS GRID ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <CalendarClock size={16} color="var(--accent-blue, #2563EB)" />
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Converted Times</h3>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? Math.min(140, 220) : 220}px,1fr))`,
          gap: 12
        }}>
          {conversions.map((tz) => (
            <div key={tz.id} style={{
              display: 'flex', flexDirection: 'column', gap: 10,
              padding: 16, borderRadius: 12,
              background: tz.isCurrent ? 'rgba(37,99,235,0.06)' : 'var(--surface, #111118)',
              border: `1px solid ${tz.isCurrent ? 'var(--accent-blue, #2563EB)' : 'var(--border)'}`,
              transition: 'all 0.2s',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {tz.isCurrent && (
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  fontSize: 9, fontWeight: 700, backgroundColor: 'var(--accent-blue, #2563EB)',
                  color: 'white', padding: '2px 8px', borderBottomLeftRadius: 8,
                  letterSpacing: '0.05em',
                }}>SOURCE</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} style={{ color: tz.isCurrent ? 'var(--accent-blue, #2563EB)' : 'var(--text-muted)' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: tz.isCurrent ? 'var(--text)' : 'var(--text-muted)' }}>
                      {tz.region}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {tz.label.split(' (')[0]}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {tz.label.includes('(') ? tz.label.split('(')[1].replace(')', '') : 'UTC' + (tz.offset >= 0 ? '+' : '') + tz.offset}
                  </div>
                </div>
                
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--surface-raised, #18181f)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {getTimeIcon(tz.hourVal)}
                </div>
              </div>

              <div style={{
                marginTop: 6, paddingTop: 10, borderTop: '1px dashed var(--border)',
                display: 'flex', alignItems: 'baseline', gap: 8,
              }}>
                <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '-0.02em', color: tz.isCurrent ? 'var(--accent-blue, #2563EB)' : 'var(--text)' }}>
                  {tz.timeStr}
                </span>
                
                <span style={{ fontSize: 12, fontWeight: 600, color: tz.dayStr ? '#f97316' : 'var(--text-muted)' }}>
                  {tz.dayStr || 'Today'}
                </span>
              </div>
            </div>
          ))}
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
  padding: '10px 12px',
  background: 'var(--surface, #111118)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text, #f0f0f5)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit',
};

const ghostBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted, #6b6b80)',
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
  transition: 'all 0.15s',
};