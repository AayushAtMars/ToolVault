import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import Nav from './Nav';
import Footer from './Footer';

export default function ToolNotFound() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: 'var(--nav-height)', minHeight: 'calc(100vh - 200px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={40} color="var(--text-muted)" />
            </div>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Tool Not Found</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
            We couldn't find the tool you're looking for. It might have been moved or doesn't exist.
          </p>
          <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            Browse tools
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
