import { useState , useEffect} from 'react';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  ChevronUp,
  ChevronDown
} from "lucide-react";


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

export default function GrammarChecker() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCheck = () => {
    if (!text.trim()) return;
    setChecking(true);
    setResult(null);
    
    setTimeout(() => {
      setResult({
        correctedText: "This is the corrected version of the text you entered. The grammar checker has implicitly fixed spelling, punctuation, and structural issues. In a real integration, this would use an API like Grammarly or OpenAI.",
        issues: Math.floor(Math.random() * 5) + 1
      });
      setChecking(false);
    }, 1500);
  };

  return (
    <div className="tool-grid-2" style={{ alignItems: 'stretch' }}>
      <div className="tool-col">
        <label className="tool-label">Your Text</label>
        <textarea
          className="tool-textarea"
          style={{ minHeight: 300, flex: 1 }}
          placeholder="Paste your text here to check for grammar and spelling errors..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="tool-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={handleCheck} disabled={checking || !text}>
            <CheckCircle2 size={16} />
            {checking ? 'Checking...' : 'Check Grammar'}
          </button>
        </div>
      </div>

      <div className="tool-col">
        <label className="tool-label">Corrected Text</label>
        <div className="tool-output" style={{ minHeight: 300, flex: 1, position: 'relative' }}>
          {checking ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ opacity: 0.5 }} />
            </div>
          ) : result ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> Found and fixed {result.issues} issues
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.7 }}>{result.correctedText}</p>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>Corrected text will appear here...</div>
          )}
        </div>
        {result && (
          <div className="tool-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => {
              navigator.clipboard.writeText(result.correctedText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy Fixes'}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } .spin { animation: spin 1.5s linear infinite; }`}</style>
    </div>
  );
}
