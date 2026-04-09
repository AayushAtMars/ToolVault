import { useState, useRef, useCallback , useEffect} from 'react';
import {
  Download,
  Film,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Music,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// ── Constants ─────────────────────────────────────────────────
const ACCEPTED_EXT  = ['.mp4','.webm','.avi','.mov','.mkv','.mpeg','.mpg'];
const ACCEPTED_MIME = ['video/mp4','video/webm','video/x-msvideo','video/quicktime','video/x-matroska','video/mpeg'];

const BITRATES = [
  { label: '64 kbps',  value: '64k',  desc: 'Voice quality' },
  { label: '128 kbps', value: '128k', desc: 'Standard'      },
  { label: '192 kbps', value: '192k', desc: 'High quality'  },
  { label: '320 kbps', value: '320k', desc: 'Maximum'       },
];

const FORMATS = [
  { label: 'MP3', value: 'mp3', codec: 'libmp3lame', mime: 'audio/mpeg', icon: '🎵' },
  { label: 'AAC', value: 'aac', codec: 'aac',        mime: 'audio/aac',  icon: '🎧' },
  { label: 'WAV', value: 'wav', codec: 'pcm_s16le',  mime: 'audio/wav',  icon: '🎼' },
  { label: 'OGG', value: 'ogg', codec: 'libvorbis',  mime: 'audio/ogg',  icon: '🔊' },
];

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
function formatDuration(s) {
  if (!s || isNaN(s)) return '—';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Load FFmpeg using plain absolute URLs (NOT import/toBlobURL) ──
// Files must exist at public/ffmpeg-core.js and public/ffmpeg-core.wasm
async function loadFFmpeg(ff) {
  if (ff.loaded) return;

  // Use window.location.origin to build absolute URLs to /public files
  // This is the ONLY correct way — never use import() or toBlobURL for public/ files
  const origin = window.location.origin;  // e.g. http://localhost:5173

  await ff.load({
    coreURL: `${origin}/ffmpeg-core.js`,
    wasmURL: `${origin}/ffmpeg-core.wasm`,
  });
}

// ── Component ─────────────────────────────────────────────────

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

export default function VideoToMp3() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage,   setStage]   = useState('idle');
  const [file,    setFile]    = useState(null);
  const [dur,     setDur]     = useState(null);
  const [prog,    setProg]    = useState(0);
  const [label,   setLabel]   = useState('');
  const [error,   setError]   = useState('');
  const [drag,    setDrag]    = useState(false);
  const [bitrate, setBitrate] = useState('192k');
  const [fmt,     setFmt]     = useState('mp3');
  const [blob,    setBlob]    = useState(null);
  const [outSize, setOutSize] = useState(null);

  const inputRef  = useRef(null);
  const ffmpegRef = useRef(new FFmpeg());

  // ── File ingest ──────────────────────────────────────────
  const ingest = useCallback((f) => {
    const ok = ACCEPTED_MIME.includes(f.type) ||
               ACCEPTED_EXT.some(e => f.name.toLowerCase().endsWith(e));
    if (!ok) {
      setError('Unsupported file. Use MP4, WebM, AVI, MOV or MKV.');
      setStage('error'); return;
    }
    setFile(f); setBlob(null); setError(''); setProg(0);
    const url = URL.createObjectURL(f);
    const v   = document.createElement('video');
    v.preload = 'metadata'; v.src = url;
    v.onloadedmetadata = () => { setDur(v.duration); URL.revokeObjectURL(url); };
    setStage('ready');
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0]; if (f) ingest(f);
  }, [ingest]);

  // ── FFmpeg conversion ────────────────────────────────────
  const convert = async () => {
    if (!file) return;
    setStage('converting'); setProg(0); setLabel('Loading FFmpeg…'); setBlob(null);

    const ff = ffmpegRef.current;
    try {
      await loadFFmpeg(ff);

      ff.on('progress', ({ progress: p }) => {
        const pct = Math.min(99, Math.round(p * 100));
        setProg(pct);
        if      (pct < 20) setLabel('Demuxing video stream…');
        else if (pct < 55) setLabel(`Encoding → ${fmt.toUpperCase()} @ ${bitrate}…`);
        else if (pct < 85) setLabel('Applying audio filters…');
        else               setLabel('Finalising output…');
      });

      const ext    = file.name.split('.').pop();
      const inF    = `input.${ext}`;
      const outF   = `output.${fmt}`;
      const selFmt = FORMATS.find(f => f.value === fmt);

      setLabel('Reading video into memory…');
      await ff.writeFile(inF, await fetchFile(file));

      setLabel(`Encoding to ${fmt.toUpperCase()}…`);
      await ff.exec(['-i', inF, '-vn', '-acodec', selFmt.codec, '-ab', bitrate, '-ar', '44100', outF]);

      setLabel('Preparing download…');
      const data    = await ff.readFile(outF);
      const outBlob = new Blob([data.buffer], { type: selFmt.mime });
      setBlob(outBlob);
      setOutSize(outBlob.size);

      await ff.deleteFile(inF);
      await ff.deleteFile(outF);
      ff.off('progress');

      setProg(100); setLabel('Done!');
      setTimeout(() => setStage('done'), 400);

    } catch (err) {
      console.error('FFmpeg error:', err);
      ff.off?.('progress');
      setError(err?.message || 'Conversion failed.');
      setStage('error');
    }
  };

  // ── Real download ─────────────────────────────────────────
  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}.${fmt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = () => {
    try { ffmpegRef.current.off?.('progress'); } catch {}
    setStage('idle'); setFile(null); setDur(null);
    setProg(0); setLabel(''); setError('');
    setBlob(null); setOutSize(null);
  };

  const basename = file?.name.replace(/\.[^/.]+$/, '') ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── IDLE ── */}
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
          <input ref={inputRef} type="file" accept={ACCEPTED_EXT.join(',')}
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && ingest(e.target.files[0])} />
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: drag ? 'rgba(37,99,235,0.12)' : 'var(--surface,#111118)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}>
            <Film size={28} color={drag ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)'} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {drag ? 'Drop to upload' : 'Drop your video here'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              or <span style={{ color: 'var(--accent-blue,#2563EB)', fontWeight: 500 }}>click to browse</span>
              <br />MP4 · WebM · AVI · MOV · MKV
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {ACCEPTED_EXT.map(ext => (
              <span key={ext} style={{
                fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
                padding: '3px 8px', borderRadius: 100,
                background: 'var(--surface,#111118)', border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}>{ext.toUpperCase()}</span>
            ))}
          </div>
        </label>
      )}

      {/* ── ERROR ── */}
      {stage === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            padding: 16, borderRadius: 10,
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
          }}>
            <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>Error</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{error}</div>
            </div>
            <button onClick={reset} style={ib}><X size={14} /></button>
          </div>
          <button onClick={reset} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '10px', borderRadius: 9,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            <RotateCcw size={13} /> Try again
          </button>
        </div>
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
              background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Film size={20} color="var(--accent-blue,#2563EB)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                <span>{formatBytes(file.size)}</span>
                {dur && <><span>·</span><span>{formatDuration(dur)}</span></>}
              </div>
            </div>
            <button onClick={reset} style={ib}><X size={14} /></button>
          </div>

          {/* Format */}
          <div>
            <label style={L}>Output Format</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {FORMATS.map(f => (
                <button key={f.value} onClick={() => setFmt(f.value)} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 8px', borderRadius: 9,
                  border: `1px solid ${fmt === f.value ? 'var(--accent-blue,#2563EB)' : 'var(--border)'}`,
                  background: fmt === f.value ? 'rgba(37,99,235,0.08)' : 'transparent',
                  color: fmt === f.value ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 18 }}>{f.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bitrate */}
          <div>
            <label style={L}>Audio Bitrate</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {BITRATES.map(b => (
                <button key={b.value} onClick={() => setBitrate(b.value)} style={{
                  padding: '10px 6px', borderRadius: 9, textAlign: 'center',
                  border: `1px solid ${bitrate === b.value ? 'var(--accent-blue,#2563EB)' : 'var(--border)'}`,
                  background: bitrate === b.value ? 'rgba(37,99,235,0.08)' : 'transparent',
                  color: bitrate === b.value ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', marginBottom: 3 }}>{b.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{b.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={convert} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            padding: '13px 20px', borderRadius: 9, border: 'none',
            background: 'var(--accent-blue,#2563EB)', color: 'white',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)', transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Music size={15} />
            Extract Audio → {fmt.toUpperCase()}
          </button>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            🔒 Runs 100% in your browser — your file never leaves your device.
          </p>
        </div>
      )}

      {/* ── CONVERTING ── */}
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
            <Music size={24} color="var(--accent-blue,#2563EB)" />
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: '2px solid transparent', borderTopColor: 'var(--accent-blue,#2563EB)',
              animation: 'spin 0.9s linear infinite',
            }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Converting…</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, fontFamily: 'monospace' }}>{file?.name}</div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 100, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%', borderRadius: 100, width: `${prog}%`,
              background: 'linear-gradient(90deg,#2563EB,#60a5fa)',
              transition: 'width 0.4s ease', boxShadow: '0 0 8px rgba(37,99,235,0.5)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'monospace' }}>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{label}</span>
            <span style={{ color: 'var(--accent-blue,#2563EB)', fontWeight: 700 }}>{Math.round(prog)}%</span>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {stage === 'done' && blob && (
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
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, fontFamily: 'monospace' }}>
              {basename}.{fmt}
            </div>
            <div style={{
              display: 'inline-flex', gap: 24, padding: '10px 20px', borderRadius: 8,
              background: 'var(--surface-raised,#18181f)', border: '1px solid var(--border)', marginBottom: 24,
            }}>
              {[
                { label: 'FORMAT',   value: fmt.toUpperCase() },
                { label: 'BITRATE',  value: bitrate },
                { label: 'SIZE',     value: formatBytes(outSize) },
                dur && { label: 'DURATION', value: formatDuration(dur) },
              ].filter(Boolean).map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{value}</div>
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
              Download {fmt.toUpperCase()}
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
            <RotateCcw size={13} /> Convert another file
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
  width: 30, height: 30, borderRadius: 6, flexShrink: 0,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
};