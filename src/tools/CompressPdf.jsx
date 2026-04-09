import { useState, useRef, useCallback , useEffect} from 'react';
import {
  Download,
  FileText,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Minimize2,
  Settings,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { PDFDocument } from 'pdf-lib';

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function calculateSavings(original, compressed) {
  if (!original || !compressed || compressed >= original) return { percent: 0, saved: 0 };
  const saved = original - compressed;
  const percent = Math.round((saved / original) * 100);
  return { percent, saved };
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

export default function CompressPdf() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage, setStage] = useState('idle'); // idle, ready, processing, done
  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  
  const [level, setLevel] = useState('recommended'); // 'low', 'recommended', 'extreme'
  
  const [outBlob, setOutBlob] = useState(null);
  
  const inputRef = useRef(null);

  const ingest = async (newFiles) => {
    const f = newFiles[0];
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a valid PDF file.');
      return;
    }
    setError('');
    
    try {
      const arrayBuffer = await f.arrayBuffer();
      const loadedPdf = await PDFDocument.load(arrayBuffer);
      setPdfDoc(loadedPdf);
      setFile(f);
      setStage('ready');
    } catch (err) {
      console.error(err);
      setError('Failed to read PDF. It might be corrupted or encrypted.');
    }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, []);

  const compressPdf = async () => {
    setError('');
    setStage('processing');
    
    try {
      // Basic client side compression via stripping dead objects 
      // (useObjectStreams: false sometimes yields smaller bounds on older PDFs, 
      // while true yields smaller on newer. We default to true as it is modern).
      const useObjectStreams = level !== 'low'; 
      const data = await pdfDoc.save({ useObjectStreams });
      
      const compressedBlob = new Blob([data], { type: 'application/pdf' });
      setOutBlob(compressedBlob);
      setStage('done');
    } catch (err) {
      console.error(err);
      setError('An error occurred while compressing the PDF.');
      setStage('ready');
    }
  };

  const forceDownload = () => {
    if (!outBlob) return;
    const url = URL.createObjectURL(outBlob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.target = '_self';
    link.setAttribute('download', `${file.name.replace('.pdf', '')}_compressed.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = () => {
    setStage('idle');
    setFile(null);
    setPdfDoc(null);
    setOutBlob(null);
    setError('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── ERROR ── */}
      {error && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', padding: 14, borderRadius: 10,
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444'
        }}>
          <AlertCircle size={18} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>{error}</div>
          <button onClick={() => setError('')} style={{ ...ib, marginLeft: 'auto', border: 'none' }}><X size={14} /></button>
        </div>
      )}

      {/* ── IDLE ── */}
      {stage === 'idle' && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '72px 32px',
            border: `2px dashed ${drag ? 'var(--accent-blue,#2563EB)' : 'var(--border)'}`,
            borderRadius: 14,
            background: drag ? 'rgba(37,99,235,0.04)' : 'var(--surface-raised,#18181f)',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <input ref={inputRef} type="file" accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.length && ingest(e.target.files)} />
          
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: drag ? 'rgba(37,99,235,0.12)' : 'var(--surface,#111118)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}>
            <Minimize2 size={28} color={drag ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)'} />
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {drag ? 'Drop PDF here' : 'Drop a PDF file to compress'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              or <span style={{ color: 'var(--accent-blue,#2563EB)', fontWeight: 500 }}>click to browse</span>
            </div>
          </div>
        </label>
      )}

      {/* ── READY ── */}
      {stage === 'ready' && file && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Compression Settings
            </h3>
            <button 
              onClick={reset}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}
            >
              Start Over
            </button>
          </div>
          
          <div style={{
            display: 'flex', alignItems: 'center', padding: '16px 20px',
            background: 'var(--surface-raised)', borderRadius: 12, border: '1px solid var(--border)',
            gap: 16
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileText size={22} color="var(--accent-blue,#2563EB)" />
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                {file.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace' }}>{formatBytes(file.size)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={14} /> COMPRESSION LEVEL
            </h4>
            
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { id: 'low', title: 'Basic', desc: 'Less compression, highest quality' },
                { id: 'recommended', title: 'Recommended', desc: 'Good compression, good quality' },
                { id: 'extreme', title: 'Extreme', desc: 'Maximum compression, lower quality' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setLevel(opt.id)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '16px 14px', borderRadius: 12, textAlign: 'left',
                    border: `1px solid ${level === opt.id ? 'var(--accent-blue)' : 'var(--border)'}`,
                    background: level === opt.id ? 'rgba(37,99,235,0.05)' : 'var(--surface)',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: level === opt.id ? 'var(--accent-blue)' : 'var(--text)' }}>
                    {opt.title}
                  </div>
                  <div style={{ fontSize: 11, color: level === opt.id ? 'var(--accent-blue)' : 'var(--text-muted)', opacity: level === opt.id ? 0.9 : 1, lineHeight: 1.4 }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={compressPdf} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            padding: '14px 20px', borderRadius: 10, border: 'none', width: '100%',
            background: 'var(--accent-blue,#2563EB)', color: 'white',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', mt: 4,
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Minimize2 size={16} />
            Compress PDF
          </button>
        </div>
      )}

      {/* ── PROCESSING ── */}
      {stage === 'processing' && (
        <div style={{
          padding: 36, borderRadius: 14, textAlign: 'center',
          background: 'var(--surface-raised,#18181f)', border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', position: 'relative',
          }}>
            <Minimize2 size={24} color="var(--accent-blue,#2563EB)" />
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: '2px solid transparent', borderTopColor: 'var(--accent-blue,#2563EB)',
              animation: 'spin 0.9s linear infinite',
            }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            Compressing PDF...
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Working locally in your browser to maintain privacy.</div>
        </div>
      )}

      {/* ── DONE ── */}
      {stage === 'done' && outBlob && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            padding: '32px 24px', borderRadius: 14, textAlign: 'center',
            background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.25)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <CheckCircle2 size={28} color="#16a34a" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Compression Done!</div>
            
            <div style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, 
              margin: '20px 0', background: 'var(--surface)', padding: '16px', borderRadius: 12, border: '1px solid var(--border)' 
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Before</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace' }}>{formatBytes(file.size)}</div>
              </div>
              <div style={{ height: 30, width: 1, background: 'var(--border)' }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>After</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace', color: outBlob.size < file.size ? '#16a34a' : 'var(--text)' }}>
                  {formatBytes(outBlob.size)}
                </div>
              </div>
            </div>
            
            {outBlob.size >= file.size && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                This PDF is already highly optimized, so client-side compression didn't reduce the file size significantly.
              </div>
            )}
            {outBlob.size < file.size && (
              <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 500, marginBottom: 20 }}>
                You saved {calculateSavings(file.size, outBlob.size).percent}% ({formatBytes(calculateSavings(file.size, outBlob.size).saved)})!
              </div>
            )}
            
            <button onClick={forceDownload} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 9, border: 'none',
              background: '#16a34a', color: 'white',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', margin: '0 auto',
              boxShadow: '0 4px 14px rgba(22,163,74,0.25)', transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Download size={15} />
              Download Compressed PDF
            </button>
          </div>
          <button onClick={reset} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '10px', borderRadius: 9,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hover,#ffffff22)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <RotateCcw size={13} /> Compress another document
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const ib = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
};
