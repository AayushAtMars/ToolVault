import { useParams, Navigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft } from 'lucide-react';
import { tools } from '../data/tools';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import ToolNotFound from '../components/ToolNotFound';

// Tool Components
import WordCounter from '../tools/WordCounter';
import CompressImage from '../tools/CompressImage';
import ResizeImage from '../tools/ResizeImage';
import CropImage from '../tools/CropImage';
import ConvertFormat from '../tools/ConvertFormat';

import CaseConverter from '../tools/CaseConverter';
import DiffChecker from '../tools/DiffChecker';
import LoremIpsum from '../tools/LoremIpsum';
import MarkdownPreview from '../tools/MarkdownPreview';

import JsonFormatter from '../tools/JsonFormatter';
import Base64Codec from '../tools/Base64Codec';
import UrlEncoder from '../tools/UrlEncoder';
import HashGenerator from '../tools/HashGenerator';
import UuidGenerator from '../tools/UuidGenerator';
import CssMinifier from '../tools/CssMinifier';
import RegexTester from '../tools/RegexTester';
import CronBuilder from '../tools/CronBuilder';

import ColorPalette from '../tools/ColorPalette';
import GradientGenerator from '../tools/GradientGenerator';
import BoxShadowBuilder from '../tools/BoxShadowBuilder';
import BorderRadiusBuilder from '../tools/BorderRadiusBuilder';
import FontPairing from '../tools/FontPairing';
import SvgToPng from '../tools/SvgToPng';

import UnitConverter from '../tools/UnitConverter';
import CurrencyConverter from '../tools/CurrencyConverter';
import TimezoneConverter from '../tools/TimezoneConverter';
import NumberBaseConverter from '../tools/NumberBaseConverter';
import VideoToMp3 from '../tools/VideoToMp3';
import QrCodeGenerator from '../tools/QrCodeGenerator';

import AiSummarizer from '../tools/AiSummarizer';
import GrammarChecker from '../tools/GrammarChecker';
import AiTranslator from '../tools/AiTranslator';
import ImageDescriber from '../tools/ImageDescriber';
import RemoveBackground from '../tools/RemoveBackground';
import AddWatermarkImage from '../tools/AddWatermarkImage';
import BulkRename from '../tools/BulkRename';
import UpscaleImage from '../tools/UpscaleImage';




import GenericFileProcessor from '../tools/GenericFileProcessor';
import MergePdf from '../tools/MergePdf';
import SplitPdf from '../tools/SplitPdf';
import CompressPdf from '../tools/CompressPdf';
import WordToPdf from '../tools/WordToPdf';
import PdfToWord from '../tools/PdfToWord';
import PdfToJpg from '../tools/PdfToJpg';
import PdfEditor from '../tools/PdfEditor';
import RotatePdf from '../tools/RotatePdf';
import AddWatermark from '../tools/AddWatermark';
import UnlockPdf from '../tools/UnlockPdf';

const COMPONENT_MAP = {
  // Text
  'word-counter': WordCounter,
  'compress-image': CompressImage,
  'resize-image': ResizeImage,
  'crop-image': CropImage,
  'convert-format': ConvertFormat,

  'case-converter': CaseConverter,
  'diff-checker': DiffChecker,
  'lorem-ipsum': LoremIpsum,
  'markdown-preview': MarkdownPreview,
  
  // Developer
  'json-formatter': JsonFormatter,
  'base64-encode': Base64Codec,
  'url-encoder': UrlEncoder,
  'hash-generator': HashGenerator,
  'uuid-generator': UuidGenerator,
  'css-minifier': CssMinifier,
  'regex-tester': RegexTester,
  'cron-builder': CronBuilder,
  
  // Design
  'color-palette': ColorPalette,
  'gradient-generator': GradientGenerator,
  'box-shadow': BoxShadowBuilder,
  'border-radius': BorderRadiusBuilder,
  'font-pairing': FontPairing,
  'svg-to-png': SvgToPng,
  
  // Converter
  'unit-converter': UnitConverter,
  'currency-converter': CurrencyConverter,
  'timezone-converter': TimezoneConverter,
  'number-base': NumberBaseConverter,
  'video-to-mp3': VideoToMp3,
  'qr-code': QrCodeGenerator,
  
  // AI
  'ai-summarizer': AiSummarizer,
  'grammar-checker': GrammarChecker,
  'ai-translator': AiTranslator,
  'image-describer': ImageDescriber,
  'remove-background': RemoveBackground,
  'add-watermark-image': AddWatermarkImage,
  'bulk-rename': BulkRename,
  'upscale-image': UpscaleImage,




  // PDF
  'merge-pdf': MergePdf,
  'split-pdf': SplitPdf,
  'compress-pdf': CompressPdf,
  'word-to-pdf': WordToPdf,
  'pdf-to-word': PdfToWord,
  'pdf-to-jpg': PdfToJpg,
  'pdf-editor': PdfEditor,
  'rotate-pdf': RotatePdf,
  'add-watermark-pdf': AddWatermark,
  'unlock-pdf': UnlockPdf,
};

function useWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const handleResize = () => setW(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return w;
}

export default function ToolRoute() {
  const { id } = useParams();
  const vw = useWidth();
  const isMobile = vw < 768;
  const tool = tools.find((t) => t.id === id);

  if (!tool) {
    return <ToolNotFound />;
  }

  const SpecificComponent = COMPONENT_MAP[tool.id];
  const isGeneric = ['pdf', 'image'].includes(tool.category);

  // SEO: Dynamic Metadata & JSON-LD
  const siteUrl = 'https://aayutools.vercel.app';
  const pageUrl = `${siteUrl}/tool/${tool.id}`;
  const title = `${tool.name} - Free & Secure Online Tool | AayuTools`;
  const description = tool.description || `Use our free, private, and fast ${tool.name} tool on AayuTools. Processes 100% locally in your browser.`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": tool.name,
    "operatingSystem": "Web",
    "applicationCategory": tool.category === 'pdf' ? 'MultimediaApplication' : 'UtilityApplication',
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": description,
    "url": pageUrl
  };

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={pageUrl} />
        
        {/* OpenGraph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <Nav />
      <main style={{ paddingTop: 'var(--nav-height)', minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="container" style={{ padding: isMobile ? '24px 16px' : '40px 0' }}>
          
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, marginBottom: isMobile ? 24 : 32, fontWeight: 500, transition: 'color 0.2s' }} className="hover:text-primary">
            <ChevronLeft size={16} /> Back to all tools
          </Link>

          <div style={{ marginBottom: isMobile ? 32 : 40, borderBottom: '1px solid var(--border)', paddingBottom: isMobile ? 24 : 32 }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, marginBottom: 12 }}>
              <div 
                style={{ width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, background: 'var(--surface-raised)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 24 : 28, border: '1px solid var(--border)' }}
                aria-label={`${tool.name} icon`}
              >
                {tool.icon}
              </div>
              <div>
                <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{tool.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span className={`tag`}>{tool.category}</span>
                </div>
              </div>
            </div>
            <p style={{ fontSize: isMobile ? 14 : 16, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 640 }}>
              {tool.description}
            </p>
          </div>

          <div style={{ 
            background: 'var(--surface)', border: '1px solid var(--border)', 
            borderRadius: isMobile ? 16 : 'var(--radius-lg)', padding: isMobile ? '20px' : '32px 40px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
            minHeight: isMobile ? 300 : 400
          }}>
            {SpecificComponent ? (
              <SpecificComponent />
            ) : isGeneric ? (
              <GenericFileProcessor 
                title={`Upload files for ${tool.name}`}
                description={`Supports ${tool.acceptedFormats.join(', ')} up to ${tool.maxFileSize}`}
                accept={tool.acceptedFormats.join(',')}
                processLabel={tool.name}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: isMobile ? 32 : 64, color: 'var(--text-muted)' }}>
                Component for {tool.name} is under construction!
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
