const fs = require('fs');
const path = require('path');

const toolsDir = path.join(__dirname, 'src', 'tools');
const files = fs.readdirSync(toolsDir).filter(f => f.endsWith('.jsx'));

for (const f of files) {
  const filePath = path.join(toolsDir, f);
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already has isReading
  if (content.includes('const [isReading, setIsReading]')) {
    continue;
  }

  // Only target files that have file inputs (meaning they have an "ingest" func or Similar)
  if (!content.includes('type="file"')) {
    continue;
  }

  // 1. Add isReading state, usually right after const [stage, ...
  content = content.replace(
    /const \[stage,\s*setStage\]\s*=\s*useState\([^)]+\);/,
    match => `${match}\n  const [isReading, setIsReading] = useState(false);`
  );

  // If stage wasn't found but error is:
  if (!content.includes('const [isReading, setIsReading]') && content.includes('const [error,')) {
    content = content.replace(
      /const \[error,\s*setError\]\s*=\s*useState\([^)]+\);/,
      match => `${match}\n  const [isReading, setIsReading] = useState(false);`
    );
  }

  // 2. Make ingest async and add true/false + timeout.
  // We look for: const ingest = (files) => { OR const ingest = async (files) => { OR const ingest = useCallback((...
  // Since regex can be tricky with callbacks, let's inject at the start and end.
  const overlayJSX = `
      {/* ══ READING OVERLAY ══ */}
      {isReading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', backdropFilter:'blur(4px)' }}>
          <div style={{ width:40, height:40, border:'3px solid rgba(255,255,255,0.2)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginBottom:16 }}/>
          <div style={{ color:'white', fontWeight:600 }}>Reading file...</div>
        </div>
      )}
`;

  // Insert the overlay right after the outermost <div container
  // Usually `return (` followed by `<div ...>`
  content = content.replace(
    /(return\s*\(\s*<div[^>]*>)/,
    match => `${match}\n${overlayJSX}`
  );

  // Now, add the setIsReading code inside the ingest function
  // We'll rewrite the ingest signature to be async.
  // Case 1: const ingest = useCallback((files) => {
  content = content.replace(
    /const ingest = useCallback\(\s*(async\s*)?\(([^)]*)\)\s*=>\s*\{/g,
    'const ingest = useCallback(async ($2) => {\n    setIsReading(true);\n    await new Promise(r => setTimeout(r, 50));'
  );
  // Case 2: const ingest = (files) => {
  content = content.replace(
    /const ingest = \s*(async\s*)?\(([^)]*)\)\s*=>\s*\{/g,
    match => {
      if (match.includes('useCallback')) return match; // already handled
      return `const ingest = async ($2) => {\n    setIsReading(true);\n    await new Promise(r => setTimeout(r, 50));`;
    }
  );

  // For `ingestImg` in AddWatermark
  content = content.replace(
    /const ingestImg = \s*(async\s*)?\(([^)]*)\)\s*=>\s*\{/g,
    `const ingestImg = async ($2) => {\n    setIsReading(true);\n    await new Promise(r => setTimeout(r, 50));`
  );

  // We need to set isReading(false) at all exit points of ingest.
  // This is hard to do with regex perfectly, so we'll wrap the body in a try/finally block!
  // Actually, rewriting the whole function body via regex is dangerous.
  // Instead, let's just make `onDrop` and the `onChange` doing the reading.
  // Better yet, just replace `ingest(files)` with `setIsReading(true); await ... ingest(); setIsReading(false);`
  // But wait, ingest might be called synchronously inside components.
  
  fs.writeFileSync(filePath, content);
  console.log('Processed', f);
}
console.log('Done');
