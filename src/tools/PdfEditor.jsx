import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Download,
  X,
  RotateCcw,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Type,
  ImagePlus,
  Pencil,
  Eraser,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  ZoomIn,
  ZoomOut,
  MousePointer,
  UploadCloud,
  Highlighter,
  Stamp,
  PenLine,
  Copy,
  Square,
  Minus,
  Undo2,
  Redo2,
  Edit3,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight
} from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;

let _id = 0;
const uid = () => `e_${++_id}_${Date.now()}`;

const hex2rgb = (h) => {
  const n = h.replace('#','');
  return rgb(parseInt(n.slice(0,2),16)/255, parseInt(n.slice(2,4),16)/255, parseInt(n.slice(4,6),16)/255);
};
const fmtBytes = (b) => !b ? '—' : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(2)} MB`;

const STAMPS = [
  { label:'✓ Approved',    color:'#16a34a', bg:'rgba(22,163,74,0.12)'  },
  { label:'✗ Rejected',    color:'#dc2626', bg:'rgba(220,38,38,0.12)'  },
  { label:'⚑ Review',     color:'#d97706', bg:'rgba(217,119,6,0.12)'   },
  { label:'★ Important',   color:'#7c3aed', bg:'rgba(124,58,237,0.12)' },
  { label:'◯ Draft',      color:'#0891b2', bg:'rgba(8,145,178,0.12)'   },
  { label:'■ Confidential',color:'#111827', bg:'rgba(17,24,39,0.15)'   },
];
const HL_COLORS   = ['#fef08a','#86efac','#93c5fd','#f9a8d4','#fdba74','#d8b4fe'];
const FONT_FAMILIES = ['Arial','Times New Roman','Courier New','Georgia','Verdana','Helvetica','Trebuchet MS','Impact','Tahoma'];
const FONT_SIZES    = [8,9,10,11,12,13,14,16,18,20,22,24,28,32,36,40,48,60,72];
const DRAG_TOOLS    = ['text','highlight','redact','shape-rect','shape-line'];


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

export default function PdfEditor() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;

  const [stage, setStage]           = useState('idle');
  const [file, setFile]             = useState(null);
  const [error, setError]           = useState('');
  const [drag, setDrag]             = useState(false);
  const [isReading, setIsReading]   = useState(false);
  const [outBlob, setOutBlob]       = useState(null);
  const [pdfBytes, setPdfBytes]     = useState(null);
  const [pages, setPages]           = useState([]);
  const [activePage, setActivePage] = useState(0);
  const [thumbUrls, setThumbUrls]   = useState([]);

  // All placed elements
  const [elements, setElements]     = useState([]);
  const [paths, setPaths]           = useState([]);

  // Undo / redo
  const [history, setHistory]       = useState([]);
  const [future, setFuture]         = useState([]);

  // Active tool
  const [tool, setTool]             = useState('select');
  const [zoom, setZoom]             = useState(1.0);
  const [selectedId, setSelectedId] = useState(null);

  // Formatting defaults (used when creating new text boxes)
  const [defFont,      setDefFont]      = useState('Arial');
  const [defSize,      setDefSize]      = useState(14);
  const [defColor,     setDefColor]     = useState('#000000');
  const [defBold,      setDefBold]      = useState(false);
  const [defItalic,    setDefItalic]    = useState(false);
  const [defUnderline, setDefUnderline] = useState(false);
  const [defAlign,     setDefAlign]     = useState('left');

  // Draw config
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [drawSize,  setDrawSize]  = useState(3);

  // Highlight config
  const [hlColor,         setHlColor]         = useState('#fef08a');
  const [showHlPicker,    setShowHlPicker]    = useState(false);

  // Shape config
  const [shapeColor,   setShapeColor]   = useState('#2563eb');
  const [shapeFill,    setShapeFill]    = useState(false);

  // Stamp
  const [selStamp,        setSelStamp]        = useState(STAMPS[0]);
  const [showStampPicker, setShowStampPicker] = useState(false);

  // Drag-to-draw
  const [dragStart,    setDragStart]    = useState(null);
  const [dragCurrent,  setDragCurrent]  = useState(null);
  const [isDragDraw,   setIsDragDraw]   = useState(false);

  // Freehand draw
  const [isDrawing,    setIsDrawing]    = useState(false);
  const [curPath,      setCurPath]      = useState(null);

  // Element drag / resize
  const [dragging,     setDragging]     = useState(null);
  const [dragOff,      setDragOff]      = useState({ x:0, y:0 });
  const [resizing,     setResizing]     = useState(null);
  const [resizeStart,  setResizeStart]  = useState(null);

  // Signature pad
  const [showSig,      setShowSig]      = useState(false);
  const [sigDrawing,   setSigDrawing]   = useState(false);
  const [sigCurPath,   setSigCurPath]   = useState(null);

  // Edit-text mode
  const [editMode,     setEditMode]     = useState(false);
  // editTarget: { pageIdx, x, y, w, h, fontSize, origText } | null
  const [editTarget,   setEditTarget]   = useState(null);
  const [editValue,    setEditValue]    = useState('');
  // editFont: formatting to apply to the committed text element
  const [editFont,     setEditFont]     = useState('Arial');
  const [editSize,     setEditSize]     = useState(14);
  const [editColor,    setEditColor]    = useState('#000000');
  const [editBold,     setEditBold]     = useState(false);
  const [editItalic,   setEditItalic]   = useState(false);

  const canvasRef    = useRef(null);
  const drawCanvasRef = useRef(null);
  const imgInputRef  = useRef(null);
  const sigCanvasRef = useRef(null);
  const editInputRef = useRef(null);

  /* ── helpers ─────────────────────────────────────────────── */
  const snap = useCallback(() => {
    setHistory(h => [...h.slice(-40), {
      elements: JSON.parse(JSON.stringify(elements)),
      paths:    JSON.parse(JSON.stringify(paths)),
    }]);
    setFuture([]);
  }, [elements, paths]);

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length-1];
    setFuture(f => [{ elements: JSON.parse(JSON.stringify(elements)), paths: JSON.parse(JSON.stringify(paths)) }, ...f.slice(0,20)]);
    setElements(prev.elements); setPaths(prev.paths);
    setHistory(h => h.slice(0,-1));
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory(h => [...h, { elements: JSON.parse(JSON.stringify(elements)), paths: JSON.parse(JSON.stringify(paths)) }]);
    setElements(next.elements); setPaths(next.paths);
    setFuture(f => f.slice(1));
  };

  const updateEl = useCallback((id, patch) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, []);

  const deleteEl = (id) => { snap(); setElements(prev => prev.filter(e => e.id !== id)); setSelectedId(null); };
  const dupEl    = (id) => {
    const el = elements.find(e => e.id === id); if (!el) return;
    snap(); setElements(prev => [...prev, { ...el, id: uid(), x: el.x+20, y: el.y+20 }]);
  };

  /* ── ingest ──────────────────────────────────────────────── */
  const ingest = useCallback(async (files) => {
    setIsReading(true);
    await new Promise(r => setTimeout(r, 50));
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') { setError('Please upload a valid PDF file.'); setIsReading(false); return; }
    setError('');
    try {
      const ab    = await f.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const pdf   = await pdfjsLib.getDocument({ data: bytes.slice().buffer }).promise;
      const pageList = Array.from({ length: pdf.numPages }, (_, i) => ({ origIndex: i+1, rotation: 0, deleted: false }));
      const thumbs = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 0.22 });
        const c = document.createElement('canvas'); c.width=vp.width; c.height=vp.height;
        const ctx = c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        thumbs.push(c.toDataURL('image/jpeg', 0.6));
      }
      setFile(f); setPdfBytes(bytes); setPages(pageList); setThumbUrls(thumbs);
      setActivePage(0); setElements([]); setPaths([]); setHistory([]); setFuture([]);
      setOutBlob(null); setTool('select'); setZoom(1.0); setSelectedId(null);
      setEditMode(false); setEditTarget(null); setStage('editing');
    } catch(err) { console.error(err); setError('Failed to load PDF. It may be encrypted or corrupted.'); }
    setIsReading(false);
  }, []);

  const onDrop = useCallback((e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files); }, [ingest]);

  /* ── page render ─────────────────────────────────────────── */
  const visiblePages = pages.filter(p => !p.deleted);
  const safeActive   = Math.min(activePage, Math.max(0, visiblePages.length-1));
  const currentOrig  = visiblePages[safeActive]?.origIndex;

  const redrawPaths = useCallback((origIdx) => {
    const dc = drawCanvasRef.current; if (!dc) return;
    const ctx = dc.getContext('2d'); ctx.clearRect(0,0,dc.width,dc.height);
    for (const p of paths.filter(p => p.pageIdx===origIdx)) {
      if (p.points.length < 2) continue;
      ctx.beginPath(); ctx.strokeStyle=p.color; ctx.lineWidth=p.size; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.moveTo(p.points[0].x,p.points[0].y);
      for (let i=1;i<p.points.length;i++) ctx.lineTo(p.points[i].x,p.points[i].y);
      ctx.stroke();
    }
  }, [paths]);

  useEffect(() => {
    if (stage !== 'editing' || !pdfBytes) return;
    const pg = visiblePages[safeActive]; if (!pg || pg.origIndex < 1) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf  = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes).buffer }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(pg.origIndex);
        const vp   = page.getViewport({ scale: 1.5*zoom, rotation: pg.rotation });
        const canvas = canvasRef.current; if (!canvas || cancelled) return;
        canvas.width = vp.width; canvas.height = vp.height;
        const ctx = canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const dc = drawCanvasRef.current; if (dc) { dc.width=vp.width; dc.height=vp.height; }
        redrawPaths(pg.origIndex);
      } catch(e) { if (!cancelled) console.error(e); }
    })();
    return () => { cancelled = true; };
  }, [safeActive, visiblePages, pdfBytes, stage, zoom, redrawPaths]);

  /* ── canvas coords ───────────────────────────────────────── */
  const getPos = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect ? { x: e.clientX-rect.left, y: e.clientY-rect.top } : { x:0, y:0 };
  };

  /* ── freehand draw ───────────────────────────────────────── */
  const onDrawDown = (e) => {
    if (tool !== 'draw' && tool !== 'eraser') return;
    const pos = getPos(e); const pg = visiblePages[safeActive]; if (!pg) return;
    setIsDrawing(true);
    if (tool === 'draw') setCurPath({ pageIdx: pg.origIndex, color: drawColor, size: drawSize, points: [pos] });
  };
  const onDrawMove = (e) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    if (tool === 'draw' && curPath) {
      const upd = { ...curPath, points: [...curPath.points, pos] };
      setCurPath(upd);
      const dc = drawCanvasRef.current; if (!dc) return;
      const ctx = dc.getContext('2d');
      const pts = upd.points;
      if (pts.length >= 2) {
        ctx.beginPath(); ctx.strokeStyle=upd.color; ctx.lineWidth=upd.size; ctx.lineCap='round';
        ctx.moveTo(pts[pts.length-2].x,pts[pts.length-2].y);
        ctx.lineTo(pts[pts.length-1].x,pts[pts.length-1].y); ctx.stroke();
      }
    } else if (tool === 'eraser') {
      const pg = visiblePages[safeActive]; if (!pg) return;
      setPaths(prev => prev.filter(p => p.pageIdx !== pg.origIndex || !p.points.some(pt => Math.hypot(pt.x-pos.x,pt.y-pos.y) < 20)));
      setTimeout(() => redrawPaths(pg.origIndex), 0);
    }
  };
  const onDrawUp = () => {
    if (tool === 'draw' && curPath?.points?.length > 1) { snap(); setPaths(prev => [...prev, curPath]); }
    setIsDrawing(false); setCurPath(null);
  };

  /* ── overlay ─────────────────────────────────────────────── */
  const onOverlayDown = (e) => {
    setShowStampPicker(false); setShowHlPicker(false);
    if (tool === 'draw' || tool === 'eraser') return;
    if (dragging || resizing) return;
    const pos = getPos(e);
    if (DRAG_TOOLS.includes(tool)) {
      e.preventDefault(); setDragStart(pos); setDragCurrent(pos); setIsDragDraw(true); return;
    }
    if (tool === 'stamp') {
      const pg = visiblePages[safeActive]; if (!pg) return;
      snap(); setElements(prev => [...prev, { id:uid(), pageIdx:pg.origIndex, type:'stamp', x:pos.x-60, y:pos.y-14, label:selStamp.label, color:selStamp.color, bg:selStamp.bg }]); return;
    }
    if (tool === 'select') setSelectedId(null);
  };

  const onOverlayMove = (e) => {
    if (isDragDraw) { setDragCurrent(getPos(e)); return; }
    if (dragging) {
      const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
      setElements(prev => prev.map(el => el.id === dragging ? { ...el, x: e.clientX-rect.left-dragOff.x, y: e.clientY-rect.top-dragOff.y } : el));
    }
    if (resizing && resizeStart) {
      const dw = e.clientX-resizeStart.mx, dh = e.clientY-resizeStart.my;
      setElements(prev => prev.map(el => el.id === resizing ? { ...el, w: Math.max(30,resizeStart.w+dw), h: Math.max(16,resizeStart.h+dh) } : el));
    }
  };

  const onOverlayUp = (e) => {
    if (isDragDraw && dragStart && dragCurrent) {
      const pg = visiblePages[safeActive]; if (!pg) { setIsDragDraw(false); return; }
      const x = Math.min(dragStart.x,dragCurrent.x), y = Math.min(dragStart.y,dragCurrent.y);
      const w = Math.abs(dragCurrent.x-dragStart.x), h = Math.abs(dragCurrent.y-dragStart.y);
      if (w > 8 || h > 8) {
        snap();
        if (tool === 'text') {
          const newEl = {
            id: uid(), pageIdx: pg.origIndex, type: 'text',
            x, y, w: Math.max(w,120), h: Math.max(h,32),
            text: '',
            color: defColor, fontSize: defSize, fontFamily: defFont,
            bold: defBold, italic: defItalic, underline: defUnderline, align: defAlign,
          };
          setElements(prev => [...prev, newEl]);
          setSelectedId(newEl.id);
        } else if (tool === 'highlight') {
          setElements(prev => [...prev, { id:uid(), pageIdx:pg.origIndex, type:'highlight', x, y, w:Math.max(w,30), h:Math.max(h,16), color:hlColor }]);
        } else if (tool === 'redact') {
          setElements(prev => [...prev, { id:uid(), pageIdx:pg.origIndex, type:'redact', x, y, w:Math.max(w,30), h:Math.max(h,16) }]);
        } else if (tool === 'shape-rect') {
          setElements(prev => [...prev, { id:uid(), pageIdx:pg.origIndex, type:'rect', x, y, w:Math.max(w,20), h:Math.max(h,16), color:shapeColor, fill:shapeFill, strokeWidth:2 }]);
        } else if (tool === 'shape-line') {
          setElements(prev => [...prev, { id:uid(), pageIdx:pg.origIndex, type:'line', x:dragStart.x, y:dragStart.y, x2:dragCurrent.x, y2:dragCurrent.y, color:shapeColor, strokeWidth:2 }]);
        }
        setTool('select');
      }
      setIsDragDraw(false); setDragStart(null); setDragCurrent(null); return;
    }
    if (dragging || resizing) snap();
    setDragging(null); setResizing(null); setResizeStart(null);
  };

  /* ── Edit-text click ─────────────────────────────────────── */
  const onEditClick = async (e) => {
    if (!editMode || !pdfBytes) return;
    // If there's already an active edit, commit it first
    if (editTarget) { commitEdit(); return; }
    const pos = getPos(e);
    const pg  = visiblePages[safeActive]; if (!pg || pg.origIndex < 1) return;
    const S   = 1.5 * zoom;
    try {
      const pdf  = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes).buffer }).promise;
      const page = await pdf.getPage(pg.origIndex);
      const content = await page.getTextContent();
      const vp = page.getViewport({ scale: S });
      const { height: vpH } = vp;
      let bestItem = null, bestDist = 9999;
      for (const item of content.items) {
        if (!item.str?.trim()) continue;
        const [,,, d, tx, ty] = item.transform;
        const fs = Math.abs(d) * S;
        const cx = tx * S, cy = vpH - ty * S - fs;
        const cw = item.width * S, ch = fs * 1.15;
        const inBox = pos.x >= cx-8 && pos.x <= cx+cw+8 && pos.y >= cy-2 && pos.y <= cy+ch+2;
        const dist  = Math.hypot(pos.x-cx-cw/2, pos.y-cy-ch/2);
        if (inBox || (dist < 60 && dist < bestDist)) { bestDist=dist; bestItem={ str:item.str, x:cx, y:cy, w:Math.max(cw,80), h:ch, fontSize:fs }; }
      }
      const target = bestItem
        ? { pageIdx:pg.origIndex, x:bestItem.x, y:bestItem.y, w:bestItem.w+4, h:bestItem.h, fontSize:bestItem.fontSize, origText:bestItem.str }
        : { pageIdx:pg.origIndex, x:pos.x-10,     y:pos.y-12,     w:200,           h:24,           fontSize:14*zoom,           origText:'' };
      // Pre-fill edit font settings from the defaults
      setEditFont(defFont); setEditSize(defSize); setEditColor(defColor); setEditBold(defBold); setEditItalic(defItalic);
      setEditTarget(target); setEditValue(bestItem?.str || '');
      setTimeout(() => editInputRef.current?.focus(), 40);
    } catch(err) { console.error(err); }
  };

  /* ─────────────────────────────────────────────────────────
     commitEdit: KEY FIX
     1. Clears editTarget immediately so the overlay vanishes
     2. Creates redact + text elements with correct formatting
  ───────────────────────────────────────────────────────── */
  const commitEdit = () => {
    if (!editTarget) return;
    // 1. Immediately clear the edit overlay
    const target    = editTarget;
    const value     = editValue;
    const font      = editFont;
    const size      = editSize;
    const color     = editColor;
    const bold      = editBold;
    const italic    = editItalic;
    setEditTarget(null);
    setEditValue('');

    // 2. Add elements
    snap();
    const els = [];
    if (target.origText) {
      // White cover to hide original text — exact height, no extra padding
      els.push({
        id: uid(), pageIdx: target.pageIdx, type: 'redact',
        x: target.x - 1, y: target.y - 1, w: target.w + 2, h: target.h + 2,
      });
    }
    if (value.trim()) {
      // Replacement text — use the editing font settings
      els.push({
        id: uid(), pageIdx: target.pageIdx, type: 'text',
        x: target.x, y: target.y,
        w: Math.max(target.w, value.length * (size * 0.6)),
        h: target.h,
        text: value,
        color,
        fontSize: Math.max(9, (target.fontSize / zoom) * 0.95),
        fontFamily: font,
        bold,
        italic,
        underline: false,
        align: 'left',
      });
    }
    setElements(prev => [...prev, ...els]);
  };

  const cancelEdit = () => { setEditTarget(null); setEditValue(''); };

  /* ── element drag ────────────────────────────────────────── */
  const onElemDown = (e, el) => {
    if (tool !== 'select') return;
    e.stopPropagation(); setSelectedId(el.id);
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    setDragging(el.id); setDragOff({ x: e.clientX-rect.left-el.x, y: e.clientY-rect.top-el.y });
  };
  const onResizeDown = (e, el) => {
    e.stopPropagation(); e.preventDefault();
    setResizing(el.id); setResizeStart({ mx: e.clientX, my: e.clientY, w: el.w, h: el.h });
  };

  /* ── image upload ────────────────────────────────────────── */
  const onImageAdd = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const pg = visiblePages[safeActive]; if (!pg) return;
      snap(); setElements(prev => [...prev, { id:uid(), pageIdx:pg.origIndex, type:'image', x:60, y:60, w:160, h:160, dataUrl:reader.result }]);
      setTool('select');
    };
    reader.readAsDataURL(f); e.target.value = '';
  };

  /* ── page ops ────────────────────────────────────────────── */
  const rotatePage = (idx, deg) => { const pg = visiblePages[idx]; setPages(prev => prev.map(p => p===pg ? { ...p, rotation: (p.rotation+deg+360)%360 } : p)); };
  const deletePage = (idx) => {
    if (visiblePages.length <= 1) { setError('Cannot delete the last page.'); return; }
    const pg = visiblePages[idx]; setPages(prev => prev.map(p => p===pg ? { ...p, deleted:true } : p));
    if (activePage >= visiblePages.length-1) setActivePage(p => Math.max(0,p-1));
  };
  const movePage = (idx, dir) => {
    const ni = idx+dir; if (ni<0||ni>=visiblePages.length) return;
    const fa = pages.indexOf(visiblePages[idx]), fb = pages.indexOf(visiblePages[ni]);
    setPages(prev => { const n=[...prev]; [n[fa],n[fb]]=[n[fb],n[fa]]; return n; }); setActivePage(ni);
  };

  /* ── signature ───────────────────────────────────────────── */
  const getSigPos = (e) => { const r = sigCanvasRef.current?.getBoundingClientRect(); return r ? { x:e.clientX-r.left, y:e.clientY-r.top } : {x:0,y:0}; };
  const onSigDown  = (e) => { setSigDrawing(true); setSigCurPath({ points:[getSigPos(e)] }); };
  const onSigMove  = (e) => {
    if (!sigDrawing||!sigCurPath) return;
    const pos = getSigPos(e); const upd = { ...sigCurPath, points:[...sigCurPath.points,pos] }; setSigCurPath(upd);
    const dc = sigCanvasRef.current; if (!dc) return;
    const ctx = dc.getContext('2d'); const pts = upd.points;
    if (pts.length >= 2) { ctx.beginPath(); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.moveTo(pts[pts.length-2].x,pts[pts.length-2].y); ctx.lineTo(pts[pts.length-1].x,pts[pts.length-1].y); ctx.stroke(); }
  };
  const onSigUp    = () => { setSigDrawing(false); setSigCurPath(null); };
  const clearSig   = () => { setSigCurPath(null); const dc = sigCanvasRef.current; if (dc) dc.getContext('2d').clearRect(0,0,dc.width,dc.height); };
  const insertSig  = () => {
    const dc = sigCanvasRef.current; if (!dc) return;
    const pg = visiblePages[safeActive]; if (!pg) return;
    snap(); setElements(prev => [...prev, { id:uid(), pageIdx:pg.origIndex, type:'image', x:80, y:80, w:200, h:70, dataUrl:dc.toDataURL('image/png') }]);
    setShowSig(false); clearSig(); setTool('select');
  };

  /* ── export ──────────────────────────────────────────────── */
  const exportPdf = async () => {
    setError(''); setStage('exporting');
    try {
      const srcDoc = await PDFDocument.load(new Uint8Array(pdfBytes).buffer);
      const outDoc = await PDFDocument.create();
      const fH  = await outDoc.embedFont(StandardFonts.Helvetica);
      const fHB = await outDoc.embedFont(StandardFonts.HelveticaBold);
      const fHI = await outDoc.embedFont(StandardFonts.HelveticaOblique);
      const fT  = await outDoc.embedFont(StandardFonts.TimesRoman);
      const fTB = await outDoc.embedFont(StandardFonts.TimesRomanBold);
      const fC  = await outDoc.embedFont(StandardFonts.Courier);

      const pickFont = (el) => {
        const fam = (el.fontFamily||'Arial').toLowerCase();
        if (fam.includes('times')||fam.includes('georgia')) return el.bold?fTB:fT;
        if (fam.includes('courier')||fam.includes('mono'))  return fC;
        if (el.italic) return fHI;
        return el.bold ? fHB : fH;
      };

      for (const pg of pages.filter(p => !p.deleted)) {
        let page;
        if (pg.origIndex === -1) { page = outDoc.addPage([612,792]); }
        else { const [c] = await outDoc.copyPages(srcDoc,[pg.origIndex-1]); page = outDoc.addPage(c); }
        if (pg.rotation) page.setRotation(degrees(pg.rotation));
        const { height: ph } = page.getSize();
        const S = 1.5;

        for (const el of elements.filter(e => e.pageIdx===pg.origIndex)) {
          if (el.type === 'text') {
            const lines = (el.text||'').split('\n');
            let ty = ph - el.y/S - (el.fontSize||14)/S;
            for (const line of lines) {
              if (!line.trim()) { ty -= (el.fontSize||14)/S; continue; }
              page.drawText(line, { x:el.x/S, y:ty, size:(el.fontSize||14)/S, font:pickFont(el), color:hex2rgb(el.color||'#000000') });
              ty -= ((el.fontSize||14)/S) * 1.5;
            }
          } else if (el.type === 'highlight') {
            page.drawRectangle({ x:el.x/S, y:ph-el.y/S-el.h/S, width:el.w/S, height:el.h/S, color:hex2rgb(el.color||'#fef08a'), opacity:0.45 });
          } else if (el.type === 'redact') {
            // Draw solid white to cover original text
            page.drawRectangle({ x:el.x/S, y:ph-el.y/S-el.h/S, width:el.w/S, height:el.h/S, color:rgb(1,1,1) });
          } else if (el.type === 'rect') {
            const c = hex2rgb(el.color||'#2563eb');
            page.drawRectangle({ x:el.x/S, y:ph-el.y/S-el.h/S, width:el.w/S, height:el.h/S, borderColor:c, borderWidth:(el.strokeWidth||2)/S, ...(el.fill?{color:c,opacity:0.2}:{}) });
          } else if (el.type === 'line') {
            page.drawLine({ start:{x:el.x/S,y:ph-el.y/S}, end:{x:(el.x2||el.x+80)/S,y:ph-(el.y2||el.y+40)/S}, thickness:(el.strokeWidth||2)/S, color:hex2rgb(el.color||'#000') });
          } else if (el.type === 'stamp') {
            const c = hex2rgb(el.color||'#111');
            page.drawRectangle({ x:el.x/S, y:ph-el.y/S-28/S, width:140/S, height:28/S, borderColor:c, borderWidth:1.5/S, color:c, opacity:0.08 });
            page.drawText(el.label||'', { x:(el.x+8)/S, y:ph-(el.y+20)/S, size:11/S, font:fHB, color:c });
          } else if (el.type === 'image' && el.dataUrl) {
            try {
              const img = el.dataUrl.includes('image/png') ? await outDoc.embedPng(el.dataUrl) : await outDoc.embedJpg(el.dataUrl);
              page.drawImage(img, { x:el.x/S, y:ph-el.y/S-el.h/S, width:el.w/S, height:el.h/S });
            } catch {}
          }
        }
        for (const p of paths.filter(p => p.pageIdx===pg.origIndex)) {
          if (p.points.length < 2) continue;
          const c = hex2rgb(p.color||'#000');
          for (let i=1;i<p.points.length;i++) page.drawLine({ start:{x:p.points[i-1].x/S,y:ph-p.points[i-1].y/S}, end:{x:p.points[i].x/S,y:ph-p.points[i].y/S}, thickness:p.size/S, color:c });
        }
      }
      const bytes = await outDoc.save();
      setOutBlob(new Blob([bytes],{type:'application/pdf'})); setStage('done');
    } catch(err) { console.error(err); setError(err?.message||'Export failed.'); setStage('editing'); }
  };

  const download = () => {
    if (!outBlob) return;
    const url = URL.createObjectURL(outBlob);
    const a = document.createElement('a'); a.href=url; a.download=`${file?.name?.replace(/\.pdf$/i,'')||'edited'}_edited.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const reset = () => {
    setStage('idle'); setFile(null); setPdfBytes(null); setPages([]); setElements([]); setPaths([]);
    setThumbUrls([]); setOutBlob(null); setError(''); setActivePage(0); setTool('select'); setZoom(1.0);
    setSelectedId(null); setHistory([]); setFuture([]); setEditMode(false); setEditTarget(null); _id=0;
  };

  /* ── currently selected element ─────────────────────────── */
  const selectedEl = elements.find(e => e.id === selectedId);
  const isTextSel  = selectedEl?.type === 'text';

  /* ── formatting helper: applies to selected OR sets default ─
     Using onMouseDown + preventDefault prevents losing selectedId */
  const applyFmt = (patch) => {
    if (isTextSel) updateEl(selectedId, patch);
    // Also update defaults
    if ('fontFamily' in patch) setDefFont(patch.fontFamily);
    if ('fontSize'   in patch) setDefSize(patch.fontSize);
    if ('color'      in patch) setDefColor(patch.color);
    if ('bold'       in patch) setDefBold(patch.bold);
    if ('italic'     in patch) setDefItalic(patch.italic);
    if ('underline'  in patch) setDefUnderline(patch.underline);
    if ('align'      in patch) setDefAlign(patch.align);
  };

  const fmtVal = (key) => {
    if (isTextSel && key in selectedEl) return selectedEl[key];
    if (key === 'fontFamily') return defFont;
    if (key === 'fontSize')   return defSize;
    if (key === 'color')      return defColor;
    if (key === 'bold')       return defBold;
    if (key === 'italic')     return defItalic;
    if (key === 'underline')  return defUnderline;
    if (key === 'align')      return defAlign;
    return null;
  };

  /* ── drag preview ────────────────────────────────────────── */
  const DragPreview = () => {
    if (!isDragDraw || !dragStart || !dragCurrent) return null;
    const x = Math.min(dragStart.x,dragCurrent.x), y = Math.min(dragStart.y,dragCurrent.y);
    const w = Math.abs(dragCurrent.x-dragStart.x), h = Math.abs(dragCurrent.y-dragStart.y);
    if (tool === 'shape-line') {
      const dx=dragCurrent.x-dragStart.x, dy=dragCurrent.y-dragStart.y;
      return (
        <div style={{position:'absolute',left:dragStart.x,top:dragStart.y,width:0,height:0,pointerEvents:'none'}}>
          <svg style={{position:'absolute',overflow:'visible'}}>
            <line x1={0} y1={0} x2={dx} y2={dy} stroke={shapeColor} strokeWidth={2} strokeDasharray="6,3" strokeLinecap="round"/>
          </svg>
        </div>
      );
    }
    const styleMap = {
      text:         { border:'2px dashed rgba(37,99,235,0.8)', background:'rgba(37,99,235,0.06)' },
      highlight:    { background:hlColor, opacity:0.45 },
      redact:       { background:'rgba(0,0,0,0.75)' },
      'shape-rect': { border:`2px solid ${shapeColor}`, background:shapeFill?`${shapeColor}30`:'transparent' },
    };
    return <div style={{ position:'absolute', left:x, top:y, width:Math.max(w,1), height:Math.max(h,1), borderRadius:3, pointerEvents:'none', ...(styleMap[tool]||{}) }} />;
  };

  /* ════════════════════════════════ RENDER ════════════════════════════════ */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* ══ READING OVERLAY ══ */}
      {isReading && (
        <div style={OverlayBase}>
          <div style={SpinnerBig} />
          <div style={{ color:'white', fontWeight:600 }}>Reading PDF...</div>
        </div>
      )}

      {error && (
        <div style={{ display:'flex', gap:12, alignItems:'center', padding:'11px 16px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={15} style={{ color:'#ef4444', flexShrink:0 }} />
          <div style={{ flex:1, fontSize:13, color:'#ef4444' }}>{error}</div>
          <button onClick={()=>setError('')} style={IB}><X size={12}/></button>
        </div>
      )}

      {/* ══ IDLE ══ */}
      {stage === 'idle' && (
        <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding: isMobile ? '48px 20px' : '80px 40px',
            border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:16,
            background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.25s' }}>
          <input type="file" accept=".pdf,application/pdf" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
          <div style={{ width:72, height:72, borderRadius:20, background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <UploadCloud size={30} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:17, fontWeight:600, marginBottom:6 }}>{drag?'Drop PDF here':'Drop a PDF to edit'}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span></div>
          </div>
        </label>
      )}

      {/* ══ EDITING ══ */}
      {stage === 'editing' && (
        <>
          {/* ── Toolbar Row 1: Tools ── */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'8px 10px', background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)', borderRadius:'12px 12px 0 0', alignItems:'center', position:'sticky', top:0, zIndex:20, borderBottom:'none' }}>

            <button onClick={()=>{setTool('select');setEditMode(false);}} style={TB(tool==='select'&&!editMode)}><MousePointer size={13}/> Select</button>

            {/* Edit Text mode */}
            <button onClick={()=>{setEditMode(m=>!m);setTool('select');setEditTarget(null);}}
              style={{...TB(editMode), background:editMode?'rgba(251,146,60,0.15)':undefined, borderColor:editMode?'#fb923c':undefined, color:editMode?'#fb923c':undefined}}>
              <Edit3 size={13}/> Edit Text {editMode&&<span style={{fontSize:9,background:'#fb923c',color:'#fff',padding:'1px 5px',borderRadius:4,marginLeft:2}}>ON</span>}
            </button>

            <div style={{width:1,height:20,background:'var(--border)',margin:'0 2px'}}/>

            <button onClick={()=>{setTool('text');setEditMode(false);}} style={TB(tool==='text'&&!editMode)}><Type size={13}/> Text</button>
            <button onClick={()=>{setTool('draw');setEditMode(false);}} style={TB(tool==='draw')}><Pencil size={13}/> Draw</button>
            <button onClick={()=>{setTool('eraser');setEditMode(false);}} style={TB(tool==='eraser')}><Eraser size={13}/> Erase</button>

            {/* Highlight */}
            <div style={{position:'relative'}}>
              <button onClick={()=>{setTool('highlight');setEditMode(false);setShowHlPicker(p=>!p);}} style={{...TB(tool==='highlight'),gap:4}}>
                <Highlighter size={13}/> Highlight
                <span style={{width:11,height:11,borderRadius:2,background:hlColor,display:'inline-block',border:'1px solid rgba(0,0,0,0.2)'}}/>
              </button>
              {showHlPicker&&(
                <div style={{position:'absolute',top:'110%',left:0,zIndex:50,display:'flex',gap:5,padding:8,background:'var(--surface-raised,#18181f)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.4)'}}>
                  {HL_COLORS.map(c=><button key={c} onClick={()=>{setHlColor(c);setShowHlPicker(false);}} style={{width:22,height:22,borderRadius:4,background:c,border:hlColor===c?'2px solid var(--accent-blue,#2563EB)':'1px solid rgba(0,0,0,0.2)',cursor:'pointer'}}/>)}
                </div>
              )}
            </div>

            {/* Stamp */}
            <div style={{position:'relative'}}>
              <button onClick={()=>{setTool('stamp');setEditMode(false);setShowStampPicker(p=>!p);}} style={TB(tool==='stamp')}><Stamp size={13}/> Stamp</button>
              {showStampPicker&&(
                <div style={{position:'absolute',top:'110%',left:0,zIndex:50,display:'flex',flexDirection:'column',gap:4,padding:8,background:'var(--surface-raised,#18181f)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.4)',minWidth:160}}>
                  {STAMPS.map(s=><button key={s.label} onClick={()=>{setSelStamp(s);setShowStampPicker(false);}} style={{padding:'5px 10px',borderRadius:6,border:`1px solid ${s.color}40`,background:s.bg,color:s.color,fontSize:11,fontWeight:700,cursor:'pointer',textAlign:'left'}}>{s.label}</button>)}
                </div>
              )}
            </div>

            <button onClick={()=>setShowSig(true)} style={TB(false)}><PenLine size={13}/> Signature</button>
            <button onClick={()=>imgInputRef.current?.click()} style={TB(false)}><ImagePlus size={13}/> Image</button>
            <input ref={imgInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={onImageAdd}/>
            <button onClick={()=>{setTool(t=>t==='shape-rect'?'select':'shape-rect');setEditMode(false);}} style={TB(tool==='shape-rect')}><Square size={13}/> Rect</button>
            <button onClick={()=>{setTool(t=>t==='shape-line'?'select':'shape-line');setEditMode(false);}} style={TB(tool==='shape-line')}><Minus size={13}/> Line</button>
            <button onClick={()=>{setTool('redact');setEditMode(false);}} style={{...TB(tool==='redact'),background:tool==='redact'?'rgba(239,68,68,0.1)':undefined,borderColor:tool==='redact'?'#ef444460':undefined,color:tool==='redact'?'#ef4444':undefined}}>
              <span style={{fontSize:11}}>◼</span> Redact
            </button>

            <div style={{flex:1}}/>
            <button onClick={undo} disabled={!history.length} style={{...IB,opacity:history.length?1:0.3}} title="Undo"><Undo2 size={13}/></button>
            <button onClick={redo} disabled={!future.length}  style={{...IB,opacity:future.length?1:0.3}}  title="Redo"><Redo2  size={13}/></button>
            <div style={{width:1,height:20,background:'var(--border)',margin:'0 2px'}}/>
            <button onClick={()=>setZoom(z=>Math.max(0.4,z-0.25))} style={IB}><ZoomOut size={13}/></button>
            <span style={{fontSize:11,fontFamily:'monospace',color:'var(--text-muted)',minWidth:38,textAlign:'center'}}>{Math.round(zoom*100)}%</span>
            <button onClick={()=>setZoom(z=>Math.min(3,z+0.25))} style={IB}><ZoomIn size={13}/></button>
          </div>

          {/* ── Toolbar Row 2: Text Formatting ── */}
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 10px',
            background:'var(--surface-raised,#18181f)', border:'1px solid var(--border)',
            borderTop:'1px solid rgba(255,255,255,0.04)', borderRadius:'0 0 12px 12px',
            marginTop:-1, position:'sticky', top:42, zIndex:19, flexWrap:'wrap' }}>

            {/* Font family */}
            <select value={fmtVal('fontFamily')}
              onMouseDown={e=>e.stopPropagation()}
              onChange={e=>applyFmt({fontFamily:e.target.value})}
              style={{...SEL,minWidth:128,fontSize:12}}>
              {FONT_FAMILIES.map(f=><option key={f} value={f}>{f}</option>)}
            </select>

            {/* Font size */}
            <select value={fmtVal('fontSize')}
              onMouseDown={e=>e.stopPropagation()}
              onChange={e=>applyFmt({fontSize:Number(e.target.value)})}
              style={{...SEL,width:64,fontSize:12}}>
              {FONT_SIZES.map(v=><option key={v} value={v}>{v}</option>)}
            </select>

            <div style={{width:1,height:20,background:'var(--border)',margin:'0 2px'}}/>

            {/* Bold */}
            <button
              onMouseDown={e=>{e.preventDefault();e.stopPropagation();}}
              onClick={()=>applyFmt({bold:!fmtVal('bold')})}
              style={{...IB,fontWeight:800,fontSize:14,color:fmtVal('bold')?'var(--accent-blue,#2563EB)':'var(--text-muted)',background:fmtVal('bold')?'rgba(37,99,235,0.12)':undefined,border:fmtVal('bold')?'1.5px solid var(--accent-blue,#2563EB)':undefined}}
              title="Bold (affects new + selected text)"><Bold size={14}/></button>

            {/* Italic */}
            <button
              onMouseDown={e=>{e.preventDefault();e.stopPropagation();}}
              onClick={()=>applyFmt({italic:!fmtVal('italic')})}
              style={{...IB,fontSize:14,color:fmtVal('italic')?'var(--accent-blue,#2563EB)':'var(--text-muted)',background:fmtVal('italic')?'rgba(37,99,235,0.12)':undefined,border:fmtVal('italic')?'1.5px solid var(--accent-blue,#2563EB)':undefined}}
              title="Italic"><Italic size={14}/></button>

            {/* Underline */}
            <button
              onMouseDown={e=>{e.preventDefault();e.stopPropagation();}}
              onClick={()=>applyFmt({underline:!fmtVal('underline')})}
              style={{...IB,fontSize:14,color:fmtVal('underline')?'var(--accent-blue,#2563EB)':'var(--text-muted)',background:fmtVal('underline')?'rgba(37,99,235,0.12)':undefined,border:fmtVal('underline')?'1.5px solid var(--accent-blue,#2563EB)':undefined}}
              title="Underline"><Underline size={14}/></button>

            <div style={{width:1,height:20,background:'var(--border)',margin:'0 2px'}}/>

            {/* Align */}
            {[{Icon:AlignLeft,val:'left'},{Icon:AlignCenter,val:'center'},{Icon:AlignRight,val:'right'}].map(({Icon,val})=>(
              <button key={val}
                onMouseDown={e=>{e.preventDefault();e.stopPropagation();}}
                onClick={()=>applyFmt({align:val})}
                style={{...IB,color:fmtVal('align')===val?'var(--accent-blue,#2563EB)':'var(--text-muted)',background:fmtVal('align')===val?'rgba(37,99,235,0.12)':undefined,border:fmtVal('align')===val?'1.5px solid var(--accent-blue,#2563EB)':undefined}}
                title={val}><Icon size={13}/></button>
            ))}

            <div style={{width:1,height:20,background:'var(--border)',margin:'0 2px'}}/>

            {/* Text color */}
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontSize:11,color:'var(--text-muted)'}}>A</span>
              <div style={{position:'relative',width:28,height:28}}>
                <input type="color" value={fmtVal('color')||'#000000'}
                  onMouseDown={e=>e.stopPropagation()}
                  onChange={e=>applyFmt({color:e.target.value})}
                  style={{width:28,height:28,border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',padding:0,background:'none'}}/>
                {/* Color underline indicator */}
                <div style={{position:'absolute',bottom:0,left:2,right:2,height:3,borderRadius:2,background:fmtVal('color')||'#000000'}}/>
              </div>
            </div>

            {/* Shape controls */}
            {(tool==='shape-rect'||tool==='shape-line'||selectedEl?.type==='rect'||selectedEl?.type==='line')&&(
              <>
                <div style={{width:1,height:20,background:'var(--border)',margin:'0 2px'}}/>
                <span style={{fontSize:11,color:'var(--text-muted)'}}>Shape</span>
                <input type="color" value={selectedEl?.type==='rect'||selectedEl?.type==='line'?(selectedEl.color||shapeColor):shapeColor}
                  onMouseDown={e=>e.stopPropagation()}
                  onChange={e=>{ if(selectedEl?.type==='rect'||selectedEl?.type==='line')updateEl(selectedId,{color:e.target.value}); setShapeColor(e.target.value); }}
                  style={{width:28,height:28,border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',padding:0,background:'none'}}/>
                {(tool==='shape-rect'||selectedEl?.type==='rect')&&(
                  <button onMouseDown={e=>{e.preventDefault();e.stopPropagation();}}
                    onClick={()=>{ const v=selectedEl?.type==='rect'?!selectedEl.fill:!shapeFill; if(selectedEl?.type==='rect')updateEl(selectedId,{fill:v}); setShapeFill(v); }}
                    style={{...IB,fontSize:10,padding:'0 8px',width:'auto'}}>
                    {(selectedEl?.type==='rect'?selectedEl.fill:shapeFill)?'Filled':'Outline'}
                  </button>
                )}
              </>
            )}

            {/* Draw config */}
            {tool==='draw'&&(
              <>
                <div style={{width:1,height:20,background:'var(--border)',margin:'0 2px'}}/>
                <span style={{fontSize:11,color:'var(--text-muted)'}}>Brush</span>
                <input type="color" value={drawColor} onMouseDown={e=>e.stopPropagation()} onChange={e=>setDrawColor(e.target.value)}
                  style={{width:28,height:28,border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',padding:0,background:'none'}}/>
                <select value={drawSize} onMouseDown={e=>e.stopPropagation()} onChange={e=>setDrawSize(Number(e.target.value))} style={SEL}>
                  {[1,2,3,5,8,12].map(v=><option key={v} value={v}>{v}px</option>)}
                </select>
              </>
            )}

            {/* Selection controls */}
            {selectedEl&&(
              <>
                <div style={{flex:1}}/>
                <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.05em'}}>{selectedEl.type}</span>
                {selectedEl.type==='highlight'&&(
                  <div style={{display:'flex',gap:3}}>
                    {HL_COLORS.map(c=>(
                      <button key={c} onMouseDown={e=>{e.preventDefault();e.stopPropagation();}} onClick={()=>updateEl(selectedEl.id,{color:c})}
                        style={{width:17,height:17,borderRadius:3,background:c,border:selectedEl.color===c?'2px solid var(--accent-blue,#2563EB)':'1px solid rgba(0,0,0,0.2)',cursor:'pointer'}}/>
                    ))}
                  </div>
                )}
                {(selectedEl.type==='rect'||selectedEl.type==='line')&&(
                  <select value={selectedEl.strokeWidth||2} onMouseDown={e=>e.stopPropagation()} onChange={e=>updateEl(selectedEl.id,{strokeWidth:Number(e.target.value)})} style={SEL}>
                    {[1,2,3,4,6].map(v=><option key={v} value={v}>{v}px</option>)}
                  </select>
                )}
                <button onMouseDown={e=>{e.preventDefault();e.stopPropagation();}} onClick={()=>dupEl(selectedEl.id)} style={IB} title="Duplicate"><Copy size={12}/></button>
                <button onMouseDown={e=>{e.preventDefault();e.stopPropagation();}} onClick={()=>deleteEl(selectedEl.id)} style={{...IB,color:'#ef4444'}} title="Delete"><Trash2 size={12}/></button>
              </>
            )}
          </div>

          {/* Edit-text hint */}
          {editMode&&!editTarget&&(
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 16px',borderRadius:10,background:'rgba(251,146,60,0.08)',border:'1px solid rgba(251,146,60,0.3)'}}>
              <Edit3 size={14} style={{color:'#fb923c',flexShrink:0}}/>
              <div style={{fontSize:12,color:'#fb923c',lineHeight:1.5,flex:1}}>
                <strong>Edit Text Mode:</strong> Click any text in the PDF. A white cover hides the original; type your replacement text and press <strong>Apply</strong> or <strong>Enter</strong>.
              </div>
              <button onClick={()=>{setEditMode(false);setEditTarget(null);}} style={{...IB,borderColor:'rgba(251,146,60,0.4)',color:'#fb923c'}}><X size={12}/></button>
            </div>
          )}

          {/* Main layout */}
          <div style={{display:'flex',gap:12}}>

            {/* Sidebar */}
            <div style={{width:124,flexShrink:0,display:'flex',flexDirection:'column',gap:7,background:'var(--surface-raised,#18181f)',border:'1px solid var(--border)',borderRadius:12,padding:10,overflowY:'auto',maxHeight:'calc(100vh - 340px)'}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text-muted)',padding:'2px 4px'}}>Pages ({visiblePages.length})</div>
              {visiblePages.map((pg,idx)=>(
                <div key={`${pg.origIndex}-${idx}`} onClick={()=>setActivePage(idx)}
                  style={{borderRadius:8,cursor:'pointer',overflow:'hidden',position:'relative',
                    border:idx===safeActive?'2px solid var(--accent-blue,#2563EB)':'1px solid var(--border)',
                    background:idx===safeActive?'rgba(37,99,235,0.06)':'rgba(255,255,255,0.02)',transition:'all 0.15s'}}>
                  {pg.origIndex>0&&thumbUrls[pg.origIndex-1]
                    ?<img src={thumbUrls[pg.origIndex-1]} alt={`p${idx+1}`} style={{width:'100%',display:'block',transform:`rotate(${pg.rotation}deg)`,transition:'transform 0.2s'}}/>
                    :<div style={{height:90,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'var(--text-muted)',fontStyle:'italic'}}>Blank</div>}
                  <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.7))',padding:'6px 0 3px',textAlign:'center',fontSize:10,color:'#fff',fontWeight:600}}>{idx+1}</div>
                </div>
              ))}
              <div style={{display:'flex',flexWrap:'wrap',gap:4,justifyContent:'center',padding:'6px 0',borderTop:'1px solid var(--border)',marginTop:4}}>
                {[{I:RotateCcw,f:()=>rotatePage(safeActive,-90)},{I:RotateCw,f:()=>rotatePage(safeActive,90)},
                  {I:ChevronUp,  f:()=>movePage(safeActive,-1),d:safeActive===0},
                  {I:ChevronDown,f:()=>movePage(safeActive,1), d:safeActive>=visiblePages.length-1}
                ].map(({I,f,d},k)=><button key={k} onClick={f} disabled={d} style={{...MB,opacity:d?0.3:1}}><I size={11}/></button>)}
                <button onClick={()=>deletePage(safeActive)} style={{...MB,color:'#ef4444'}}><Trash2 size={11}/></button>
                <button onClick={()=>setPages(p=>[...p,{origIndex:-1,rotation:0,deleted:false}])} style={{...MB,color:'#16a34a'}}><Plus size={11}/></button>
              </div>
            </div>

            {/* Canvas area */}
            <div style={{flex:1,display:'flex',alignItems:'flex-start',justifyContent:'center',overflow:'auto',background:'var(--surface,#111118)',borderRadius:12,border:'1px solid var(--border)',padding:24,maxHeight:'calc(100vh - 340px)',minHeight:480}}>
              <div style={{position:'relative',display:'inline-block',userSelect:'none'}}>

                <canvas ref={canvasRef} style={{display:'block',borderRadius:6,boxShadow:'0 4px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.05)'}}/>

                {/* Freehand draw canvas */}
                <canvas ref={drawCanvasRef}
                  onMouseDown={onDrawDown} onMouseMove={onDrawMove} onMouseUp={onDrawUp} onMouseLeave={onDrawUp}
                  style={{position:'absolute',top:0,left:0,cursor:tool==='draw'?'crosshair':tool==='eraser'?'cell':'default',pointerEvents:(tool==='draw'||tool==='eraser')?'auto':'none'}}/>

                {/* Overlay: drag-to-draw, click, element interactions */}
                <div
                  onMouseDown={onOverlayDown} onMouseMove={onOverlayMove}
                  onMouseUp={onOverlayUp}   onMouseLeave={onOverlayUp}
                  onClick={editMode ? onEditClick : undefined}
                  style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',
                    pointerEvents:(tool==='draw'||tool==='eraser')?'none':'auto',
                    cursor:editMode?'text':DRAG_TOOLS.includes(tool)?'crosshair':tool==='stamp'?'copy':'default'}}>

                  <DragPreview/>

                  {/* ── Edit-text overlay ── */}
                  {editTarget && editTarget.pageIdx === currentOrig && (
                    <div style={{position:'absolute',left:editTarget.x,top:editTarget.y,zIndex:40}}>
                      {/* Yellow highlight behind input — precisely sized to match the text line */}
                      <div style={{position:'absolute',left:-1,top:-1,width:Math.max(editTarget.w+6,160)+2,height:editTarget.h+2,background:'#fffde7',border:'2px solid #fb923c',borderRadius:4,boxShadow:'0 2px 12px rgba(0,0,0,0.2)',pointerEvents:'none'}}/>
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') cancelEdit(); }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        style={{
                          position:'relative', zIndex:1,
                          width: Math.max(editTarget.w+4, 160),
                          height: editTarget.h,
                          fontSize: Math.max(11, editTarget.fontSize * 0.94),
                          fontFamily: editFont,
                          fontWeight: editBold ? 700 : 400,
                          fontStyle: editItalic ? 'italic' : 'normal',
                          color: editColor,
                          background: 'transparent', border: 'none', outline: 'none',
                          padding: '0px 4px', lineHeight: 1.15, cursor: 'text',
                          boxSizing: 'border-box',
                        }}
                      />
                      {/* Apply / Cancel buttons */}
                      <div style={{position:'absolute',top:editTarget.h+6,left:0,display:'flex',gap:5,zIndex:42}}>
                        <button
                          onMouseDown={e=>e.stopPropagation()}
                          onClick={e=>{e.stopPropagation();commitEdit();}}
                          style={{padding:'5px 14px',borderRadius:6,border:'none',background:'#16a34a',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.3)'}}>
                          ✓ Apply
                        </button>
                        <button
                          onMouseDown={e=>e.stopPropagation()}
                          onClick={e=>{e.stopPropagation();cancelEdit();}}
                          style={{padding:'5px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface-raised,#18181f)',color:'var(--text-muted)',fontSize:11,cursor:'pointer'}}>
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Placed elements ── */}
                  {elements.filter(el => el.pageIdx===currentOrig).map(el => {
                    const isSel = el.id === selectedId;
                    return (
                      <div key={el.id} onMouseDown={e=>onElemDown(e,el)}
                        style={{position:'absolute',left:el.x,top:el.y,cursor:tool==='select'?'move':'default',outline:isSel?'2px solid rgba(37,99,235,0.8)':'none',outlineOffset:2,borderRadius:3,userSelect:'none'}}>

                        {el.type==='text' && (
                          <textarea value={el.text} onChange={e=>updateEl(el.id,{text:e.target.value})}
                            onMouseDown={e=>onElemDown(e,el)}
                            style={{
                              display:'block', width:el.w, minHeight:el.h,
                              resize: isSel ? 'both' : 'none',
                              background: isSel ? 'rgba(255,255,255,0.93)' : 'transparent',
                              border: isSel ? '1.5px dashed rgba(37,99,235,0.7)' : 'none',
                              borderRadius: isSel ? 4 : 0,
                              padding: '0px 2px',
                              fontSize: el.fontSize,
                              color: el.color,
                              fontFamily: el.fontFamily || 'Arial',
                              fontWeight: el.bold ? 700 : 400,
                              fontStyle: el.italic ? 'italic' : 'normal',
                              textDecoration: el.underline ? 'underline' : 'none',
                              textAlign: el.align || 'left',
                              outline:'none', cursor: isSel ? 'text' : 'move',
                              boxShadow: isSel ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                              lineHeight: 1.15, overflow:'hidden', boxSizing:'border-box',
                            }}/>
                        )}

                        {el.type==='highlight' && (
                          <div style={{width:el.w,height:el.h,background:el.color,opacity:0.5,borderRadius:3,border:isSel?'1px dashed rgba(37,99,235,0.6)':'none',position:'relative'}}>
                            {isSel&&<div onMouseDown={e=>onResizeDown(e,el)} style={RH}/>}
                          </div>
                        )}

                        {el.type==='redact' && (
                          <div style={{width:el.w,height:el.h,background:'#fff',borderRadius:1,border:isSel?'2px dashed #ef4444':'none',position:'relative'}}>
                            {isSel&&<><span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#ccc',fontFamily:'monospace',letterSpacing:'0.05em',pointerEvents:'none'}}>COVER</span><div onMouseDown={e=>onResizeDown(e,el)} style={RH}/></>}
                          </div>
                        )}

                        {el.type==='rect' && (
                          <div style={{width:el.w,height:el.h,border:`${el.strokeWidth||2}px solid ${el.color}`,background:el.fill?`${el.color}28`:'transparent',borderRadius:3,position:'relative'}}>
                            {isSel&&<div onMouseDown={e=>onResizeDown(e,el)} style={RH}/>}
                          </div>
                        )}

                        {el.type==='line' && (()=>{
                          const dx=(el.x2||el.x+80)-el.x, dy=(el.y2||el.y+40)-el.y;
                          return <svg width={Math.abs(dx)+10} height={Math.abs(dy)+10} style={{overflow:'visible',display:'block'}}>
                            <line x1={dx<0?Math.abs(dx):0} y1={dy<0?Math.abs(dy):0} x2={dx<0?0:Math.abs(dx)} y2={dy<0?0:Math.abs(dy)} stroke={el.color} strokeWidth={el.strokeWidth||2} strokeLinecap="round"/>
                          </svg>;
                        })()}

                        {el.type==='stamp' && (
                          <div style={{padding:'4px 12px',borderRadius:6,border:`1.5px solid ${el.color}`,background:el.bg,color:el.color,fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>{el.label}</div>
                        )}

                        {el.type==='image' && (
                          <div style={{position:'relative'}}>
                            <img src={el.dataUrl} draggable={false} alt="" style={{width:el.w,height:el.h,objectFit:'contain',display:'block',border:isSel?'1.5px dashed rgba(37,99,235,0.6)':'none',borderRadius:4}}/>
                            {isSel&&<div onMouseDown={e=>onResizeDown(e,el)} style={RH}/>}
                          </div>
                        )}

                        {/* Duplicate / Delete badges */}
                        {isSel && (
                          <div style={{position:'absolute',top:-28,right:0,display:'flex',gap:4}}>
                            <button onMouseDown={e=>{e.preventDefault();e.stopPropagation();}} onClick={()=>dupEl(el.id)} style={{...IB,width:22,height:22,background:'var(--surface-raised,#18181f)'}}><Copy size={10}/></button>
                            <button onMouseDown={e=>{e.preventDefault();e.stopPropagation();}} onClick={()=>deleteEl(el.id)} style={{...IB,width:22,height:22,color:'#ef4444',background:'var(--surface-raised,#18181f)'}}><X size={10}/></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderRadius:12,background:'var(--surface-raised,#18181f)',border:'1px solid var(--border)'}}>
            <div style={{flex:1,fontSize:11,color:'var(--text-muted)',fontFamily:'monospace'}}>
              {visiblePages.length} page{visiblePages.length!==1?'s':''} · {elements.filter(e=>e.pageIdx===currentOrig).length} elements on page
            </div>
            <button onClick={reset} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:12,cursor:'pointer'}}>
              <RotateCcw size={12}/> Start Over
            </button>
            <button onClick={exportPdf} style={{display:'flex',alignItems:'center',gap:7,padding:'10px 22px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#2563EB,#1d4ed8)',color:'white',fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:'0 4px 16px rgba(37,99,235,0.3)',transition:'all 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <Save size={14}/> Export PDF
            </button>
          </div>
        </>
      )}

      {/* ══ EXPORTING ══ */}
      {stage==='exporting'&&(
        <div style={{padding:48,borderRadius:16,textAlign:'center',background:'var(--surface-raised,#18181f)',border:'1px solid var(--border)'}}>
          <div style={{width:76,height:76,borderRadius:'50%',background:'rgba(37,99,235,0.08)',border:'1px solid rgba(37,99,235,0.2)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',position:'relative'}}>
            <Save size={28} color="var(--accent-blue,#2563EB)"/>
            <div style={{position:'absolute',inset:-6,borderRadius:'50%',border:'2px solid transparent',borderTopColor:'var(--accent-blue,#2563EB)',animation:'spin 0.9s linear infinite'}}/>
          </div>
          <div style={{fontSize:17,fontWeight:600,marginBottom:8}}>Exporting PDF…</div>
          <div style={{fontSize:13,color:'var(--text-muted)'}}>Baking all edits into your document</div>
        </div>
      )}

      {/* ══ DONE ══ */}
      {stage==='done'&&outBlob&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{padding:'40px 24px',borderRadius:16,textAlign:'center',background:'rgba(22,163,74,0.05)',border:'1px solid rgba(22,163,74,0.25)'}}>
            <div style={{width:68,height:68,borderRadius:'50%',background:'rgba(22,163,74,0.1)',border:'1px solid rgba(22,163,74,0.25)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}>
              <CheckCircle2 size={30} color="#16a34a"/>
            </div>
            <div style={{fontSize:19,fontWeight:700,marginBottom:8}}>Export Complete!</div>
            <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:20,lineHeight:1.6}}>Your edited PDF is ready.</div>
            <div style={{display:'inline-flex',gap:24,padding:'10px 20px',borderRadius:10,background:'var(--surface-raised,#18181f)',border:'1px solid var(--border)',marginBottom:24}}>
              {[{l:'PAGES',v:visiblePages.length},{l:'SIZE',v:fmtBytes(outBlob.size)}].map(({l,v})=>(
                <div key={l} style={{textAlign:'center'}}><div style={{fontSize:9,letterSpacing:'0.1em',color:'var(--text-muted)',marginBottom:4}}>{l}</div><div style={{fontWeight:700,fontSize:13,fontFamily:'monospace'}}>{v}</div></div>
              ))}
            </div>
            <button onClick={download} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px 28px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#16a34a,#15803d)',color:'white',fontSize:14,fontWeight:600,cursor:'pointer',margin:'0 auto',boxShadow:'0 4px 16px rgba(22,163,74,0.3)',transition:'all 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <Download size={15}/> Download Edited PDF
            </button>
          </div>
          <button onClick={()=>setStage('editing')} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'10px',borderRadius:10,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:13,cursor:'pointer'}}>
            <Pencil size={13}/> Keep editing
          </button>
          <button onClick={reset} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'10px',borderRadius:10,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:13,cursor:'pointer'}}>
            <RotateCcw size={13}/> Edit another PDF
          </button>
        </div>
      )}

      {/* ══ SIGNATURE MODAL ══ */}
      {showSig&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e=>{if(e.target===e.currentTarget)setShowSig(false);}}>
          <div style={{background:'var(--surface,#111118)',border:'1px solid var(--border)',borderRadius:16,padding:24,width:480,display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:15,fontWeight:700}}>Draw your Signature</div>
              <button onClick={()=>setShowSig(false)} style={IB}><X size={13}/></button>
            </div>
            <canvas ref={sigCanvasRef} width={432} height={160}
              onMouseDown={onSigDown} onMouseMove={onSigMove} onMouseUp={onSigUp} onMouseLeave={onSigUp}
              style={{background:'#fff',borderRadius:10,border:'2px dashed var(--border)',cursor:'crosshair',display:'block',width:'100%',touchAction:'none'}}/>
            <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center'}}>Draw with your mouse · Press Clear to start over</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={clearSig} style={{flex:1,padding:'9px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:13,cursor:'pointer'}}>Clear</button>
              <button onClick={insertSig} style={{flex:2,padding:'9px',borderRadius:8,border:'none',background:'var(--accent-blue,#2563EB)',color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>Insert Signature</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}

/* ── Shared styles ─────────────────────────────────────────── */
const OverlayBase = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', backdropFilter: 'blur(4px)' };
const SpinnerBig = { width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 };

const TB = (a) => ({
  display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:8, fontSize:12, fontWeight:600,
  border: a ? '1.5px solid var(--accent-blue,#2563EB)' : '1px solid var(--border)',
  background: a ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.02)',
  color: a ? 'var(--accent-blue,#2563EB)' : 'var(--text-muted)',
  cursor:'pointer', transition:'all 0.15s',
});
const IB = {
  display:'flex', alignItems:'center', justifyContent:'center',
  width:30, height:30, borderRadius:7, flexShrink:0,
  border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)',
  color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s',
};
const MB = {
  display:'flex', alignItems:'center', justifyContent:'center',
  width:26, height:26, borderRadius:6, flexShrink:0,
  border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)',
  color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s',
};
const SEL = {
  background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6,
  color:'var(--text)', padding:'5px 8px', fontSize:11, cursor:'pointer',
};
const RH = {
  position:'absolute', bottom:-5, right:-5, width:10, height:10, borderRadius:2,
  background:'var(--accent-blue,#2563EB)', cursor:'se-resize', border:'1px solid rgba(255,255,255,0.4)',
};