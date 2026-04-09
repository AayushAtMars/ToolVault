import { useState, useRef, useCallback , useEffect} from 'react';
import {
  Download,
  FileText,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// ── Use local /public file — same pattern as FFmpeg ──────────
// Run this once in terminal:
// cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

// ── Rebuild lines from raw PDF text items ─────────────────────
function buildParagraphs(items) {
  if (!items.length) return [];

  // Sort top→bottom, left→right
  const sorted = [...items].sort((a, b) => {
    const yDiff = Math.round(b.transform[5]) - Math.round(a.transform[5]);
    if (Math.abs(yDiff) > 3) return yDiff;
    return a.transform[4] - b.transform[4];
  });

  const lines = [];
  let currentY   = null;
  let currentLine = [];
  const Y_GAP    = 4;

  for (const item of sorted) {
    const y = Math.round(item.transform[5]);
    if (currentY === null) currentY = y;

    if (Math.abs(y - currentY) <= Y_GAP) {
      currentLine.push(item);
    } else {
      if (currentLine.length) lines.push(currentLine);
      currentLine = [item];
      currentY    = y;
    }
  }
  if (currentLine.length) lines.push(currentLine);

  return lines.map(line => {
    const text     = line.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
    const fontSize = Math.abs(line[0]?.transform?.[3] || 0);
    const bold     = line.some(i => i.fontName?.toLowerCase().includes('bold'));
    const isHeading = (text === text.toUpperCase() && text.length < 50 && text.length > 1) || fontSize > 13;

    if (!text) return new Paragraph({ text: '' });

    return new Paragraph({
      children: [new TextRun({
        text,
        bold: bold || isHeading,
        size: isHeading ? 26 : 22,
      })],
      spacing: isHeading
        ? { before: 200, after: 100 }
        : { after: 60 },
    });
  });
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

export default function PdfToWord() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage,    setStage]    = useState('idle');
  const [file,     setFile]     = useState(null);
  const [error,    setError]    = useState('');
  const [drag,     setDrag]     = useState(false);
  const [outBlob,  setOutBlob]  = useState(null);
  const [progress, setProgress] = useState({ page: 0, total: 0 });

  const inputRef = useRef(null);

  const ingest = (files) => {
    const f = files[0];
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a valid PDF file.');
      return;
    }
    setError(''); setFile(f); setOutBlob(null);
    setStage('ready');
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, []);

  // ── Conversion ────────────────────────────────────────────
  const convertToWord = async () => {
    setError(''); setStage('converting');
    setProgress({ page: 0, total: 0 });

    try {
      const arrayBuffer = await file.arrayBuffer();

      const pdf   = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const total = pdf.numPages;
      setProgress({ page: 0, total });

      const allParagraphs = [];

      for (let i = 1; i <= total; i++) {
        setProgress({ page: i, total });
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent({ includeMarkedContent: false });
        const items   = content.items.filter(it => it.str?.trim());

        if (items.length) {
          allParagraphs.push(...buildParagraphs(items));
        }

        // Page separator
        if (i < total) {
          allParagraphs.push(new Paragraph({
            children: [new TextRun({ text: '─'.repeat(60), color: 'CCCCCC', size: 16 })],
            spacing: { before: 200, after: 200 },
          }));
        }
      }

      if (!allParagraphs.length) {
        throw new Error('No readable text found. This PDF may contain only scanned images.');
      }

      const doc = new Document({
        creator: 'AayuTools',
        title: file.name.replace(/\.pdf$/i, ''),
        sections: [{
          properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
          children: allParagraphs,
        }],
      });

      const blob = await Packer.toBlob(doc);
      setOutBlob(blob);
      setStage('done');

    } catch (err) {
      console.error(err);
      // Give specific hint if it's still a worker issue
      const msg = err?.message?.includes('worker')
        ? 'Worker failed to load. Run: cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js — then refresh.'
        : err?.message || 'Conversion failed.';
      setError(msg);
      setStage('ready');
    }
  };

  const download = () => {
    if (!outBlob || !file) return;
    const url  = URL.createObjectURL(outBlob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = file.name.replace(/\.pdf$/i, '') + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = () => {
    setStage('idle'); setFile(null);
    setOutBlob(null); setError('');
    setProgress({ page: 0, total: 0 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ERROR */}
      {error && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14,
          borderRadius: 10, background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.25)',
        }}>
          <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, fontSize: 13, color: '#ef4444', lineHeight: 1.55 }}>{error}</div>
          <button onClick={() => setError('')} style={ib}><X size={13} /></button>
        </div>
      )}

      {/* IDLE */}
      {stage === 'idle' && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
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
            <FileText size={28} color={drag ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)'} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {drag ? 'Drop PDF here' : 'Drop a PDF Document'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              or <span style={{ color: 'var(--accent-blue,#2563EB)', fontWeight: 500 }}>click to browse</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5, marginTop: 6 }}>
              .pdf · Text-based PDFs only · 100% private
            </div>
          </div>
        </label>
      )}

      {/* READY */}
      {stage === 'ready' && file && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* File chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px', borderRadius: 10,
            background: 'var(--surface-raised,#18181f)', border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={20} color="#ef4444" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {formatBytes(file.size)}
              </div>
            </div>
            <button onClick={reset} style={ib}><X size={14} /></button>
          </div>

          {/* Note */}
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)',
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
          }}>
            <span style={{ color: '#eab308', fontWeight: 600 }}>Note: </span>
            Works with text-based PDFs. Images, exact layout and positioning are not preserved — text content is fully extracted and structured.
          </div>

          {/* CTA */}
          <button onClick={convertToWord} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            padding: '13px 20px', borderRadius: 9, border: 'none',
            background: 'var(--accent-blue,#2563EB)', color: 'white',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)', transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <RefreshCw size={15} />
            Convert to Word (.docx)
          </button>
        </div>
      )}

      {/* CONVERTING */}
      {stage === 'converting' && (
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
            <RefreshCw size={24} color="var(--accent-blue,#2563EB)" />
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: '2px solid transparent', borderTopColor: 'var(--accent-blue,#2563EB)',
              animation: 'spin 0.9s linear infinite',
            }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Converting…</div>
          {progress.total > 0 ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                Processing page {progress.page} of {progress.total}
              </div>
              <div style={{ height: 5, background: 'var(--border)', borderRadius: 100, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
                <div style={{
                  height: '100%', borderRadius: 100,
                  width: `${Math.round((progress.page / progress.total) * 100)}%`,
                  background: 'linear-gradient(90deg,#2563EB,#60a5fa)',
                  transition: 'width 0.3s ease',
                  boxShadow: '0 0 6px rgba(37,99,235,0.5)',
                }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading PDF…</div>
          )}
        </div>
      )}

      {/* DONE */}
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
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Conversion Complete!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Your Word document is ready.<br />All text has been extracted and structured.
            </div>

            <button onClick={download} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 9, border: 'none',
              background: '#16a34a', color: 'white',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', margin: '0 auto 14px',
              boxShadow: '0 4px 14px rgba(22,163,74,0.25)', transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Download size={15} />
              Download .docx
            </button>

            <button onClick={reset} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '9px 20px', margin: '0 auto', borderRadius: 9,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hover,#ffffff22)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <RotateCcw size={13} /> Convert another PDF
            </button>
          </div>
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