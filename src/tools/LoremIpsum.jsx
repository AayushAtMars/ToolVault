import { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Check, RefreshCw, FileText, AlignLeft, Type, Hash,
         ChevronDown, Minus, Plus, Download, Eye, EyeOff } from 'lucide-react';

/* ─── Word banks ─────────────────────────────────────────── */
const LOREM_WORDS = [
  'lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit',
  'sed','do','eiusmod','tempor','incididunt','ut','labore','et','dolore',
  'magna','aliqua','enim','ad','minim','veniam','quis','nostrud',
  'exercitation','ullamco','laboris','nisi','aliquip','ex','ea','commodo',
  'consequat','duis','aute','irure','in','reprehenderit','voluptate',
  'velit','esse','cillum','fugiat','nulla','pariatur','excepteur','sint',
  'occaecat','cupidatat','non','proident','sunt','culpa','qui','officia',
  'deserunt','mollit','anim','id','est','laborum','blandit','volutpat',
  'maecenas','accumsan','lacus','vel','facilisis','varius','diam',
];

const HIPSTER_WORDS = [
  'artisan','craft','micro','roast','vinyl','fixie','kombucha','vegan',
  'raw','organic','sustainable','aesthetic','curated','minimalist','bespoke',
  'handcrafted','authentic','heritage','farmhouse','forage','heirloom',
  'asymmetrical','distillery','mixtape','typewriter','polaroid','tattooed',
  'quinoa','chia','kale','sriracha','coloring','gastropub','truffaut',
  'kitsch','hoodie','synth','portland','brooklyn','austin','echo','park',
];

const TECH_WORDS = [
  'algorithm','bandwidth','binary','blockchain','cache','cloud','compiler',
  'container','daemon','database','debug','deploy','docker','endpoint',
  'framework','function','gateway','hash','interface','iterate','kernel',
  'lambda','latency','library','microservice','middleware','module','mutex',
  'namespace','node','oauth','pipeline','proxy','query','recursion',
  'refactor','regex','render','repository','runtime','schema','server',
  'socket','stack','syntax','terminal','token','typescript','webhook',
];

const WORD_BANKS = {
  lorem:   { label: 'Lorem Ipsum', words: LOREM_WORDS },
  hipster: { label: 'Hipster',     words: HIPSTER_WORDS },
  tech:    { label: 'Tech',        words: TECH_WORDS },
};

/* ─── Generation helpers ─────────────────────────────────── */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeSentence(words, len) {
  const w = Array.from({ length: len }, () => pick(words));
  w[0] = w[0][0].toUpperCase() + w[0].slice(1);
  return w.join(' ') + '.';
}

function makeParagraph(words, sentMin, sentMax) {
  const n = sentMin + Math.floor(Math.random() * (sentMax - sentMin + 1));
  return Array.from({ length: n }, () =>
    makeSentence(words, 6 + Math.floor(Math.random() * 9))
  ).join(' ');
}

function generateText({ count, type, bank, startWithLorem }) {
  const words = WORD_BANKS[bank].words;
  if (type === 'words') {
    const w = Array.from({ length: count }, () => pick(words));
    if (startWithLorem && bank === 'lorem') w[0] = 'Lorem'; w[1] = 'ipsum';
    return w.join(' ');
  }
  if (type === 'sentences') {
    const sents = Array.from({ length: count }, () =>
      makeSentence(words, 6 + Math.floor(Math.random() * 9))
    );
    if (startWithLorem && bank === 'lorem') sents[0] = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
    return sents.join(' ');
  }
  // paragraphs
  const paras = Array.from({ length: count }, () => makeParagraph(words, 3, 6));
  if (startWithLorem && bank === 'lorem') {
    paras[0] = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
  }
  return paras.join('\n\n');
}

function countStats(text) {
  if (!text) return { chars: 0, words: 0, sentences: 0, paragraphs: 0 };
  return {
    chars:      text.length,
    words:      text.trim() ? text.trim().split(/\s+/).length : 0,
    sentences:  (text.match(/[.!?]+/g) || []).length,
    paragraphs: text.trim() ? text.trim().split(/\n\n+/).length : 0,
  };
}

/* ─── useWidth hook ──────────────────────────────────────── */
function useWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

/* ─── Stepper input ──────────────────────────────────────── */
function Stepper({ value, onChange, min = 1, max = 50 }) {
  // Local string so the user can type freely without the cursor jumping.
  // We only call onChange (which clamps) on blur or − / + clicks.
  const [raw, setRaw] = useState(String(value));

  // Keep raw in sync when parent updates value via +/- buttons
  useEffect(() => { setRaw(String(value)); }, [value]);

  const commit = (str) => {
    const n = parseInt(str, 10);
    const clamped = isNaN(n) ? min : Math.max(min, Math.min(max, n));
    setRaw(String(clamped));
    onChange(clamped);
  };

  const btnStyle = {
    width: 36, height: 40, border: 'none', background: 'transparent',
    color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
    fontFamily: 'inherit', flexShrink: 0,
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: 'var(--surface,#111118)', border: '1px solid var(--border)',
      borderRadius: 9, overflow: 'hidden',
    }}>
      <button
        onClick={() => { const next = Math.max(min, value - 1); setRaw(String(next)); onChange(next); }}
        style={btnStyle}
        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
        onMouseLeave={e => e.currentTarget.style.background='transparent'}
      ><Minus size={12}/></button>

      <input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={e => setRaw(e.target.value)}           // just update string, no clamping
        onBlur={() => commit(raw)}                        // clamp only on blur
        onKeyDown={e => { if (e.key === 'Enter') { commit(raw); e.currentTarget.blur(); } }}
        onFocus={e => e.currentTarget.select()}           // select all on focus for easy replace
        style={{
          width: 72, textAlign: 'center', background: 'transparent',
          border: 'none',
          borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
          color: 'var(--text,#f0f0f5)', fontSize: 13, fontWeight: 700,
          fontFamily: '"DM Mono", monospace', outline: 'none', padding: '9px 0',
        }}
      />

      <button
        onClick={() => { const next = Math.min(max, value + 1); setRaw(String(next)); onChange(next); }}
        style={btnStyle}
        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
        onMouseLeave={e => e.currentTarget.style.background='transparent'}
      ><Plus size={12}/></button>
    </div>
  );
}

/* ─── Stat pill ──────────────────────────────────────────── */
function Stat({ label, value }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 14px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, minWidth: 60,
    }}>
      <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text,#f0f0f5)', fontFamily: '"DM Mono", monospace', letterSpacing: '-0.5px' }}>{value.toLocaleString()}</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: 1 }}>{label}</span>
    </div>
  );
}

/* ─── Section panel ──────────────────────────────────────── */
function Panel({ title, children }) {
  return (
    <div style={{ background: 'var(--surface-raised,#18181f)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
      {title && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{title}</div>}
      {children}
    </div>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function LoremIpsum() {
  const vw = useWidth();
  const isDesktop = vw >= 900;

  const [count, setCount]             = useState(3);
  const [type, setType]               = useState('paragraphs');
  const [bank, setBank]               = useState('lorem');
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [htmlTags, setHtmlTags]       = useState(false);
  const [output, setOutput]           = useState('');
  const [copied, setCopied]           = useState(false);
  const [preview, setPreview]         = useState(true);
  const [generated, setGenerated]     = useState(false);

  const stats = countStats(output);

  const generate = useCallback(() => {
    let text = generateText({ count, type, bank, startWithLorem });
    if (htmlTags && type === 'paragraphs') {
      text = text.split('\n\n').map(p => `<p>${p}</p>`).join('\n');
    }
    setOutput(text);
    setGenerated(true);
  }, [count, type, bank, startWithLorem, htmlTags]);

  // Auto-generate on first load
  useEffect(() => { generate(); }, []);

  const copy = () => {
    navigator.clipboard.writeText(output).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `lorem-ipsum.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const typeOptions = [
    { id: 'paragraphs', label: 'Paragraphs', icon: AlignLeft },
    { id: 'sentences',  label: 'Sentences',  icon: FileText },
    { id: 'words',      label: 'Words',      icon: Type },
  ];

  /* ─── Sidebar controls ─── */
  const Controls = () => (
    <>
      {/* Type */}
      <Panel title="Output Type">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {typeOptions.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setType(id)} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${type === id ? 'var(--accent-blue,#2563eb)' : 'var(--border)'}`,
              background: type === id ? 'rgba(37,99,235,0.1)' : 'var(--surface,#111118)',
              color: type === id ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s', textAlign: 'left',
            }}>
              <Icon size={13}/>
              {label}
            </button>
          ))}
        </div>
      </Panel>

      {/* Count */}
      <Panel title={`Count — ${type}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Stepper value={count} onChange={setCount} min={1} max={type === 'words' ? 500 : type === 'sentences' ? 100 : 20}/>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>
            max {type === 'words' ? 500 : type === 'sentences' ? 100 : 20}
          </span>
        </div>
      </Panel>

      {/* Word bank */}
      <Panel title="Word Bank">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
          {Object.entries(WORD_BANKS).map(([id, { label }]) => (
            <button key={id} onClick={() => setBank(id)} style={{
              padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${bank === id ? 'var(--accent-blue,#2563eb)' : 'var(--border)'}`,
              background: bank === id ? 'rgba(37,99,235,0.1)' : 'var(--surface,#111118)',
              color: bank === id ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
              fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>
      </Panel>

      {/* Options */}
      <Panel title="Options">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { id: 'lorem', label: 'Start with "Lorem ipsum"', value: startWithLorem, set: setStartWithLorem, disabled: bank !== 'lorem' },
            { id: 'html',  label: 'Wrap in <p> HTML tags',   value: htmlTags,       set: setHtmlTags,       disabled: type !== 'paragraphs' },
          ].map(({ id, label, value, set, disabled }) => (
            <label key={id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.4 : 1,
            }}>
              <div onClick={() => !disabled && set(v => !v)} style={{
                width: 36, height: 20, borderRadius: 99,
                background: value && !disabled ? 'var(--accent-blue,#2563eb)' : 'var(--surface,#111118)',
                border: `1px solid ${value && !disabled ? 'var(--accent-blue,#2563eb)' : 'var(--border)'}`,
                position: 'relative', cursor: disabled ? 'default' : 'pointer',
                transition: 'all 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 2,
                  left: value && !disabled ? 18 : 2,
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}/>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
            </label>
          ))}
        </div>
      </Panel>

      {/* Generate button */}
      <button onClick={generate} style={{
        width: '100%', padding: '13px', borderRadius: 10,
        background: 'var(--accent-blue,#2563eb)', color: '#fff',
        border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, boxShadow: '0 4px 16px rgba(37,99,235,0.35)', transition: 'all 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.background='#1d4ed8'; e.currentTarget.style.transform='translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='var(--accent-blue,#2563eb)'; e.currentTarget.style.transform='translateY(0)'; }}
      >
        <RefreshCw size={15}/>
        Generate
      </button>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        .li-root * { box-sizing: border-box; }
        .li-root { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }
        .li-root input[type=number]::-webkit-inner-spin-button,
        .li-root input[type=number]::-webkit-outer-spin-button { opacity: 0; }
        .li-output {
          width: 100%; padding: 20px;
          background: var(--surface,#111118);
          border: 1px solid var(--border); border-radius: 12;
          color: var(--text,#f0f0f5);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; line-height: 1.85;
          outline: none; resize: vertical;
          min-height: 320px;
          white-space: pre-wrap; overflow-y: auto;
        }
        .li-html-preview p { margin: 0 0 1em; }
        .li-html-preview p:last-child { margin: 0; }
        @keyframes fadeSlideIn {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .li-fadein { animation: fadeSlideIn 0.25s ease both; }
      `}</style>

      <div className="li-root">
        <div style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? '1fr 280px' : '1fr',
          gap: 20, alignItems: 'start',
        }}>

          {/* ═══ LEFT — Output area ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Output toolbar */}
            {output && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Stats */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Stat label="Chars"  value={stats.chars}/>
                  <Stat label="Words"  value={stats.words}/>
                  {type !== 'words' && <Stat label="Sents" value={stats.sentences}/>}
                  {type === 'paragraphs' && <Stat label="Paras" value={stats.paragraphs}/>}
                </div>
                <div style={{ flex: 1 }}/>
                {/* Preview toggle */}
                <button onClick={() => setPreview(p => !p)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontFamily: 'inherit',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {preview ? <Eye size={12}/> : <EyeOff size={12}/>}
                  {preview ? 'Rendered' : 'Raw'}
                </button>
              </div>
            )}

            {/* Output box */}
            {output && (
              <div className="li-fadein" key={output.slice(0,40)}>
                {preview && htmlTags ? (
                  <div
                    className="li-output li-html-preview"
                    style={{ padding: 20, background: 'var(--surface,#111118)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, lineHeight: 1.85, maxHeight: 420, overflowY: 'auto' }}
                    dangerouslySetInnerHTML={{ __html: output }}
                  />
                ) : (
                  <textarea
                    className="li-output"
                    value={output}
                    onChange={e => setOutput(e.target.value)}
                    spellCheck={false}
                  />
                )}
              </div>
            )}

            {/* Action bar */}
            {output && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={copy} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 9,
                  background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                  color: copied ? '#10b981' : 'var(--text-muted)',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {copied ? <Check size={13}/> : <Copy size={13}/>}
                  {copied ? 'Copied!' : 'Copy Text'}
                </button>
                <button onClick={download} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 9,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <Download size={13}/> Save .txt
                </button>
                <button onClick={generate} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 9,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <RefreshCw size={13}/> Regenerate
                </button>
              </div>
            )}

            {/* On mobile — controls go below output */}
            {!isDesktop && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <Controls/>
              </div>
            )}
          </div>

          {/* ═══ RIGHT — Sidebar (desktop only) ═══ */}
          {isDesktop && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Controls/>
            </div>
          )}
        </div>
      </div>
    </>
  );
}