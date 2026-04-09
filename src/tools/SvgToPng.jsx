import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download, UploadCloud, Code2, Image as ImageIcon,
  ChevronDown, CheckCircle2, AlertCircle, X, Copy,
  Check, ZoomIn, ZoomOut, RotateCcw, Maximize2, Eye,
  FileCode, Layers, Sliders
} from 'lucide-react';

/* ── Constants ───────────────────────────────────────────── */
const SCALES = [
  { value: 0.5, label: '0.5×', note: 'Half' },
  { value: 1,   label: '1×',   note: 'Original' },
  { value: 2,   label: '2×',   note: 'Retina' },
  { value: 3,   label: '3×',   note: '' },
  { value: 4,   label: '4×',   note: 'Hi-res' },
  { value: 8,   label: '8×',   note: '' },
  { value: 16,  label: '16×',  note: 'Ultra' },
];

const FORMATS = [
  { id: 'image/png',  label: 'PNG',  ext: 'png',  note: 'Lossless + alpha' },
  { id: 'image/jpeg', label: 'JPEG', ext: 'jpg',  note: 'Smaller size' },
  { id: 'image/webp', label: 'WebP', ext: 'webp', note: 'Best of both' },
];

const BG_PRESETS = [
  { id: 'transparent', label: 'None',       color: null },
  { id: '#ffffff',     label: 'White',      color: '#ffffff' },
  { id: '#000000',     label: 'Black',      color: '#000000' },
  { id: '#18181b',     label: 'Dark',       color: '#18181b' },
  { id: '#2563eb',     label: 'Blue',       color: '#2563eb' },
  { id: 'custom',      label: 'Custom',     color: null },
];

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#g)" opacity="0.15"/>
  <circle cx="100" cy="85" r="35" fill="url(#g)"/>
  <rect x="60" y="130" width="80" height="12" rx="6" fill="url(#g)" opacity="0.7"/>
  <rect x="75" y="152" width="50" height="8" rx="4" fill="url(#g)" opacity="0.4"/>
</svg>`;

/* ── Helpers ─────────────────────────────────────────────── */
function fmtBytes(kb) {
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function parseSvgDimensions(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return null;
  const w = parseFloat(svg.getAttribute('width') || svg.viewBox?.baseVal?.width || 0);
  const h = parseFloat(svg.getAttribute('height') || svg.viewBox?.baseVal?.height || 0);
  return w && h ? { w: Math.round(w), h: Math.round(h) } : null;
}

/* ── Sub-components ──────────────────────────────────────── */

function SegmentedControl({ options, value, onChange, small }) {
  return (
    <div style={{
      display: 'flex', background: 'var(--surface,#111118)',
      border: '1px solid var(--border)', borderRadius: 10,
      padding: 3, gap: 2,
    }}>
      {options.map(opt => (
        <button key={opt.value ?? opt.id} onClick={() => onChange(opt.value ?? opt.id)}
          style={{
            flex: 1, padding: small ? '5px 8px' : '7px 12px',
            borderRadius: 7, border: 'none', cursor: 'pointer',
            fontSize: small ? 11 : 12, fontWeight: 700,
            fontFamily: 'inherit',
            background: (value === (opt.value ?? opt.id))
              ? 'var(--accent-blue,#2563eb)'
              : 'transparent',
            color: (value === (opt.value ?? opt.id))
              ? '#fff'
              : 'var(--text-muted,#6b6b80)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ children, icon: Icon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.09em',
      marginBottom: 8,
    }}>
      {Icon && <Icon size={11} />}
      {children}
    </div>
  );
}

function StatusBadge({ type, children }) {
  const styles = {
    success: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'rgba(16,185,129,0.2)' },
    error:   { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', border: 'rgba(239,68,68,0.2)' },
    info:    { bg: 'rgba(37,99,235,0.1)',  color: 'var(--accent-blue,#2563eb)', border: 'rgba(37,99,235,0.2)' },
  };
  const s = styles[type];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', borderRadius: 10,
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`, fontSize: 13, fontWeight: 500,
    }}>
      {type === 'success' && <CheckCircle2 size={15} />}
      {type === 'error'   && <AlertCircle  size={15} />}
      {children}
    </div>
  );
}

/* ── Preview Checkerboard ────────────────────────────────── */
function CheckerPreview({ outputUrl, bgColor, zoom, onZoomIn, onZoomOut, onReset, dimensions }) {
  return (
    <div style={{ position: 'relative' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: 'var(--surface,#111118)',
        borderRadius: '10px 10px 0 0', border: '1px solid var(--border)',
        borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Eye size={12} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Preview</span>
          {dimensions && (
            <span style={{
              fontSize: 10, color: 'var(--text-muted)', opacity: 0.6,
              fontFamily: 'monospace', marginLeft: 4,
            }}>
              {dimensions.w}×{dimensions.h}px
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { icon: ZoomOut, action: onZoomOut, tip: 'Zoom out' },
            { icon: RotateCcw, action: onReset, tip: 'Reset zoom' },
            { icon: ZoomIn, action: onZoomIn, tip: 'Zoom in' },
          ].map(({ icon: Icon, action, tip }) => (
            <button key={tip} onClick={action} title={tip}
              style={{
                width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--surface-raised,#18181f)', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
              }}>
              <Icon size={12} />
            </button>
          ))}
          <span style={{
            padding: '0 8px', height: 26, lineHeight: '26px',
            borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--surface-raised,#18181f)',
            fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
            fontFamily: 'monospace',
          }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div style={{
        minHeight: 280, maxHeight: 420,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'auto', padding: 32,
        background: 'var(--surface,#111118)',
        border: '1px solid var(--border)', borderRadius: '0 0 10px 10px',
        backgroundImage: bgColor === 'transparent'
          ? 'linear-gradient(45deg,rgba(255,255,255,0.03) 25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,0.03) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(255,255,255,0.03) 75%),linear-gradient(-45deg,transparent 75%,rgba(255,255,255,0.03) 75%)'
          : 'none',
        backgroundSize: bgColor === 'transparent' ? '16px 16px' : 'auto',
        backgroundPosition: bgColor === 'transparent' ? '0 0,0 8px,8px -8px,-8px 0' : 'auto',
      }}>
        <img
          src={outputUrl} alt="Converted SVG"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center',
            transition: 'transform 0.2s ease',
            maxWidth: '100%', maxHeight: 340,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            borderRadius: 4,
            background: bgColor !== 'transparent' ? bgColor : undefined,
          }}
        />
      </div>
    </div>
  );
}

/* ══ Main Component ══════════════════════════════════════════ */
export default function SvgToPng() {
  const [mode, setMode]         = useState('code');
  const [svgText, setSvgText]   = useState('');
  const [fileName, setFileName] = useState('image');
  const [scale, setScale]       = useState(2);
  const [format, setFormat]     = useState('image/png');
  const [bgColor, setBgColor]   = useState('transparent');
  const [customBg, setCustomBg] = useState('#ff6b6b');
  const [outputUrl, setOutputUrl] = useState(null);
  const [outputSize, setOutputSize] = useState(0);
  const [outputDims, setOutputDims] = useState(null);
  const [svgDims, setSvgDims]   = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError]       = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [zoom, setZoom]         = useState(1);
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'info'

  const canvasRef   = useRef(null);
  const fileInputRef = useRef(null);

  /* ── Drag handlers ─ */
  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'image/svg+xml' || file.name.endsWith('.svg'))) {
      processFile(file);
    } else {
      showError('Please drop a valid .svg file.');
    }
  };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 3500);
  };

  const processFile = (file) => {
    setFileName(file.name.replace(/\.svg$/i, ''));
    const reader = new FileReader();
    reader.onload = (e) => {
      setSvgText(e.target.result);
      setOutputUrl(null);
    };
    reader.readAsText(file);
  };

  /* ── Parse dims whenever SVG changes ─ */
  useEffect(() => {
    if (!svgText.trim()) { setSvgDims(null); return; }
    const d = parseSvgDimensions(svgText);
    setSvgDims(d);
  }, [svgText]);

  /* ── Convert ─ */
  const convert = useCallback(() => {
    if (!svgText.trim()) { showError('Provide SVG code or upload a file first.'); return; }
    if (!svgText.includes('<svg')) { showError('Invalid SVG — missing <svg> tag.'); return; }

    setError('');
    setIsConverting(true);

    let processed = svgText;
    if (!processed.includes('xmlns=')) {
      processed = processed.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    }

    const blob = new Blob([processed], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();

    img.onload = () => {
      const canvas = canvasRef.current;
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const effectiveBg = bgColor === 'custom' ? customBg : bgColor;
      if (effectiveBg !== 'transparent') {
        ctx.fillStyle = effectiveBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL(format, format === 'image/jpeg' ? 0.92 : undefined);
      setOutputUrl(dataUrl);
      setOutputDims({ w: canvas.width, h: canvas.height });
      setZoom(1);

      const decoded = atob(dataUrl.split(',')[1]);
      setOutputSize(decoded.length / 1024);

      URL.revokeObjectURL(url);
      setIsConverting(false);
    };
    img.onerror = () => {
      showError('Failed to render SVG. Check your markup for errors.');
      setIsConverting(false);
    };
    img.src = url;
  }, [svgText, scale, format, bgColor, customBg]);

  /* ── Download ─ */
  const download = () => {
    if (!outputUrl) return;
    const ext = FORMATS.find(f => f.id === format)?.ext ?? 'png';
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `${fileName}_${scale}x.${ext}`;
    a.click();
  };

  /* ── Copy data URL ─ */
  const copyDataUrl = () => {
    if (!outputUrl) return;
    navigator.clipboard.writeText(outputUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const loadSample = () => {
    setSvgText(SAMPLE_SVG);
    setFileName('sample');
    setOutputUrl(null);
    setMode('code');
  };

  const clearAll = () => {
    setSvgText(''); setOutputUrl(null); setError('');
    setSvgDims(null); setOutputDims(null);
  };

  const effectiveBg = bgColor === 'custom' ? customBg : bgColor;

  /* ─────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        .svgc * { box-sizing: border-box; }
        .svgc { font-family: 'DM Sans', 'Outfit', system-ui, sans-serif; }
        .svgc textarea { resize: vertical; }
        .svgc textarea::placeholder { color: rgba(255,255,255,0.18); }

        .svgc-tab {
          flex: 1; display: flex; align-items: center; justify-content: center;
          gap: 7px; padding: 10px 0;
          background: transparent; border: none; cursor: pointer;
          font-family: inherit; font-size: 13px; font-weight: 600;
          color: var(--text-muted,#6b6b80);
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
        }
        .svgc-tab.active {
          color: var(--accent-blue,#2563eb);
          border-bottom-color: var(--accent-blue,#2563eb);
        }
        .svgc-tab:hover:not(.active) { color: var(--text,#f0f0f5); }

        .svgc-btn-ghost {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 12px; border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          color: var(--text-muted,#6b6b80);
          font-family: inherit; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s ease;
        }
        .svgc-btn-ghost:hover {
          background: rgba(255,255,255,0.08);
          color: var(--text,#f0f0f5);
        }

        .svgc-convert-btn {
          width: 100%; padding: 13px;
          background: var(--accent-blue,#2563eb); color: #fff;
          border: none; border-radius: 10px;
          font-family: inherit; font-size: 14px; font-weight: 700;
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; gap: 8px;
          box-shadow: 0 4px 16px rgba(37,99,235,0.35);
          transition: all 0.15s ease;
        }
        .svgc-convert-btn:hover:not(:disabled) {
          background: #1d4ed8;
          box-shadow: 0 6px 20px rgba(37,99,235,0.45);
          transform: translateY(-1px);
        }
        .svgc-convert-btn:disabled { opacity: 0.5; cursor: default; transform: none; }

        .svgc-bg-swatch {
          width: 32px; height: 32px; border-radius: 8px;
          border: 2px solid transparent;
          cursor: pointer; transition: all 0.15s ease;
          position: relative; flex-shrink: 0;
        }
        .svgc-bg-swatch.active { border-color: var(--accent-blue,#2563eb); }
        .svgc-bg-swatch:hover { transform: scale(1.1); }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spinning { animation: spin 0.8s linear infinite; }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .fade-up { animation: fadeUp 0.3s ease both; }
      `}</style>

      <div className="svgc" style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(37,99,235,0.12)',
              border: '1px solid rgba(37,99,235,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Layers size={18} style={{ color: 'var(--accent-blue,#2563eb)' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text,#f0f0f5)', letterSpacing: '-0.4px' }}>
                SVG → Image
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                Convert vectors to PNG, JPEG or WebP at any resolution
              </p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="svgc-btn-ghost" onClick={loadSample}>
                <FileCode size={12} /> Sample
              </button>
              {svgText && (
                <button className="svgc-btn-ghost" onClick={clearAll} style={{ color: 'rgba(239,68,68,0.7)' }}>
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

          {/* LEFT — Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Mode tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid var(--border)',
              background: 'var(--surface-raised,#18181f)',
              borderRadius: '12px 12px 0 0',
              border: '1px solid var(--border)', borderBottom: 'none',
              overflow: 'hidden',
            }}>
              <button className={`svgc-tab${mode === 'code' ? ' active' : ''}`} onClick={() => setMode('code')}>
                <Code2 size={14} /> Paste Code
              </button>
              <button className={`svgc-tab${mode === 'file' ? ' active' : ''}`} onClick={() => setMode('file')}>
                <UploadCloud size={14} /> Upload File
              </button>
            </div>

            {/* Input panel */}
            <div style={{
              background: 'var(--surface-raised,#18181f)',
              border: '1px solid var(--border)',
              borderRadius: '0 0 12px 12px',
              overflow: 'hidden',
            }}>
              {mode === 'code' ? (
                <div style={{ position: 'relative' }}>
                  <textarea
                    value={svgText}
                    onChange={(e) => { setSvgText(e.target.value); setOutputUrl(null); }}
                    placeholder={'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">\n  <!-- your SVG here -->\n</svg>'}
                    style={{
                      width: '100%', minHeight: 240, padding: '16px 20px',
                      background: 'transparent', border: 'none',
                      color: 'var(--text,#f0f0f5)', outline: 'none',
                      fontFamily: '"DM Mono","Fira Code",monospace',
                      fontSize: 12.5, lineHeight: 1.65,
                    }}
                  />
                  {svgText && (
                    <div style={{
                      position: 'absolute', bottom: 10, right: 14,
                      fontSize: 10, color: 'var(--text-muted)', opacity: 0.5,
                      fontFamily: 'monospace', pointerEvents: 'none',
                    }}>
                      {svgText.length} chars
                      {svgDims && ` · ${svgDims.w}×${svgDims.h}`}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    minHeight: 240,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: 32, cursor: 'pointer',
                    border: isDragging ? '2px dashed var(--accent-blue)' : '2px dashed transparent',
                    background: isDragging ? 'rgba(37,99,235,0.05)' : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: 'rgba(37,99,235,0.1)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14, color: 'var(--accent-blue,#2563eb)',
                  }}>
                    <UploadCloud size={24} />
                  </div>
                  {svgText ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                        ✓ {fileName}.svg loaded
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {svgDims ? `${svgDims.w}×${svgDims.h}px · ` : ''}Click to replace
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                        Drop SVG here
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>or click to browse</div>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} onChange={(e) => e.target.files[0] && processFile(e.target.files[0])} accept=".svg,image/svg+xml" style={{ display: 'none' }} />
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="fade-up">
                <StatusBadge type="error">{error}</StatusBadge>
              </div>
            )}

            {/* Output preview */}
            {outputUrl && (
              <div className="fade-up">
                <CheckerPreview
                  outputUrl={outputUrl}
                  bgColor={effectiveBg}
                  zoom={zoom}
                  onZoomIn={() => setZoom(z => Math.min(z + 0.25, 3))}
                  onZoomOut={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                  onReset={() => setZoom(1)}
                  dimensions={outputDims}
                />

                {/* Output meta + actions */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
                  flexWrap: 'wrap',
                }}>
                  <StatusBadge type="success">
                    {FORMATS.find(f => f.id === format)?.label} · {fmtBytes(outputSize)}
                    {outputDims && ` · ${outputDims.w}×${outputDims.h}px`}
                  </StatusBadge>
                  <div style={{ flex: 1 }} />
                  <button className="svgc-btn-ghost" onClick={copyDataUrl}>
                    {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy URL'}
                  </button>
                  <button
                    onClick={download}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '8px 16px', borderRadius: 9,
                      background: 'rgba(16,185,129,0.12)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      color: '#10b981', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Download size={13} /> Download {FORMATS.find(f=>f.id===format)?.label}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Scale */}
            <div style={{
              background: 'var(--surface-raised,#18181f)',
              border: '1px solid var(--border)',
              borderRadius: 12, padding: 14,
            }}>
              <SectionLabel icon={Maximize2}>Output Scale</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                {SCALES.map(s => (
                  <button key={s.value} onClick={() => setScale(s.value)}
                    style={{
                      padding: '7px 4px', borderRadius: 8,
                      border: `1px solid ${scale === s.value ? 'var(--accent-blue,#2563eb)' : 'var(--border)'}`,
                      background: scale === s.value ? 'rgba(37,99,235,0.12)' : 'var(--surface,#111118)',
                      color: scale === s.value ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                    }}
                  >
                    {s.label}
                    {s.note && (
                      <div style={{ fontSize: 9, opacity: 0.65, marginTop: 1 }}>{s.note}</div>
                    )}
                  </button>
                ))}
              </div>
              {svgDims && (
                <div style={{
                  marginTop: 10, padding: '8px 10px', borderRadius: 8,
                  background: 'rgba(37,99,235,0.06)',
                  border: '1px solid rgba(37,99,235,0.12)',
                  fontSize: 11, color: 'var(--text-muted)',
                  fontFamily: 'monospace', textAlign: 'center',
                }}>
                  {svgDims.w}×{svgDims.h} → <span style={{ color: 'var(--accent-blue,#2563eb)', fontWeight: 700 }}>
                    {Math.round(svgDims.w * scale)}×{Math.round(svgDims.h * scale)}px
                  </span>
                </div>
              )}
            </div>

            {/* Format */}
            <div style={{
              background: 'var(--surface-raised,#18181f)',
              border: '1px solid var(--border)',
              borderRadius: 12, padding: 14,
            }}>
              <SectionLabel icon={ImageIcon}>Format</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {FORMATS.map(f => (
                  <button key={f.id} onClick={() => setFormat(f.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 12px', borderRadius: 9,
                      border: `1px solid ${format === f.id ? 'var(--accent-blue,#2563eb)' : 'var(--border)'}`,
                      background: format === f.id ? 'rgba(37,99,235,0.1)' : 'var(--surface,#111118)',
                      color: format === f.id ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    }}
                  >
                    <span>{f.label}</span>
                    <span style={{ fontSize: 10, opacity: 0.65, fontWeight: 400 }}>{f.note}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Background */}
            <div style={{
              background: 'var(--surface-raised,#18181f)',
              border: '1px solid var(--border)',
              borderRadius: 12, padding: 14,
            }}>
              <SectionLabel icon={Sliders}>Background</SectionLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {BG_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setBgColor(p.id)}
                    className={`svgc-bg-swatch${bgColor === p.id ? ' active' : ''}`}
                    title={p.label}
                    style={{
                      background: p.id === 'transparent'
                        ? 'repeating-conic-gradient(#444 0% 25%, #222 0% 50%) 0 0 / 10px 10px'
                        : p.id === 'custom'
                        ? 'linear-gradient(135deg, #f06, #6f0, #06f)'
                        : p.color,
                    }}
                  />
                ))}
              </div>
              {bgColor === 'custom' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <input
                    type="color" value={customBg}
                    onChange={e => setCustomBg(e.target.value)}
                    style={{ width: 36, height: 32, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', padding: 2 }}
                  />
                  <input
                    type="text" value={customBg}
                    onChange={e => setCustomBg(e.target.value)}
                    style={{
                      flex: 1, padding: '6px 10px',
                      background: 'var(--surface,#111118)',
                      border: '1px solid var(--border)',
                      borderRadius: 7, color: 'var(--text)',
                      fontFamily: 'monospace', fontSize: 12, outline: 'none',
                    }}
                  />
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>
                {bgColor === 'transparent' ? 'Alpha channel preserved' : `Solid fill: ${effectiveBg}`}
              </div>
            </div>

            {/* File name */}
            <div style={{
              background: 'var(--surface-raised,#18181f)',
              border: '1px solid var(--border)',
              borderRadius: 12, padding: 14,
            }}>
              <SectionLabel>File Name</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <input
                  type="text" value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  style={{
                    flex: 1, padding: '8px 12px',
                    background: 'var(--surface,#111118)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px 0 0 8px',
                    color: 'var(--text,#f0f0f5)',
                    fontFamily: 'monospace', fontSize: 12, outline: 'none',
                  }}
                />
                <div style={{
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)', borderLeft: 'none',
                  borderRadius: '0 8px 8px 0',
                  fontSize: 11, color: 'var(--text-muted)',
                  fontFamily: 'monospace', whiteSpace: 'nowrap',
                }}>
                  _{scale}x.{FORMATS.find(f=>f.id===format)?.ext}
                </div>
              </div>
            </div>

            {/* Convert CTA */}
            <button
              className="svgc-convert-btn"
              onClick={convert}
              disabled={isConverting || !svgText.trim()}
            >
              {isConverting
                ? <><RotateCcw size={16} className="spinning" /> Converting…</>
                : <><ImageIcon size={16} /> Convert to {FORMATS.find(f=>f.id===format)?.label}</>
              }
            </button>

          </div>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </>
  );
}