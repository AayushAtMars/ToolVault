import { useState, useCallback, useRef , useEffect} from 'react';
import {
  Download,
  RotateCcw,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Copy,
  Layers,
  Check,
  ArrowUpDown,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;

function fmtBytes(b) {
  if (!b) return '—';
  const k = 1024;
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${['B','KB','MB','GB'][i]}`;
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

export default function RotatePdf() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage, setStage]         = useState('idle');
  const [file, setFile]           = useState(null);
  const [error, setError]         = useState('');
  const [drag, setDrag]           = useState(false);
  const [pdfBytes, setPdfBytes]   = useState(null);
  const [pages, setPages]         = useState([]);       // { rotation, deleted }
  const [thumbUrls, setThumbUrls] = useState([]);
  const [outBlob, setOutBlob]     = useState(null);

  // Multi-select
  const [selected, setSelected]   = useState(new Set());
  const [lastClicked, setLastClicked] = useState(null);

  // Preview modal
  const [previewIdx, setPreviewIdx] = useState(null);

  // Drag-to-reorder
  const [dragIdx, setDragIdx]     = useState(null);
  const [dropIdx, setDropIdx]     = useState(null);

  const inputRef = useRef(null);

  /* ── ingest ─────────────────────────────────────────────── */
  const ingest = async (files) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.'); return;
    }
    setError('');
    try {
      const ab    = await f.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const pdf   = await pdfjsLib.getDocument({ data: bytes.slice().buffer }).promise;
      const pageList = [], thumbs = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        pageList.push({ rotation: 0, deleted: false });
        const page    = await pdf.getPage(i);
        const vp      = page.getViewport({ scale: 0.22 });
        const canvas  = document.createElement('canvas');
        canvas.width  = vp.width; canvas.height = vp.height;
        const ctx     = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        thumbs.push(canvas.toDataURL('image/jpeg', 0.65));
      }

      setFile(f); setPdfBytes(bytes); setPages(pageList); setThumbUrls(thumbs);
      setSelected(new Set()); setLastClicked(null);
      setStage('ready');
    } catch(err) {
      console.error(err); setError('Failed to load PDF. It may be corrupted or protected.');
    }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, []);

  /* ── selection ──────────────────────────────────────────── */
  const toggleSelect = (idx, e) => {
    const ns = new Set(selected);
    if (e.shiftKey && lastClicked !== null) {
      // Range select
      const lo = Math.min(lastClicked, idx), hi = Math.max(lastClicked, idx);
      for (let i = lo; i <= hi; i++) ns.add(i);
    } else if (e.ctrlKey || e.metaKey) {
      ns.has(idx) ? ns.delete(idx) : ns.add(idx);
    } else {
      if (ns.size === 1 && ns.has(idx)) { ns.clear(); }
      else { ns.clear(); ns.add(idx); }
    }
    setSelected(ns); setLastClicked(idx);
  };

  const selectAll  = () => setSelected(new Set(pages.map((_,i)=>i)));
  const deselectAll = () => setSelected(new Set());

  /* ── rotate ─────────────────────────────────────────────── */
  const rotateSel = (deg) => {
    if (!selected.size) return;
    setPages(prev => prev.map((p,i) => selected.has(i) ? { ...p, rotation: (p.rotation+deg+360)%360 } : p));
  };
  const rotateOne = (idx, deg) => {
    setPages(prev => prev.map((p,i) => i===idx ? { ...p, rotation: (p.rotation+deg+360)%360 } : p));
  };
  const rotateAll = (deg) => {
    setPages(prev => prev.map(p => ({ ...p, rotation: (p.rotation+deg+360)%360 })));
  };
  const resetRot  = (idx) => {
    setPages(prev => prev.map((p,i) => i===idx ? { ...p, rotation: 0 } : p));
  };

  /* ── delete / restore ───────────────────────────────────── */
  const deleteSel = () => {
    if (!selected.size) return;
    const active = pages.filter(p=>!p.deleted).length;
    if (active - selected.size < 1) { setError('Cannot delete all pages.'); return; }
    setPages(prev => prev.map((p,i) => selected.has(i) ? { ...p, deleted: true } : p));
    setSelected(new Set());
  };
  const restoreAll = () => setPages(prev => prev.map(p => ({ ...p, deleted: false })));

  /* ── duplicate ──────────────────────────────────────────── */
  const duplicateSel = () => {
    if (!selected.size) return;
    const idxArr = [...selected].sort((a,b)=>a-b);
    setPages(prev => {
      const n = [...prev];
      let offset = 0;
      for (const i of idxArr) {
        n.splice(i + 1 + offset, 0, { ...prev[i] });
        offset++;
      }
      return n;
    });
    setThumbUrls(prev => {
      const n = [...prev];
      let offset = 0;
      for (const i of idxArr) {
        n.splice(i + 1 + offset, 0, prev[i]);
        offset++;
      }
      return n;
    });
    setSelected(new Set());
  };

  /* ── drag-to-reorder ────────────────────────────────────── */
  const onDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver  = (e, idx) => { e.preventDefault(); setDropIdx(idx); };
  const onDragEnd   = () => {
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
      setPages(prev => {
        const n = [...prev]; const [el] = n.splice(dragIdx,1); n.splice(dropIdx,0,el); return n;
      });
      setThumbUrls(prev => {
        const n = [...prev]; const [el] = n.splice(dragIdx,1); n.splice(dropIdx,0,el); return n;
      });
    }
    setDragIdx(null); setDropIdx(null);
  };

  /* ── preview modal nav ──────────────────────────────────── */
  const activePagesIdx = pages.map((p,i)=>(!p.deleted?i:null)).filter(x=>x!==null);
  const previewNext = () => {
    const pos = activePagesIdx.indexOf(previewIdx);
    if (pos < activePagesIdx.length-1) setPreviewIdx(activePagesIdx[pos+1]);
  };
  const previewPrev = () => {
    const pos = activePagesIdx.indexOf(previewIdx);
    if (pos > 0) setPreviewIdx(activePagesIdx[pos-1]);
  };

  /* ── export ─────────────────────────────────────────────── */
  const handleApply = async () => {
    setStage('processing');
    try {
      const srcDoc  = await PDFDocument.load(pdfBytes.slice().buffer);
      const outDoc  = await PDFDocument.create();
      const active  = pages.map((p,i)=>(!p.deleted?i:null)).filter(x=>x!==null);
      const copied  = await outDoc.copyPages(srcDoc, active);
      copied.forEach((page, ci) => {
        const orig = pages[active[ci]];
        const cur  = page.getRotation().angle;
        page.setRotation(degrees(cur + orig.rotation));
        outDoc.addPage(page);
      });
      const bytes = await outDoc.save();
      setOutBlob(new Blob([bytes],{type:'application/pdf'}));
      setStage('done');
    } catch(err) { console.error(err); setError('Export failed: ' + err.message); setStage('ready'); }
  };

  const download = () => {
    if (!outBlob) return;
    const url = URL.createObjectURL(outBlob);
    const a = document.createElement('a');
    a.href = url; a.download = `${file.name.replace(/\.pdf$/i,'')}_edited.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const reset = () => { setStage('idle'); setFile(null); setPdfBytes(null); setPages([]); setThumbUrls([]); setOutBlob(null); setError(''); setSelected(new Set()); };

  const deletedCount = pages.filter(p=>p.deleted).length;
  const activeCount  = pages.filter(p=>!p.deleted).length;
  const selArr       = [...selected].sort((a,b)=>a-b);

  /* ════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Error */}
      {error && (
        <div style={{ display:'flex', gap:10, alignItems:'center', padding:'11px 16px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={15} style={{ color:'#ef4444', flexShrink:0 }}/>
          <div style={{ flex:1, fontSize:13, color:'#ef4444' }}>{error}</div>
          <button onClick={()=>setError('')} style={IB}><X size={12}/></button>
        </div>
      )}

      {/* ══ IDLE ══ */}
      {stage === 'idle' && (
        <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding: isMobile ? '48px 20px' : '80px 40px',
            border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:16,
            background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.2s' }}>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
          <div style={{ width:72, height:72, borderRadius:20, background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}>
            <UploadCloud size={30} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:17, fontWeight:600, marginBottom:6 }}>{drag?'Drop PDF here':'Drop a PDF to manage pages'}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span></div>
            <div style={{ marginTop:10, display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
              {['Rotate Pages','Delete Pages','Reorder','Duplicate','Preview'].map(f=>(
                <span key={f} style={{ fontSize:10, padding:'3px 9px', borderRadius:100, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text-muted)', fontWeight:600 }}>{f}</span>
              ))}
            </div>
          </div>
        </label>
      )}

      {/* ══ READY ══ */}
      {stage === 'ready' && (
        <>
          {/* ── Top bar ── */}
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'var(--surface-raised,#18181f)', borderRadius:12, border:'1px solid var(--border)', flexWrap:'wrap' }}>

            {/* File info */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:4 }}>
              <div style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:6, background:'rgba(37,99,235,0.1)', color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>
                {activeCount} / {pages.length}
              </div>
              <span style={{ fontSize:12, color:'var(--text-muted)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</span>
            </div>

            <div style={{ width:1, height:20, background:'var(--border)', margin:'0 4px' }}/>

            {/* Global rotate */}
            <button onClick={()=>rotateAll(-90)} style={TB} title="Rotate all left"><RotateCcw size={13}/> All ↺</button>
            <button onClick={()=>rotateAll(90)}  style={TB} title="Rotate all right"><RotateCw size={13}/> All ↻</button>

            <div style={{ width:1, height:20, background:'var(--border)', margin:'0 4px' }}/>

            {/* Selection actions */}
            <button onClick={selectAll}   style={TB}><Check size={13}/> All</button>
            <button onClick={deselectAll} style={TB} disabled={!selected.size}><X size={13}/> None</button>

            {selected.size > 0 && (
              <>
                <div style={{ width:1, height:20, background:'var(--border)', margin:'0 4px' }}/>
                <span style={{ fontSize:11, color:'var(--accent-blue,#2563EB)', fontWeight:600, fontFamily:'monospace' }}>{selected.size} selected</span>
                <button onClick={()=>rotateSel(-90)} style={{...TB,color:'var(--accent-blue,#2563EB)'}} title="Rotate selected left"><RotateCcw size={13}/></button>
                <button onClick={()=>rotateSel(90)}  style={{...TB,color:'var(--accent-blue,#2563EB)'}} title="Rotate selected right"><RotateCw  size={13}/></button>
                <button onClick={duplicateSel}        style={{...TB,color:'var(--accent-blue,#2563EB)'}} title="Duplicate selected"><Copy size={13}/></button>
                <button onClick={deleteSel}           style={{...TB,color:'#ef4444'}} title="Delete selected"><Trash2 size={13}/></button>
              </>
            )}

            {deletedCount > 0 && (
              <>
                <div style={{ width:1, height:20, background:'var(--border)', margin:'0 4px' }}/>
                <button onClick={restoreAll} style={{ ...TB, color:'#16a34a' }}>↩ Restore {deletedCount}</button>
              </>
            )}

            <div style={{ flex:1 }}/>

            <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace' }}>
              Drag to reorder · Click to select
            </div>
          </div>

          {/* ── Page grid ── */}
          <div style={{ display:'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? Math.min(140, 148) : 148}px,1fr))`, gap:14 }}>
            {pages.map((p, i) => {
              const isSel   = selected.has(i);
              const isDrop  = dropIdx === i;
              return (
                <div key={i}
                  draggable
                  onDragStart={e=>onDragStart(e,i)}
                  onDragOver={e=>onDragOver(e,i)}
                  onDragEnd={onDragEnd}
                  onClick={e=>{ if (!p.deleted) toggleSelect(i,e); }}
                  style={{
                    display:'flex', flexDirection:'column', gap:8,
                    cursor: p.deleted ? 'default' : 'pointer',
                    transition:'transform 0.15s, opacity 0.15s',
                    transform: isDrop ? 'scale(1.03)' : 'scale(1)',
                    opacity: p.deleted ? 0.35 : 1,
                  }}>

                  {/* Thumb card */}
                  <div style={{
                    position:'relative', borderRadius:10, overflow:'hidden',
                    border: isSel
                      ? '2px solid var(--accent-blue,#2563EB)'
                      : isDrop ? '2px dashed var(--accent-blue,#2563EB)'
                      : '1px solid var(--border)',
                    background:'#fff',
                    aspectRatio:'1/1.41',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow: isSel ? '0 0 0 3px rgba(37,99,235,0.2)' : '0 2px 8px rgba(0,0,0,0.15)',
                    transition:'all 0.15s',
                  }}>
                    {/* Thumbnail */}
                    <img src={thumbUrls[i]} alt={`Page ${i+1}`} draggable={false}
                      style={{ maxWidth:'94%', maxHeight:'94%', display:'block',
                        transform:`rotate(${p.rotation}deg)`,
                        transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                        pointerEvents:'none' }}/>

                    {/* Selection checkbox */}
                    <div style={{ position:'absolute', top:6, left:6, width:18, height:18, borderRadius:5,
                      background: isSel ? 'var(--accent-blue,#2563EB)' : 'rgba(255,255,255,0.9)',
                      border: isSel ? '2px solid var(--accent-blue,#2563EB)' : '1.5px solid var(--border)',
                      display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                      pointerEvents:'none' }}>
                      {isSel && <Check size={11} color="white" strokeWidth={3}/>}
                    </div>

                    {/* Rotation badge */}
                    {p.rotation !== 0 && (
                      <div style={{ position:'absolute', top:6, right:6, background:'rgba(37,99,235,0.9)',
                        color:'white', fontSize:9, fontWeight:700, padding:'2px 5px', borderRadius:5,
                        fontFamily:'monospace', pointerEvents:'none' }}>{p.rotation}°</div>
                    )}

                    {/* Deleted overlay */}
                    {p.deleted && (
                      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:9 }}>
                        <span style={{ fontSize:10, color:'#ef4444', fontWeight:700, letterSpacing:'0.06em' }}>DELETED</span>
                      </div>
                    )}

                    {/* Hover actions (shown on non-deleted pages) */}
                    {!p.deleted && (
                      <div className="page-actions" style={{ position:'absolute', bottom:0, left:0, right:0,
                        display:'flex', justifyContent:'center', gap:4, padding:'6px',
                        background:'linear-gradient(transparent,rgba(0,0,0,0.6))',
                        opacity:0, transition:'opacity 0.15s' }}>
                        <button onClick={e=>{e.stopPropagation();rotateOne(i,-90);}} style={MiniBtn} title="Rotate left"><RotateCcw size={11}/></button>
                        <button onClick={e=>{e.stopPropagation();rotateOne(i,90);}}  style={MiniBtn} title="Rotate right"><RotateCw  size={11}/></button>
                        <button onClick={e=>{e.stopPropagation();setPreviewIdx(i);}} style={MiniBtn} title="Preview"><Eye size={11}/></button>
                        {p.rotation!==0&&<button onClick={e=>{e.stopPropagation();resetRot(i);}} style={MiniBtn} title="Reset rotation"><X size={11}/></button>}
                        <button onClick={e=>{e.stopPropagation();
                          if (activeCount > 1) { setPages(prev=>prev.map((pp,ii)=>ii===i?{...pp,deleted:true}:pp)); setSelected(s=>{const n=new Set(s);n.delete(i);return n;});}
                          else setError('Cannot delete the last page.');
                        }} style={{...MiniBtn,color:'#ef4444'}} title="Delete"><Trash2 size={11}/></button>
                      </div>
                    )}
                  </div>

                  {/* Page label */}
                  <div style={{ textAlign:'center', fontSize:11, fontWeight:600,
                    color: isSel ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)', fontFamily:'monospace' }}>
                    {p.deleted ? <span style={{ color:'#ef4444' }}>✕ Deleted</span> : `pg ${i+1}`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Footer ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px',
            background:'var(--surface-raised,#18181f)', borderRadius:12, border:'1px solid var(--border)' }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'monospace' }}>
              {activeCount} active · {deletedCount} deleted · {pages.reduce((s,p)=>s+(p.rotation!==0?1:0),0)} rotated
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={reset} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={handleApply} style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 20px', borderRadius:9, border:'none',
                background:'var(--accent-blue,#2563EB)', color:'white', fontSize:13, fontWeight:600, cursor:'pointer',
                boxShadow:'0 4px 14px rgba(37,99,235,0.3)', transition:'all 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                <CheckCircle2 size={14}/> Apply & Save PDF
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══ PROCESSING ══ */}
      {stage === 'processing' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'64px 20px', textAlign:'center',
          background:'var(--surface-raised,#18181f)', borderRadius:16, border:'1px solid var(--border)' }}>
          <div style={{ width:52, height:52, border:'3px solid rgba(37,99,235,0.15)', borderTopColor:'var(--accent-blue,#2563EB)',
            borderRadius:'50%', animation:'spin 0.8s linear infinite', marginBottom:20 }}/>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:6 }}>Applying changes…</div>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>Building your PDF with {activeCount} pages</div>
        </div>
      )}

      {/* ══ DONE ══ */}
      {stage === 'done' && outBlob && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 24px', textAlign:'center',
          background:'rgba(22,163,74,0.04)', borderRadius:16, border:'1px solid rgba(22,163,74,0.2)' }}>
          <div style={{ width:68, height:68, borderRadius:'50%', background:'rgba(22,163,74,0.1)', border:'1px solid rgba(22,163,74,0.25)',
            display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
            <CheckCircle2 size={30} color="#16a34a"/>
          </div>
          <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>PDF Ready!</div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24, lineHeight:1.6 }}>
            {activeCount} pages · {pages.reduce((s,p)=>s+(p.rotation!==0?1:0),0)} rotated · {deletedCount} removed
          </div>

          {/* Stats row */}
          <div style={{ display:'inline-flex', gap:24, padding:'10px 20px', borderRadius:10,
            background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', marginBottom:24 }}>
            {[{l:'PAGES',v:activeCount},{l:'SIZE',v:fmtBytes(outBlob.size)},{l:'REMOVED',v:deletedCount}].map(({l,v})=>(
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:9, letterSpacing:'0.1em', color:'var(--text-muted)', marginBottom:4 }}>{l}</div>
                <div style={{ fontWeight:700, fontSize:13, fontFamily:'monospace' }}>{v}</div>
              </div>
            ))}
          </div>

          <button onClick={download} style={{ display:'flex', alignItems:'center', gap:8, padding:'13px 28px', borderRadius:10, border:'none',
            background:'#16a34a', color:'white', fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:12,
            boxShadow:'0 4px 16px rgba(22,163,74,0.3)', transition:'all 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            <Download size={16}/> Download PDF
          </button>
          <button onClick={reset} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:13, cursor:'pointer', padding:'8px' }}>
            ← Edit another file
          </button>
        </div>
      )}

      {/* ══ PREVIEW MODAL ══ */}
      {previewIdx !== null && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)',
          zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setPreviewIdx(null)}>
          <div style={{ background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:16, padding:24,
            maxWidth:480, width:'90%', display:'flex', flexDirection:'column', gap:16 }}
            onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:14, fontWeight:700 }}>
                Page {previewIdx+1}
                {pages[previewIdx]?.rotation!==0&&<span style={{ fontSize:11, marginLeft:8, background:'rgba(37,99,235,0.12)', color:'var(--accent-blue,#2563EB)', padding:'2px 8px', borderRadius:6, fontFamily:'monospace' }}>{pages[previewIdx].rotation}°</span>}
              </div>
              <button onClick={()=>setPreviewIdx(null)} style={IB}><X size={13}/></button>
            </div>

            {/* Image */}
            <div style={{ background:'#fff', borderRadius:10, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', padding:20, minHeight:320 }}>
              <img src={thumbUrls[previewIdx]} alt={`Page ${previewIdx+1}`} draggable={false}
                style={{ maxWidth:'100%', maxHeight:360, display:'block',
                  transform:`rotate(${pages[previewIdx]?.rotation||0}deg)`,
                  transition:'transform 0.3s', borderRadius:4 }}/>
            </div>

            {/* Controls */}
            <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
              <button onClick={previewPrev} disabled={activePagesIdx.indexOf(previewIdx)===0}
                style={{...IB,opacity:activePagesIdx.indexOf(previewIdx)===0?0.3:1}}><ChevronLeft size={14}/></button>
              <button onClick={()=>rotateOne(previewIdx,-90)} style={{ ...IB, width:'auto', padding:'0 14px', gap:6 }}><RotateCcw size={13}/> Left</button>
              <button onClick={()=>rotateOne(previewIdx,90)}  style={{ ...IB, width:'auto', padding:'0 14px', gap:6 }}><RotateCw  size={13}/> Right</button>
              {pages[previewIdx]?.rotation!==0&&<button onClick={()=>resetRot(previewIdx)} style={{...IB,fontSize:11,width:'auto',padding:'0 10px'}}>Reset</button>}
              <button onClick={previewNext} disabled={activePagesIdx.indexOf(previewIdx)===activePagesIdx.length-1}
                style={{...IB,opacity:activePagesIdx.indexOf(previewIdx)===activePagesIdx.length-1?0.3:1}}><ChevronRight size={14}/></button>
            </div>

            <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)' }}>
              {activePagesIdx.indexOf(previewIdx)+1} of {activePagesIdx.length} pages
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        div:hover .page-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

/* ── Shared styles ─────────────────────────────────────────── */
const IB = {
  display:'flex', alignItems:'center', justifyContent:'center',
  width:30, height:30, borderRadius:7, flexShrink:0,
  border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)',
  color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s',
};
const TB = {
  display:'flex', alignItems:'center', gap:5,
  padding:'6px 11px', borderRadius:7, fontSize:11, fontWeight:600,
  border:'1px solid var(--border)', background:'rgba(255,255,255,0.02)',
  color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s',
};
const MiniBtn = {
  display:'flex', alignItems:'center', justifyContent:'center',
  width:26, height:26, borderRadius:6, flexShrink:0,
  border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.15)',
  color:'white', cursor:'pointer', transition:'all 0.12s',
};