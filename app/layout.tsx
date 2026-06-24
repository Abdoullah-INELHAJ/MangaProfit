import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DataProvider } from '../context/DataContext';
import PWARegister from '../components/PWARegister';
import Link from 'next/link';
import { Search, BarChart2, Download, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MangaProfit — Achat/Revente Vinted',
  description: 'Outil intelligent pour optimiser l\'achat-revente de mangas sur Vinted. Calculez vos marges, estimez votre ROI et analysez la hype en temps réel.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MangaProfit',
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  }
};

export const viewport: Viewport = {
  themeColor: '#ff3e3e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <div className="manga-grid-bg"></div>
        <DataProvider>
          <PWARegister />
          <div className="app-container">
            {/* Header Navigation */}
            <header style={headerStyle}>
              <div className="header-content" style={headerContentStyle}>
                <Link href="/" style={logoStyle}>
                  <div style={logoWrapperStyle}>
                    <img src="/icon.svg" alt="MangaProfit Logo" style={{ width: '100%', height: '100%' }} />
                  </div>
                  <span style={logoTextStyle}>Manga<span style={{ color: 'var(--accent-neon)' }}>Profit</span></span>
                </Link>
                
                <nav className="header-nav" style={navLinksStyle}>
                  <Link href="/" className="header-nav-link" style={navLinkStyle}>
                    <Search size={18} />
                    <span>Recherche</span>
                  </Link>
                  <Link href="/dashboard" className="header-nav-link" style={navLinkStyle}>
                    <BarChart2 size={18} />
                    <span>Tableau de Bord</span>
                  </Link>
                  <Link href="/import" className="header-nav-link" style={navLinkStyle}>
                    <Download size={18} />
                    <span>Import/Export</span>
                  </Link>
                </nav>
                
                <div style={headerRightStyle}>
                  <div style={premiumBadgeStyle}>
                    <Zap size={14} fill="currentColor" />
                    <span>PRO</span>
                  </div>
                </div>
              </div>
            </header>
            
            <main className="main-content">
              {children}
            </main>
            
            <footer style={footerStyle}>
              <p>© {new Date().getFullYear()} MangaProfit. Développé pour optimiser vos gains sur Vinted.</p>
              <p style={{ marginTop: '4px', fontSize: '0.75rem', opacity: 0.5 }}>
                Analyse indicative. Les prix réels dépendent du marché.
              </p>
            </footer>
          </div>
        </DataProvider>
      </body>
    </html>
  );
}

// Inline styles for header structure and layout
const headerStyle: React.CSSProperties = {
  background: 'var(--glass-bg)',
  backdropFilter: 'var(--glass-blur)',
  borderBottom: '1px solid var(--border-medium)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
  boxShadow: 'var(--glass-shadow)',
};

const headerContentStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 24px',
  maxWidth: '1400px',
  margin: '0 auto',
};

const logoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  textDecoration: 'none',
  color: 'inherit',
};

const logoWrapperStyle: React.CSSProperties = {
  width: '38px',
  height: '38px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const logoTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.4rem',
  fontWeight: 800,
  letterSpacing: '-0.03em',
};

const navLinksStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const navLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  textDecoration: 'none',
  color: 'var(--text-secondary)',
  fontSize: '0.9rem',
  fontWeight: 500,
  padding: '8px 12px',
  borderRadius: '8px',
  transition: 'all var(--transition-fast)',
};

const headerRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

const premiumBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  backgroundColor: 'rgba(255, 170, 0, 0.15)',
  color: 'var(--accent-gold)',
  border: '1px solid rgba(255, 170, 0, 0.3)',
  padding: '4px 10px',
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: 700,
};

const footerStyle: React.CSSProperties = {
  padding: '24px',
  textAlign: 'center',
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  borderTop: '1px solid var(--border-light)',
  marginTop: '40px',
  background: 'var(--bg-secondary)',
};
