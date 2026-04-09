import { useState, useEffect, useCallback } from 'react';
import {
  Copy, Check, Download, Trash2, ArrowLeftRight,
  Minimize2, Maximize2, Eye, AlertCircle, FileCode,
  Wand2, Layers
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

/* ─── CSS Minifier ───────────────────────────────────────── */
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/0(px|em|rem|%)/g, '0')
    .replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3/g, '#$1$2$3')
    .replace(/\s*!important/g, '!important')
    .trim();
}

/* ─── CSS Beautifier ─────────────────────────────────────── */
function beautifyCss(css, indentSize = 2) {
  const indent = ' '.repeat(indentSize);
  let result = '';
  let depth = 0;
  let inComment = false;
  let i = 0;

  // Strip extra whitespace first
  const cleaned = css.replace(/\s+/g, ' ').trim();

  for (i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (!inComment && ch === '/' && next === '*') {
      result += '\n' + indent.repeat(depth) + '/*';
      inComment = true;
      i++;
      continue;
    }
    if (inComment && ch === '*' && next === '/') {
      result += '*/\n';
      inComment = false;
      i++;
      continue;
    }
    if (inComment) { result += ch; continue; }

    if (ch === '{') {
      result += ' {\n';
      depth++;
      result += indent.repeat(depth);
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      result = result.trimEnd();
      result += '\n' + indent.repeat(depth) + '}\n\n';
    } else if (ch === ';') {
      result += ';\n' + indent.repeat(depth);
    } else if (ch === ':' && cleaned[i - 1] !== '&') {
      result += ': ';
      // skip space after colon if present
      if (next === ' ') i++;
    } else {
      result += ch;
    }
  }

  return result
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\{\s*\n\s*\}/g, '{}')
    .trim();
}

/* ─── CSS Linter (basic) ─────────────────────────────────── */
function lintCss(css) {
  const issues = [];
  const lines = css.split('\n');

  lines.forEach((line, i) => {
    const ln = i + 1;
    const t = line.trim();
    if (!t || t.startsWith('/*')) return;

    // Missing semicolons (property lines not ending in ; { })
    if (/^[a-z-]+\s*:/.test(t) && !/[;{},]$/.test(t) && !t.endsWith('*/')) {
      issues.push({ line: ln, type: 'warning', msg: 'Possible missing semicolon' });
    }
    // Duplicate declarations (basic)
    if (/^[a-z-]+\s*:/.test(t)) {
      const prop = t.split(':')[0].trim();
      const earlier = lines.slice(0, i).findIndex(l => l.trim().startsWith(prop + ':'));
      if (earlier >= 0) {
        issues.push({ line: ln, type: 'info', msg: `Duplicate property: "${prop}" (also on line ${earlier + 1})` });
      }
    }
    // !important overuse
    if (t.includes('!important')) {
      issues.push({ line: ln, type: 'info', msg: '!important — consider specificity instead' });
    }
    // Browser prefixes
    if (/^-webkit-|-moz-|-ms-|-o-/.test(t)) {
      issues.push({ line: ln, type: 'info', msg: 'Vendor prefix — may not be needed for modern browsers' });
    }
    // Zero units
    if (/:\s*0(px|em|rem|%)/.test(t)) {
      issues.push({ line: ln, type: 'hint', msg: `Can remove unit from 0 value (e.g. "0" not "0px")` });
    }
  });

  return issues;
}

/* ─── CSS stats ──────────────────────────────────────────── */
function getCssStats(css) {
  if (!css.trim()) return null;
  const selectors = (css.match(/[^{}]+(?=\s*\{)/g) || []).filter(s => !s.trim().startsWith('@') && !s.trim().startsWith('/*')).length;
  const properties = (css.match(/[a-z-]+\s*:/g) || []).length;
  const rules = (css.match(/\{[^{}]*\}/g) || []).length;
  const mediaQueries = (css.match(/@media/g) || []).length;
  const comments = (css.match(/\/\*[\s\S]*?\*\//g) || []).length;
  return { selectors, properties, rules, mediaQueries, comments };
}

/* ─── Syntax highlighting ────────────────────────────────── */
function highlightCss(code) {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="css-comment">$1</span>')
    .replace(/(@[\w-]+)/g, '<span class="css-atrule">$1</span>')
    .replace(/([.#]?[\w-]+)\s*(?=\{)/g, '<span class="css-selector">$1</span>')
    .replace(/([\w-]+)\s*(?=:)/g, '<span class="css-prop">$1</span>')
    .replace(/:\s*([^;{}\n]+)/g, (m, v) => `: <span class="css-val">${v}</span>`)
    .replace(/(#[0-9a-fA-F]{3,6})/g, (m) => `<span class="css-color" style="border-bottom:2px solid ${m}">${m}</span>`);
}

/* ─── Reusable UI ────────────────────────────────────────── */
function Panel({ title, icon: Icon, rightSlot, children }) {
  return (
    <div style={{ background: 'var(--surface-raised,#18181f)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)', flexShrink: 0 }}>
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

function Stat({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize: 12, fontWeight: 800, fontFamily: '"DM Mono",monospace', color: highlight ? '#10b981' : 'var(--text,#f0f0f5)' }}>{value}</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

const SAMPLE_CSS = `/* Navigation styles */
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0px 24px;
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  -webkit-box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.navbar__logo {
  font-size: 1.5rem;
  font-weight: 700 !important;
  color: #2563eb;
}

.navbar__link {
  color: #333333;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 6px;
  transition: background 0.2s;
}

.navbar__link:hover {
  background-color: #f0f0f5;
  color: #2563eb;
}

@media (max-width: 768px) {
  .navbar {
    flex-direction: column;
    padding: 16px;
  }
}`;

/* ══ Main Component ══════════════════════════════════════════ */
export default function CssMinifier() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [input, setInput]       = useState('');
  const [mode, setMode]         = useState('minify');   // 'minify' | 'beautify'
  const [indentSize, setIndentSize] = useState(2);
  const [highlight, setHighlight] = useState(true);
  const [showLint, setShowLint] = useState(true);
  const [activeTab, setActiveTab] = useState('output'); // 'output' | 'lint' | 'stats'

  const output = useCallback(() => {
    if (!input.trim()) return '';
    return mode === 'minify' ? minifyCss(input) : beautifyCss(input, indentSize);
  }, [input, mode, indentSize])();

  const lintIssues = useCallback(() => lintCss(input), [input])();
  const cssStats   = useCallback(() => getCssStats(input), [input])();

  const originalBytes  = new Blob([input]).size;
  const outputBytes    = output ? new Blob([output]).size : 0;
  const savedPct       = originalBytes > 0 ? Math.max(0, ((1 - outputBytes / originalBytes) * 100)).toFixed(1) : '0';

  const download = (content, name) => {
    const blob = new Blob([content], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const issueColor = { warning: '#f59e0b', info: '#93c5fd', hint: '#86efac' };
  const issueLabel = { warning: 'Warn', info: 'Info', hint: 'Hint' };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .cm * { box-sizing: border-box; }
        .cm { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }

        .cm-textarea {
          width:100%; min-height:380px; padding:16px 18px;
          background:transparent; border:none; resize:vertical; outline:none;
          font-family:'DM Mono',monospace; font-size:13px; line-height:1.7;
          color:var(--text,#f0f0f5); tab-size:2;
        }
        .cm-textarea::placeholder { color:rgba(255,255,255,0.2); }

        .cm-output {
          padding:16px 18px; min-height:380px; overflow:auto;
          font-family:'DM Mono',monospace; font-size:13px; line-height:1.7;
          white-space:pre-wrap; word-break:break-all; color:var(--text,#f0f0f5);
        }

        .css-comment { color:#6b7280; font-style:italic; }
        .css-atrule  { color:#f59e0b; font-weight:600; }
        .css-selector{ color:#c4b5fd; font-weight:600; }
        .css-prop    { color:#93c5fd; }
        .css-val     { color:#86efac; }
        .css-color   { font-weight:600; }

        .cm-tab {
          display:flex; align-items:center; gap:5px;
          padding:7px 12px; border-bottom:2px solid transparent;
          background:transparent; border-top:none; border-left:none; border-right:none;
          color:var(--text-muted); font-family:inherit; font-size:11px; font-weight:700;
          cursor:pointer; transition:all 0.15s; white-space:nowrap;
        }
        .cm-tab.active { color:var(--accent-blue,#2563eb); border-bottom-color:var(--accent-blue,#2563eb); }
        .cm-tab:hover:not(.active) { color:var(--text,#f0f0f5); }

        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .cm-fadein { animation:fadeIn 0.2s ease both; }
      `}</style>

      <div className="cm">
        {/* ── Top controls ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>

          {/* Mode toggle */}
          <div style={{ display: 'flex', background: 'var(--surface,#111118)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 2 }}>
            {[
              { id: 'minify',   label: 'Minify',   icon: Minimize2 },
              { id: 'beautify', label: 'Beautify', icon: Maximize2 },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setMode(id)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: mode === id ? 'var(--accent-blue,#2563eb)' : 'transparent',
                color: mode === id ? '#fff' : 'var(--text-muted)',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <Icon size={13} />{label}
              </button>
            ))}
          </div>

          {/* Beautify indent options */}
          {mode === 'beautify' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Indent</span>
              <div style={{ display: 'flex', background: 'var(--surface,#111118)', border: '1px solid var(--border)', borderRadius: 8, padding: 2, gap: 1 }}>
                {[2, 4].map(n => (
                  <button key={n} onClick={() => setIndentSize(n)} style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none',
                    background: indentSize === n ? 'var(--accent-blue,#2563eb)' : 'transparent',
                    color: indentSize === n ? '#fff' : 'var(--text-muted)',
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}>{n}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Highlight toggle */}
          <button onClick={() => setHighlight(h => !h)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 11px', borderRadius: 8,
            background: highlight ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${highlight ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
            color: highlight ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
            fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <Eye size={11} /> Highlight
          </button>

          {/* Sample */}
          <button onClick={() => setInput(SAMPLE_CSS)} style={{
            padding: '6px 11px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            Sample
          </button>
        </div>

        {/* ── Two panels ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr auto 1fr' : '1fr', gap: isDesktop ? 0 : 12, alignItems: 'start' }}>

          {/* INPUT */}
          <Panel title="CSS Input" icon={FileCode}
            rightSlot={
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {input && (
                  <button onClick={() => setInput('')} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'rgba(239,68,68,0.07)', color: 'rgba(239,68,68,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            }
          >
            <textarea
              className="cm-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`.selector {\n  property: value;\n  color: #2563eb;\n}`}
              spellCheck={false}
            />
            {input && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '7px 12px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                <Stat label="chars" value={input.length.toLocaleString()} />
                <Stat label="bytes" value={`${originalBytes}B`} />
                <Stat label="lines" value={input.split('\n').length} />
                {lintIssues.filter(i => i.type === 'warning').length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '3px 8px' }}>
                    <AlertCircle size={9} /> {lintIssues.filter(i => i.type === 'warning').length} warning{lintIssues.filter(i => i.type === 'warning').length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </Panel>

          {/* Swap arrow — desktop */}
          {isDesktop && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', paddingTop: 48 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface,#111118)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  {mode === 'minify' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </div>
                <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
              </div>
            </div>
          )}

          {/* OUTPUT */}
          <Panel title={mode === 'minify' ? 'Minified Output' : 'Beautified Output'} icon={Wand2}
            rightSlot={
              output && (
                <div style={{ display: 'flex', gap: 5 }}>
                  <CopyBtn getText={() => output} small />
                  <button onClick={() => download(output, mode === 'minify' ? 'style.min.css' : 'style.css')} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }} title="Download">
                    <Download size={12} />
                  </button>
                </div>
              )
            }
          >
            {/* Output tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
              {[
                { id: 'output', label: 'Output', icon: FileCode },
                { id: 'lint',   label: `Lint ${lintIssues.length > 0 ? `(${lintIssues.length})` : ''}`, icon: AlertCircle },
                { id: 'stats',  label: 'Stats',  icon: Layers },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} className={`cm-tab${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}>
                  <Icon size={11} />{label}
                </button>
              ))}
            </div>

            {/* Output content */}
            {activeTab === 'output' && (
              <div className="cm-output">
                {!input ? (
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>Output appears here live…</span>
                ) : highlight ? (
                  <span dangerouslySetInnerHTML={{ __html: highlightCss(output) }} />
                ) : (
                  output
                )}
              </div>
            )}

            {/* Lint tab */}
            {activeTab === 'lint' && (
              <div className="cm-fadein" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 200 }}>
                {!input ? (
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Paste CSS to see lint results.</span>
                ) : lintIssues.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, color: '#10b981', fontSize: 13, fontWeight: 600 }}>
                    ✓ No issues found — clean CSS!
                  </div>
                ) : (
                  lintIssues.map((issue, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 11px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: issueColor[issue.type] + '18', color: issueColor[issue.type], border: `1px solid ${issueColor[issue.type]}33`, flexShrink: 0, alignSelf: 'flex-start', marginTop: 1, whiteSpace: 'nowrap' }}>
                        {issueLabel[issue.type]}
                      </span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginRight: 6 }}>L{issue.line}</span>
                        <span style={{ fontSize: 12, color: 'var(--text,#f0f0f5)' }}>{issue.msg}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Stats tab */}
            {activeTab === 'stats' && (
              <div className="cm-fadein" style={{ padding: '14px', minHeight: 200 }}>
                {!cssStats ? (
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Paste CSS to see stats.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Size comparison */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Stat label="Original"  value={`${originalBytes}B`} />
                      <Stat label="Output"    value={`${outputBytes}B`} />
                      <Stat label="Saved"     value={`${savedPct}%`} highlight={parseFloat(savedPct) > 0} />
                    </div>
                    {/* Compression bar */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Compression</div>
                      <div style={{ height: 6, background: 'var(--surface,#111118)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div style={{ height: '100%', width: `${Math.max(5, 100 - parseFloat(savedPct))}%`, background: 'linear-gradient(90deg,var(--accent-blue,#2563eb),rgba(37,99,235,0.5))', borderRadius: 99, transition: 'width 0.3s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--text-muted)', opacity: 0.5 }}>
                        <span>Output size</span><span>↔</span><span>Original size</span>
                      </div>
                    </div>
                    {/* CSS structure stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {[
                        { l: 'Selectors', v: cssStats.selectors },
                        { l: 'Properties', v: cssStats.properties },
                        { l: 'Rules', v: cssStats.rules },
                        { l: '@media', v: cssStats.mediaQueries },
                        { l: 'Comments', v: cssStats.comments },
                        { l: 'Lines', v: input.split('\n').length },
                      ].map(({ l, v }) => (
                        <div key={l} style={{ padding: '8px 10px', background: 'var(--surface,#111118)', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: '"DM Mono",monospace', color: 'var(--text,#f0f0f5)' }}>{v}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Output footer */}
            {output && activeTab === 'output' && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '7px 12px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                <Stat label="chars" value={output.length.toLocaleString()} />
                <Stat label="bytes" value={`${outputBytes}B`} />
                <Stat label="saved" value={`${savedPct}%`} highlight={parseFloat(savedPct) > 0} />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}