import { useState, useEffect } from 'react';
import { Menu, X, Github, Sun, Moon } from 'lucide-react';
import './Nav.css';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navLinks = [
    { label: 'Tools', href: '#tools' },
    { label: 'PDF', href: '#pdf' },
    { label: 'Image', href: '#image' },
    { label: 'Developer', href: '#developer' },
    { label: 'Converters', href: '#converter' },
  ];

  const handleLinkClick = () => setMobileOpen(false);

  return (
    <>
      <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="nav__inner container">
          <a href="/" className="nav__logo" aria-label="AayuTools Home" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/favicon.svg" alt="AayuTools" width="26" height="26" style={{ display: 'block' }} />
            <div>
              <span className="nav__logo-tool">Tool</span>
              <span className="nav__logo-vault">Vault</span>
            </div>
          </a>

          <div className="nav__links">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="nav__link">
                {link.label}
              </a>
            ))}
          </div>

          <div className="nav__actions">
            <button
              className="nav__theme-toggle"
              onClick={() => setDark(!dark)}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            
            <a href="#tools" className="btn btn-primary nav__browse-btn">
              Browse All Tools
            </a>
            <button
              className="nav__hamburger"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div
        className={`nav-mobile-overlay ${mobileOpen ? 'nav-mobile-overlay--open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile menu */}
      <div className={`nav-mobile ${mobileOpen ? 'nav-mobile--open' : ''}`} role="dialog" aria-label="Mobile navigation">
        <div className="nav-mobile__links">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="nav-mobile__link" onClick={handleLinkClick}>
              {link.label}
            </a>
          ))}
          <a href="#tools" className="btn btn-primary nav-mobile__cta" onClick={handleLinkClick}>
            Browse All Tools
          </a>
        </div>
      </div>
    </>
  );
}
