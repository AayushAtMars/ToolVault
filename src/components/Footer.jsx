import { Github, Twitter, Heart, ExternalLink, ShieldCheck, Mail, Activity } from 'lucide-react';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner container">
        <div className="footer__grid">
          {/* Brand Section */}
          <div className="footer__brand">
            <a href="/" className="footer__logo" aria-label="AayuTools Home">
              <span className="footer__logo-tool">Tool</span>
              <span className="footer__logo-vault">Vault</span>
            </a>
            <p className="footer__tagline">
              Premium web tools for every occasion. Fast, secure, and 100% private processing right in your browser.
            </p>
            <div className="footer__status">
              <div className="footer__status-dot"></div>
              <span className="footer__status-text">All Systems Operational</span>
            </div>
          </div>

          {/* Explore Section */}
          <div className="footer__col">
            <h4 className="footer__col-title">Explore</h4>
            <nav className="footer__nav">
              <a href="/#image" className="footer__link">Image Processing</a>
              <a href="/#pdf" className="footer__link">PDF Management</a>
              <a href="/#text" className="footer__link">Text Utilities</a>
              <a href="/#developer" className="footer__link">Developer Suite</a>
              <a href="/#design" className="footer__link">Design Tools</a>
            </nav>
          </div>

          {/* Company Section */}
          <div className="footer__col">
            <h4 className="footer__col-title">Company</h4>
            <nav className="footer__nav">
              <a href="/about" className="footer__link">About Us</a>
              <a href="/privacy" className="footer__link">Privacy Policy</a>
              <a href="/terms" className="footer__link">Terms of Service</a>
              <a href="/changelog" className="footer__link">Changelog</a>
            </nav>
          </div>

          {/* Connect Section */}
          {/* <div className="footer__col">
            <h4 className="footer__col-title">Connect</h4>
            <nav className="footer__nav">
              <a href="https://github.com/AayushAtMars" target="_blank" rel="noopener noreferrer" className="footer__link footer__link--icon">
                <Github size={14} /> GitHub
              </a>
              <a href="https://www.aayushrajput.in" target="_blank" rel="noopener noreferrer" className="footer__link footer__link--icon">
                <ExternalLink size={14} /> Portfolio
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="footer__link footer__link--icon">
                <Twitter size={14} /> Twitter
              </a>
              <a href="mailto:support@aayutools.com" className="footer__link footer__link--icon">
                <Mail size={14} /> Contact Support
              </a>
            </nav>
          </div> */}
        </div>

        <div className="footer__bottom">
          <div className="footer__copy">
            &copy; {currentYear} ToolVault. High-performance tools for everyone.
          </div>
          <div className="footer__meta">
            <span className="footer__made">
              Crafted with <Heart size={12} className="footer__heart" /> by Vaishnavi
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
