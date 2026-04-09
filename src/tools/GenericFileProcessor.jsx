import { useState } from 'react';
import {
  Upload,
  Download,
  File,
  Loader
} from "lucide-react";

export default function GenericFileProcessor({ accept, title, description, processLabel = 'Process File', simulateTime = 3000 }) {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) setFiles([...e.dataTransfer.files]);
  };

  const handleChange = (e) => {
    if (e.target.files?.length > 0) setFiles([...e.target.files]);
  };

  const process = () => {
    if (files.length === 0) return;
    setProcessing(true);
    setProgress(0);
    setDone(false);

    let p = 0;
    const interval = setInterval(() => {
      p += 100 / (simulateTime / 100);
      if (p >= 100) {
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => {
          setProcessing(false);
          setDone(true);
        }, 300);
      } else {
        setProgress(p);
      }
    }, 100);
  };

  const handleDownload = () => {
    files.forEach(f => {
      const url = URL.createObjectURL(f);
      const a = document.createElement('a');
      a.href = url;
      a.download = `processed-${f.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  if (done) {
    return (
      <div style={{ padding: 48, background: 'var(--surface-raised)', border: '1px solid var(--success)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <div style={{ padding: 16, background: 'var(--surface)', borderRadius: '50%', marginBottom: 16, display: 'inline-block' }}>
          <Download size={40} color="var(--success)" />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Success!</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>Your files have been processed successfully.</p>
        <div className="tool-actions" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={handleDownload}>Download All</button>
          <button className="btn btn-ghost" onClick={() => { setFiles([]); setDone(false); }}>Start Over</button>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div style={{ padding: 48, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <Loader size={32} className="spin" color="var(--accent)" style={{ marginBottom: 16 }} />
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Processing...</h3>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', margin: '24px auto', maxWidth: 300 }}>
          <div style={{ height: '100%', background: 'var(--accent)', width: `${progress}%` }} />
        </div>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } .spin { animation: spin 1.5s linear infinite; }`}</style>
      </div>
    );
  }

  return (
    <div>
      <label
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 64, border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
          background: 'var(--surface-raised)', cursor: 'pointer', transition: 'border-color 0.2s',
          marginBottom: 24,
        }}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        onDrop={handleDrop}
      >
        <input type="file" accept={accept} multiple style={{ display: 'none' }} onChange={handleChange} />
        <div style={{ padding: 16, background: 'var(--surface)', borderRadius: '50%', marginBottom: 16 }}>
          <Upload size={32} color="var(--accent)" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{description}</p>
      </label>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)' }}>
              <File size={20} color="var(--text-muted)" />
              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{f.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(f.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="tool-actions">
          <button className="btn btn-primary" onClick={process}>{processLabel}</button>
          <button className="btn btn-ghost" onClick={() => setFiles([])}>Clear</button>
        </div>
      )}
    </div>
  );
}
