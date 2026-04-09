import { useState , useEffect} from 'react';
import {
  ArrowLeftRight,
  Sparkles,
  Copy,
  Check,
  ChevronUp,
  ChevronDown
} from "lucide-react";

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 'Japanese', 'Korean', 'Chinese (Simplified)', 'Hindi', 'Arabic'];


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

export default function AiTranslator() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [sourceLang, setSourceLang] = useState('English');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [copied, setCopied] = useState(false);

  const swap = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(targetText);
    setTargetText(sourceText);
  };

  const handleTranslate = () => {
    if (!sourceText.trim()) return;
    setTranslating(true);
    setTargetText('');
    
    setTimeout(() => {
      setTargetText(`[Translated to ${targetLang}]: Hola, esto es una traducción simulada usando inteligencia artificial. En una aplicación real, se integraría con la API de traducción de Google, DeepL u OpenAI.`);
      setTranslating(false);
    }, 1200);
  };

  return (
    <div>
      <div className="tool-row" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <select className="tool-select" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} style={{ padding: '12px', fontSize: 14 }}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost" onClick={swap} style={{ padding: 12 }}>
          <ArrowLeftRight size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <select className="tool-select" value={targetLang} onChange={(e) => setTargetLang(e.target.value)} style={{ padding: '12px', fontSize: 14 }}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="tool-grid-2" style={{ alignItems: 'stretch' }}>
        <textarea
          className="tool-textarea"
          style={{ minHeight: 240, fontSize: 16, lineHeight: 1.6 }}
          placeholder="Enter text to translate..."
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
        />
        <div className="tool-output" style={{ minHeight: 240, fontSize: 16, lineHeight: 1.6, position: 'relative' }}>
          {translating ? (
            <span style={{ color: 'var(--text-muted)' }}>Translating...</span>
          ) : targetText ? (
            targetText
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Translation will appear here...</span>
          )}
        </div>
      </div>

      <div className="tool-actions" style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={handleTranslate} disabled={translating || !sourceText}>
          <Sparkles size={16} />
          {translating ? 'Translating...' : 'Translate'}
        </button>
        {targetText && (
          <button className="btn btn-ghost" onClick={() => {
            navigator.clipboard.writeText(targetText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
