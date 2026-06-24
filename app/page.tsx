'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import MangaCover from '../components/MangaCover';
import InfoTooltip from '../components/InfoTooltip';
import Link from 'next/link';
import { Search as SearchIcon, Filter, Heart, ArrowUpDown, Tag, Star, Award, Zap } from 'lucide-react';
import { Manga } from '../lib/defaultData';

export default function HomePage() {
  const {
    filteredMangas,
    mangas,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    toggleFavorite,
    allSeries,
    allTags
  } = useData();

  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Suggestions while typing
  const suggestions = searchQuery.trim()
    ? mangas
        .filter(m => m.nom_arc_collection.toLowerCase().includes(searchQuery.toLowerCase()) || m.titre.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 5)
    : [];

  // Hide suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick helper calculations
  const calculateROI = (maxBuy: number, minSell: number) => {
    if (maxBuy <= 0) return 0;
    return ((minSell - maxBuy) / maxBuy) * 100;
  };

  const getROIClass = (roi: number) => {
    if (roi >= 80) return 'excellent';
    if (roi >= 40) return 'good';
    return 'avoid';
  };

  const getVerdictEmoji = (roi: number) => {
    if (roi >= 80) return '⭐ Excellent';
    if (roi >= 40) return '👍 Bon';
    return '❌ Eviter';
  };

  const formatVolumeRange = (debut: number, fin: number) => {
    if (debut === fin) return `Tome ${debut}`;
    if (fin >= 999) return `Tome ${debut} et +`;
    return `Tomes ${debut} à ${fin}`;
  };

  return (
    <div>
      {/* Hero section */}
      <section style={heroSectionStyle}>
        <div style={heroHeaderBadge}>
          <Zap size={14} style={{ color: 'var(--accent-neon)' }} />
          <span>Vinted Flipping Tool</span>
        </div>
        <h1 style={heroTitleStyle}>
          Manga Revente <span style={{ color: 'var(--accent-neon)', textShadow: '0 0 20px var(--accent-neon-glow)' }}>Vinted</span>
        </h1>
        <p style={heroSubStyle}>
          Recherchez un lot de mangas, analysez les prix et maximisez vos marges d&apos;achat-revente en un clic.
        </p>
      </section>

      {/* Search and Autocomplete System */}
      <div style={searchWrapperStyle} ref={suggestionRef}>
        <div style={{ position: 'relative', flex: 1 }}>
          <SearchIcon style={searchIconStyle} size={20} />
          <input
            type="text"
            placeholder="Rechercher un manga (ex: One Piece, Naruto...)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              setIsFocused(true);
              setShowSuggestions(true);
            }}
            onBlur={() => setIsFocused(false)}
            style={isFocused ? { ...searchInputStyle, borderColor: 'var(--accent-neon)', boxShadow: '0 0 15px rgba(255, 62, 62, 0.15)' } : searchInputStyle}
          />
          
          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={suggestionsBoxStyle}>
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  style={suggestionItemStyle}
                  onClick={() => {
                    setSearchQuery(s.nom_arc_collection);
                    setShowSuggestions(false);
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.nom_arc_collection}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Achat max: {s.prix_achat_max.toFixed(2)}€/tome • Revente: {s.prix_vente_min.toFixed(2)}-{s.prix_vente_max.toFixed(2)}€/tome
                    </span>
                  </div>
                  <div className={`badge-roi ${getROIClass(calculateROI(s.prix_achat_max, s.prix_vente_min))}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                    ROI: +{calculateROI(s.prix_achat_max, s.prix_vente_min).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filter Section */}
      <div className="glass-panel" style={filterPanelStyle}>
        <div style={filterHeaderStyle}>
          <Filter size={18} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Filtres de recherche</span>
        </div>
        
        <div style={filterGridStyle}>
          {/* Filter Series */}
          <div style={filterItemStyle}>
            <label style={labelStyle}>Série / Manga</label>
            <select
              value={filters.series}
              onChange={(e) => setFilters(prev => ({ ...prev, series: e.target.value }))}
              style={selectStyle}
            >
              <option value="Toutes">Toutes les séries</option>
              {allSeries.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Filter Condition */}
          <div style={filterItemStyle}>
            <label style={labelStyle}>État recommandé</label>
            <select
              value={filters.condition}
              onChange={(e) => setFilters(prev => ({ ...prev, condition: e.target.value }))}
              style={selectStyle}
            >
              <option value="Tous">Tous les états</option>
              <option value="TBE">TBE (Très Bon État)</option>
              <option value="BE">BE (Bon État)</option>
              <option value="Correct">Correct</option>
            </select>
          </div>

          {/* Filter Tag */}
          <div style={filterItemStyle}>
            <label style={labelStyle}>Tags personnalisés</label>
            <select
              value={filters.tag}
              onChange={(e) => setFilters(prev => ({ ...prev, tag: e.target.value }))}
              style={selectStyle}
            >
              <option value="Tous">Tous les tags</option>
              {allTags.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div style={filterItemStyle}>
            <label style={labelStyle}>Trier par</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
              style={selectStyle}
            >
              <option value="popularity">Popularité / Hype</option>
              <option value="roi">Rentabilité (ROI)</option>
              <option value="margin">Marge potentielle (€)</option>
              <option value="retailPrice">Prix neuf moyen</option>
              <option value="title">Nom A-Z</option>
            </select>
          </div>

          {/* Sort Order */}
          <div style={filterItemStyle}>
            <label style={labelStyle}>Ordre</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                style={sortOrderButtonStyle}
              >
                <ArrowUpDown size={16} />
                <span>{filters.sortOrder === 'asc' ? 'Croissant' : 'Décroissant'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Results */}
      <div style={gridStyle}>
        {filteredMangas.map((manga) => {
          const roi = calculateROI(manga.prix_achat_max, manga.prix_vente_min);
          const roiClass = getROIClass(roi);
          
          return (
            <div key={manga.id} className="glass-panel" style={cardStyle}>
              {/* Cover visual */}
              <Link href={`/manga/${manga.id}`} style={{ textDecoration: 'none' }}>
                <MangaCover title={manga.nom_arc_collection} series={manga.titre} volumeRange={formatVolumeRange(manga.volume_debut, manga.volume_fin)} />
              </Link>
              
              {/* Card info */}
              <div style={cardBodyStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={seriesBadgeStyle}>{manga.titre}</span>
                  <button
                    onClick={() => toggleFavorite(manga.id)}
                    style={favoriteButtonStyle}
                  >
                    <Heart size={16} fill={manga.isFavorite ? 'var(--accent-neon)' : 'none'} stroke={manga.isFavorite ? 'var(--accent-neon)' : 'var(--text-secondary)'} />
                  </button>
                </div>
                
                <Link href={`/manga/${manga.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h3 style={cardTitleStyle}>{manga.nom_arc_collection}</h3>
                </Link>
                
                {/* Stats */}
                <div style={statsWrapperStyle}>
                  <div style={statItemStyle}>
                    <span style={statLabelStyle}>Achat Max <InfoTooltip term="maxbuy" /></span>
                    <span style={statValueStyle}>{manga.prix_achat_max.toFixed(2)} € <span style={{ fontSize: '0.65rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/u</span></span>
                  </div>
                  <div style={statItemStyle}>
                    <span style={statLabelStyle}>Revente Estimée <InfoTooltip term="margin" /></span>
                    <span style={statValueStyle}>{manga.prix_vente_min.toFixed(2)}-{manga.prix_vente_max.toFixed(2)} € <span style={{ fontSize: '0.65rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/u</span></span>
                  </div>
                </div>
                
                {/* Verdict tags */}
                <div style={badgeContainerStyle}>
                  <span className={`badge-roi ${roiClass}`}>
                    ROI: +{roi.toFixed(0)}%
                  </span>
                  
                  <span style={popularityBadgeStyle(manga.popularity)}>
                    🔥 Hype: {manga.hypeScore}/100
                  </span>
                </div>
                
                <div style={cardFooterStyle}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Award size={14} />
                    <span>{getVerdictEmoji(roi)}</span>
                  </span>
                  
                  <Link href={`/manga/${manga.id}`} className="btn-neon" style={{ padding: '6px 12px', fontSize: '0.8rem', textTransform: 'none' }}>
                    Analyser
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
        
        {filteredMangas.length === 0 && (
          <div style={noResultsStyle}>
            <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Aucun manga trouvé</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Essayez de modifier votre recherche ou réinitialisez la base de données.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Inline styles for search & layouts
const heroSectionStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '40px 0 24px',
};

const heroHeaderBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: 'rgba(255, 62, 62, 0.08)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-accent)',
  padding: '5px 12px',
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: '16px',
};

const heroTitleStyle: React.CSSProperties = {
  fontSize: '3rem',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  marginBottom: '10px',
  letterSpacing: '-0.03em',
};

const heroSubStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  color: 'var(--text-secondary)',
  maxWidth: '600px',
  margin: '0 auto',
  lineHeight: 1.5,
};

const searchWrapperStyle: React.CSSProperties = {
  maxWidth: '650px',
  margin: '24px auto 32px',
  display: 'flex',
  gap: '12px',
  position: 'relative',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '16px 20px 16px 48px',
  fontSize: '1rem',
  borderRadius: '12px',
  border: '2px solid var(--border-medium)',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-primary)',
  transition: 'all var(--transition-fast)',
};

const searchIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: 16,
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--text-secondary)',
  pointerEvents: 'none',
};

const suggestionsBoxStyle: React.CSSProperties = {
  position: 'absolute',
  top: '105%',
  left: 0,
  right: 0,
  backgroundColor: 'var(--bg-tertiary)',
  border: '1px solid var(--border-medium)',
  borderRadius: '12px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  zIndex: 50,
  overflow: 'hidden',
};

const suggestionItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border-light)',
  cursor: 'pointer',
  transition: 'background var(--transition-fast)',
};

const filterPanelStyle: React.CSSProperties = {
  padding: '20px',
  marginBottom: '32px',
};

const filterHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  borderBottom: '1px solid var(--border-light)',
  paddingBottom: '12px',
  marginBottom: '16px',
  color: 'var(--accent-neon)',
};

const filterGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '16px',
};

const filterItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};

const selectStyle: React.CSSProperties = {
  padding: '10px',
  borderRadius: '8px',
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-medium)',
  color: 'var(--text-primary)',
  outline: 'none',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontFamily: 'var(--font-primary)',
  transition: 'border var(--transition-fast)',
};

const sortOrderButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  flex: 1,
  padding: '10px',
  borderRadius: '8px',
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-medium)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  transition: 'all var(--transition-fast)',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '24px',
};

const cardStyle: React.CSSProperties = {
  padding: '14px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

const cardBodyStyle: React.CSSProperties = {
  marginTop: '12px',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
};

const seriesBadgeStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.06)',
  color: 'var(--text-secondary)',
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '4px',
  textTransform: 'uppercase',
};

const favoriteButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  transition: 'transform var(--transition-fast)',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  lineHeight: 1.3,
  marginBottom: '12px',
  fontFamily: 'var(--font-display)',
};

const statsWrapperStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  backgroundColor: 'var(--bg-primary)',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid var(--border-light)',
  marginBottom: '12px',
};

const statItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
};

const statValueStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#ffffff',
  marginTop: '2px',
};

const badgeContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '14px',
  flexWrap: 'wrap',
};

const popularityBadgeStyle = (pop: string): React.CSSProperties => {
  return {
    fontSize: '0.75rem',
    fontWeight: 600,
    backgroundColor: 'rgba(255, 170, 0, 0.1)',
    color: 'var(--accent-gold)',
    border: '1px solid rgba(255, 170, 0, 0.25)',
    padding: '4px 10px',
    borderRadius: '9999px',
  };
};

const cardFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderTop: '1px solid var(--border-light)',
  paddingTop: '12px',
  marginTop: 'auto',
};

const noResultsStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  textAlign: 'center',
  padding: '60px 20px',
  background: 'var(--bg-secondary)',
  borderRadius: '12px',
  border: '1px dashed var(--border-medium)',
};
