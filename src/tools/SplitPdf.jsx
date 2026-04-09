import { useState, useRef, useCallback , useEffect} from 'react';
import {
  Download,
  FileText,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Scissors,
  FileArchive,
  Layers,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

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

export default function SplitPdf() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage, setStage] = useState('idle'); // idle, ready, processing, done
  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [isReading, setIsReading] = useState(false);
  
  const [pagesInput, setPagesInput] = useState('');
  const [splitMode, setSplitMode] = useState('extract'); // 'extract' | 'split'
  
  const [outBlob, setOutBlob] = useState(null);
  const [outFilename, setOutFilename] = useState('');
  
  const inputRef = useRef(null);

  const ingest = async (newFiles) => {
    setIsReading(true);
    await new Promise(r => setTimeout(r, 50));
    const f = newFiles[0];
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a valid PDF file.');
      setIsReading(false);
      return;
    }
    setError('');
    
    try {
      const arrayBuffer = await f.arrayBuffer();
      const loadedPdf = await PDFDocument.load(arrayBuffer);
      setPdfDoc(loadedPdf);
      setPageCount(loadedPdf.getPageCount());
      setFile(f);
      setPagesInput(`1-${loadedPdf.getPageCount()}`);
      setStage('ready');
    } catch (err) {
      console.error(err);
      setError('Failed to read PDF. It might be corrupted or encrypted.');
    }
    setIsReading(false);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, []);

  const parsePages = (input, max) => {
    const pages = new Set();
    const parts = input.split(',');
    for (let p of parts) {
      p = p.trim();
      if (!p) continue;
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(n => parseInt(n.trim(), 10));
        if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > max) return null;
        for (let i = start; i <= end; i++) pages.add(i);
      } else {
        const num = parseInt(p, 10);
        if (isNaN(num) || num < 1 || num > max) return null;
        pages.add(num);
      }
    }
    return Array.from(pages).sort((a,b) => a-b);
  };

  const processPdf = async () => {
    setError('');
    const parsed = parsePages(pagesInput, pageCount);
    if (!parsed || parsed.length === 0) {
      setError(`Invalid page range. Please use format like '1-5, 8' (Max pages: ${pageCount})`);
      return;
    }

    setStage('processing');
    
    try {
      const indices = parsed.map(p => p - 1);
      
      if (splitMode === 'extract') {
        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdfDoc, indices);
        copiedPages.forEach(p => newPdf.addPage(p));
        const data = await newPdf.save();
        setOutBlob(new Blob([data], { type: 'application/pdf' }));
        setOutFilename(`${file.name.replace('.pdf', '')}_extracted.pdf`);
      } else {
        const zip = new JSZip();
        for (let i = 0; i < indices.length; i++) {
          const newPdf = await PDFDocument.create();
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [indices[i]]);
          newPdf.addPage(copiedPage);
          const data = await newPdf.save();
          zip.file(`${file.name.replace('.pdf', '')}_page_${indices[i] + 1}.pdf`, data);
        }
        const zipData = await zip.generateAsync({ type: 'blob' });
        setOutBlob(zipData);
        setOutFilename(`${file.name.replace('.pdf', '')}_split.zip`);
      }
      
      setStage('done');
    } catch (err) {
      console.error(err);
      setError('An error occurred while processing the PDF.');
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
    link.setAttribute('download', outFilename);
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
    setPagesInput('');
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
          <input ref={inputRef} type="file" accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.length && ingest(e.target.files)} />
          
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: drag ? 'rgba(37,99,235,0.12)' : 'var(--surface,#111118)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}>
            <Scissors size={28} color={drag ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)'} />
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {drag ? 'Drop PDF here' : 'Drop a PDF file here'}
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
              Selected File
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
                <span style={{ fontSize: 10, color: 'var(--border)' }}>•</span>
                <span>{pageCount} {pageCount === 1 ? 'Page' : 'Pages'} total</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={() => setSplitMode('extract')} 
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px', borderRadius: 12, border: `1px solid ${splitMode === 'extract' ? 'var(--accent-blue)' : 'var(--border)'}`,
                background: splitMode === 'extract' ? 'rgba(37,99,235,0.05)' : 'var(--surface)',
                color: splitMode === 'extract' ? 'var(--accent-blue)' : 'var(--text-muted)',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <FileText size={18} />
              Extract to single PDF
            </button>
            <button 
              onClick={() => setSplitMode('split')} 
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px', borderRadius: 12, border: `1px solid ${splitMode === 'split' ? 'var(--accent-blue)' : 'var(--border)'}`,
                background: splitMode === 'split' ? 'rgba(37,99,235,0.05)' : 'var(--surface)',
                color: splitMode === 'split' ? 'var(--accent-blue)' : 'var(--text-muted)',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <FileArchive size={18} />
              Split into separate files (ZIP)
            </button>
          </div>

          <div style={{ 
            background: 'var(--surface)', border: '1px solid var(--border)', 
            borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 
          }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>PAGES TO {splitMode === 'extract' ? 'EXTRACT' : 'SPLIT'}</h4>
            <input 
              type="text" 
              value={pagesInput} 
              onChange={(e) => setPagesInput(e.target.value)} 
              placeholder={`e.g., 1-5, 8, 11-13`}
              style={{
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                padding: '12px 14px', borderRadius: 8, color: 'var(--text)', fontSize: 14,
                width: '100%', outline: 'none'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Enter page numbers and/or ranges separated by commas. Max pages: {pageCount}.
            </div>
          </div>

          <button onClick={processPdf} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            padding: '14px 20px', borderRadius: 10, border: 'none', width: '100%',
            background: 'var(--accent-blue,#2563EB)', color: 'white',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Scissors size={16} />
            {splitMode === 'extract' ? 'Extract Pages' : 'Split Pages'}
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
            <Scissors size={24} color="var(--accent-blue,#2563EB)" />
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: '2px solid transparent', borderTopColor: 'var(--accent-blue,#2563EB)',
              animation: 'spin 0.9s linear infinite',
            }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            {splitMode === 'extract' ? 'Extracting Pages...' : 'Splitting and Zipping...'}
          </div>
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
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Process Complete!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              {splitMode === 'extract'
                ? 'Your new extracted PDF is strictly ready to download.'
                : 'Your zip archive with scattered pages is ready.'}
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
              Download {splitMode === 'extract' ? 'Extracted PDF' : 'ZIP File'} • {formatBytes(outBlob.size)}
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
            <RotateCcw size={13} /> Process another document
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
