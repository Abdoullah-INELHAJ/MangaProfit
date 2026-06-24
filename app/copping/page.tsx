'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import MangaCover from '../../components/MangaCover';
import { Search as SearchIcon, Zap, Play, Square, ExternalLink, Filter, RotateCw, AlertCircle, ShoppingCart } from 'lucide-react';

interface VintedListing {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  url: string;
  condition: string;
  description: string;
  receivedAt: number;
}

export default function CoppingPage() {
  const { mangas } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<VintedListing[]>([]);
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Basic Filters
  const [filterMangaOnly, setFilterMangaOnly] = useState(true); 
  const [filterStrictTime, setFilterStrictTime] = useState(false);
  const [maxPrice, setMaxPrice] = useState<string>('');

  const [serverIp, setServerIp] = useState('Vérification...');
  const [stats, setStats] = useState<{
    totalVintedRequests: number;
    total403Errors: number;
    cacheHits: number;
    cacheMisses: number;
  } | null>(null);

  const isFetchingRef = useRef(false); // Anti double-fetch protection

  // Initial load
  useEffect(() => {
    if (mangas.length > 0 && searchQuery === '') {
      const defaultManga = mangas[0].titre;
      setSearchQuery(defaultManga);
      fetchVintedListings(defaultManga);
    }
  }, [mangas]);

  // Auto-Refresh: Polls every 5 seconds
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isLiveActive && searchQuery) {
      intervalId = setInterval(() => {
        fetchVintedListings(searchQuery, true);
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLiveActive, searchQuery, filterMangaOnly]);

  const fetchVintedListings = async (query: string, isSilent = false) => {
    if (!query.trim()) return;
    if (isFetchingRef.current) return; // Prevent simultaneous overlapping calls
    
    isFetchingRef.current = true;
    if (!isSilent && listings.length === 0) setIsLoading(true);

    try {
      // catalog_id=1341 = "Bandes dessinées, mangas et romans graphiques" sur Vinted FR
      const catalogQuery = filterMangaOnly ? '&catalog_ids=1341' : '';
      const res = await fetch(`/api/vinted?q=${encodeURIComponent(query)}${catalogQuery}&t=${Date.now()}`);
      if (!res.ok) throw new Error("Erreur de connexion API");
      
      const data = await res.json();
      if (data.serverIp) {
        setServerIp(data.serverIp);
      }
      if (data.stats) {
        setStats(data.stats);
      }
      if (data.error) {
        setErrorMessage(data.error);
      } else {
        setErrorMessage(null);
      }
      
      if (data.items) {
        const now = Date.now();
        setListings(prev => {
          const incoming: VintedListing[] = data.items.map((item: any) => {
            const existing = prev.find(p => p.id === item.id);
            return {
              ...item,
              receivedAt: existing ? existing.receivedAt : now,
            };
          });

          // Merge uniquely
          const uniqueNew = incoming.filter(inc => !prev.some(p => p.id === inc.id));
          const merged = [...uniqueNew, ...prev.filter(p => incoming.some(inc => inc.id === p.id))];
          
          // Sort by Vinted ID descending (sequential IDs = highest ID is the absolute newest post)
          merged.sort((a, b) => Number(b.id) - Number(a.id));
          
          return merged.slice(0, 50);
        });
      }
    } catch (err: any) {
      console.error("Sniper refresh error:", err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setListings([]);
    fetchVintedListings(searchQuery);
  };

  const processedListings = listings
    .filter(lst => {
      if (filterStrictTime) {
        const ageSec = Math.floor((Date.now() - lst.receivedAt) / 1000);
        if (ageSec > 90) return false;
      }
      if (maxPrice && lst.price > parseFloat(maxPrice)) return false;
      return true;
    });

  return (
    <div>
      {/* Title & Live Status Indicator */}
      <section style={{ padding: '20px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Sniper de Deals <span style={{ color: 'var(--accent-gold)' }}>Copping</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Flux d'annonces réelles Vinted mis à jour toutes les 5 secondes.
          </p>
        </div>

        {/* IP Display & Live Switch */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>IP Serveur Scraper</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', fontWeight: 800, fontFamily: 'monospace', backgroundColor: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-medium)' }}>
              {serverIp}
            </div>
          </div>

          <div className="glass-panel" style={liveIndicatorWrapper}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                backgroundColor: isLiveActive ? 'var(--success)' : 'var(--text-muted)',
                boxShadow: isLiveActive ? '0 0 10px var(--success)' : 'none',
                display: 'inline-block',
                animation: isLiveActive ? 'pulse 1.5s infinite' : 'none'
              }}></span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                {isLiveActive ? 'SNIPER 5s : ACTIF' : 'SNIPER : PAUSE'}
              </span>
            </div>
            <button 
              onClick={() => setIsLiveActive(!isLiveActive)} 
              style={isLiveActive ? stopBtnStyle : startBtnStyle}
            >
              {isLiveActive ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
              <span>{isLiveActive ? 'Pause' : 'Reprendre'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Stats Monitor Bar */}
      {stats && (
        <div className="glass-panel" style={{ display: 'flex', gap: '16px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.75rem', color: 'var(--text-secondary)', overflowX: 'auto', flexWrap: 'wrap', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
          <div>📡 Requêtes Vinted : <strong>{stats.totalVintedRequests}</strong></div>
          <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '12px' }}>🛑 Erreurs 403 : <strong style={{ color: stats.total403Errors > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>{stats.total403Errors}</strong></div>
          <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '12px' }}>🎯 Cache Hits : <strong style={{ color: 'var(--success)' }}>{stats.cacheHits}</strong></div>
          <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '12px' }}>🔍 Cache Misses : <strong>{stats.cacheMisses}</strong></div>
        </div>
      )}

      {/* CSS animation for pulsing red indicator */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.4; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}} />

      {/* Keyword Search Input */}
      <form onSubmit={handleManualSearch} style={searchWrapperStyle}>
        <div style={{ position: 'relative', flex: 1 }}>
          <SearchIcon style={searchIconStyle} size={20} />
          <input
            type="text"
            placeholder="Rechercher sur Vinted (ex: One Piece, Naruto, Bleach...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
        </div>
        <button type="submit" className="btn-neon" disabled={isLoading} style={{ padding: '0 24px', minWidth: '130px' }}>
          {isLoading ? <RotateCw size={18} className="animate-spin" /> : 'Rechercher'}
        </button>
      </form>

      {/* Error Message Box */}
      {errorMessage && (
        <div className="glass-panel" style={errorPanelStyle}>
          <AlertCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#ffffff', display: 'block' }}>Avertissement API Vinted</strong>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Filter Options */}
      <div className="glass-panel" style={filterPanelStyle}>
        <div style={filterHeaderStyle}>
          <Filter size={16} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Filtres de Tri & Score</span>
        </div>
        <div style={filterFlexStyle}>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={filterMangaOnly} onChange={(e) => setFilterMangaOnly(e.target.checked)} style={checkboxStyle} />
            <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>📚 Manga/BD uniquement (Cat. Vinted BD·Manga·Romans graphiques)</span>
          </label>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={filterStrictTime} onChange={(e) => setFilterStrictTime(e.target.checked)} style={checkboxStyle} />
            <span style={{ color: '#ff55aa', fontWeight: 700 }}>☑️ Annonces récentes uniquement (&lt;90s)</span>
          </label>

          <div style={inputFilterWrapperStyle}>
            <span style={inputFilterLabelStyle}>Prix Max (€)</span>
            <input 
              type="number" 
              placeholder="Ex: 40" 
              value={maxPrice} 
              onChange={(e) => setMaxPrice(e.target.value)} 
              style={inputFilterStyle}
            />
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && listings.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <RotateCw size={32} className="animate-spin" style={{ color: 'var(--accent-gold)' }} />
        </div>
      )}

      {/* Sniped Deals Grid */}
      <div style={listingsGridStyle}>
        {processedListings.map((lst) => {
          const ageSec = Math.floor((Date.now() - lst.receivedAt) / 1000);
          
          return (
            <div key={lst.id} className="glass-panel" style={listingCardStyle}>
              {/* Header: Title and Published Info */}
              <div style={listingCardHeaderStyle}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={sourceLabelStyle}>Vinted</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={ageSec <= 15 ? liveBadgeStyle : timeLabelStyle}>
                    {ageSec <= 15 ? '⚡ NOUVELLE' : `Reçue il y a ${ageSec}s`}
                  </span>
                  <span style={timeLabelStyle}>• {lst.condition}</span>
                </div>
              </div>

              {/* Body Content */}
              <div style={listingCardBodyStyle}>
                {/* Cover Showcase */}
                <div style={{ width: '100px', height: '140px', flexShrink: 0, overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                  {lst.imageUrl ? (
                    <img 
                      src={lst.imageUrl} 
                      alt={lst.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <MangaCover 
                      title={lst.title} 
                      series="Manga" 
                      volumeRange="Inconnu" 
                      height={140} 
                    />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <h3 style={listingTitleStyle}>{lst.title}</h3>
                  <p style={listingDescStyle}>{lst.description}</p>
                  
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Prix Vinted : </span>
                    <strong style={{ fontSize: '1.3rem', color: '#ffffff' }}>{lst.price.toFixed(2)} €</strong>
                  </div>
                </div>
              </div>

              {/* Footer: link */}
              <div style={listingCardFooterStyle}>
                <div></div>
                <a 
                  href={lst.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn-neon" 
                  style={buyLinkStyle}
                >
                  <ShoppingCart size={14} />
                  <span>Voir sur Vinted</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          );
        })}

        {processedListings.length === 0 && (
          <div style={noResultsStyle}>
            <AlertCircle size={32} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Aucun deal trouvé</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Aucune annonce correspondante n'a été récupérée ou vos filtres de tri sont trop restrictifs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Styling definitions
const liveIndicatorWrapper: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '10px 16px',
  backgroundColor: 'var(--bg-secondary)',
};

const startBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: 'var(--success)',
  color: '#ffffff',
  fontSize: '0.8rem',
  fontWeight: 700,
  padding: '6px 12px',
  cursor: 'pointer',
};

const stopBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: 'var(--danger)',
  color: '#ffffff',
  fontSize: '0.8rem',
  fontWeight: 700,
  padding: '6px 12px',
  cursor: 'pointer',
};

const searchWrapperStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginBottom: '20px',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px 14px 44px',
  borderRadius: '8px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-medium)',
  color: '#ffffff',
  fontSize: '0.95rem',
  outline: 'none',
};

const searchIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: 14,
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--text-secondary)',
  pointerEvents: 'none',
};

const errorPanelStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  padding: '12px 16px',
  backgroundColor: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  borderRadius: '8px',
  marginBottom: '20px',
};

const filterPanelStyle: React.CSSProperties = {
  padding: '16px',
  marginBottom: '24px',
};

const filterHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: 'var(--accent-gold)',
  borderBottom: '1px solid var(--border-light)',
  paddingBottom: '8px',
  marginBottom: '12px',
};

const filterFlexStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '20px',
  alignItems: 'center',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.85rem',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
};

const checkboxStyle: React.CSSProperties = {
  cursor: 'pointer',
  accentColor: 'var(--accent-gold)',
};

const inputFilterWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const inputFilterLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
};

const inputFilterStyle: React.CSSProperties = {
  width: '80px',
  padding: '6px 10px',
  borderRadius: '6px',
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-medium)',
  color: '#ffffff',
  fontSize: '0.8rem',
  outline: 'none',
};

const listingsGridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const listingCardStyle: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  position: 'relative',
  borderLeft: '1px solid var(--border-light)',
  boxShadow: 'var(--glass-shadow)',
  transition: 'all 0.3s ease-in-out'
};

const listingCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const sourceLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  color: 'var(--accent-gold)',
  backgroundColor: 'rgba(255, 170, 0, 0.08)',
  padding: '2px 8px',
  borderRadius: '4px',
  textTransform: 'uppercase',
};

const timeLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
};

const liveBadgeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 800,
  color: 'var(--accent-gold)',
  backgroundColor: 'rgba(255, 170, 0, 0.1)',
  padding: '2px 8px',
  borderRadius: '4px',
  boxShadow: '0 0 8px rgba(255, 170, 0, 0.2)',
  animation: 'pulse 1.5s infinite'
};

const listingCardBodyStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
};

const listingTitleStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  color: '#ffffff',
};

const listingDescStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.4,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const pricingLabelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '2px',
};

const listingCardFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderTop: '1px solid var(--border-light)',
  paddingTop: '12px',
};

const buyLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  textDecoration: 'none',
  padding: '8px 14px',
  fontSize: '0.85rem',
};

const noResultsStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '60px 20px',
  background: 'var(--bg-secondary)',
  borderRadius: '12px',
  border: '1px dashed var(--border-medium)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};
