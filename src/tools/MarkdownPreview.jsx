import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy, Check, Download, Trash2, Eye, Code2,
  Columns, Maximize2, Minimize2, FileDown,
  Bold, Italic, Strikethrough, Link, Image,
  List, ListOrdered, Quote, Minus, Hash,
  TerminalSquare, AlignLeft
} from 'lucide-react';

/* ─── Markdown → HTML ────────────────────────────────────── */
function markdownToHtml(md) {
  let html = md
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang}">${escHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm,  '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm,   '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm,    '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm,     '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm,      '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/~~(.+?)~~/g,         '<del>$1</del>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:8px 0" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,  '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^>\s+(.+)$/gm,  '<blockquote>$1</blockquote>')
    .replace(/^---+$/gm,      '<hr />')
    .replace(/^[-*]\s+(.+)$/gm, '<li class="ul-item">$1</li>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="ol-item">$1</li>')
    .replace(/^(?!<[a-z]|$)(.*\S.*)$/gm, '<p>$1</p>');

  html = html
    .replace(/(<li class="ul-item">[\s\S]*?<\/li>)/g, m => `<ul>${m.replace(/ class="ul-item"/g,'')}</ul>`)
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/(<li class="ol-item">[\s\S]*?<\/li>)/g, m => `<ol>${m.replace(/ class="ol-item"/g,'')}</ol>`)
    .replace(/<\/ol>\s*<ol>/g, '');

  return html;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getStats(text) {
  if (!text.trim()) return { chars: 0, words: 0, lines: 0, readTime: 0 };
  const words = text.trim().split(/\s+/).length;
  return {
    chars:    text.length,
    words,
    lines:    text.split('\n').length,
    readTime: Math.max(1, Math.ceil(words / 200)),
  };
}

/* ─── Sample ─────────────────────────────────────────────── */
const SAMPLE = `# Welcome to Markdown Preview

## What you can do

Write **bold**, *italic*, or ***both*** text effortlessly.  
Use ~~strikethrough~~ or \`inline code\` for emphasis.

### Code Blocks

\`\`\`javascript
const greet = (name) => {
  return \`Hello, \${name}!\`;
};
console.log(greet('World'));
\`\`\`

> "The best tools get out of your way."  
> — Every developer, ever

---

## Lists

- Design systems
- Component libraries
- **Dark mode** everything

1. Write markdown
2. See live preview
3. Copy HTML or MD

## Links & Images

[Visit AayuTools](https://aayutools.com)

---

Start editing to see changes live ✨`;

/* ─── useWidth ───────────────────────────────────────────── */
function useWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

/* ─── Toolbar button ─────────────────────────────────────── */
function TBtn({ icon: Icon, title, onClick, active }) {
  return (
    <button title={title} onClick={onClick} style={{
      width: 30, height: 30, borderRadius: 7, border: 'none',
      background: active ? 'rgba(37,99,235,0.15)' : 'transparent',
      color: active ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted,#6b6b80)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background='rgba(255,255,255,0.07)'; e.currentTarget.style.color='var(--text,#f0f0f5)'; }}
      onMouseLeave={e => { e.currentTarget.style.background=active?'rgba(37,99,235,0.15)':'transparent'; e.currentTarget.style.color=active?'var(--accent-blue,#2563eb)':'var(--text-muted,#6b6b80)'; }}
    >
      <Icon size={14}/>
    </button>
  );
}

function TDivider() {
  return <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 3px', flexShrink: 0 }}/>;
}

/* ─── Copy button ────────────────────────────────────────── */
function CopyBtn({ label, getText }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    navigator.clipboard.writeText(getText()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={doCopy} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 8,
      background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
      color: copied ? '#10b981' : 'var(--text-muted)',
      fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
      cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>
      {copied ? <Check size={12}/> : <Copy size={12}/>}
      {copied ? 'Copied!' : label}
    </button>
  );
}

/* ─── Stat pill ──────────────────────────────────────────── */
function Stat({ label, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 10px', borderRadius: 8,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: '"DM Mono",monospace', color: 'var(--text,#f0f0f5)' }}>{value}</span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

/* ══ Main ════════════════════════════════════════════════════ */
export default function MarkdownPreview() {
  const vw = useWidth();
  const isDesktop = vw >= 768;

  const [text, setText]           = useState(SAMPLE);
  const [layout, setLayout]       = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'editor' : 'split'
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [scrollSync, setScrollSync] = useState(true);
  const textareaRef = useRef(null);
  const previewRef  = useRef(null);
  const syncingRef  = useRef(false);

  const stats = getStats(text);
  const html  = markdownToHtml(text);

  /* ── Scroll sync ── */
  const onEditorScroll = useCallback(() => {
    if (!scrollSync || syncingRef.current || !previewRef.current || !textareaRef.current) return;
    syncingRef.current = true;
    const el = textareaRef.current;
    const ratio = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
    const pr = previewRef.current;
    pr.scrollTop = ratio * (pr.scrollHeight - pr.clientHeight);
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [scrollSync]);

  /* ── Insert helpers ── */
  const insert = useCallback((before, after = '', placeholder = 'text') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const sel = text.slice(start, end) || placeholder;
    const newText = text.slice(0, start) + before + sel + after + text.slice(end);
    setText(newText);
    requestAnimationFrame(() => {
      el.focus();
      const ns = start + before.length;
      el.setSelectionRange(ns, ns + sel.length);
    });
  }, [text]);

  const insertLine = useCallback((prefix) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart);
    setText(newText);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + prefix.length, start + prefix.length); });
  }, [text]);

  /* ── Download ── */
  const download = (content, name, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Keyboard shortcuts ── */
  const onKeyDown = useCallback((e) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b') { e.preventDefault(); insert('**', '**', 'bold text'); }
      if (e.key === 'i') { e.preventDefault(); insert('*', '*', 'italic text'); }
      if (e.key === 'k') { e.preventDefault(); insert('[', '](url)', 'link text'); }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = textareaRef.current;
      const s = el.selectionStart, en = el.selectionEnd;
      const newText = text.slice(0, s) + '  ' + text.slice(en);
      setText(newText);
      requestAnimationFrame(() => { el.setSelectionRange(s + 2, s + 2); });
    }
  }, [text, insert]);

  const showEditor  = layout === 'split' || layout === 'editor';
  const showPreview = layout === 'split' || layout === 'preview';

  const layoutBtns = [
    { id: 'editor',  icon: Code2,    title: 'Editor only' },
    { id: 'split',   icon: Columns,  title: 'Split view' },
    { id: 'preview', icon: Eye,      title: 'Preview only' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');

        .mdp * { box-sizing: border-box; }
        .mdp { font-family: 'DM Sans', sans-serif; color: var(--text,#f0f0f5); }

        .mdp-textarea {
          width: 100%; height: 100%; min-height: 480px;
          padding: 18px 20px;
          background: transparent; border: none; resize: none; outline: none;
          font-family: 'DM Mono', monospace; font-size: 13.5px; line-height: 1.75;
          color: var(--text,#f0f0f5);
          tab-size: 2;
        }
        .mdp-textarea::placeholder { color: rgba(255,255,255,0.2); }

        /* ── Preview typography ── */
        .mdp-preview { padding: 20px 24px; font-size: 14px; line-height: 1.8; overflow-y: auto; min-height: 480px; }
        .mdp-preview h1 { font-size: 26px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.5px; color: var(--text,#f0f0f5); border-bottom: 1px solid var(--border); padding-bottom: 8px; }
        .mdp-preview h2 { font-size: 20px; font-weight: 700; margin: 20px 0 8px; letter-spacing: -0.3px; color: var(--text,#f0f0f5); }
        .mdp-preview h3 { font-size: 16px; font-weight: 700; margin: 16px 0 6px; color: var(--text,#f0f0f5); }
        .mdp-preview h4,h5,h6 { font-weight: 700; margin: 12px 0 4px; color: var(--text,#f0f0f5); }
        .mdp-preview p  { margin: 0 0 12px; color: rgba(240,240,245,0.85); }
        .mdp-preview a  { color: var(--accent-blue,#2563eb); text-decoration: underline; text-underline-offset: 2px; }
        .mdp-preview strong { font-weight: 700; color: var(--text,#f0f0f5); }
        .mdp-preview em { font-style: italic; color: rgba(240,240,245,0.9); }
        .mdp-preview del { text-decoration: line-through; color: var(--text-muted,#6b6b80); }
        .mdp-preview code {
          background: rgba(37,99,235,0.12); color: #93c5fd;
          padding: 2px 7px; border-radius: 5px;
          font-family: 'DM Mono', monospace; font-size: 12.5px;
          border: 1px solid rgba(37,99,235,0.2);
        }
        .mdp-preview pre {
          background: var(--surface,#111118); border: 1px solid var(--border);
          border-radius: 10px; padding: 16px 18px; overflow-x: auto;
          margin: 12px 0; position: relative;
        }
        .mdp-preview pre code { background: none; border: none; padding: 0; color: #e2e8f0; font-size: 13px; }
        .mdp-preview blockquote {
          border-left: 3px solid var(--accent-blue,#2563eb);
          margin: 12px 0; padding: 8px 16px;
          background: rgba(37,99,235,0.06); border-radius: 0 8px 8px 0;
          color: rgba(240,240,245,0.7); font-style: italic;
        }
        .mdp-preview ul, .mdp-preview ol { padding-left: 22px; margin: 0 0 12px; }
        .mdp-preview li { margin: 4px 0; color: rgba(240,240,245,0.85); }
        .mdp-preview ul li { list-style: disc; }
        .mdp-preview ol li { list-style: decimal; }
        .mdp-preview hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
        .mdp-preview img { max-width: 100%; border-radius: 8px; }

        .mdp-layout-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 7px; border: none;
          background: transparent; color: var(--text-muted,#6b6b80);
          cursor: pointer; transition: all 0.12s; font-family: inherit;
        }
        .mdp-layout-btn.active { background: rgba(37,99,235,0.15); color: var(--accent-blue,#2563eb); }
        .mdp-layout-btn:hover:not(.active) { background: rgba(255,255,255,0.07); color: var(--text,#f0f0f5); }

        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
        .mdp-fadein { animation: fadeIn 0.2s ease both; }
      `}</style>

      <div className="mdp">

        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>

          {/* Stats — compact on mobile */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {[
              { label: 'chars',    value: stats.chars.toLocaleString() },
              { label: 'words',    value: stats.words.toLocaleString() },
              { label: 'lines',    value: stats.lines.toLocaleString() },
              { label: 'read',     value: `~${stats.readTime}m` },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 9px', borderRadius: 7,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: '"DM Mono",monospace', color: 'var(--text,#f0f0f5)' }}>{s.value}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{s.label}</span>
              </div>
            ))}
          </div>

          <div style={{ flex: 1 }}/>

          {/* Layout switcher — desktop: 3 options, mobile: editor/preview toggle */}
          <div style={{ display: 'flex', background: 'var(--surface,#111118)', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 2 }}>
            {(isDesktop ? layoutBtns : [
              { id: 'editor',  icon: Code2, title: 'Editor' },
              { id: 'preview', icon: Eye,   title: 'Preview' },
            ]).map(({ id, icon: Icon, title }) => (
              <button key={id} title={title} className={`mdp-layout-btn${layout===id?' active':''}`} onClick={() => setLayout(id)}>
                <Icon size={14}/>
                {!isDesktop && <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 4 }}>{title}</span>}
              </button>
            ))}
          </div>

          {/* Scroll sync — desktop split only */}
          {isDesktop && layout === 'split' && (
            <button onClick={() => setScrollSync(s => !s)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 11px', borderRadius: 8,
              background: scrollSync ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${scrollSync ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
              color: scrollSync ? 'var(--accent-blue,#2563eb)' : 'var(--text-muted)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}>
              <AlignLeft size={11}/> Sync
            </button>
          )}
        </div>

        {/* ── Editor toolbar — shown when editor is visible ── */}
        {(layout === 'editor' || layout === 'split' || (!isDesktop && layout !== 'preview')) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
            padding: '5px 8px',
            background: 'var(--surface-raised,#18181f)',
            border: '1px solid var(--border)',
            borderRadius: '10px 10px 0 0',
            borderBottom: 'none',
          }}>
            <TBtn icon={Bold}           title="Bold (Ctrl+B)"   onClick={() => insert('**','**','bold text')}/>
            <TBtn icon={Italic}         title="Italic (Ctrl+I)" onClick={() => insert('*','*','italic text')}/>
            <TBtn icon={Strikethrough}  title="Strikethrough"   onClick={() => insert('~~','~~','strikethrough')}/>
            <TDivider/>
            <TBtn icon={Hash}           title="Heading"         onClick={() => insertLine('## ')}/>
            <TBtn icon={Quote}          title="Blockquote"      onClick={() => insertLine('> ')}/>
            <TBtn icon={Minus}          title="HR"              onClick={() => setText(t => t + '\n\n---\n\n')}/>
            <TDivider/>
            <TBtn icon={List}           title="Bullet list"     onClick={() => insertLine('- ')}/>
            <TBtn icon={ListOrdered}    title="Ordered list"    onClick={() => insertLine('1. ')}/>
            <TDivider/>
            <TBtn icon={Link}           title="Link (Ctrl+K)"   onClick={() => insert('[','](url)','link text')}/>
            <TBtn icon={Image}          title="Image"           onClick={() => insert('![','](url)','alt text')}/>
            <TBtn icon={TerminalSquare} title="Code block"      onClick={() => insert('\n```\n','\n```\n','code here')}/>
            <div style={{ flex: 1 }}/>
            <TBtn icon={Trash2}         title="Clear"           onClick={() => setText('')}/>
          </div>
        )}

        {/* ── Main panels ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isDesktop && layout === 'split' ? '1fr 1fr' : '1fr',
          border: '1px solid var(--border)',
          borderRadius: (layout === 'editor' || layout === 'split' || (!isDesktop && layout !== 'preview'))
            ? '0 0 12px 12px' : 12,
          overflow: 'hidden',
          background: 'var(--surface-raised,#18181f)',
        }}>

          {/* Editor panel — show when: desktop editor/split, OR mobile editor tab */}
          {(isDesktop ? (layout === 'editor' || layout === 'split') : layout !== 'preview') && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              borderRight: isDesktop && layout === 'split' ? '1px solid var(--border)' : 'none',
              borderBottom: !isDesktop && layout === 'split' ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Code2 size={11}/> Editor
                </span>
                {isDesktop && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.4, fontFamily: 'monospace' }}>
                    ⌘B · ⌘I · ⌘K
                  </span>
                )}
              </div>
              <textarea
                ref={textareaRef}
                className="mdp-textarea"
                value={text}
                onChange={e => setText(e.target.value)}
                onScroll={onEditorScroll}
                onKeyDown={onKeyDown}
                placeholder="Write your markdown here..."
                spellCheck={false}
                style={{ minHeight: isDesktop ? 480 : 340 }}
              />
            </div>
          )}

          {/* Preview panel — show when: desktop preview/split, OR mobile preview tab */}
          {(isDesktop ? (layout === 'preview' || layout === 'split') : layout === 'preview') && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Eye size={11}/> Preview
                </span>
                <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' }}>● Live</span>
              </div>
              <div
                ref={previewRef}
                className="mdp-preview mdp-fadein"
                dangerouslySetInnerHTML={{ __html: html }}
                style={{ minHeight: isDesktop ? 480 : 340 }}
              />
            </div>
          )}
        </div>

        {/* ── Action bar ── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <CopyBtn label="Copy MD"   getText={() => text}/>
          <CopyBtn label="Copy HTML" getText={() => html}/>
          <button onClick={() => download(text, 'document.md', 'text/markdown')} style={{
            display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:8,
            background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',
            color:'var(--text-muted)',fontFamily:'inherit',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap',
          }}>
            <FileDown size={12}/> .md
          </button>
          <button onClick={() => download(html, 'document.html', 'text/html')} style={{
            display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:8,
            background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',
            color:'var(--text-muted)',fontFamily:'inherit',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap',
          }}>
            <Download size={12}/> .html
          </button>
        </div>

      </div>
    </>
  );
}