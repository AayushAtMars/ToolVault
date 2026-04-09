import { useState, useRef , useEffect} from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Trash2,
  Upload,
  FileText,
  AlignLeft,
  List,
  ChevronDown,
  RotateCcw,
  AlertCircle,
  ChevronUp
} from "lucide-react";

const SUMMARY_MODES = [
  {
    id: 'concise',
    label: 'Concise',
    icon: '⚡',
    desc: '2–3 sentence overview',
    prompt: 'Summarize the following text in 2-3 clear, concise sentences. Focus only on the most critical points.',
  },
  {
    id: 'detailed',
    label: 'Detailed',
    icon: '📋',
    desc: 'Full breakdown with key points',
    prompt: 'Provide a detailed summary of the following text. Include the main argument, key supporting points, and any important conclusions. Use clear paragraphs.',
  },
  {
    id: 'bullets',
    label: 'Bullet Points',
    icon: '•',
    desc: 'Scannable list format',
    prompt: 'Summarize the following text as a structured bullet-point list. Start with one sentence overview, then list the key points using "• " as bullets. Be concise per point.',
  },
  {
    id: 'eli5',
    label: 'Simple',
    icon: '🙂',
    desc: 'Plain language, easy to read',
    prompt: 'Summarize the following text in very simple, plain language that anyone can understand. Avoid jargon. Keep it short and friendly.',
  },
  {
    id: 'tldr',
    label: 'TL;DR',
    icon: '⏱',
    desc: 'One-line bottom line',
    prompt: 'Give a single-sentence TL;DR summary of the following text. Start with "TL;DR:" and keep it under 25 words.',
  },
];

const TONE_OPTIONS = [
  { value: 'neutral',      label: 'Neutral' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual',       label: 'Casual' },
  { value: 'academic',     label: 'Academic' },
];

function countWords(str) {
  return str.trim() ? str.trim().split(/\s+/).length : 0;
}
function countChars(str) {
  return str.length;
}
function readingTime(str) {
  const words = countWords(str);
  const mins = Math.ceil(words / 200);
  return mins <= 1 ? '< 1 min' : `~${mins} min`;
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

export default function AiSummarizer() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [text, setText]         = useState('');
  const [summary, setSummary]   = useState('');
  const [mode, setMode]         = useState('concise');
  const [tone, setTone]         = useState('neutral');
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(false);
  const [error, setError]       = useState('');
  const [streamText, setStream] = useState('');
  const fileRef                 = useRef(null);
  const abortRef                = useRef(null);

  const selectedMode = SUMMARY_MODES.find(m => m.id === mode);
  const wordCount    = countWords(text);
  const charCount    = countChars(text);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText(ev.target.result);
    reader.readAsText(file);
  };

  const handleSummarize = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setSummary('');
    setStream('');
    setError('');

    const toneInstruction = tone !== 'neutral'
      ? ` Write in a ${tone} tone.`
      : '';

    const systemPrompt = `You are an expert summarizer. ${selectedMode.prompt}${toneInstruction} Output only the summary — no preamble, no "Here is a summary:", just the summary itself.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          stream: false,
          system: systemPrompt,
          messages: [{ role: 'user', content: text.trim() }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const result = data?.content?.[0]?.text || '';
      setSummary(result);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setText('');
    setSummary('');
    setError('');
    setStream('');
  };

  const displaySummary = streamText || summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── MODE SELECTOR ── */}
      <div>
        <label style={labelStyle}>Summary Style</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SUMMARY_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setSummary(''); setError(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 100,
                border: `1px solid ${mode === m.id ? 'var(--accent-blue, #2563EB)' : 'var(--border)'}`,
                background: mode === m.id ? 'rgba(37,99,235,0.1)' : 'transparent',
                color: mode === m.id ? 'var(--accent-blue, #2563EB)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: mode === m.id ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 14 }}>{m.icon}</span>
              {m.label}
              <span style={{
                fontSize: 10,
                opacity: 0.7,
                display: mode === m.id ? 'inline' : 'none',
              }}>— {m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TONE + OPTIONS ROW ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Tone:</label>
          <div style={{ position: 'relative' }}>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              style={{
                ...inputBase,
                padding: '7px 32px 7px 12px',
                appearance: 'none',
                fontSize: 13,
                cursor: 'pointer',
                minWidth: 130,
              }}
            >
              {TONE_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown size={13} style={{
              position: 'absolute', right: 10, top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Upload TXT button */}
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hover, #ffffff22)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <Upload size={13} />
          Import .txt
        </button>
        <input ref={fileRef} type="file" accept=".txt,.md" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* LEFT: INPUT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} /> Original Text
            </label>
            {text && (
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                <span>{wordCount.toLocaleString()} words</span>
                <span>·</span>
                <span>{charCount.toLocaleString()} chars</span>
                <span>·</span>
                <span>{readingTime(text)} read</span>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setSummary(''); setError(''); }}
              placeholder="Paste your article, document, or any long text here…&#10;&#10;Supports up to ~50,000 characters."
              style={{
                ...inputBase,
                minHeight: 320,
                resize: 'vertical',
                fontSize: 14,
                lineHeight: 1.65,
                padding: '14px',
              }}
            />
            {text && (
              <button
                onClick={handleClear}
                title="Clear"
                style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'var(--surface-raised, #18181f)',
                  border: '1px solid var(--border)',
                  borderRadius: 6, padding: '4px 6px',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Summarize CTA */}
          <button
            onClick={loading ? handleStop : handleSummarize}
            disabled={!loading && !text.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 20px', borderRadius: 9, border: 'none',
              background: loading
                ? 'rgba(239,68,68,0.15)'
                : (!text.trim() ? 'var(--surface-raised, #18181f)' : 'var(--accent-blue, #2563EB)'),
              color: loading
                ? '#ef4444'
                : (!text.trim() ? 'var(--text-muted)' : 'white'),
              fontSize: 14, fontWeight: 600, cursor: text.trim() || loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              border: loading ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                Stop generating
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Summarize with AI
              </>
            )}
          </button>
        </div>

        {/* RIGHT: OUTPUT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} /> AI Summary
            </label>
            {displaySummary && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                {countWords(displaySummary)} words
              </div>
            )}
          </div>

          {/* Output box */}
          <div style={{
            minHeight: 320,
            background: 'var(--surface-raised, #18181f)',
            border: `1px solid ${error ? 'rgba(239,68,68,0.35)' : 'var(--border)'}`,
            borderRadius: 10,
            padding: 14,
            fontSize: 14,
            lineHeight: 1.75,
            color: displaySummary ? 'var(--text)' : 'var(--text-muted)',
            position: 'relative',
            transition: 'border-color 0.2s',
          }}>
            {/* Loading shimmer */}
            {loading && !displaySummary && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18, animation: 'pulse 1.2s ease-in-out infinite' }}>✨</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analyzing and summarizing…</span>
                </div>
                {[90, 75, 82, 60].map((w, i) => (
                  <div key={i} style={{
                    height: 14, borderRadius: 6,
                    width: `${w}%`,
                    background: 'var(--border)',
                    animation: `pulse 1.4s ease-in-out ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: 14, borderRadius: 8,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>Error</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{error}</div>
                </div>
              </div>
            )}

            {/* Summary text */}
            {!loading && !error && displaySummary && (
              <div style={{ whiteSpace: 'pre-wrap' }}>{displaySummary}</div>
            )}

            {/* Empty state */}
            {!loading && !error && !displaySummary && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 10, opacity: 0.5,
              }}>
                <AlignLeft size={28} style={{ opacity: 0.4 }} />
                <div style={{ fontSize: 13, textAlign: 'center' }}>
                  Your summary will<br />appear here
                </div>
              </div>
            )}
          </div>

          {/* Summary actions */}
          {displaySummary && !loading && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCopy} style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 8,
                border: `1px solid ${copied ? 'rgba(22,163,74,0.4)' : 'var(--border)'}`,
                background: copied ? 'rgba(22,163,74,0.08)' : 'transparent',
                color: copied ? '#16a34a' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy Summary'}
              </button>
              <button
                onClick={() => { setSummary(''); setStream(''); setError(''); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <RotateCcw size={12} />
                Regenerate
              </button>
            </div>
          )}

          {/* Compression ratio */}
          {displaySummary && text && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--surface-raised, #18181f)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em' }}>COMPRESSION RATIO</div>
                <div style={{
                  height: 4, background: 'var(--border)', borderRadius: 100, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 100,
                    width: `${Math.min(100, (countWords(displaySummary) / countWords(text)) * 100)}%`,
                    background: 'var(--accent-blue, #2563EB)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
              <div style={{
                fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--accent-blue, #2563EB)',
              }}>
                {Math.round((1 - countWords(displaySummary) / countWords(text)) * 100)}% shorter
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }
        textarea:focus, select:focus { 
          outline: none; 
          border-color: var(--accent-blue, #2563EB) !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }
      `}</style>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────
const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted, #6b6b80)',
  marginBottom: 6,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const inputBase = {
  width: '100%',
  background: 'var(--surface-raised, #18181f)',
  border: '1px solid var(--border)',
  borderRadius: 9,
  color: 'var(--text, #f0f0f5)',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  resize: 'none',
};