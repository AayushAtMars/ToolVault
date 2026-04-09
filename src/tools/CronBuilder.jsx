import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Copy, Check, RotateCcw, ChevronDown, ChevronRight,
  Clock, Calendar, Play, Zap, AlertCircle, CheckCircle2,
  Plus, Minus
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

/* ─── Field definitions ──────────────────────────────────── */
const FIELDS = [
  {
    id: 'minute', label: 'Minute',    short: 'MIN', range: '0–59',
    min: 0, max: 59,
    examples: ['*', '0', '*/15', '0,30', '0-5'],
    hint: 'Use * for every minute, */n for every n minutes',
  },
  {
    id: 'hour',   label: 'Hour',      short: 'HR',  range: '0–23',
    min: 0, max: 23,
    examples: ['*', '0', '*/6', '9,17', '9-17'],
    hint: 'Use */6 for every 6 hours, 9-17 for business hours',
  },
  {
    id: 'dom',    label: 'Day (Month)', short: 'DOM', range: '1–31',
    min: 1, max: 31,
    examples: ['*', '1', '15', '1,15', 'L'],
    hint: '1 = first of month, L = last day (non-standard)',
  },
  {
    id: 'month',  label: 'Month',     short: 'MON', range: '1–12',
    min: 1, max: 12,
    examples: ['*', '1', '6', '1-6', '*/3'],
    hint: '1=Jan, 12=Dec. Use names: JAN, FEB, etc.',
  },
  {
    id: 'dow',    label: 'Weekday',   short: 'DOW', range: '0–6',
    min: 0, max: 6,
    examples: ['*', '1', '1-5', '0,6', '1,3,5'],
    hint: '0=Sun, 1=Mon … 6=Sat. 1-5 = Mon–Fri',
  },
];

/* ─── Presets ────────────────────────────────────────────── */
const PRESET_GROUPS = [
  {
    label: 'Frequent',
    icon: Zap,
    items: [
      { label: 'Every minute',     cron: '* * * * *' },
      { label: 'Every 5 min',      cron: '*/5 * * * *' },
      { label: 'Every 15 min',     cron: '*/15 * * * *' },
      { label: 'Every 30 min',     cron: '*/30 * * * *' },
      { label: 'Every hour',       cron: '0 * * * *' },
      { label: 'Every 6 hours',    cron: '0 */6 * * *' },
      { label: 'Every 12 hours',   cron: '0 */12 * * *' },
    ],
  },
  {
    label: 'Daily',
    icon: Clock,
    items: [
      { label: 'Daily midnight',   cron: '0 0 * * *' },
      { label: 'Daily at noon',    cron: '0 12 * * *' },
      { label: 'Daily at 6am',     cron: '0 6 * * *' },
      { label: 'Daily at 9am',     cron: '0 9 * * *' },
    ],
  },
  {
    label: 'Weekly',
    icon: Calendar,
    items: [
      { label: 'Every Monday 9am', cron: '0 9 * * 1' },
      { label: 'Weekdays 8am',     cron: '0 8 * * 1-5' },
      { label: 'Weekends midnight',cron: '0 0 * * 0,6' },
      { label: 'Every Sunday',     cron: '0 0 * * 0' },
    ],
  },
  {
    label: 'Monthly',
    icon: Play,
    items: [
      { label: '1st of month',     cron: '0 0 1 * *' },
      { label: '15th of month',    cron: '0 0 15 * *' },
      { label: '1st & 15th',       cron: '0 0 1,15 * *' },
      { label: 'Last day (approx)',cron: '0 0 28-31 * *' },
    ],
  },
];

/* ─── Months / days helpers ──────────────────────────────── */
const MONTHS = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ─── Human-readable description ────────────────────────── */
function describeCron(parts) {
  if (parts.length !== 5) return 'Invalid cron expression';
  const [min, hour, dom, month, dow] = parts;

  // Validate basics
  for (const p of parts) {
    if (p === '') return 'Fill in all five fields';
  }

  let time = '';
  if (min === '*' && hour === '*') time = 'Every minute';
  else if (min.startsWith('*/') && hour === '*') time = `Every ${min.slice(2)} minutes`;
  else if (hour.startsWith('*/') && min === '0') time = `Every ${hour.slice(2)} hours (on the hour)`;
  else if (hour === '*') time = `At minute ${min} of every hour`;
  else {
    const h = hour.includes(',') ? hour : hour.padStart(2,'0');
    const m = min.padStart(2,'0');
    time = hour.includes(',') || hour.includes('-') || hour.includes('/')
      ? `At minute ${m} past hour(s) ${hour}`
      : `At ${h}:${m}`;
  }

  let dayPart = '';
  if (dom !== '*' && dow !== '*') {
    dayPart = ` on day ${dom} of the month and on ${dow.split(',').map(d => DAYS[parseInt(d)]||d).join(', ')}`;
  } else if (dom !== '*') {
    dayPart = ` on day ${dom} of the month`;
  } else if (dow !== '*') {
    const dowStr = dow.split(',').map(d => {
      if (d.includes('-')) { const [s,e] = d.split('-'); return `${DAYS[+s]||s}–${DAYS[+e]||e}`; }
      return DAYS[parseInt(d)] || d;
    }).join(', ');
    dayPart = ` on ${dowStr}`;
  }

  let monthPart = '';
  if (month !== '*') {
    if (month.includes('-')) {
      const [s,e] = month.split('-');
      monthPart = ` in ${MONTHS[+s]||s}–${MONTHS[+e]||e}`;
    } else if (month.includes(',')) {
      monthPart = ` in ${month.split(',').map(m => MONTHS[+m]||m).join(', ')}`;
    } else {
      monthPart = ` in ${MONTHS[parseInt(month)] || month}`;
    }
  }

  return time + dayPart + monthPart;
}

/* ─── Next run times ─────────────────────────────────────── */
function getNextRuns(cronStr, count = 5) {
  const parts = cronStr.trim().split(/\s+/);
  if (parts.length !== 5) return [];
  const [minP, hourP, domP, monthP, dowP] = parts;

  function matchField(val, field, min, max) {
    if (field === '*') return true;
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2));
      return (val - min) % step === 0;
    }
    const segments = field.split(',');
    return segments.some(seg => {
      if (seg.includes('-')) {
        const [lo, hi] = seg.split('-').map(Number);
        return val >= lo && val <= hi;
      }
      return parseInt(seg) === val;
    });
  }

  const runs = [];
  const now = new Date();
  now.setSeconds(0, 0);
  const cur = new Date(now.getTime() + 60000); // start from next minute

  for (let i = 0; i < 525600 && runs.length < count; i++) {
    const d = new Date(cur.getTime() + i * 60000);
    if (
      matchField(d.getMinutes(), minP, 0, 59) &&
      matchField(d.getHours(), hourP, 0, 23) &&
      matchField(d.getDate(), domP, 1, 31) &&
      matchField(d.getMonth() + 1, monthP, 1, 12) &&
      matchField(d.getDay(), dowP, 0, 6)
    ) {
      runs.push(d);
      // Skip ahead to avoid duplicates
      if (minP !== '*' && !minP.startsWith('*/')) i += 58;
    }
  }
  return runs;
}

/* ─── Validate cron ──────────────────────────────────────── */
function validateCron(parts) {
  if (parts.length !== 5) return 'Must have exactly 5 fields';
  const rules = [
    { label: 'Minute', min: 0, max: 59 },
    { label: 'Hour',   min: 0, max: 23 },
    { label: 'DOM',    min: 1, max: 31 },
    { label: 'Month',  min: 1, max: 12 },
    { label: 'DOW',    min: 0, max:  6 },
  ];
  for (let i = 0; i < 5; i++) {
    const p = parts[i];
    const r = rules[i];
    if (p === '*' || p === '') continue;
    if (p.startsWith('*/')) {
      const n = parseInt(p.slice(2));
      if (isNaN(n) || n < 1) return `${r.label}: invalid step "${p}"`;
      continue;
    }
    const segs = p.split(',');
    for (const seg of segs) {
      if (seg.includes('-')) {
        const [lo, hi] = seg.split('-').map(Number);
        if (isNaN(lo) || isNaN(hi) || lo < r.min || hi > r.max || lo > hi)
          return `${r.label}: invalid range "${seg}" (${r.min}–${r.max})`;
      } else {
        const n = parseInt(seg);
        if (isNaN(n) || n < r.min || n > r.max)
          return `${r.label}: "${seg}" out of range (${r.min}–${r.max})`;
      }
    }
  }
  return null;
}

/* ─── Reusable UI ────────────────────────────────────────── */
function Panel({ title, icon: Icon, rightSlot, children }) {
  return (
    <div style={{ background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.15)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
          {Icon && <Icon size={11}/>}{title}
        </span>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

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

/* ─── Field input with quick helpers ────────────────────── */
function FieldInput({ field, value, onChange, index }) {
  const [open, setOpen] = useState(false);
  const colors = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#f43f5e'];
  const color = colors[index];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      {/* Label + range */}
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.07em' }}>{field.short}</span>
        <span style={{ fontSize:9, color:'var(--text-muted)', opacity:0.55, fontFamily:'monospace' }}>{field.range}</span>
      </div>

      {/* Input */}
      <div style={{ position:'relative' }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width:'100%', padding:'8px 10px', borderRadius:9,
            background:'var(--surface,#111118)',
            border:`1.5px solid ${value !== '*' ? color + '55' : 'var(--border)'}`,
            color: value !== '*' ? color : 'var(--text,#f0f0f5)',
            fontFamily:'"DM Mono",monospace', fontSize:14, fontWeight:700,
            outline:'none', textAlign:'center', transition:'all 0.15s',
          }}
        />
      </div>

      {/* Full label + hint toggle */}
      <button onClick={() => setOpen(o => !o)} style={{
        display:'flex',alignItems:'center',justifyContent:'space-between',
        marginTop:4,padding:'3px 2px',background:'transparent',border:'none',
        cursor:'pointer',fontFamily:'inherit',
      }}>
        <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>{field.label}</span>
        {open ? <ChevronDown size={10} style={{color:'var(--text-muted)'}}/> : <ChevronRight size={10} style={{color:'var(--text-muted)'}}/>}
      </button>

      {/* Quick values */}
      {open && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:3 }}>
          {field.examples.map(ex => (
            <button key={ex} onClick={() => { onChange(ex); setOpen(false); }} style={{
              padding:'2px 7px',borderRadius:5,cursor:'pointer',fontFamily:'"DM Mono",monospace',
              fontSize:10,fontWeight:700,
              background:value===ex?color+'22':'rgba(255,255,255,0.04)',
              border:`1px solid ${value===ex?color+'55':'var(--border)'}`,
              color:value===ex?color:'var(--text-muted)',transition:'all 0.12s',
            }}>{ex}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Collapsible preset group ───────────────────────────── */
function PresetGroup({ group, onApply }) {
  const [open, setOpen] = useState(true);
  const Icon = group.icon;
  return (
    <div style={{ borderBottom:'1px solid var(--border)' }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'7px 14px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',
      }}>
        <span style={{ display:'flex',alignItems:'center',gap:6,fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em' }}>
          <Icon size={10}/>{group.label}
        </span>
        {open ? <ChevronDown size={11} style={{color:'var(--text-muted)'}}/> : <ChevronRight size={11} style={{color:'var(--text-muted)'}}/>}
      </button>
      {open && (
        <div style={{ padding:'0 10px 8px', display:'flex', flexDirection:'column', gap:2 }}>
          {group.items.map(item => (
            <button key={item.cron} onClick={() => onApply(item.cron)} style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'6px 8px',borderRadius:7,cursor:'pointer',
              background:'transparent',border:'1px solid transparent',fontFamily:'inherit',
              transition:'all 0.12s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.borderColor='var(--border)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor='transparent';}}
            >
              <span style={{ fontSize:12,color:'var(--text,#f0f0f5)',fontWeight:500 }}>{item.label}</span>
              <code style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'var(--text-muted)',background:'rgba(255,255,255,0.05)',padding:'2px 6px',borderRadius:4 }}>{item.cron}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function CronBuilder() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [fields, setFields]       = useState(['*','*','*','*','*']);
  const [customInput, setCustomInput] = useState('');
  const [customMode, setCustomMode]   = useState(false);
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' | 'raw'

  const cron = fields.join(' ');
  const description = useMemo(() => describeCron(fields), [fields]);
  const validationError = useMemo(() => validateCron(fields), [fields]);
  const nextRuns = useMemo(() => {
    if (validationError) return [];
    try { return getNextRuns(cron); } catch { return []; }
  }, [cron, validationError]);

  const updateField = (i, v) => setFields(prev => { const n=[...prev]; n[i]=v; return n; });

  const applyPreset = (cronStr) => {
    const parts = cronStr.split(' ');
    setFields(parts);
    setCustomInput(cronStr);
  };

  const applyCustom = () => {
    const parts = customInput.trim().split(/\s+/);
    if (parts.length === 5) setFields(parts);
  };

  const reset = () => { setFields(['*','*','*','*','*']); setCustomInput('* * * * *'); };

  // Sync custom input when fields change
  useEffect(() => { setCustomInput(cron); }, [cron]);

  const formatRunTime = (d) => {
    const now = new Date();
    const diff = d - now;
    const mins = Math.round(diff / 60000);
    const hrs  = Math.round(diff / 3600000);
    const days = Math.round(diff / 86400000);
    let rel = '';
    if (mins < 60) rel = `in ${mins}m`;
    else if (hrs < 24) rel = `in ${hrs}h`;
    else rel = `in ${days}d`;
    return {
      full: d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }),
      rel,
    };
  };

  const SidebarContent = () => (
    <>
      {/* Presets */}
      <Panel title="Presets" icon={Zap}>
        {PRESET_GROUPS.map(g => (
          <PresetGroup key={g.label} group={g} onApply={applyPreset}/>
        ))}
      </Panel>

      {/* Next runs */}
      <Panel title="Next 5 Runs" icon={Clock}>
        <div style={{ padding:'8px 0' }}>
          {validationError ? (
            <div style={{ padding:'8px 14px', fontSize:12, color:'rgba(239,68,68,0.7)' }}>Fix the expression to see next runs</div>
          ) : nextRuns.length === 0 ? (
            <div style={{ padding:'8px 14px', fontSize:12, color:'var(--text-muted)' }}>Could not compute runs</div>
          ) : (
            nextRuns.map((d, i) => {
              const { full, rel } = formatRunTime(d);
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 14px', borderBottom: i < nextRuns.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', flexShrink:0 }}/>
                    <span style={{ fontSize:11, fontFamily:'"DM Mono",monospace', color:'var(--text,#f0f0f5)' }}>{full}</span>
                  </div>
                  <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace', flexShrink:0 }}>{rel}</span>
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .cb * { box-sizing: border-box; }
        .cb { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }
        .cb-tab {
          display:flex;align-items:center;gap:5px;padding:7px 12px;
          border-bottom:2px solid transparent;background:transparent;
          border-top:none;border-left:none;border-right:none;
          color:var(--text-muted);font-family:inherit;font-size:11px;font-weight:700;
          cursor:pointer;transition:all 0.15s;white-space:nowrap;
        }
        .cb-tab.active { color:var(--accent-blue,#2563eb); border-bottom-color:var(--accent-blue,#2563eb); }
        .cb-tab:hover:not(.active) { color:var(--text,#f0f0f5); }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .cb-fadein { animation:fadeIn 0.2s ease both; }
      `}</style>

      <div className="cb">
        <div style={{ display:'grid', gridTemplateColumns:isDesktop?'1fr 280px':'1fr', gap:16, alignItems:'start' }}>

          {/* ═══ LEFT ═══ */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Cron expression display */}
            <div style={{
              background:'var(--surface-raised,#18181f)',
              border:`1px solid ${validationError ? 'rgba(239,68,68,0.35)' : 'rgba(37,99,235,0.3)'}`,
              borderRadius:14, padding:'18px 20px',
            }}>
              {/* Big expression */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                <code style={{
                  fontSize: isDesktop ? 28 : 20,
                  fontFamily:'"DM Mono",monospace', fontWeight:800,
                  letterSpacing:'0.06em', color:'var(--text,#f0f0f5)',
                  background:'transparent', flex:1,
                }}>
                  {fields.map((f, i) => (
                    <span key={i}>
                      <span style={{ color: f !== '*' ? ['#2563eb','#10b981','#f59e0b','#8b5cf6','#f43f5e'][i] : 'rgba(255,255,255,0.5)' }}>{f}</span>
                      {i < 4 && <span style={{ color:'rgba(255,255,255,0.2)', margin:'0 4px' }}>·</span>}
                    </span>
                  ))}
                </code>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <CopyBtn getText={() => cron} label="Copy" />
                  <button onClick={reset} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 11px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',color:'var(--text-muted)',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.15s' }}>
                    <RotateCcw size={11}/> Reset
                  </button>
                </div>
              </div>

              {/* Field labels row */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4, marginTop:8 }}>
                {FIELDS.map((f, i) => (
                  <div key={i} style={{ fontSize:9, textAlign:'center', color:'var(--text-muted)', opacity:0.5, textTransform:'uppercase', letterSpacing:'0.07em' }}>{f.short}</div>
                ))}
              </div>

              {/* Description */}
              <div style={{ marginTop:10, display:'flex', alignItems:'flex-start', gap:8 }}>
                {validationError ? (
                  <div style={{ display:'flex',alignItems:'center',gap:7,padding:'8px 12px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,color:'#fca5a5',fontSize:12,width:'100%' }}>
                    <AlertCircle size={13}/><span style={{ fontFamily:'"DM Mono",monospace' }}>{validationError}</span>
                  </div>
                ) : (
                  <div style={{ display:'flex',alignItems:'center',gap:7,padding:'8px 12px',background:'rgba(37,99,235,0.07)',border:'1px solid rgba(37,99,235,0.18)',borderRadius:8,fontSize:13,color:'rgba(240,240,245,0.85)',width:'100%',lineHeight:1.5 }}>
                    <CheckCircle2 size={13} style={{ color:'#10b981', flexShrink:0 }}/>{description}
                  </div>
                )}
              </div>
            </div>

            {/* Builder tabs */}
            <Panel title="Builder">
              <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.1)' }}>
                {[
                  { id:'visual', label:'Visual' },
                  { id:'raw',    label:'Raw Input' },
                ].map(({ id, label }) => (
                  <button key={id} className={`cb-tab${activeTab===id?' active':''}`} onClick={() => setActiveTab(id)}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Visual field editor */}
              {activeTab === 'visual' && (
                <div className="cb-fadein" style={{ padding:'16px', display:'grid', gridTemplateColumns: isDesktop ? 'repeat(5,1fr)' : 'repeat(3,1fr)', gap:16 }}>
                  {FIELDS.map((field, i) => (
                    <FieldInput key={field.id} field={field} value={fields[i]} onChange={v => updateField(i, v)} index={i}/>
                  ))}
                </div>
              )}

              {/* Raw input */}
              {activeTab === 'raw' && (
                <div className="cb-fadein" style={{ padding:'16px', display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>
                    Enter a cron expression directly. Format: <code style={{ fontFamily:'"DM Mono",monospace', color:'#93c5fd', fontSize:11 }}>MIN HOUR DOM MON DOW</code>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      onBlur={applyCustom}
                      onKeyDown={e => e.key === 'Enter' && applyCustom()}
                      placeholder="* * * * *"
                      style={{
                        flex:1, padding:'10px 14px', borderRadius:9,
                        background:'var(--surface,#111118)', border:'1px solid var(--border)',
                        color:'var(--text,#f0f0f5)', fontFamily:'"DM Mono",monospace',
                        fontSize:15, fontWeight:700, outline:'none', letterSpacing:'0.05em',
                      }}
                    />
                    <button onClick={applyCustom} style={{ padding:'10px 16px', borderRadius:9, background:'var(--accent-blue,#2563eb)', border:'none', color:'#fff', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      Apply
                    </button>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.7 }}>
                    <strong style={{ color:'rgba(255,255,255,0.5)' }}>Shortcuts:</strong> * = any, */n = every n, n-m = range, n,m = list
                  </div>
                </div>
              )}
            </Panel>

            {/* Mobile sidebar content */}
            {!isDesktop && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <SidebarContent/>
              </div>
            )}
          </div>

          {/* ═══ RIGHT SIDEBAR ═══ */}
          {isDesktop && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <SidebarContent/>
            </div>
          )}
        </div>
      </div>
    </>
  );
}