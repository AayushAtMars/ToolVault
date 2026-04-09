import { useState, useRef, useCallback , useEffect} from 'react';
import {
  Download,
  Image as ImageIcon,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ZoomIn,
  Layers,
  FileImage,
  Settings2,
  Eye,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

// ── Config options ─────────────────────────────────────────────
const DPI_OPTIONS = [
  { label: '72 DPI',  value: 1.0,  desc: 'Web / preview' },
  { label: '150 DPI', value: 2.08, desc: 'Standard'      },
  { label: '300 DPI', value: 4.17, desc: 'Print quality' },
  { label: '600 DPI', value: 8.33, desc: 'Max quality'   },
];

const FORMAT_OPTIONS = [
  { label: 'JPEG', value: 'jpeg', mime: 'image/jpeg', ext: 'jpg', quality: 0.95 },
  { label: 'PNG',  value: 'png',  mime: 'image/png',  ext: 'png', quality: 1.0  },
  { label: 'WebP', value: 'webp', mime: 'image/webp', ext: 'webp', quality: 0.92 },
];

const PAGE_RANGE_OPTIONS = [
  { label: 'All Pages',    value: 'all'   },
  { label: 'Custom Range', value: 'range' },
  { label: 'Odd Pages',    value: 'odd'   },
  { label: 'Even Pages',   value: 'even'  },
];


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

export default function PdfToJpg() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage,      setStage]      = useState('idle');
  const [file,       setFile]       = useState(null);
  const [pageCount,  setPageCount]  = useState(0);
  const [error,      setError]      = useState('');
  const [drag,       setDrag]       = useState(false);
  const [outBlob,    setOutBlob]    = useState(null);
  const [outFilename,setOutFilename]= useState('');
  const [progress,   setProgress]   = useState({ page: 0, total: 0 });
  const [thumbnails, setThumbnails] = useState([]);  // preview thumbs
  const [previewing, setPreviewing] = useState(false);

  // Options
  const [dpi,       setDpi]       = useState(2.08);  // 150 DPI default
  const [format,    setFormat]    = useState('jpeg');
  const [pageRange, setPageRange] = useState('all');
  const [rangeFrom, setRangeFrom] = useState('1');
  const [rangeTo,   setRangeTo]   = useState('');
  const [bgColor,   setBgColor]   = useState('#ffffff');

  const inputRef = useRef(null);

  // ── Parse pages to render ────────────────────────────────
  const getPageNumbers = (total) => {
    switch (pageRange) {
      case 'odd':   return Array.from({ length: total }, (_, i) => i + 1).filter(n => n % 2 !== 0);
      case 'even':  return Array.from({ length: total }, (_, i) => i + 1).filter(n => n % 2 === 0);
      case 'range': {
        const from = Math.max(1, parseInt(rangeFrom) || 1);
        const to   = Math.min(total, parseInt(rangeTo) || total);
        return Array.from({ length: to - from + 1 }, (_, i) => from + i);
      }
      default: return Array.from({ length: total }, (_, i) => i + 1);
    }
  };

  // ── Render a single page to canvas blob ──────────────────
  const renderPage = async (page, scale) => {
    const viewport = page.getViewport({ scale });
    const canvas   = document.createElement('canvas');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    const ctx      = canvas.getContext('2d');
    ctx.fillStyle  = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const selFmt = FORMAT_OPTIONS.find(f => f.value === format);
    return new Promise(res => canvas.toBlob(res, selFmt.mime, selFmt.quality));
  };

  // ── Ingest ────────────────────────────────────────────────
  const ingest = async (files) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.'); return;
    }
    setError(''); setFile(f); setOutBlob(null);
    setThumbnails([]); setPageCount(0);
    // Quick peek at page count
    try {
      const ab  = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      setPageCount(pdf.numPages);
      setRangeTo(String(pdf.numPages));
    } catch {}
    setStage('ready');
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, []);

  // ── Generate thumbnails for preview ──────────────────────
  const generatePreviews = async () => {
    if (!file) return;
    setPreviewing(true);
    try {
      const ab   = await file.arrayBuffer();
      const pdf  = await pdfjsLib.getDocument({ data: ab }).promise;
      const pages = getPageNumbers(pdf.numPages).slice(0, 6); // max 6 previews
      const thumbs = [];
      for (const pn of pages) {
        const page = await pdf.getPage(pn);
        const blob = await renderPage(page, 0.3); // low scale for thumb
        thumbs.push({ page: pn, url: URL.createObjectURL(blob) });
      }
      setThumbnails(thumbs);
    } catch (e) {
      console.error(e);
    }
    setPreviewing(false);
  };

  // ── Convert ───────────────────────────────────────────────
  const convertToImg = async () => {
    setError(''); setStage('converting');
    setProgress({ page: 0, total: 0 });

    try {
      const ab    = await file.arrayBuffer();
      const pdf   = await pdfjsLib.getDocument({ data: ab }).promise;
      const pages = getPageNumbers(pdf.numPages);
      const total = pages.length;
      setProgress({ page: 0, total });

      const selFmt = FORMAT_OPTIONS.find(f => f.value === format);
      const zip    = new JSZip();
      let singleBlob = null;
      const padLen = total.toString().length;

      for (let i = 0; i < pages.length; i++) {
        const pn   = pages[i];
        setProgress({ page: i + 1, total });
        const page = await pdf.getPage(pn);
        const blob = await renderPage(page, dpi);

        if (total === 1) {
          singleBlob = blob;
        } else {
          const pad = pn.toString().padStart(padLen, '0');
          zip.file(`${file.name.replace(/\.pdf$/i, '')}_page_${pad}.${selFmt.ext}`, blob);
        }
      }

      if (total === 1) {
        setOutBlob(singleBlob);
        setOutFilename(`${file.name.replace(/\.pdf$/i, '')}.${selFmt.ext}`);
      } else {
        const zipBlob = await zip.generateAsync({ type: 'blob',
          compression: 'DEFLATE', compressionOptions: { level: 6 } });
        setOutBlob(zipBlob);
        setOutFilename(`${file.name.replace(/\.pdf$/i, '')}_images.zip`);
      }

      setStage('done');
    } catch (err) {
      console.error(err);
      setError(err?.message?.includes('worker')
        ? 'Worker failed. Run: cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js'
        : err?.message || 'Conversion failed.');
      setStage('ready');
    }
  };

  const download = () => {
    if (!outBlob) return;
    const url = URL.createObjectURL(outBlob);
    const a   = document.createElement('a');
    a.href = url; a.download = outFilename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = () => {
    setStage('idle'); setFile(null); setOutBlob(null);
    setError(''); setOutFilename(''); setPageCount(0);
    setProgress({ page: 0, total: 0 });
    setThumbnails([]); setPageRange('all');
  };

  const selFmt = FORMAT_OPTIONS.find(f => f.value === format);

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

      {/* ── IDLE ── */}
      {stage === 'idle' && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 14, padding: '64px 32px',
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
            width: 68, height: 68, borderRadius: 18,
            background: drag ? 'rgba(37,99,235,0.12)' : 'var(--surface,#111118)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}>
            <FileImage size={30} color={drag ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)'} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {drag ? 'Drop PDF here' : 'Drop a PDF to convert'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              or <span style={{ color: 'var(--accent-blue,#2563EB)', fontWeight: 500 }}>click to browse</span>
            </div>
          </div>

          {/* Format badges */}
          <div style={{ display: 'flex', gap: 6 }}>
            {FORMAT_OPTIONS.map(f => (
              <span key={f.value} style={{
                fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                padding: '3px 9px', borderRadius: 100,
                background: 'var(--surface,#111118)',
                border: '1px solid var(--border)', color: 'var(--text-muted)',
                letterSpacing: '0.05em',
              }}>{f.label}</span>
            ))}
            <span style={{
              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
              padding: '3px 9px', borderRadius: 100,
              background: 'var(--surface,#111118)',
              border: '1px solid var(--border)', color: 'var(--text-muted)',
            }}>ZIP</span>
          </div>
        </label>
      )}

      {/* ── READY ── */}
      {stage === 'ready' && file && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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
              <FileImage size={20} color="#ef4444" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                <span>{formatBytes(file.size)}</span>
                {pageCount > 0 && <><span>·</span><span>{pageCount} page{pageCount > 1 ? 's' : ''}</span></>}
              </div>
            </div>
            <button onClick={reset} style={ib}><X size={14} /></button>
          </div>

          {/* ── Settings panel ── */}
          <div style={{
            background: 'var(--surface-raised,#18181f)',
            border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Settings2 size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Conversion Settings
              </span>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Output Format */}
              <div>
                <label style={L}>Output Format</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {FORMAT_OPTIONS.map(f => (
                    <button key={f.value} onClick={() => setFormat(f.value)} style={{
                      flex: 1, padding: '9px 8px', borderRadius: 8, textAlign: 'center',
                      border: `1px solid ${format === f.value ? 'var(--accent-blue,#2563EB)' : 'var(--border)'}`,
                      background: format === f.value ? 'rgba(37,99,235,0.08)' : 'transparent',
                      color: format === f.value ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', marginBottom: 2 }}>{f.label}</div>
                      <div style={{ fontSize: 9, opacity: 0.7 }}>
                        {f.value === 'jpeg' ? 'Smaller size' : f.value === 'png' ? 'Lossless' : 'Modern'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* DPI / Resolution */}
              <div>
                <label style={L}>
                  <span>Resolution</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {DPI_OPTIONS.map(d => (
                    <button key={d.value} onClick={() => setDpi(d.value)} style={{
                      padding: '9px 6px', borderRadius: 8, textAlign: 'center',
                      border: `1px solid ${dpi === d.value ? 'var(--accent-blue,#2563EB)' : 'var(--border)'}`,
                      background: dpi === d.value ? 'rgba(37,99,235,0.08)' : 'transparent',
                      color: dpi === d.value ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', marginBottom: 2 }}>{d.label}</div>
                      <div style={{ fontSize: 9, opacity: 0.7 }}>{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Page Range + BG Color row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                <div>
                  <label style={L}>Pages to Convert</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {PAGE_RANGE_OPTIONS.map(r => (
                      <button key={r.value} onClick={() => setPageRange(r.value)} style={{
                        padding: '6px 12px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                        border: `1px solid ${pageRange === r.value ? 'var(--accent-blue,#2563EB)' : 'var(--border)'}`,
                        background: pageRange === r.value ? 'rgba(37,99,235,0.08)' : 'transparent',
                        color: pageRange === r.value ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>{r.label}</button>
                    ))}
                  </div>
                  {/* Range inputs */}
                  {pageRange === 'range' && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                      <input
                        type="number" min="1" max={pageCount} value={rangeFrom}
                        onChange={e => setRangeFrom(e.target.value)}
                        style={{ ...inputSt, width: 70 }} placeholder="From"
                      />
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
                      <input
                        type="number" min="1" max={pageCount} value={rangeTo}
                        onChange={e => setRangeTo(e.target.value)}
                        style={{ ...inputSt, width: 70 }} placeholder="To"
                      />
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>of {pageCount}</span>
                    </div>
                  )}
                </div>

                {/* Background color */}
                <div>
                  <label style={L}>Background</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['#ffffff', '#000000', '#f3f4f6'].map(c => (
                      <button key={c} onClick={() => setBgColor(c)} style={{
                        width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                        background: c,
                        border: bgColor === c ? '2px solid var(--accent-blue,#2563EB)' : '1px solid var(--border)',
                        transition: 'all 0.15s',
                      }} title={c} />
                    ))}
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                      title="Custom color"
                      style={{
                        width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                        border: '1px solid var(--border)', background: 'none', padding: 0,
                      }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview thumbnails */}
          {thumbnails.length > 0 && (
            <div>
              <label style={{ ...L, marginBottom: 10 }}>Page Preview</label>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {thumbnails.map(t => (
                  <div key={t.page} style={{ flexShrink: 0, textAlign: 'center' }}>
                    <div style={{
                      width: 80, height: 108,
                      borderRadius: 6, overflow: 'hidden',
                      border: '1px solid var(--border)',
                      background: bgColor,
                    }}>
                      <img src={t.url} alt={`Page ${t.page}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                      pg {t.page}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={generatePreviews} disabled={previewing} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px 16px', borderRadius: 9,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s', flexShrink: 0,
              opacity: previewing ? 0.6 : 1,
            }}
              onMouseEnter={e => !previewing && (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Eye size={13} />
              {previewing ? 'Loading…' : 'Preview'}
            </button>

            <button onClick={convertToImg} style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              padding: '11px 20px', borderRadius: 9, border: 'none',
              background: 'var(--accent-blue,#2563EB)', color: 'white',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)', transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <RefreshCw size={15} />
              Convert to {selFmt.label}
            </button>
          </div>

          {/* Output summary */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--surface-raised,#18181f)',
            border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-muted)',
          }}>
            <Layers size={13} />
            <span>
              {pageCount > 0 ? (
                <>
                  {(() => {
                    const pages = getPageNumbers(pageCount);
                    return `${pages.length} page${pages.length > 1 ? 's' : ''} → `;
                  })()}
                  {getPageNumbers(pageCount).length === 1
                    ? `1 ${selFmt.ext.toUpperCase()} file`
                    : `ZIP archive of ${selFmt.label} images`}
                  {' · '}
                  {DPI_OPTIONS.find(d => d.value === dpi)?.label}
                </>
              ) : '—'}
            </span>
          </div>
        </div>
      )}

      {/* ── CONVERTING ── */}
      {stage === 'converting' && (
        <div style={{
          padding: 36, borderRadius: 14, textAlign: 'center',
          background: 'var(--surface-raised,#18181f)', border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', position: 'relative',
          }}>
            <FileImage size={26} color="var(--accent-blue,#2563EB)" />
            <div style={{
              position: 'absolute', inset: -5, borderRadius: '50%',
              border: '2px solid transparent', borderTopColor: 'var(--accent-blue,#2563EB)',
              animation: 'spin 0.9s linear infinite',
            }} />
          </div>

          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Rendering pages…</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            {DPI_OPTIONS.find(d => d.value === dpi)?.label} · {selFmt.label} format
          </div>

          {progress.total > 0 && (
            <>
              <div style={{ height: 5, background: 'var(--border)', borderRadius: 100, overflow: 'hidden', maxWidth: 320, margin: '0 auto 10px' }}>
                <div style={{
                  height: '100%', borderRadius: 100,
                  width: `${Math.round((progress.page / progress.total) * 100)}%`,
                  background: 'linear-gradient(90deg,#2563EB,#60a5fa)',
                  transition: 'width 0.3s ease',
                  boxShadow: '0 0 8px rgba(37,99,235,0.5)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 320, margin: '0 auto', fontSize: 11, fontFamily: 'monospace' }}>
                <span style={{ color: 'var(--text-muted)' }}>Page {progress.page} of {progress.total}</span>
                <span style={{ color: 'var(--accent-blue,#2563EB)', fontWeight: 700 }}>
                  {Math.round((progress.page / progress.total) * 100)}%
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DONE ── */}
      {stage === 'done' && outBlob && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.6 }}>
              {progress.total === 1
                ? `Your ${selFmt.label} image is ready.`
                : `All ${progress.total} pages packaged into a ZIP archive.`}
            </div>

            {/* Output details */}
            <div style={{
              display: 'inline-flex', gap: 20, padding: '8px 18px', borderRadius: 8,
              background: 'var(--surface-raised,#18181f)', border: '1px solid var(--border)',
              marginBottom: 20, fontSize: 11, fontFamily: 'monospace',
            }}>
              {[
                { label: 'FORMAT', value: selFmt.label },
                { label: 'DPI', value: DPI_OPTIONS.find(d => d.value === dpi)?.label },
                { label: 'PAGES', value: progress.total },
                { label: 'SIZE', value: formatBytes(outBlob.size) },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{value}</div>
                </div>
              ))}
            </div>

            <button onClick={download} style={{
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
              {progress.total === 1 ? `Download .${selFmt.ext}` : 'Download ZIP Archive'}
            </button>
          </div>

          <button onClick={reset} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '10px', borderRadius: 9,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hover,#ffffff22)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <RotateCcw size={13} /> Convert another PDF
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const L = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted,#6b6b80)', marginBottom: 8,
  letterSpacing: '0.07em', textTransform: 'uppercase',
};

const ib = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
};

const inputSt = {
  background: 'var(--surface,#111118)',
  border: '1px solid var(--border)',
  borderRadius: 7, color: 'var(--text)',
  padding: '7px 10px', fontSize: 12,
  fontFamily: 'monospace', outline: 'none',
  boxSizing: 'border-box',
};