import { useState, useEffect, useCallback } from 'react';
import {
  Copy, Check, RefreshCw, Trash2, Download,
  ShieldCheck, Info, Plus, Minus
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

/* ─── UUID generators ────────────────────────────────────── */
function genV4() {
  return crypto.randomUUID();
}

function genV7() {
  // UUID v7: Unix timestamp ms in top 48 bits + version + random
  const now = Date.now();
  const timeHex = now.toString(16).padStart(12, '0');
  const rand = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  const varByte = (0x8 | (Math.random() * 4 | 0)).toString(16);
  return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-7${rand().slice(1)}-${varByte}${rand().slice(1)}-${rand()}${rand()}${rand()}`;
}

function genNil() {
  return '00000000-0000-0000-0000-000000000000';
}

function genMax() {
  return 'ffffffff-ffff-ffff-ffff-ffffffffffff';
}

const VERSIONS = [
  {
    id: 'v4',
    label: 'v4',
    title: 'Version 4 — Random',
    desc: 'Cryptographically random. Most common. Use for IDs, tokens, keys.',
    gen: genV4,
    color: '#2563eb',
  },
  {
    id: 'v7',
    label: 'v7',
    title: 'Version 7 — Time-ordered',
    desc: 'Unix timestamp prefix + random. Sortable. Great for database primary keys.',
    gen: genV7,
    color: '#10b981',
  },
  {
    id: 'nil',
    label: 'Nil',
    title: 'Nil UUID',
    desc: 'All zeros. Used as a sentinel / null value in protocols.',
    gen: genNil,
    color: '#6b7280',
  },
  {
    id: 'max',
    label: 'Max',
    title: 'Max UUID',
    desc: 'All f\'s. Defined in RFC 9562 as the maximum UUID value.',
    gen: genMax,
    color: '#f59e0b',
  },
];

const FORMATS = [
  { id: 'standard',  label: 'Standard',     example: '550e8400-e29b-41d4-a716-446655440000',  apply: (u) => u },
  { id: 'upper',     label: 'UPPERCASE',     example: '550E8400-E29B-41D4-A716-446655440000',  apply: (u) => u.toUpperCase() },
  { id: 'nodash',    label: 'No dashes',     example: '550e8400e29b41d4a716446655440000',      apply: (u) => u.replace(/-/g, '') },
  { id: 'braces',    label: '{Braces}',      example: '{550e8400-e29b-41d4-a716-446655440000}', apply: (u) => `{${u}}` },
  { id: 'urn',       label: 'URN',           example: 'urn:uuid:550e8400-e29b-41d4-a716-…',    apply: (u) => `urn:uuid:${u}` },
];

/* ─── UUID parser / validator ────────────────────────────── */
function parseUUID(str) {
  const s = str.trim().toLowerCase()
    .replace(/^urn:uuid:/, '')
    .replace(/[{}]/g, '')
    .replace(/-/g, '');

  if (!/^[0-9a-f]{32}$/.test(s)) return null;

  const version = parseInt(s[12], 16);
  const variant = parseInt(s[16], 16);
  let variantStr = 'Unknown';
  if ((variant & 0xc) === 0x8 || (variant & 0xc) === 0x9 || (variant & 0xc) === 0xa || (variant & 0xc) === 0xb) variantStr = 'RFC 4122';
  else if (variant < 8) variantStr = 'NCS backward compat';
  else variantStr = 'Microsoft GUID';

  const formatted = `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;

  let versionName = `v${version}`;
  if (version === 4) versionName = 'v4 — Random';
  else if (version === 7) versionName = 'v7 — Time-ordered (Unix)';
  else if (version === 1) versionName = 'v1 — Time-based (MAC)';
  else if (version === 3) versionName = 'v3 — Name-based (MD5)';
  else if (version === 5) versionName = 'v5 — Name-based (SHA-1)';

  return { version, versionName, variantStr, formatted };
}

/* ─── Reusable UI ────────────────────────────────────────── */
function Panel({ title, icon: Icon, rightSlot, children }) {
  return (
    <div style={{ background: 'var(--surface-raised,#18181f)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {Icon && <Icon size={11} />}{title}
        </span>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{children}</div>;
}

function CopyBtn({ getText, label = 'Copy', small }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(getText()).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 1500); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: small ? '4px 9px' : '7px 13px', borderRadius: 8,
        background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
        color: ok ? '#10b981' : 'var(--text-muted)',
        fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}>
      {ok ? <Check size={11} /> : <Copy size={11} />}
      {ok ? 'Copied!' : label}
    </button>
  );
}

/* ─── UUID row ───────────────────────────────────────────── */
function UUIDRow({ uuid, index, onRemove, accentColor }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(uuid).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Highlight the version nibble (position 14) and variant nibble (position 19)
  const parts = uuid.replace(/[{}]/g, '').replace(/^urn:uuid:/, '').split('-');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      transition: 'background 0.12s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.4, minWidth: 20, textAlign: 'right', fontFamily: 'monospace', flexShrink: 0 }}>
        {index + 1}
      </span>
      <code style={{
        flex: 1, fontSize: 13, fontFamily: '"DM Mono",monospace',
        color: 'var(--text,#f0f0f5)', letterSpacing: '0.02em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {/* Highlight version and variant segments */}
        {parts.length === 5 ? (
          <>
            <span>{parts[0]}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>-</span>
            <span>{parts[1]}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>-</span>
            <span>
              <span style={{ color: accentColor, fontWeight: 700 }}>{parts[2][0]}</span>
              <span>{parts[2].slice(1)}</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>-</span>
            <span>
              <span style={{ color: '#f59e0b', fontWeight: 700 }}>{parts[3][0]}</span>
              <span>{parts[3].slice(1)}</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>-</span>
            <span>{parts[4]}</span>
          </>
        ) : (
          uuid
        )}
      </code>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={copy} style={{
          width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
          background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
          color: copied ? '#10b981' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.13s', fontFamily: 'inherit',
        }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        <button onClick={onRemove} style={{
          width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
          background: 'rgba(239,68,68,0.06)', color: 'rgba(239,68,68,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.13s', fontFamily: 'inherit',
        }}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

/* ─── Stepper ────────────────────────────────────────────── */
function Stepper({ value, onChange, min = 1, max = 100 }) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => { setRaw(String(value)); }, [value]);
  const commit = (s) => {
    const n = parseInt(s, 10);
    const c = isNaN(n) ? min : Math.max(min, Math.min(max, n));
    setRaw(String(c)); onChange(c);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface,#111118)', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
      <button onClick={() => { const n = Math.max(min, value - 1); setRaw(String(n)); onChange(n); }}
        style={{ width: 34, height: 36, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
        <Minus size={12} />
      </button>
      <input type="text" inputMode="numeric" value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => commit(raw)}
        onKeyDown={e => { if (e.key === 'Enter') { commit(raw); e.currentTarget.blur(); } }}
        onFocus={e => e.currentTarget.select()}
        style={{ width: 52, textAlign: 'center', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', color: 'var(--text,#f0f0f5)', fontSize: 12, fontFamily: '"DM Mono",monospace', fontWeight: 700, outline: 'none', padding: '8px 0' }}
      />
      <button onClick={() => { const n = Math.min(max, value + 1); setRaw(String(n)); onChange(n); }}
        style={{ width: 34, height: 36, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
        <Plus size={12} />
      </button>
    </div>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function UuidGenerator() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [version, setVersion]     = useState('v4');
  const [format, setFormat]       = useState('standard');
  const [count, setCount]         = useState(5);
  const [uuids, setUuids]         = useState([]);
  const [validateInput, setValidateInput] = useState('');

  const ver = VERSIONS.find(v => v.id === version);
  const fmt = FORMATS.find(f => f.id === format);

  const applyFormat = useCallback((u) => fmt.apply(u), [fmt]);

  const generate = useCallback(() => {
    const list = Array.from({ length: count }, () => applyFormat(ver.gen()));
    setUuids(list);
  }, [count, ver, applyFormat]);

  // Generate on mount
  useEffect(() => { generate(); }, []);

  const addOne = () => setUuids(prev => [applyFormat(ver.gen()), ...prev]);
  const removeOne = (i) => setUuids(prev => prev.filter((_, j) => j !== i));
  const clearAll = () => setUuids([]);

  const download = () => {
    const blob = new Blob([uuids.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'uuids.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  // Validation
  const parsed = validateInput.trim() ? parseUUID(validateInput) : null;
  const isValidUUID = parsed !== null;

  const SidebarContent = () => (
    <>
      {/* Version */}
      <Panel title="Version">
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {VERSIONS.map(v => (
            <button key={v.id} onClick={() => setVersion(v.id)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 9,
              padding: '9px 11px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${version === v.id ? v.color + '55' : 'var(--border)'}`,
              background: version === v.id ? v.color + '12' : 'var(--surface,#111118)',
              transition: 'all 0.15s', textAlign: 'left',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: version === v.id ? v.color : 'var(--border)', marginTop: 3, flexShrink: 0, transition: 'all 0.15s' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: version === v.id ? v.color : 'var(--text-muted)', fontFamily: '"DM Mono",monospace', marginBottom: 2 }}>
                  {v.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, opacity: 0.7 }}>{v.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      {/* Format */}
      <Panel title="Format">
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {FORMATS.map(f => (
            <button key={f.id} onClick={() => setFormat(f.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${format === f.id ? 'var(--accent-blue,#2563eb)' : 'var(--border)'}`,
              background: format === f.id ? 'rgba(37,99,235,0.1)' : 'var(--surface,#111118)',
              transition: 'all 0.15s', textAlign: 'left',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: format === f.id ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)' }}>{f.label}</span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.45, fontFamily: '"DM Mono",monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{f.example}</span>
            </button>
          ))}
        </div>
      </Panel>

      {/* Validate */}
      <Panel title="Validate UUID" icon={ShieldCheck}>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={validateInput}
            onChange={e => setValidateInput(e.target.value)}
            placeholder="Paste any UUID to inspect…"
            style={{
              width: '100%', padding: '8px 11px', borderRadius: 8,
              background: 'var(--surface,#111118)',
              border: `1px solid ${validateInput ? (isValidUUID ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)') : 'var(--border)'}`,
              color: 'var(--text,#f0f0f5)', fontFamily: '"DM Mono",monospace',
              fontSize: 12, outline: 'none', transition: 'border-color 0.15s',
            }}
          />
          {validateInput && (
            isValidUUID ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#10b981' }}>
                  <ShieldCheck size={13} /> Valid UUID
                </div>
                {[
                  { label: 'Version', value: parsed.versionName },
                  { label: 'Variant', value: parsed.variantStr },
                  { label: 'Formatted', value: parsed.formatted },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', minWidth: 56, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text,#f0f0f5)', fontFamily: '"DM Mono",monospace', wordBreak: 'break-all' }}>{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#f87171' }}>
                <Info size={13} /> Not a valid UUID
              </div>
            )
          )}
        </div>
      </Panel>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .ug * { box-sizing: border-box; }
        .ug { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .ug-fadein { animation:fadeSlideIn 0.18s ease both; }
      `}</style>

      <div className="ug">
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 280px' : '1fr', gap: 16, alignItems: 'start' }}>

          {/* ═══ LEFT — Generator ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Controls bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Count stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Count</span>
                <Stepper value={count} onChange={setCount} min={1} max={100} />
              </div>

              <div style={{ flex: 1 }} />

              {/* Actions */}
              <button onClick={addOne} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
                background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)',
                color: 'var(--accent-blue,#2563eb)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                <Plus size={13} /> Add one
              </button>

              <button onClick={generate} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9,
                background: 'var(--accent-blue,#2563eb)', border: 'none',
                color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 3px 12px rgba(37,99,235,0.35)', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-blue,#2563eb)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <RefreshCw size={14} /> Generate {count}
              </button>
            </div>

            {/* UUID list */}
            <Panel
              title={`${uuids.length} UUID${uuids.length !== 1 ? 's' : ''} · ${ver.label} · ${fmt.label}`}
              icon={null}
              rightSlot={
                uuids.length > 0 && (
                  <div style={{ display: 'flex', gap: 5 }}>
                    <CopyBtn getText={() => uuids.join('\n')} label="Copy all" small />
                    <button onClick={download} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }} title="Download as .txt">
                      <Download size={12} />
                    </button>
                    <button onClick={clearAll} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'rgba(239,68,68,0.07)', color: 'rgba(239,68,68,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }} title="Clear all">
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              }
            >
              {uuids.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                  No UUIDs yet — click Generate
                </div>
              ) : (
                <div>
                  {uuids.map((uuid, i) => (
                    <div key={`${uuid}-${i}`} className="ug-fadein" style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}>
                      <UUIDRow uuid={uuid} index={i} onRemove={() => removeOne(i)} accentColor={ver.color} />
                    </div>
                  ))}
                </div>
              )}

              {/* Legend */}
              {uuids.length > 0 && format === 'standard' && (
                <div style={{ display: 'flex', gap: 14, padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.6 }}>
                    <span style={{ color: ver.color, fontWeight: 700 }}>■</span> version nibble
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.6 }}>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>■</span> variant nibble
                  </span>
                </div>
              )}
            </Panel>

            {/* Mobile sidebar */}
            {!isDesktop && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <SidebarContent />
              </div>
            )}
          </div>

          {/* ═══ RIGHT SIDEBAR ═══ */}
          {isDesktop && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SidebarContent />
            </div>
          )}
        </div>
      </div>
    </>
  );
}