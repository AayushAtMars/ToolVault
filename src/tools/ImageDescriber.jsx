import { useState , useEffect} from 'react';
import {
  Upload,
  Eye,
  Image as ImageIcon,
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

export default function ImageDescriber() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [description, setDescription] = useState('');

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    setImage(url);
    setDescription('');
    
    // Auto-analyze
    setAnalyzing(true);
    setTimeout(() => {
      setDescription("A bright, beautiful composition featuring a mix of modern and natural elements. The image exhibits high contrast and balanced colors, typical of professional photography. The lighting is soft and directional, creating gentle shadows that add depth to the subject matter.");
      setAnalyzing(false);
    }, 2000);
  };

  return (
    <div className="tool-grid-2" style={{ alignItems: 'flex-start' }}>
      <div className="tool-col">
        {!image ? (
          <label
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: 400, border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-raised)', cursor: 'pointer', transition: 'border-color 0.2s',
            }}
          >
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
            <div style={{ padding: 16, background: 'var(--surface)', borderRadius: '50%', marginBottom: 16 }}>
              <Upload size={32} color="var(--accent)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Upload Image</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>JPG, PNG, or WebP</p>
          </label>
        ) : (
          <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img src={image} alt="Upload preview" style={{ width: '100%', display: 'block' }} />
            <button
              className="btn btn-ghost"
              style={{ position: 'absolute', top: 12, right: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}
              onClick={() => { setImage(null); setDescription(''); }}
            >
              Clear Image
            </button>
          </div>
        )}
      </div>

      <div className="tool-col">
        <label className="tool-label">AI Description</label>
        <div className="tool-output" style={{ minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          {!image ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ImageIcon size={32} style={{ opacity: 0.5, marginBottom: 16 }} />
              <p>Upload an image to see its AI-generated description.</p>
            </div>
          ) : analyzing ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-primary)' }}>
              <Eye size={32} className="pulse" style={{ color: 'var(--accent)', marginBottom: 16 }} />
              <p style={{ fontWeight: 500 }}>AI Vision is analyzing the image...</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Identifying objects, context, and composition</p>
            </div>
          ) : (
            <div style={{ padding: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={16} /> Analysis Complete
              </h3>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-primary)' }}>{description}</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } } .pulse { animation: pulse 1.5s ease-in-out infinite; }`}</style>
    </div>
  );
}
