import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { tools as allTools } from '../data/tools';
import { useSearch } from '../hooks/useSearch';
import { useFilter } from '../hooks/useFilter';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import StatsBar from '../components/StatsBar';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import ToolGrid from '../components/ToolGrid';
import FeatureSection from '../components/FeatureSection';
import Footer from '../components/Footer';

export default function Home() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const filtered = useFilter(allTools, category);
  const results = useSearch(filtered, query);

  const siteUrl = 'https://aayutools.vercel.app';
  const title = 'AayuTools - 50+ Premium Web Tools | Free, Fast & Private';
  const description = 'Access 50+ professional web tools for PDF, Image, Text, and Developer tasks. 100% free, private processing in your browser. No sign-ups required.';

  // Keyboard shortcut: ⌘K to focus search
  const handleKeyboard = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const input = document.querySelector('.search__input');
      if (input) input.focus();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, [handleKeyboard]);

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={siteUrl} />
        
        {/* OpenGraph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${siteUrl}/og-image.png`} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Helmet>
      <Nav />
      <main>
        <Hero />
        <StatsBar />
        <SearchBar query={query} setQuery={setQuery} />
        <CategoryFilter active={category} setActive={setCategory} />
        <ToolGrid tools={results} />
        <FeatureSection />
      </main>
      <Footer />
    </>
  );
}
