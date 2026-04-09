import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Copy, Check, Trash2, AlertCircle, CheckCircle2,
  ChevronDown, ChevronRight, Play, BookOpen,
  Replace, Download, RotateCcw
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

/* ─── Flag definitions ───────────────────────────────────── */
const FLAG_INFO = {
  g: { label: 'g', title: 'Global — find all matches' },
  i: { label: 'i', title: 'Case insensitive' },
  m: { label: 'm', title: 'Multiline — ^ and $ match line boundaries' },
  s: { label: 's', title: 'Dot-all — . matches newlines' },
  u: { label: 'u', title: 'Unicode — treat pattern as unicode' },
};

/* ─── Highlight colors ───────────────────────────────────── */
const MATCH_COLORS = [
  { bg: 'rgba(37,99,235,0.2)',   border: '#2563eb' },
  { bg: 'rgba(16,185,129,0.2)',  border: '#10b981' },
  { bg: 'rgba(245,158,11,0.2)',  border: '#f59e0b' },
  { bg: 'rgba(239,68,68,0.2)',   border: '#ef4444' },
  { bg: 'rgba(139,92,246,0.2)',  border: '#8b5cf6' },
];

/* ─── Cheat sheet ────────────────────────────────────────── */
const CHEAT_SHEET = [
  { cat: 'Anchors',    items: [{ pat: '^', desc: 'Start of string/line' }, { pat: '$', desc: 'End of string/line' }, { pat: '\\b', desc: 'Word boundary' }, { pat: '\\B', desc: 'Non-word boundary' }] },
  { cat: 'Character Classes', items: [{ pat: '.', desc: 'Any char except newline' }, { pat: '\\d', desc: 'Digit [0-9]' }, { pat: '\\D', desc: 'Non-digit' }, { pat: '\\w', desc: 'Word char [a-zA-Z0-9_]' }, { pat: '\\W', desc: 'Non-word' }, { pat: '\\s', desc: 'Whitespace' }, { pat: '\\S', desc: 'Non-whitespace' }] },
  { cat: 'Quantifiers', items: [{ pat: '*', desc: '0 or more' }, { pat: '+', desc: '1 or more' }, { pat: '?', desc: '0 or 1 (optional)' }, { pat: '{n}', desc: 'Exactly n' }, { pat: '{n,}', desc: 'n or more' }, { pat: '{n,m}', desc: 'Between n and m' }] },
  { cat: 'Groups',     items: [{ pat: '(abc)', desc: 'Capture group' }, { pat: '(?:abc)', desc: 'Non-capture group' }, { pat: '(?<name>…)', desc: 'Named capture group' }, { pat: '(?=…)', desc: 'Positive lookahead' }, { pat: '(?!…)', desc: 'Negative lookahead' }, { pat: '(?<=…)', desc: 'Positive lookbehind' }] },
  { cat: 'Common',     items: [{ pat: '[abc]', desc: 'Character set' }, { pat: '[^abc]', desc: 'Negated set' }, { pat: '[a-z]', desc: 'Range' }, { pat: 'a|b', desc: 'Alternation (a or b)' }] },
];

/* ─── Quick patterns ─────────────────────────────────────── */
const QUICK_PATTERNS = [
  { label: 'Email',      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', flags: 'gi' },
  { label: 'URL',        pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)', flags: 'gi' },
  { label: 'IPv4',       pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g' },
  { label: 'Hex Color',  pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'gi' },
  { label: 'Date',       pattern: '\\b\\d{4}[-/]\\d{2}[-/]\\d{2}\\b', flags: 'g' },
  { label: 'Phone',      pattern: '[\\+]?[(]?[0-9]{3}[)]?[-\\s\\.]?[0-9]{3}[-\\s\\.]?[0-9]{4,6}', flags: 'g' },
  { label: 'Digits',     pattern: '\\d+', flags: 'g' },
  { label: 'Words',      pattern: '\\b\\w+\\b', flags: 'g' },
];

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

function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: '"DM Mono",monospace', color: color || 'var(--text,#f0f0f5)' }}>{value}</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

/* ─── Collapsible cheat sheet section ────────────────────── */
function CheatSection({ cat, items, onInsert }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: 'transparent', border: 'none',
        color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{cat}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div style={{ padding: '0 14px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map(({ pat, desc }) => (
            <button key={pat} onClick={() => onInsert(pat)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 8px', borderRadius: 7, cursor: 'pointer',
              background: 'transparent', border: '1px solid transparent',
              fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
            >
              <code style={{ fontSize: 12, fontFamily: '"DM Mono",monospace', color: '#93c5fd', minWidth: 80, flexShrink: 0 }}>{pat}</code>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function RegexTester() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [pattern, setPattern]     = useState('\\b\\w+@\\w+\\.\\w+\\b');
  const [flags, setFlags]         = useState('gi');
  const [testString, setTestString] = useState('Contact us at hello@aayutools.com or support@example.org\nAlso try info@test.co for more details.');
  const [replaceWith, setReplaceWith] = useState('[REDACTED]');
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'replace' | 'cheatsheet'
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const patternRef = useRef(null);
  const [error, setError]         = useState('');

  /* ── Compute matches ── */
  const { matches, highlighted, regexObj } = useMemo(() => {
    if (!pattern || !testString) return { matches: [], highlighted: [], regexObj: null };
    try {
      setError('');
      const safeFlags = flags.includes('g') ? flags : flags + 'g';
      const re = new RegExp(pattern, safeFlags);
      const results = [];
      let m;
      const clone = new RegExp(pattern, safeFlags);

      while ((m = clone.exec(testString)) !== null) {
        const namedGroups = m.groups ? Object.entries(m.groups) : [];
        results.push({
          match: m[0],
          index: m.index,
          end: m.index + m[0].length,
          groups: m.slice(1).filter(g => g !== undefined),
          namedGroups,
        });
        if (!m[0]) { clone.lastIndex++; }
        if (results.length > 500) break;
      }

      // Build highlighted parts
      const parts = [];
      let last = 0;
      results.forEach((r, i) => {
        if (r.index > last) parts.push({ text: testString.slice(last, r.index), highlight: false });
        parts.push({ text: r.match, highlight: true, colorIdx: i % MATCH_COLORS.length });
        last = r.end;
      });
      if (last < testString.length) parts.push({ text: testString.slice(last), highlight: false });

      return { matches: results, highlighted: parts, regexObj: re };
    } catch (e) {
      setError(e.message);
      return { matches: [], highlighted: [], regexObj: null };
    }
  }, [pattern, flags, testString]);

  /* ── Replace result ── */
  const replaceResult = useMemo(() => {
    if (!pattern || !testString || error) return '';
    try {
      const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
      return testString.replace(re, replaceWith);
    } catch { return ''; }
  }, [pattern, flags, testString, replaceWith, error]);

  const toggleFlag = (f) => {
    setFlags(prev => prev.includes(f) ? prev.replace(f, '') : prev + f);
  };

  const insertPattern = (pat) => {
    if (!patternRef.current) return;
    const el = patternRef.current;
    const s = el.selectionStart, e = el.selectionEnd;
    const newVal = pattern.slice(0, s) + pat + pattern.slice(e);
    setPattern(newVal);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + pat.length, s + pat.length); });
  };

  const loadQuick = ({ pattern: p, flags: f }) => { setPattern(p); setFlags(f); };

  const hasGroups = matches.some(m => m.groups.length > 0 || m.namedGroups.length > 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .rt * { box-sizing: border-box; }
        .rt { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }

        .rt-pattern-input {
          flex:1; padding:10px 14px; background:var(--surface,#111118);
          border:none; outline:none;
          font-family:'DM Mono',monospace; font-size:14px; font-weight:500;
          color:var(--text,#f0f0f5); letter-spacing:0.02em;
        }
        .rt-pattern-input::placeholder { color:rgba(255,255,255,0.2); }

        .rt-textarea {
          width:100%; min-height:160px; padding:14px 16px;
          background:transparent; border:none; resize:vertical; outline:none;
          font-family:'DM Mono',monospace; font-size:13px; line-height:1.75;
          color:var(--text,#f0f0f5);
        }
        .rt-textarea::placeholder { color:rgba(255,255,255,0.2); }

        .rt-tab {
          display:flex;align-items:center;gap:5px;
          padding:7px 12px;border-bottom:2px solid transparent;
          background:transparent;border-top:none;border-left:none;border-right:none;
          color:var(--text-muted);font-family:inherit;font-size:11px;font-weight:700;
          cursor:pointer;transition:all 0.15s;white-space:nowrap;
        }
        .rt-tab.active { color:var(--accent-blue,#2563eb); border-bottom-color:var(--accent-blue,#2563eb); }
        .rt-tab:hover:not(.active) { color:var(--text,#f0f0f5); }

        .rt-match-row {
          display:flex;align-items:flex-start;gap:10px;
          padding:7px 14px;border-bottom:1px solid rgba(255,255,255,0.04);
          transition:background 0.1s;
        }
        .rt-match-row:hover { background:rgba(255,255,255,0.02); }
        .rt-match-row:last-child { border-bottom:none; }

        @keyframes fadeIn { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:translateY(0)} }
        .rt-fadein { animation:fadeIn 0.18s ease both; }
      `}</style>

      <div className="rt">
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 280px' : '1fr', gap: 16, alignItems: 'start' }}>

          {/* ═══ LEFT ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Pattern input */}
            <Panel title="Pattern" icon={Play}
              rightSlot={
                pattern && (
                  <button onClick={() => { setPattern(''); setError(''); }} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(239,68,68,0.07)', color: 'rgba(239,68,68,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Trash2 size={11} />
                  </button>
                )
              }
            >
              <div style={{ borderBottom: '1px solid var(--border)' }}>
                {/* Row 1: slash + input + slash */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ padding: '10px 10px', fontFamily: '"DM Mono",monospace', fontSize: 18, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>/</span>
                  <input
                    ref={patternRef}
                    className="rt-pattern-input"
                    placeholder="Enter regex pattern…"
                    value={pattern}
                    onChange={e => setPattern(e.target.value)}
                    spellCheck={false}
                  />
                  <span style={{ padding: '10px 10px', fontFamily: '"DM Mono",monospace', fontSize: 18, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>/</span>
                </div>
                {/* Row 2: flags — always visible, wraps naturally */}
                <div style={{ display: 'flex', gap: 4, padding: '6px 12px 8px', borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                  {Object.entries(FLAG_INFO).map(([f, info]) => (
                    <button key={f} onClick={() => toggleFlag(f)} title={info.title} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', height: 28, borderRadius: 7,
                      border: `1px solid ${flags.includes(f) ? 'var(--accent-blue,#2563eb)' : 'var(--border)'}`,
                      background: flags.includes(f) ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.04)',
                      color: flags.includes(f) ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
                      fontFamily: '"DM Mono",monospace', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.13s', whiteSpace: 'nowrap',
                    }}>
                      <span>{f}</span>
                      {!isDesktop && <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.6 }}>{info.title.split(' — ')[0]}</span>}
                    </button>
                  ))}
                  {/* Valid badge inline with flags */}
                  {!error && pattern && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#10b981', marginLeft: 'auto' }}>
                      <CheckCircle2 size={11} /> Valid
                    </span>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: 12 }}>
                  <AlertCircle size={13} /><span style={{ fontFamily: '"DM Mono",monospace' }}>{error}</span>
                </div>
              )}
            </Panel>

            {/* Test string */}
            <Panel title="Test String"
              rightSlot={
                testString && <button onClick={() => setTestString('')} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(239,68,68,0.07)', color: 'rgba(239,68,68,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }}><Trash2 size={11} /></button>
              }
            >
              <textarea
                className="rt-textarea"
                value={testString}
                onChange={e => setTestString(e.target.value)}
                placeholder="Paste or type text to test against…"
                spellCheck={false}
              />
            </Panel>

            {/* Highlighted preview */}
            {testString && pattern && !error && (
              <Panel title={`Match Preview — ${matches.length} match${matches.length !== 1 ? 'es' : ''}`}
                rightSlot={
                  <Stat label="matches" value={matches.length} color={matches.length > 0 ? '#10b981' : undefined} />
                }
              >
                <div style={{ padding: '14px 16px', fontFamily: '"DM Mono",monospace', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {highlighted.length === 0 ? (
                    <span style={{ color: 'rgba(255,255,255,0.25)' }}>{testString}</span>
                  ) : (
                    highlighted.map((part, i) => (
                      part.highlight ? (
                        <span key={i} style={{
                          background: MATCH_COLORS[part.colorIdx].bg,
                          borderBottom: `2px solid ${MATCH_COLORS[part.colorIdx].border}`,
                          borderRadius: 3, padding: '1px 2px',
                          color: 'var(--text,#f0f0f5)',
                        }}>{part.text}</span>
                      ) : (
                        <span key={i} style={{ color: 'rgba(240,240,245,0.6)' }}>{part.text}</span>
                      )
                    ))
                  )}
                </div>
              </Panel>
            )}

            {/* Results tabs */}
            {testString && pattern && !error && (
              <Panel title="Results"
                rightSlot={
                  replaceResult && activeTab === 'replace' && (
                    <CopyBtn getText={() => replaceResult} label="Copy result" small />
                  )
                }
              >
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                  {[
                    { id: 'matches',    label: `Matches (${matches.length})` },
                    { id: 'replace',    label: 'Replace' },
                  ].map(({ id, label }) => (
                    <button key={id} className={`rt-tab${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Matches list */}
                {activeTab === 'matches' && (
                  <div className="rt-fadein" style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {matches.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No matches found</div>
                    ) : (
                      matches.slice(0, 100).map((m, i) => (
                        <div key={i} className="rt-match-row">
                          <div style={{ width: 18, height: 18, borderRadius: 5, background: MATCH_COLORS[i % MATCH_COLORS.length].bg, border: `1px solid ${MATCH_COLORS[i % MATCH_COLORS.length].border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: MATCH_COLORS[i % MATCH_COLORS.length].border, flexShrink: 0, marginTop: 2, fontFamily: 'monospace' }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <code style={{ fontSize: 13, fontFamily: '"DM Mono",monospace', color: 'var(--text,#f0f0f5)', wordBreak: 'break-all' }}>{m.match || '(empty)'}</code>
                            <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                pos {m.index}–{m.end} · len {m.match.length}
                              </span>
                              {m.groups.length > 0 && (
                                <span style={{ fontSize: 10, color: '#c4b5fd' }}>
                                  groups: {m.groups.map((g, gi) => `$${gi + 1}="${g}"`).join(', ')}
                                </span>
                              )}
                              {m.namedGroups.length > 0 && (
                                <span style={{ fontSize: 10, color: '#86efac' }}>
                                  {m.namedGroups.map(([k, v]) => `${k}="${v}"`).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <CopyBtn getText={() => m.match} small />
                        </div>
                      ))
                    )}
                    {matches.length > 100 && (
                      <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                        Showing 100 of {matches.length} matches
                      </div>
                    )}
                  </div>
                )}

                {/* Replace tab */}
                {activeTab === 'replace' && (
                  <div className="rt-fadein">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                      <span style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>Replace with</span>
                      <input
                        value={replaceWith}
                        onChange={e => setReplaceWith(e.target.value)}
                        placeholder="Replacement string… ($1 for group 1)"
                        style={{ flex: 1, padding: '8px 12px', background: 'transparent', border: 'none', outline: 'none', fontFamily: '"DM Mono",monospace', fontSize: 13, color: 'var(--text,#f0f0f5)' }}
                        spellCheck={false}
                      />
                    </div>
                    <div style={{ padding: '14px 16px', fontFamily: '"DM Mono",monospace', fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflowY: 'auto', color: 'var(--text,#f0f0f5)' }}>
                      {replaceResult || <span style={{ color: 'rgba(255,255,255,0.2)' }}>Result will appear here…</span>}
                    </div>
                  </div>
                )}
              </Panel>
            )}

            {/* Mobile cheatsheet */}
            {!isDesktop && (
              <Panel title="Reference" icon={BookOpen}>
                {CHEAT_SHEET.map(sec => (
                  <CheatSection key={sec.cat} cat={sec.cat} items={sec.items} onInsert={insertPattern} />
                ))}
              </Panel>
            )}
          </div>

          {/* ═══ RIGHT SIDEBAR ═══ */}
          {isDesktop && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Quick patterns */}
              <Panel title="Quick Patterns" icon={Play}>
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {QUICK_PATTERNS.map(qp => (
                    <button key={qp.label} onClick={() => loadQuick(qp)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                      background: 'transparent', border: '1px solid transparent',
                      fontFamily: 'inherit', transition: 'all 0.12s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text,#f0f0f5)' }}>{qp.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', fontFamily: '"DM Mono",monospace', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>{qp.flags}</span>
                    </button>
                  ))}
                </div>
              </Panel>

              {/* Cheat sheet */}
              <Panel title="Reference" icon={BookOpen}>
                {CHEAT_SHEET.map(sec => (
                  <CheatSection key={sec.cat} cat={sec.cat} items={sec.items} onInsert={insertPattern} />
                ))}
              </Panel>

            </div>
          )}
        </div>
      </div>
    </>
  );
}