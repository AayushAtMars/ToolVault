import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Type,
  Image as ImageIcon,
  Download,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Trash2,
  X,
  Eye,
  Layers,
  RefreshCw,
  Sliders,
  Move,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;

function hexToRgb01(hex) {
  return rgb(parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255);
}
function fmtBytes(b) {
  if (!b) return '—';
  const i = Math.floor(Math.log(b)/Math.log(1024));
  return `${(b/Math.pow(1024,i)).toFixed(1)} ${['B','KB','MB','GB'][i]}`;
}

const POSITIONS = [
  { id:'top-left',      label:'↖ TL'  }, { id:'top-center',    label:'↑ TC'  }, { id:'top-right',     label:'↗ TR'  },
  { id:'center',        label:'⊕ Ctr' }, { id:'bottom-left',   label:'↙ BL'  }, { id:'bottom-center', label:'↓ BC'  },
  { id:'bottom-right',  label:'↘ BR'  }, { id:'tile',          label:'⧉ Tile'}, { id:'diagonal',      label:'⟋ Diag'},
];

const TEXT_PRESETS = [
  { label:'WATERMARK',   color:'#ef4444', opacity:0.35, rotation:-45, size:52 },
  { label:'CONFIDENTIAL',color:'#dc2626', opacity:0.3,  rotation:-35, size:42 },
  { label:'DRAFT',       color:'#d97706', opacity:0.4,  rotation:-30, size:64 },
  { label:'SAMPLE',      color:'#7c3aed', opacity:0.35, rotation:-45, size:58 },
  { label:'APPROVED',    color:'#16a34a', opacity:0.35, rotation:0,   size:48 },
  { label:'DO NOT COPY', color:'#1d4ed8', opacity:0.3,  rotation:-20, size:38 },
];

const FONT_OPTIONS = [
  { label:'Helvetica Bold', value:'HelveticaBold'  },
  { label:'Helvetica',      value:'Helvetica'      },
  { label:'Times Bold',     value:'TimesRomanBold' },
  { label:'Times Roman',    value:'TimesRoman'     },
  { label:'Courier Bold',   value:'CourierBold'    },
  { label:'Courier',        value:'Courier'        },
];

const STD_FONT_MAP = {
  HelveticaBold:  StandardFonts.HelveticaBold,
  Helvetica:      StandardFonts.Helvetica,
  TimesRomanBold: StandardFonts.TimesRomanBold,
  TimesRoman:     StandardFonts.TimesRoman,
  CourierBold:    StandardFonts.CourierBold,
  Courier:        StandardFonts.Courier,
};

/* ── Responsive hook ─────────────────────────────────────── */
function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

/* ── Collapsible section wrapper ─────────────────────────── */
function Section({ title, icon: Icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', background:'var(--surface-raised,#18181f)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'12px 14px',
          background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
        {Icon && <Icon size={13} style={{ color:'var(--text-muted)', flexShrink:0 }}/>}
        <span style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase' }}>{title}</span>
        {open ? <ChevronUp size={14} style={{ color:'var(--text-muted)' }}/> : <ChevronDown size={14} style={{ color:'var(--text-muted)' }}/>}
      </button>
      {open && <div style={{ padding:'0 14px 14px' }}>{children}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
export default function AddWatermark() {
  const vw = useWidth();
  const isMobile = vw < 640;
  const isTablet = vw >= 640 && vw < 1024;
  const isDesktop = vw >= 1024;

  const [stage, setStage]         = useState('idle');
  const [file, setFile]           = useState(null);
  const [pdfBytes, setPdfBytes]   = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError]         = useState('');
  const [drag, setDrag]           = useState(false);
  const [outBlob, setOutBlob]     = useState(null);

  const [mode,       setMode]       = useState('text');
  const [text,       setText]       = useState('WATERMARK');
  const [color,      setColor]      = useState('#ef4444');
  const [size,       setSize]       = useState(52);
  const [opacity,    setOpacity]    = useState(0.35);
  const [rotation,   setRotation]   = useState(-45);
  const [position,   setPosition]   = useState('center');
  const [fontKey,    setFontKey]    = useState('HelveticaBold');
  const [tileGap,    setTileGap]    = useState(1.8);
  const [wmImage,    setWmImage]    = useState(null);
  const [wmImgBytes, setWmImgBytes] = useState(null);
  const [imgScale,   setImgScale]   = useState(0.4);
  const [applyRange, setApplyRange] = useState('all');
  const [pageFrom,   setPageFrom]   = useState(1);
  const [pageTo,     setPageTo]     = useState(1);

  const previewCanvasRef = useRef(null);
  const [pdfPage, setPdfPage]     = useState(null);
  const [previewScale]            = useState(1.2);
  const imgInputRef               = useRef(null);

  /* ── ingest ─────────────────────────────────────────────── */
  const ingest = async (files) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.'); return;
    }
    setError('');
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const pdf   = await pdfjsLib.getDocument({ data: bytes.slice().buffer }).promise;
      const pg    = await pdf.getPage(1);
      setFile(f); setPdfBytes(bytes);
      setPageCount(pdf.numPages); setPageTo(pdf.numPages);
      setPdfPage(pg); setStage('ready');
    } catch(err) { console.error(err); setError('Failed to load PDF.'); }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }, []);

  const ingestImg = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!['image/png','image/jpeg'].includes(f.type)) { setError('Watermark image must be PNG or JPG.'); return; }
    setWmImage(f); setWmImgBytes(new Uint8Array(await f.arrayBuffer()));
    e.target.value = '';
  };

  /* ── canvas preview ─────────────────────────────────────── */
  useEffect(() => {
    if (stage !== 'ready' || !pdfPage) return;
    const canvas = previewCanvasRef.current; if (!canvas) return;
    // Scale preview to container width
    const containerW = Math.min(canvas.parentElement?.clientWidth || 400, 600);
    const vp = pdfPage.getViewport({ scale: previewScale });
    const scale = Math.min(1, containerW / vp.width);
    const scaledVp = pdfPage.getViewport({ scale: previewScale * scale });
    canvas.width  = scaledVp.width;
    canvas.height = scaledVp.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    pdfPage.render({ canvasContext: ctx, viewport: scaledVp }).promise.then(() => {
      drawOverlay(ctx, canvas.width, canvas.height);
    });
  }, [pdfPage, stage, previewScale, mode, text, color, size, opacity, rotation, position, fontKey, tileGap, wmImage, imgScale, vw]);

  const drawOverlay = (ctx, W, H) => {
    ctx.save(); ctx.globalAlpha = opacity;
    if (mode === 'text') {
      const cssFontMap = {
        HelveticaBold:'bold Arial', Helvetica:'Arial',
        TimesRomanBold:'bold Georgia', TimesRoman:'Georgia',
        CourierBold:'bold "Courier New"', Courier:'"Courier New"',
      };
      const fontStr = `${size}px ${cssFontMap[fontKey]||'bold Arial'}`;
      ctx.font = fontStr; ctx.fillStyle = color;
      const tw = ctx.measureText(text).width, th = size;
      const pad = 30;
      const drawAt = (x, y) => {
        ctx.save(); ctx.translate(x,y); ctx.rotate((rotation*Math.PI)/180);
        ctx.fillText(text, -tw/2, th/4); ctx.restore();
      };
      if (position==='center') drawAt(W/2,H/2);
      else if (position==='top-left') drawAt(pad+tw/2, pad+th/2);
      else if (position==='top-center') drawAt(W/2, pad+th/2);
      else if (position==='top-right') drawAt(W-pad-tw/2, pad+th/2);
      else if (position==='bottom-left') drawAt(pad+tw/2, H-pad-th/2);
      else if (position==='bottom-center') drawAt(W/2, H-pad-th/2);
      else if (position==='bottom-right') drawAt(W-pad-tw/2, H-pad-th/2);
      else if (position==='tile') {
        const gx=tw*tileGap, gy=th*tileGap*2;
        for (let x=gx/2; x<W+gx; x+=gx) for (let y=gy/2; y<H+gy; y+=gy) drawAt(x,y);
      } else if (position==='diagonal') {
        const diag=Math.sqrt(W*W+H*H), gx=tw*tileGap, gy=th*3;
        ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(-Math.PI/4);
        for (let x=-diag; x<diag; x+=gx) for (let y=-diag; y<diag; y+=gy) {
          ctx.save(); ctx.translate(x+tw/2,y); ctx.rotate((rotation*Math.PI)/180);
          ctx.font=fontStr; ctx.fillStyle=color; ctx.fillText(text,-tw/2,0); ctx.restore();
        }
        ctx.restore();
      }
    } else if (mode==='image'&&wmImage) {
      const img = new window.Image();
      img.src = URL.createObjectURL(wmImage);
      img.onload = () => {
        const iw=img.naturalWidth*imgScale, ih=img.naturalHeight*imgScale;
        ctx.save(); ctx.globalAlpha=opacity;
        if (position==='tile') {
          for (let x=0; x<W; x+=iw*tileGap) for (let y=0; y<H; y+=ih*tileGap) ctx.drawImage(img,x,y,iw,ih);
        } else {
          let x=0,y=0;
          if (position==='center') {x=(W-iw)/2;y=(H-ih)/2;}
          else if (position==='top-left') {x=20;y=20;}
          else if (position==='top-center') {x=(W-iw)/2;y=20;}
          else if (position==='top-right') {x=W-iw-20;y=20;}
          else if (position==='bottom-left') {x=20;y=H-ih-20;}
          else if (position==='bottom-center') {x=(W-iw)/2;y=H-ih-20;}
          else if (position==='bottom-right') {x=W-iw-20;y=H-ih-20;}
          ctx.drawImage(img,x,y,iw,ih);
        }
        ctx.restore();
      };
    }
    ctx.restore();
  };

  /* ── apply preset ────────────────────────────────────────── */
  const applyPreset = (p) => {
    setText(p.label); setColor(p.color); setOpacity(p.opacity);
    setRotation(p.rotation); setSize(p.size);
  };

  /* ── export ──────────────────────────────────────────────── */
  const applyWatermark = async () => {
    setStage('processing');
    try {
      const doc  = await PDFDocument.load(pdfBytes.slice().buffer);
      const font = await doc.embedFont(STD_FONT_MAP[fontKey]);
      const pgList = doc.getPages();
      let indices;
      if (applyRange==='all')   indices = pgList.map((_,i)=>i);
      else if (applyRange==='first') indices = [0];
      else {
        const from=Math.max(1,pageFrom)-1, to=Math.min(pageCount,pageTo)-1;
        indices = Array.from({length:to-from+1},(_,i)=>i+from);
      }
      let wmPdfImage = null;
      if (mode==='image'&&wmImgBytes) {
        wmPdfImage = wmImage.type==='image/png'
          ? await doc.embedPng(wmImgBytes.slice().buffer)
          : await doc.embedJpg(wmImgBytes.slice().buffer);
      }
      for (const pi of indices) {
        const page = pgList[pi];
        const {width:W, height:H} = page.getSize();
        if (mode==='text') {
          const tw=font.widthOfTextAtSize(text,size), pad=40;
          const drawTxt=(cx,cy)=>page.drawText(text,{x:cx-tw/2,y:cy,size,font,color:hexToRgb01(color),opacity,rotate:degrees(rotation)});
          if (position==='center') drawTxt(W/2,H/2);
          else if (position==='top-left')    drawTxt(pad+tw/2,H-pad-size);
          else if (position==='top-center')  drawTxt(W/2,H-pad-size);
          else if (position==='top-right')   drawTxt(W-pad-tw/2,H-pad-size);
          else if (position==='bottom-left') drawTxt(pad+tw/2,pad);
          else if (position==='bottom-center') drawTxt(W/2,pad);
          else if (position==='bottom-right')  drawTxt(W-pad-tw/2,pad);
          else if (position==='tile'||position==='diagonal') {
            const gx=tw*tileGap, gy=size*tileGap*2;
            for (let x=0; x<W+gx; x+=gx) for (let y=0; y<H+gy; y+=gy)
              page.drawText(text,{x,y,size,font,color:hexToRgb01(color),opacity,rotate:degrees(rotation)});
          }
        } else if (wmPdfImage) {
          const iw=wmPdfImage.width*imgScale, ih=wmPdfImage.height*imgScale, pad=20;
          const di=(x,y)=>page.drawImage(wmPdfImage,{x,y,width:iw,height:ih,opacity});
          if (position==='center') di((W-iw)/2,(H-ih)/2);
          else if (position==='top-left')    di(pad,H-ih-pad);
          else if (position==='top-center')  di((W-iw)/2,H-ih-pad);
          else if (position==='top-right')   di(W-iw-pad,H-ih-pad);
          else if (position==='bottom-left') di(pad,pad);
          else if (position==='bottom-center') di((W-iw)/2,pad);
          else if (position==='bottom-right')  di(W-iw-pad,pad);
          else if (position==='tile'||position==='diagonal') {
            for (let x=0; x<W; x+=iw*tileGap) for (let y=0; y<H; y+=ih*tileGap) di(x,y);
          }
        }
      }
      const bytes = await doc.save();
      setOutBlob(new Blob([bytes],{type:'application/pdf'})); setStage('done');
    } catch(err) { console.error(err); setError('Failed: '+err.message); setStage('ready'); }
  };

  const download = () => {
    const url=URL.createObjectURL(outBlob), a=document.createElement('a');
    a.href=url; a.download=`${file.name.replace(/\.pdf$/i,'')}_watermarked.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const reset = () => {
    setStage('idle'); setFile(null); setPdfBytes(null); setPdfPage(null);
    setOutBlob(null); setWmImage(null); setWmImgBytes(null); setError(''); setPageCount(0);
  };

  /* ── controls panel (shared between mobile/desktop) ──────── */
  const ControlsPanel = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* Mode tabs */}
      <div style={{ display:'flex', gap:4, padding:4, background:'var(--surface-raised,#18181f)', borderRadius:10, border:'1px solid var(--border)' }}>
        {[{id:'text',label:'✦ Text',Icon:Type},{id:'image',label:'⬛ Image',Icon:ImageIcon}].map(({id,label})=>(
          <button key={id} onClick={()=>setMode(id)}
            style={{ flex:1, padding:'9px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all 0.15s',
              background:mode===id?'var(--surface,#111118)':'transparent',
              color:mode===id?'var(--text,#f0f0f5)':'var(--text-muted)',
              boxShadow:mode===id?'0 1px 4px rgba(0,0,0,0.2)':'none' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Text settings */}
      {mode==='text' && (
        <Section title="Text Settings" icon={Sliders}>
          {/* Presets */}
          <div style={{ marginBottom:12 }}>
            <div style={LS}>Quick Presets</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {TEXT_PRESETS.map(p=>(
                <button key={p.label} onClick={()=>applyPreset(p)}
                  style={{ padding:'4px 10px', borderRadius:100, fontSize:10, fontWeight:700, cursor:'pointer',
                    border:`1px solid ${p.color}50`, background:`${p.color}15`, color:p.color }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text input */}
          <div style={{ marginBottom:12 }}>
            <div style={LS}>Watermark Text</div>
            <input type="text" value={text} onChange={e=>setText(e.target.value)} style={IN} placeholder="Your watermark text"/>
          </div>

          {/* Font */}
          <div style={{ marginBottom:12 }}>
            <div style={LS}>Font</div>
            <select value={fontKey} onChange={e=>setFontKey(e.target.value)} style={{...IN,cursor:'pointer',appearance:'none'}}>
              {FONT_OPTIONS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          {/* Size + Color row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:12, alignItems:'end', marginBottom:12 }}>
            <div>
              <div style={{ ...LS, display:'flex', justifyContent:'space-between' }}>
                <span>Font Size</span>
                <span style={{ color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{size}px</span>
              </div>
              <input type="range" min={8} max={140} value={size} onChange={e=>setSize(Number(e.target.value))}
                style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
            </div>
            <div>
              <div style={LS}>Color</div>
              <input type="color" value={color} onChange={e=>setColor(e.target.value)}
                style={{ width:40, height:40, border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', padding:2, background:'none' }}/>
            </div>
          </div>

          {/* Opacity + Rotation */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ ...LS, display:'flex', justifyContent:'space-between' }}>
                <span>Opacity</span>
                <span style={{ color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{Math.round(opacity*100)}%</span>
              </div>
              <input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={e=>setOpacity(Number(e.target.value))}
                style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
            </div>
            <div>
              <div style={{ ...LS, display:'flex', justifyContent:'space-between' }}>
                <span>Rotation</span>
                <span style={{ color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{rotation}°</span>
              </div>
              <input type="range" min={-180} max={180} value={rotation} onChange={e=>setRotation(Number(e.target.value))}
                style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
            </div>
          </div>
        </Section>
      )}

      {/* Image settings */}
      {mode==='image' && (
        <Section title="Image Settings" icon={ImageIcon}>
          {!wmImage ? (
            <label style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'24px 20px',
              border:'2px dashed var(--border)', borderRadius:10, cursor:'pointer', background:'var(--surface,#111118)',
              transition:'border-color 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent-blue,#2563EB)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <input ref={imgInputRef} type="file" accept="image/png,image/jpeg" style={{display:'none'}} onChange={ingestImg}/>
              <UploadCloud size={22} color="var(--text-muted)"/>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:13, fontWeight:600 }}>Upload Logo / Image</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>PNG or JPG · Transparent PNG recommended</div>
              </div>
            </label>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'rgba(37,99,235,0.06)', border:'1px solid rgba(37,99,235,0.2)', borderRadius:10, marginBottom:12 }}>
              <img src={URL.createObjectURL(wmImage)} alt="wm" style={{ width:38, height:38, objectFit:'contain', borderRadius:6, background:'#fff', padding:2 }}/>
              <div style={{ flex:1, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{wmImage.name}</div>
              <button onClick={()=>{setWmImage(null);setWmImgBytes(null);}} style={IB}><Trash2 size={12}/></button>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:wmImage?0:12 }}>
            <div>
              <div style={{ ...LS, display:'flex', justifyContent:'space-between' }}>
                <span>Scale</span>
                <span style={{ color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{Math.round(imgScale*100)}%</span>
              </div>
              <input type="range" min={0.05} max={2} step={0.05} value={imgScale} onChange={e=>setImgScale(Number(e.target.value))}
                style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
            </div>
            <div>
              <div style={{ ...LS, display:'flex', justifyContent:'space-between' }}>
                <span>Opacity</span>
                <span style={{ color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{Math.round(opacity*100)}%</span>
              </div>
              <input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={e=>setOpacity(Number(e.target.value))}
                style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer' }}/>
            </div>
          </div>
        </Section>
      )}

      {/* Position */}
      <Section title="Position" icon={Move}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
          {POSITIONS.map(p=>(
            <button key={p.id} onClick={()=>setPosition(p.id)}
              style={{ padding:'8px 4px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', textAlign:'center', transition:'all 0.15s', border:'none',
                outline:`1px solid ${position===p.id?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:position===p.id?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                color:position===p.id?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
              {p.label}
            </button>
          ))}
        </div>
        {(position==='tile'||position==='diagonal') && (
          <div style={{ marginTop:12 }}>
            <div style={{ ...LS, display:'flex', justifyContent:'space-between' }}>
              <span>Tile Spacing</span>
              <span style={{ color:'var(--accent-blue,#2563EB)', fontFamily:'monospace' }}>{tileGap.toFixed(1)}×</span>
            </div>
            <input type="range" min={1} max={4} step={0.1} value={tileGap} onChange={e=>setTileGap(Number(e.target.value))}
              style={{ width:'100%', accentColor:'var(--accent-blue,#2563EB)', cursor:'pointer', marginTop:6 }}/>
          </div>
        )}
      </Section>

      {/* Apply to pages */}
      <Section title={`Apply To — ${pageCount} page${pageCount!==1?'s':''}`} icon={Layers} defaultOpen={pageCount > 1}>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {[{id:'all',label:`All ${pageCount}`},{id:'first',label:'First only'},{id:'custom',label:'Custom'}].map(r=>(
            <button key={r.id} onClick={()=>setApplyRange(r.id)}
              style={{ padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s', border:'none',
                outline:`1px solid ${applyRange===r.id?'var(--accent-blue,#2563EB)':'var(--border)'}`,
                background:applyRange===r.id?'rgba(37,99,235,0.1)':'var(--surface,#111118)',
                color:applyRange===r.id?'var(--accent-blue,#2563EB)':'var(--text-muted)' }}>
              {r.label}
            </button>
          ))}
        </div>
        {applyRange==='custom' && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>Pages</span>
            <input type="number" min={1} max={pageCount} value={pageFrom} onChange={e=>setPageFrom(Number(e.target.value))}
              style={{ ...IN, width:64, padding:'6px 8px', fontSize:12, textAlign:'center' }}/>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>to</span>
            <input type="number" min={1} max={pageCount} value={pageTo} onChange={e=>setPageTo(Number(e.target.value))}
              style={{ ...IN, width:64, padding:'6px 8px', fontSize:12, textAlign:'center' }}/>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace' }}>of {pageCount}</span>
          </div>
        )}
      </Section>

      {/* Apply button */}
      <button onClick={applyWatermark}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px 20px', borderRadius:10, border:'none',
          background:'var(--accent-blue,#2563EB)', color:'white', fontSize:14, fontWeight:600, cursor:'pointer',
          boxShadow:'0 4px 16px rgba(37,99,235,0.3)', transition:'all 0.15s' }}
        onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
        onMouseLeave={e=>e.currentTarget.style.transform='none'}>
        <Layers size={15}/> Apply Watermark to PDF
      </button>

      <button onClick={reset}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9,
          border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
        <RefreshCw size={12}/> Start over
      </button>
    </div>
  );

  /* ════════════════════════════════════════════════════════ RENDER */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Error */}
      {error && (
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'11px 16px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={15} style={{ color:'#ef4444', flexShrink:0, marginTop:1 }}/>
          <div style={{ flex:1, fontSize:13, color:'#ef4444', lineHeight:1.5 }}>{error}</div>
          <button onClick={()=>setError('')} style={IB}><X size={12}/></button>
        </div>
      )}

      {/* ══ IDLE ══ */}
      {stage==='idle' && (
        <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14,
            padding: isMobile ? '48px 24px' : '80px 40px',
            border:`2px dashed ${drag?'var(--accent-blue,#2563EB)':'var(--border)'}`, borderRadius:16,
            background:drag?'rgba(37,99,235,0.04)':'var(--surface-raised,#18181f)', cursor:'pointer', transition:'all 0.2s' }}>
          <input type="file" accept=".pdf,application/pdf" style={{display:'none'}} onChange={e=>e.target.files?.length&&ingest(e.target.files)}/>
          <div style={{ width:68, height:68, borderRadius:20, background:drag?'rgba(37,99,235,0.12)':'var(--surface,#111118)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}>
            <UploadCloud size={28} color={drag?'var(--accent-blue,#2563EB)':'var(--text-muted)'}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize: isMobile ? 15 : 17, fontWeight:600, marginBottom:6 }}>{drag?'Drop PDF here':'Add Watermark to PDF'}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              or <span style={{ color:'var(--accent-blue,#2563EB)', fontWeight:500 }}>click to browse</span>
            </div>
            <div style={{ marginTop:10, display:'flex', gap:5, justifyContent:'center', flexWrap:'wrap' }}>
              {['Text & Image','9 Positions','Tile/Diagonal','Live Preview','Page Range'].map(f=>(
                <span key={f} style={{ fontSize:10, padding:'3px 8px', borderRadius:100, background:'var(--surface,#111118)', border:'1px solid var(--border)', color:'var(--text-muted)', fontWeight:600 }}>{f}</span>
              ))}
            </div>
          </div>
        </label>
      )}

      {/* ══ READY ══ */}
      {stage==='ready' && (
        /* Desktop: side-by-side | Tablet/Mobile: stacked */
        <div style={{
          display: isDesktop ? 'grid' : 'flex',
          gridTemplateColumns: isDesktop ? '1fr 360px' : undefined,
          flexDirection: isDesktop ? undefined : 'column',
          gap: 16,
          alignItems: 'start',
        }}>

          {/* Preview — on mobile goes first, settings below */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase' }}>
                <Eye size={12}/> Live Preview — Page 1
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth: isMobile ? 180 : 300 }}>
                {file.name} · {pageCount}p
              </div>
            </div>

            <div style={{ background:'#e5e7eb', borderRadius:12, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', padding: isMobile ? 10 : 16 }}>
              <canvas ref={previewCanvasRef} style={{ display:'block', borderRadius:6, maxWidth:'100%', boxShadow:'0 4px 24px rgba(0,0,0,0.3)' }}/>
            </div>

            {/* On desktop, settings go here on the RIGHT — so for mobile/tablet show them BELOW preview */}
            {!isDesktop && (
              <div style={{ marginTop:4 }}>
                <ControlsPanel/>
              </div>
            )}
          </div>

          {/* Settings — desktop only (right column) */}
          {isDesktop && <ControlsPanel/>}
        </div>
      )}

      {/* ══ PROCESSING ══ */}
      {stage==='processing' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding: isMobile ? '40px 16px' : '64px 20px', textAlign:'center', background:'var(--surface-raised,#18181f)', borderRadius:16, border:'1px solid var(--border)' }}>
          <div style={{ width:52, height:52, border:'3px solid rgba(37,99,235,0.15)', borderTopColor:'var(--accent-blue,#2563EB)', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginBottom:20 }}/>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:6 }}>Applying watermark…</div>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>Processing all selected pages</div>
        </div>
      )}

      {/* ══ DONE ══ */}
      {stage==='done' && outBlob && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding: isMobile ? '36px 16px' : '56px 24px', textAlign:'center', background:'rgba(22,163,74,0.04)', borderRadius:16, border:'1px solid rgba(22,163,74,0.2)' }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(22,163,74,0.1)', border:'1px solid rgba(22,163,74,0.25)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
            <CheckCircle2 size={28} color="#16a34a"/>
          </div>
          <div style={{ fontSize: isMobile ? 17 : 20, fontWeight:700, marginBottom:8 }}>Watermark Applied!</div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24, lineHeight:1.6, maxWidth:340 }}>
            {mode==='text'?`"${text}" watermark`:'Image watermark'} applied to your PDF · {fmtBytes(outBlob.size)}
          </div>
          <button onClick={download}
            style={{ display:'flex', alignItems:'center', gap:8, padding: isMobile ? '12px 20px' : '13px 28px', borderRadius:10, border:'none',
              background:'#16a34a', color:'white', fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:12,
              boxShadow:'0 4px 16px rgba(22,163,74,0.3)', transition:'all 0.15s', width: isMobile ? '100%' : 'auto', justifyContent:'center' }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            <Download size={15}/> Download Watermarked PDF
          </button>
          <button onClick={reset} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:13, cursor:'pointer', padding:'8px' }}>
            ← Watermark another file
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const LS = { fontSize:11, fontWeight:700, color:'var(--text-muted,#6b6b80)', marginBottom:6, letterSpacing:'0.06em', textTransform:'uppercase', display:'block' };
const IN = { width:'100%', padding:'9px 12px', background:'var(--surface,#111118)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text,#f0f0f5)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
const IB = { display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:7, flexShrink:0, border:'1px solid var(--border)', background:'rgba(255,255,255,0.03)', color:'var(--text-muted)', cursor:'pointer', transition:'all 0.15s' };