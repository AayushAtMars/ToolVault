import { useState, useRef, useCallback , useEffect} from 'react';
import {
  FileText,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import mammoth from 'mammoth';
import html2pdf from 'html2pdf.js';

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

// ── Strip images/SVGs but keep all text & structure ──────────
function stripImages(html) {
  return html
    .replace(/<img[^>]*>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/src="data:[^"]*"/gi, '')
    .replace(/<picture[\s\S]*?<\/picture>/gi, '')
    .trim();
}

// ── Mammoth style map: Word styles → semantic HTML ───────────
// This is the key fix — maps every common Word paragraph style
// to correct HTML so structure is preserved
const STYLE_MAP = `
  p[style-name='Title']            => h1.doc-title:fresh
  p[style-name='Heading 1']        => h2.doc-h1:fresh
  p[style-name='Heading 2']        => h3.doc-h2:fresh
  p[style-name='Heading 3']        => h4.doc-h3:fresh
  p[style-name='Heading 4']        => h5.doc-h4:fresh
  p[style-name='Heading 5']        => h6.doc-h5:fresh
  p[style-name='List Paragraph']   => p.doc-list-item:fresh
  p[style-name='List Number']      => p.doc-list-num:fresh
  p[style-name='Normal']           => p.doc-normal:fresh
  p[style-name='Body Text']        => p.doc-body:fresh
  p[style-name='Caption']          => p.doc-caption:fresh
  p[style-name='intense quote']    => blockquote:fresh
  p[style-name='Quote']            => blockquote:fresh
  r[style-name='Strong']           => strong
  r[style-name='Emphasis']         => em
`.trim();


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

export default function WordToPdf() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage,       setStage]       = useState('idle');
  const [file,        setFile]        = useState(null);
  const [error,       setError]       = useState('');
  const [drag,        setDrag]        = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pageSize,    setPageSize]    = useState('a4');
  const [orientation, setOrientation] = useState('portrait');
  const [warnings,    setWarnings]    = useState([]);

  const inputRef     = useRef(null);
  const containerRef = useRef(null);

  // ── Ingest + parse ────────────────────────────────────────
  const ingest = async (files) => {
    const f = files[0];
    const valid = f.name.toLowerCase().endsWith('.docx') ||
                  f.name.toLowerCase().endsWith('.doc');
    if (!valid) {
      setError('Please upload a .docx or .doc Word file.');
      return;
    }
    setError(''); setWarnings([]);
    setFile(f);

    try {
      const arrayBuffer = await f.arrayBuffer();

      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          // Custom style mappings preserve Word document structure
          styleMap: STYLE_MAP,
          // Completely ignore all images — they cause the giant icon bug
          convertImage: mammoth.images.imgElement(() => ({ src: '' })),
          // Preserve table structure
          includeDefaultStyleMap: true,
        }
      );

      const clean = stripImages(result.value);
      setHtmlContent(clean);

      // Collect non-critical warnings to show user
      const warns = (result.messages || [])
        .filter(m => m.type === 'warning')
        .map(m => m.message)
        .slice(0, 3);
      setWarnings(warns);

      setStage('ready');
    } catch (err) {
      console.error(err);
      setError('Failed to read Word file. It may be corrupted or password-protected.');
      setFile(null);
    }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, []);

  // ── Convert to PDF ────────────────────────────────────────
  const convertToPdf = () => {
    setError('');
    setStage('converting');

    setTimeout(async () => {
      try {
        const element = containerRef.current;
        const filename = file.name.replace(/\.docx?$/i, '') + '.pdf';

        const opt = {
          margin:      [12, 15, 12, 15],
          filename,
          image:       { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2.5,
            useCORS: true,
            letterRendering: true,
            imageTimeout: 0,
            allowTaint: false,
            logging: false,
            scrollY: 0,
          },
          jsPDF: {
            unit: 'mm',
            format: pageSize,
            orientation,
            compress: true,
          },
          pagebreak: {
            mode: ['avoid-all', 'css', 'legacy'],
            before: '.page-break-before',
            after:  '.page-break-after',
            avoid:  ['tr', 'li', 'p'],
          },
        };

        await html2pdf().set(opt).from(element).save();
        setStage('done');
      } catch (err) {
        console.error(err);
        setError('PDF generation failed: ' + (err?.message || 'Unknown error'));
        setStage('ready');
      }
    }, 300);
  };

  const reset = () => {
    setStage('idle'); setFile(null);
    setHtmlContent(''); setError('');
    setShowPreview(false); setWarnings([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ERROR */}
      {error && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', padding: 14,
          borderRadius: 10, background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444',
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13, flex: 1 }}>{error}</div>
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
          <input ref={inputRef} type="file"
            accept=".doc,.docx"
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
              {drag ? 'Drop Word Document here' : 'Drop a Word Document'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              or <span style={{ color: 'var(--accent-blue,#2563EB)', fontWeight: 500 }}>click to browse</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5, marginTop: 6 }}>
              .docx · .doc · 100% private, runs in your browser
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
              background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={20} color="var(--accent-blue,#2563EB)" />
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

          {/* Warnings (non-fatal) */}
          {warnings.length > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)',
              fontSize: 12, color: '#eab308', lineHeight: 1.6,
            }}>
              <strong>Heads up:</strong> Some Word-specific formatting (custom fonts, colors, inline images) may not transfer perfectly. Text content is fully preserved.
            </div>
          )}

          {/* Page options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={L}>Page Size</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['a4', 'letter', 'legal'].map(s => (
                  <button key={s} onClick={() => setPageSize(s)} style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8,
                    border: `1px solid ${pageSize === s ? 'var(--accent-blue,#2563EB)' : 'var(--border)'}`,
                    background: pageSize === s ? 'rgba(37,99,235,0.08)' : 'transparent',
                    color: pageSize === s ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)',
                    fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                    textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
                  }}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={L}>Orientation</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { value: 'portrait',  label: '▯ Portrait'  },
                  { value: 'landscape', label: '▭ Landscape' },
                ].map(o => (
                  <button key={o.value} onClick={() => setOrientation(o.value)} style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8,
                    border: `1px solid ${orientation === o.value ? 'var(--accent-blue,#2563EB)' : 'var(--border)'}`,
                    background: orientation === o.value ? 'rgba(37,99,235,0.08)' : 'transparent',
                    color: orientation === o.value ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}>{o.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview toggle */}
          <button onClick={() => setShowPreview(p => !p)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '9px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>
            {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
            {showPreview ? 'Hide Preview' : 'Preview Document'}
          </button>

          {/* Inline preview */}
          {showPreview && (
            <div style={{
              maxHeight: 480, overflowY: 'auto',
              background: '#ffffff', color: '#111111',
              borderRadius: 10, padding: '32px 40px',
              border: '1px solid var(--border)',
            }}>
              <div className="doc-preview"
                dangerouslySetInnerHTML={{ __html: htmlContent }} />
            </div>
          )}

          {/* CTA */}
          <button onClick={convertToPdf} style={{
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
            Convert to PDF
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
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Generating PDF…</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Rendering document layout…
          </div>
        </div>
      )}

      {/* DONE */}
      {stage === 'done' && (
        <div style={{
          padding: '40px 24px', borderRadius: 14, textAlign: 'center',
          background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.25)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <CheckCircle2 size={28} color="#16a34a" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>PDF Downloaded!</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
            Your document has been converted and downloaded.
          </div>
          <button onClick={reset} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '10px 24px', margin: '0 auto', borderRadius: 9,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            <RotateCcw size={13} /> Convert another document
          </button>
        </div>
      )}

      {/* ── HIDDEN RENDER CONTAINER ── */}
      {/* This is what html2pdf screenshots. Positioned off-screen. */}
      <div style={{
        position: 'fixed', top: -99999, left: -99999,
        width: 760,
        background: '#ffffff', color: '#000000',
        fontFamily: '"Calibri", "Arial", sans-serif',
        fontSize: '11pt',
        lineHeight: '1.5',
        padding: '0',
        zIndex: -1,
      }}>
        <div
          ref={containerRef}
          className="pdf-render"
          dangerouslySetInnerHTML={{ __html: htmlContent || '<p></p>' }}
        />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ═══════════════════════════════════════════
           PDF RENDER STYLES (what html2pdf captures)
           Mirrors Word document layout as closely as possible
        ═══════════════════════════════════════════ */

        .pdf-render {
          padding: 32px 48px;
          box-sizing: border-box;
        }

        /* Hide all images/icons */
        .pdf-render img,
        .pdf-render svg,
        .pdf-render picture { display: none !important; }

        /* Title / Name (Word "Title" style) */
        .pdf-render h1,
        .pdf-render .doc-title {
          font-size: 22pt;
          font-weight: 700;
          text-align: center;
          margin: 0 0 4px 0;
          color: #111;
          letter-spacing: 0.01em;
        }

        /* Section headings (Heading 1 → blue/colored in Word) */
        .pdf-render h2,
        .pdf-render .doc-h1 {
          font-size: 10pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #1a56db;
          border-bottom: 1px solid #1a56db;
          padding-bottom: 2px;
          margin: 14px 0 6px 0;
        }

        /* Sub-headings (Heading 2) */
        .pdf-render h3,
        .pdf-render .doc-h2 {
          font-size: 11pt;
          font-weight: 700;
          margin: 10px 0 4px 0;
          color: #111;
        }

        /* Heading 3 */
        .pdf-render h4,
        .pdf-render .doc-h3 {
          font-size: 10.5pt;
          font-weight: 600;
          margin: 8px 0 3px 0;
          color: #222;
        }

        /* Normal paragraphs */
        .pdf-render p,
        .pdf-render .doc-normal,
        .pdf-render .doc-body {
          font-size: 10pt;
          margin: 0 0 5px 0;
          color: #222;
        }

        /* List items (Word "List Paragraph" style) */
        .pdf-render .doc-list-item {
          font-size: 10pt;
          margin: 0 0 3px 0;
          padding-left: 16px;
          color: #222;
          position: relative;
        }

        .pdf-render .doc-list-item::before {
          content: "•";
          position: absolute;
          left: 4px;
          color: #555;
        }

        /* Numbered lists */
        .pdf-render .doc-list-num {
          font-size: 10pt;
          margin: 0 0 3px 20px;
          color: #222;
        }

        /* Native ul/ol from mammoth */
        .pdf-render ul {
          margin: 2px 0 6px 0;
          padding-left: 18px;
        }
        .pdf-render ol {
          margin: 2px 0 6px 0;
          padding-left: 18px;
        }
        .pdf-render li {
          font-size: 10pt;
          margin-bottom: 2px;
          color: #222;
        }

        /* Bold / italic */
        .pdf-render strong, .pdf-render b { font-weight: 700; }
        .pdf-render em, .pdf-render i     { font-style: italic; }
        .pdf-render u                     { text-decoration: underline; }

        /* Links */
        .pdf-render a {
          color: #1a56db;
          text-decoration: none;
        }

        /* Tables */
        .pdf-render table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0 12px 0;
          font-size: 10pt;
        }
        .pdf-render th {
          background: #f3f4f6;
          font-weight: 700;
          padding: 5px 8px;
          border: 1px solid #ccc;
          text-align: left;
        }
        .pdf-render td {
          padding: 4px 8px;
          border: 1px solid #ccc;
          vertical-align: top;
        }

        /* Blockquote */
        .pdf-render blockquote {
          border-left: 3px solid #999;
          margin: 8px 0;
          padding: 2px 12px;
          color: #555;
          font-style: italic;
        }

        /* Caption */
        .pdf-render .doc-caption {
          font-size: 9pt;
          color: #777;
          text-align: center;
          margin: 2px 0 8px 0;
        }

        /* HR */
        .pdf-render hr {
          border: none;
          border-top: 1px solid #ddd;
          margin: 10px 0;
        }

        /* ═══════════════════════════════════════════
           PREVIEW STYLES (visible scrollable panel)
        ═══════════════════════════════════════════ */

        .doc-preview {
          font-family: "Calibri", "Arial", sans-serif;
          font-size: 11pt;
          color: #111;
          line-height: 1.5;
        }

        .doc-preview img,
        .doc-preview svg,
        .doc-preview picture { display: none !important; }

        .doc-preview h1, .doc-preview .doc-title {
          font-size: 20pt; font-weight: 700;
          text-align: center; margin: 0 0 4px;
        }
        .doc-preview h2, .doc-preview .doc-h1 {
          font-size: 10pt; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: #1a56db; border-bottom: 1px solid #1a56db;
          padding-bottom: 2px; margin: 14px 0 6px;
        }
        .doc-preview h3, .doc-preview .doc-h2 {
          font-size: 11pt; font-weight: 700; margin: 10px 0 4px;
        }
        .doc-preview h4 { font-size: 10.5pt; font-weight: 600; margin: 8px 0 3px; }
        .doc-preview p  { font-size: 10pt; margin: 0 0 5px; }
        .doc-preview .doc-list-item {
          font-size: 10pt; margin: 0 0 3px; padding-left: 16px; position: relative;
        }
        .doc-preview .doc-list-item::before { content: "•"; position: absolute; left: 4px; color: #555; }
        .doc-preview ul  { margin: 2px 0 6px; padding-left: 18px; }
        .doc-preview ol  { margin: 2px 0 6px; padding-left: 18px; }
        .doc-preview li  { font-size: 10pt; margin-bottom: 2px; }
        .doc-preview strong, .doc-preview b { font-weight: 700; }
        .doc-preview em, .doc-preview i     { font-style: italic; }
        .doc-preview a   { color: #1a56db; }
        .doc-preview table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10pt; }
        .doc-preview th  { background: #f3f4f6; font-weight: 700; padding: 5px 8px; border: 1px solid #ccc; }
        .doc-preview td  { padding: 4px 8px; border: 1px solid #ccc; }
      `}</style>
    </div>
  );
}

const L = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted,#6b6b80)', marginBottom: 7,
  letterSpacing: '0.07em', textTransform: 'uppercase',
};
const ib = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-muted)', cursor: 'pointer',
};