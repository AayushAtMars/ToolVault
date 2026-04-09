import { useState, useRef, useCallback , useEffect} from 'react';
import {
  Download,
  FileText,
  X,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { PDFDocument } from 'pdf-lib';

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
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

export default function MergePdf() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage, setStage] = useState('idle'); // idle, ready, merging, done
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [outBlob, setOutBlob] = useState(null);
  
  const inputRef = useRef(null);
  const appendRef = useRef(null);

  const ingest = useCallback(async (newFiles) => {
    setIsReading(true);
    await new Promise(r => setTimeout(r, 50));
    const valid = Array.from(newFiles).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (valid.length === 0) {
      setError('Unsupported file. Please use strictly PDF files.');
      setIsReading(false);
      return;
    }
    setError('');
    setFiles(prev => {
      const updated = [...prev, ...valid];
      if (updated.length > 0) setStage('ready');
      return updated;
    });
    setIsReading(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, [ingest]);

  const mergePdfs = async () => {
    if (files.length < 2) {
      setError('Please add at least 2 PDFs to merge.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setStage('merging');
    setError('');
    
    try {
      const mergedPdf = await PDFDocument.create();
      
      for (let i = 0; i < files.length; i++) {
        const arrayBuffer = await files[i].arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      
      const mergedData = await mergedPdf.save();
      const blob = new Blob([mergedData], { type: 'application/pdf' });
      setOutBlob(blob);
      setStage('done');
    } catch (err) {
      console.error('Merge error:', err);
      setError('Failed to merge PDFs. The files might be corrupted or encrypted.');
      setStage('ready');
    }
  };

  const forceDownload = () => {
    if (!outBlob) return;
    const url = URL.createObjectURL(outBlob);
    
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    // Set target to _self and use download attribute to force browser download
    link.target = '_self';
    link.setAttribute('download', `merged_${files.length}_files.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const removeFile = (index) => {
    setFiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setStage('idle');
      return next;
    });
  };
  
  const moveUp = (index) => {
    if (index === 0) return;
    setFiles(prev => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr;
    });
  };
  
  const moveDown = (index) => {
    if (index === files.length - 1) return;
    setFiles(prev => {
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      return arr;
    });
  };

  const reset = () => {
    setStage('idle');
    setFiles([]);
    setOutBlob(null);
    setError('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ══ READING OVERLAY ══ */}
      {isReading && (
        <div style={OverlayBase}>
          <div style={SpinnerBig} />
          <div style={{ color:'white', fontWeight:600 }}>Reading PDF...</div>
        </div>
      )}

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
          <input ref={inputRef} type="file" multiple accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.length && ingest(e.target.files)} />
          
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: drag ? 'rgba(37,99,235,0.12)' : 'var(--surface,#111118)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}>
            <Layers size={28} color={drag ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)'} />
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {drag ? 'Drop to upload' : 'Drop PDF files here'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              or <span style={{ color: 'var(--accent-blue,#2563EB)', fontWeight: 500 }}>click to browse</span>
            </div>
          </div>
        </label>
      )}

      {/* ── READY ── */}
      {stage === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Files to Merge ({files.length})
            </h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <input ref={appendRef} type="file" multiple accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => e.target.files?.length && ingest(e.target.files)} />
              <button onClick={() => appendRef.current?.click()} style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Add More
              </button>
              <button 
                onClick={() => { setFiles([]); setStage('idle'); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}
              >
                Clear All
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-raised)', padding: 12, borderRadius: 14, border: '1px solid var(--border)' }}>
            {files.map((file, i) => (
              <div key={`${file.name}-${i}`} style={{
                display: 'flex', alignItems: 'center', padding: '12px 16px',
                background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
                gap: 14
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FileText size={18} color="var(--accent-blue,#2563EB)" />
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{formatBytes(file.size)}</div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => moveUp(i)} disabled={i === 0} style={{ ...ib, opacity: i === 0 ? 0.3 : 1 }} title="Move Up">
                    <ArrowUp size={14} />
                  </button>
                  <button onClick={() => moveDown(i)} disabled={i === files.length - 1} style={{ ...ib, opacity: i === files.length - 1 ? 0.3 : 1 }} title="Move Down">
                    <ArrowDown size={14} />
                  </button>
                  <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
                  <button onClick={() => removeFile(i)} style={ib} title="Remove">
                    <X size={14} color="#ef4444" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={mergePdfs} disabled={files.length < 2} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            padding: '14px 20px', borderRadius: 10, border: 'none', width: '100%',
            background: files.length < 2 ? 'var(--surface-raised)' : 'var(--accent-blue,#2563EB)', 
            color: files.length < 2 ? 'var(--text-muted)' : 'white',
            fontSize: 14, fontWeight: 600, cursor: files.length < 2 ? 'not-allowed' : 'pointer',
            boxShadow: files.length < 2 ? 'none' : '0 4px 14px rgba(37,99,235,0.25)', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { if(files.length >= 2) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => { if(files.length >= 2) e.currentTarget.style.opacity = '1' }}
          >
            <Layers size={16} />
            Merge {files.length} PDFs
          </button>
          {files.length < 2 && (
            <div style={{ fontSize: 12, textAlign: 'center', color: 'var(--text-muted)', marginTop: -4 }}>
              Add at least 2 files to merge.
            </div>
          )}
        </div>
      )}

      {/* ── MERGING ── */}
      {stage === 'merging' && (
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
            <Layers size={24} color="var(--accent-blue,#2563EB)" />
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: '2px solid transparent', borderTopColor: 'var(--accent-blue,#2563EB)',
              animation: 'spin 0.9s linear infinite',
            }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Combining {files.length} PDFs...</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>This usually only takes a moment.</div>
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
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Merge Complete!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Combined {files.length} documents into 1 strictly ready-to-download PDF.
            </div>
            
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
              Download Merged PDF • {formatBytes(outBlob.size)}
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
            <RotateCcw size={13} /> Merge more files
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const OverlayBase = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', backdropFilter: 'blur(4px)' };
const SpinnerBig = { width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 };

const ib = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
};
