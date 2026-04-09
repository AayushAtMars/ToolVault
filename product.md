🎯 AayuTools — Full Build Prompt for Google Antigravity (or any AI coding tool)

PROJECT OVERVIEW
Build a fully functional, multi-page utility web application called ToolVault — a premium, free, all-in-one toolkit website. The design must be modern minimalist — clean whitespace, sharp typography, subtle depth, zero clutter. Think Linear.app meets Vercel meets Notion.

DESIGN SYSTEM
Color Palette:
Background:     #FAFAFA  (near-white, not pure white)
Surface:        #FFFFFF
Surface Raised: #F4F4F5
Border:         #E4E4E7
Border Hover:   #D4D4D8
Text Primary:   #09090B
Text Secondary: #71717A
Text Muted:     #A1A1AA
Accent:         #18181B  (near-black for CTAs)
Accent Alt:     #2563EB  (electric blue for highlights)
Success:        #16A34A
Tag New:        #DBEAFE / #1D4ED8
Tag Hot:        #FEE2E2 / #DC2626
Tag Popular:    #FEF9C3 / #CA8A04
Typography:
Display / Logo:  "Geist" or "Inter" — weight 700-800
Headings:        "Inter" — weight 600
Body:            "Inter" — weight 400, size 14-15px
Mono / Tags:     "Geist Mono" or "JetBrains Mono" — weight 400-500
Line height:     1.6 for body, 1.1 for display
Letter spacing:  -0.02em for headings, 0.08em for mono tags
Spacing Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96px
Border Radius: 6px cards, 8px inputs, 10px modals, 100px pills
Shadows:
sm:  0 1px 2px rgba(0,0,0,0.05)
md:  0 4px 12px rgba(0,0,0,0.06)
lg:  0 8px 32px rgba(0,0,0,0.08)
hover: 0 8px 24px rgba(0,0,0,0.10)

LAYOUT & PAGES
1. NAVIGATION (sticky, blurred)

Logo left: Tool + Vault (second word in blue)
Center: links — Tools, PDF, Image, Developer, Converters
Right: GitHub icon + Browse All Tools button (filled, dark)
Height: 56px, background: white/90 + backdrop-blur-md
Bottom border: 1px solid border color
On scroll: add subtle shadow

2. HERO SECTION

Centered layout, generous vertical padding (120px top)
Top badge: pill shape — ✦ 50+ tools · Always Free in blue tint
H1: Two lines, huge — Every Tool / You'll Ever Need — font size clamp(48px, 8vw, 88px), weight 800, tight tracking
Subtext: 16px, muted color, max-width 480px, centered
Two CTAs side by side: Browse Tools → (dark filled) + View on GitHub (ghost outlined)
Below CTAs: avatar stack + "Trusted by 2M+ users" social proof
Background: Pure white with a very subtle dot grid pattern (SVG, opacity 0.4)
Floating elements: 3–4 frosted-glass tool preview cards scattered in background with slight rotation (±3°), blur behind them — position: absolute, pointer-events none

3. STATS BAR

Full-width, light gray background (#F4F4F5)
5 stats in a row: 50+ Tools / 100% Free / No Watermarks / No Login / 2M+ Files
Each stat: large number (28px, weight 700) + label below (11px mono, muted, uppercase)
Dividers between each stat

4. SEARCH + FILTER BAR (sticky below nav when scrolled to tools)

Search input: full width max 640px, centered

Left icon: magnifier
Right: ⌘K keyboard shortcut badge
Placeholder: Search 50+ tools...


Below search: horizontal scrollable pill filters

All · PDF · Image · Text · Developer · Design · Converter · AI Tools
Active state: dark filled pill, inactive: ghost outlined pill



5. TOOLS GRID (main content)
Group tools by category with a section header per group:
Section Header format:
[Category Icon] Category Name ——————————— (12) tools

Icon left, name in mono caps, count right, line fills middle

Card design (minimalist):

White background, 1px border, 6px radius
Hover: border darkens, shadow lifts, arrow icon appears top-right
Inside card:

Top: emoji icon (24px) in a 40x40 light gray square, rounded 8px
Tool name: 14px, weight 600, color primary
Description: 12px, muted, 2 lines max, ellipsis
Bottom: tag pill (Hot/New/Popular) left, arrow right


Grid: repeat(auto-fill, minmax(220px, 1fr)), gap 1px, border around entire grid (mosaic/seamless look)

6. FEATURE SECTION ("Why ToolVault?")

3-column grid
Each feature: icon in colored square (12px radius) + title + body text
Icons: 🔒 Privacy First / ⚡ Instant Processing / 💎 Always Free
Clean, no backgrounds — just typography and spacing

7. TOOL MODAL (click any card)

Center modal, max-width 480px
Dark overlay backdrop
Header: icon + tool name + close button (X, top right)
Description paragraph
Upload dropzone: dashed border, rounded, hover state changes border to blue

Upload icon + "Click to upload or drag & drop"
Accepted formats + max size note


Action button: full-width, dark
Animate in: scale(0.97) → scale(1) + fade, 200ms ease

8. FOOTER

3-column: Logo + tagline / Navigation links / Social links
Bottom bar: copyright left, "Made with ♥" right
Top border only, white background


INTERACTIONS & ANIMATIONS
Page load:      Hero text fades up staggered (0ms, 100ms, 200ms delays)
Tool cards:     Fade-in on scroll using Intersection Observer, staggered by index
Card hover:     Border color transition 150ms, shadow lift 200ms, arrow slide-in
Search filter:  Cards animate out (opacity 0, scale 0.98) / in (opacity 1, scale 1)
Category pills: Active pill slides background (position animated, not re-render)
Modal open:     Backdrop fade 200ms, modal scale+fade 200ms
Modal close:    Reverse, 150ms
Scroll nav:     Shadow appears smoothly on scroll past 60px

TOOL CATEGORIES & TOOLS LIST
PDF Tools (10): Merge PDF · Split PDF · Compress PDF · PDF to Word · Word to PDF · PDF to JPG · JPG to PDF · Rotate PDF · Add Watermark · Unlock PDF · PDF Editor
Image Tools (8): Compress Image · Resize Image · Convert Format · Remove Background · Crop Image · Add Watermark · Bulk Rename · Upscale Image (AI)
Text Tools (5): Word Counter · Case Converter · Diff Checker · Lorem Ipsum Generator · Markdown Preview
Developer Tools (8): JSON Formatter · Base64 Encode/Decode · URL Encoder · Hash Generator · UUID Generator · CSS Minifier · Regex Tester · Cron Builder
Design Tools (6): Color Palette Generator · Gradient Generator · Box Shadow Builder · Border Radius Builder · Font Pairing Tool · SVG to PNG
Converter Tools (6): Unit Converter · Currency Converter · Timezone Converter · Number Base Converter · Video to MP3 · QR Code Generator
AI Tools (4): AI Summarizer · Grammar Checker · AI Translator · Image Describer

TECH STACK (suggest to the AI)
Framework:   React + Vite  OR  Next.js 14 App Router
Styling:     Tailwind CSS v3 with custom design tokens
Animations:  Framer Motion (card reveals, modal, stagger)
Icons:       Lucide React
Fonts:       Google Fonts — Inter + JetBrains Mono
State:       Zustand or useState (search, filter, modal)
Routing:     React Router or Next.js file-based routing

COMPONENT STRUCTURE
src/
├── components/
│   ├── Nav.jsx
│   ├── Hero.jsx
│   ├── StatsBar.jsx
│   ├── SearchBar.jsx
│   ├── CategoryFilter.jsx
│   ├── ToolCard.jsx
│   ├── ToolGrid.jsx
│   ├── ToolModal.jsx
│   ├── FeatureSection.jsx
│   └── Footer.jsx
├── data/
│   └── tools.js        ← all 50+ tools as JSON array
├── hooks/
│   ├── useSearch.js
│   └── useFilter.js
├── pages/
│   ├── Home.jsx
│   └── Tool/[slug].jsx  ← individual tool pages
└── App.jsx

TOOLS DATA SCHEMA
js{
  id: "merge-pdf",
  name: "Merge PDF",
  description: "Combine multiple PDF files into one document.",
  category: "pdf",
  icon: "📑",
  tags: ["hot"],           // "hot" | "popular" | "new" | []
  keywords: ["combine", "join", "merge", "pdf"],
  acceptedFormats: [".pdf"],
  maxFileSize: "500MB",
  multipleFiles: true
}

KEY RULES FOR THE AI

No purple gradients. No rainbow gradients. No glassmorphism overload.
Whitespace is content. Use generous padding — 48px+ section gaps.
One accent color only — blue (#2563EB) used sparingly for active states and links.
Cards use a mosaic grid — 1px gap between cards, border around the entire grid, no individual card shadows on default state.
Typography hierarchy is strict — 3 sizes max per section.
Animations must be subtle — nothing bouncy or distracting. Ease-out, short durations.
Mobile first — collapse to 2-col on tablet, 1-col on mobile. Nav becomes hamburger.
No Lorem ipsum in UI copy — write real, crisp microcopy for every element.
Dark mode support — use CSS variables and prefers-color-scheme media query with a dark variant.
Accessibility — all interactive elements need focus rings, aria-labels on icon buttons, semantic HTML.