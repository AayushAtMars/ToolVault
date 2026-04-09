import os
import re

TOOLS_DIR = "/home/aayu/Desktop/AayuTools/src/tools"

responsive_helpers = """
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
"""

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip files already processed or reference files
    if "function useWidth()" in content or "CompressImage" in filepath or "AddWatermark" in filepath:
        return

    original_content = content

    # 1. Add ChevronUp, ChevronDown to lucide-react imports if not there
    lucide_match = re.search(r"import\s+\{([^}]+)\}\s+from\s+['\"]lucide-react['\"];", content)
    if lucide_match:
        imports = lucide_match.group(1)
        if "ChevronUp" not in imports:
            new_imports = imports + ", ChevronUp, ChevronDown"
            content = content.replace(f"import {{{imports}}}", f"import {{{new_imports}}}")

    # 2. Add useEffect to react imports if not there
    react_match = re.search(r"import\s+\{([^}]+)\}\s+from\s+['\"]react['\"];", content)
    if react_match:
        imports = react_match.group(1)
        if "useEffect" not in imports:
            new_imports = imports + ", useEffect"
            content = content.replace(f"import {{{imports}}}", f"import {{{new_imports}}}")

    # 3. Insert helpers before the component definition
    comp_def_match = re.search(r"export\s+default\s+function\s+([A-Za-z0-9_]+)\s*\(\)\s*\{", content)
    if not comp_def_match:
        return
    
    # We'll inject helpers before `export default function...`
    # Also ensuring we only inject once.
    if "/* ── Responsive hook ─────────────────────────────────────── */" not in content:
        content = content.replace(comp_def_match.group(0), responsive_helpers + "\n" + comp_def_match.group(0))

    # 4. Inject vw definitions inside component
    vw_defs = """  const vw = useWidth();
  const isMobile = vw < 640;
  const isDesktop = vw >= 1024;
"""
    # Just after component def:
    content = content.replace(comp_def_match.group(0), comp_def_match.group(0) + "\n" + vw_defs)

    # 5. Find 2-column or grid main wrappers and make them responsive.
    # Pattern: display:\s*'grid',\s*gridTemplateColumns:\s*'2[0-9]{2}px 1fr'
    grid_match = re.finditer(r"display:\s*['\"]grid['\"]\s*,\s*gridTemplateColumns:\s*['\"](\d+px\s+1fr|1fr\s+\d+px)['\"]", content)
    for match in grid_match:
        old_str = match.group(0)
        cols = match.group(1)
        new_str = f"display: isDesktop ? 'grid' : 'flex', flexDirection: isDesktop ? 'row' : 'column', gridTemplateColumns: isDesktop ? '{cols}' : undefined"
        content = content.replace(old_str, new_str)

    # 6. For inner repeating grids, make them responsive
    # like gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))'
    # we can make minmax smaller on mobile
    content = re.sub(
        r"gridTemplateColumns:\s*['\"]repeat\(auto-fill,\s*minmax\((\d+)px,\s*1fr\)\)['\"]",
        r"gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? Math.min(140, \1) : \1}px,1fr))`",
        content
    )

    # 7. Make padding responsive on IDLE file drop zones
    # padding:'80px 40px' -> padding: isMobile ? '48px 20px' : '80px 40px'
    content = re.sub(
        r"padding:\s*['\"]80px\s+40px['\"]",
        "padding: isMobile ? '48px 20px' : '80px 40px'",
        content
    )

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {os.path.basename(filepath)}")

for filename in os.listdir(TOOLS_DIR):
    if filename.endswith(".jsx"):
        process_file(os.path.join(TOOLS_DIR, filename))
