'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { calculateLotPricing, parseVolumeRange } from '../../lib/dbAdapter';
import { analyzeListingAI, AIAnalysisResult } from '../../lib/vintedAi';
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
  ai?: AIAnalysisResult & { isExternalAI?: boolean };
}

export default function CoppingPage() {
  const { mangas } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<VintedListing[]>([]);
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverIp, setServerIp] = useState('Vérification...');
  const [stats, setStats] = useState<{
    totalVintedRequests: number;
    total403Errors: number;
    total429Errors: number;
    cacheHits: number;
    cacheMisses: number;
    openAiCalls: number;
    estimatedOpenAiCost: number;
    cooldownActive: boolean;
  } | null>(null);
  
  // Real-Time & AI Filters
  const [filterMangaOnly, setFilterMangaOnly] = useState(true); // Default to true as requested
  const [filterStrictTime, setFilterStrictTime] = useState(false);
  const [filterRentable, setFilterRentable] = useState(false);
  const [filterHighROI, setFilterHighROI] = useState(false);
  const [filterHotDeal, setFilterHotDeal] = useState(false);
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minScore, setMinScore] = useState<string>('');

  const listingsRef = useRef<VintedListing[]>([]);

  // Initial load
  useEffect(() => {
    if (mangas.length > 0 && searchQuery === '') {
      const defaultManga = mangas[0].titre;
      setSearchQuery(defaultManga);
      fetchVintedListings(defaultManga);
    }
  }, [mangas]);

  // Continuous Auto-Refresh: fetch Vinted every 1 second
  // Append cache-buster timestamp `&t=${Date.now()}` to bypass browser/network caching
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isLiveActive && searchQuery) {
      intervalId = setInterval(() => {
        fetchVintedListings(searchQuery, true);
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLiveActive, searchQuery, filterMangaOnly]);

  const fetchVintedListings = async (query: string, isSilent = false) => {
    if (!query.trim()) return;
    if (!isSilent && listings.length === 0) setIsLoading(true);

    try {
      const catalogQuery = filterMangaOnly ? '&catalog_ids=1058' : '';
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
      
      if (data.items && data.items.length > 0) {
        const now = Date.now();
        setListings(prev => {
          const incoming: VintedListing[] = data.items.map((item: any) => {
            const existing = prev.find(p => p.id === item.id);
            return {
              ...item,
              receivedAt: existing ? existing.receivedAt : now
            };
          });

          // Filter duplicates
          const uniqueNew = incoming.filter(inc => !prev.some(p => p.id === inc.id));
          if (uniqueNew.length === 0) return prev;

          const merged = [...uniqueNew, ...prev];
          
          // Sort strictly newest items first
          merged.sort((a, b) => b.receivedAt - a.receivedAt);
          
          const sliced = merged.slice(0, 60);
          listingsRef.current = sliced;
          return sliced;
        });
      }
    } catch (err: any) {
      console.error("Sniper poll error:", err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setListings([]);
    fetchVintedListings(searchQuery);
  };

  // Fuzzy match query to find database entry
  const findMatchingManga = (vintedTitle: string) => {
    if (mangas.length === 0) return null;

    const cleanString = (str: string) => {
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\b(tomes?|vols?|volumes?|lot|collection|complet|vf|mangas?|de|a|et|du)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const cleanedVinted = cleanString(vintedTitle);
    const uniqueTitles = Array.from(new Set(mangas.map(m => m.titre)));
    
    let bestSeries: string | null = null;
    let highestScore = 0;

    for (const title of uniqueTitles) {
      const cleanedDb = cleanString(title);
      if (!cleanedDb) continue;

      let score = 0;
      if (cleanedVinted.includes(cleanedDb) || cleanedDb.includes(cleanedVinted)) {
        score = Math.min(cleanedDb.length, cleanedVinted.length) / Math.max(cleanedDb.length, cleanedVinted.length);
        if (cleanedVinted.startsWith(cleanedDb)) score += 0.2;
      }
      
      if (title.toLowerCase() === 'one piece' && (cleanedVinted.split(' ').includes('op') || cleanedVinted.split(' ').includes('onepiece'))) {
        score = 0.95;
      }
      
      if (score > highestScore && score > 0.15) {
        highestScore = score;
        bestSeries = title;
      }
    }

    if (!bestSeries) return null;

    const segment = mangas.find(m => m.titre === bestSeries) || mangas[0];
    return {
      series: bestSeries,
      originalManga: segment
    };
  };

  // AI-Driven analysis and ROI scoring
  const analyzeListing = (listing: VintedListing) => {
    // 1. Trigger AI Classification
    const ai = listing.ai || analyzeListingAI(listing.title, listing.description, listing.price, searchQuery);
    
    const match = findMatchingManga(listing.title);
    if (!match || !ai.isManga) {
      return {
        ai,
        matched: false,
        roi: 0,
        margin: 0,
        score: 50,
        badgeLabel: '🔍 INCONNU',
        badgeClass: 'avoid',
        maxBuy: 0,
        series: '',
        ageSec: Math.floor((Date.now() - listing.receivedAt) / 1000)
      };
    }

    const { series, originalManga } = match;
    const { startVolume, endVolume, totalVolumes, type } = ai;
    const isUnitSale = type === 'unité';

    // 2. Pricing and ROI calculations based on AI findings
    let maxBuy = 0;
    let minSell = 0;

    if (type === 'unité') {
      maxBuy = originalManga.prix_achat_max;
      minSell = originalManga.prix_vente_min;
    } else {
      const lotPricing = calculateLotPricing(series, startVolume, endVolume, mangas, originalManga);
      maxBuy = lotPricing.prix_achat_max;
      minSell = lotPricing.prix_vente_min;
    }

    const margin = minSell - listing.price;
    const roi = listing.price > 0 ? (margin / listing.price) * 100 : 0;

    // 3. Score Calculation
    let score = 50;
    if (listing.price <= maxBuy * 0.6) {
      score = Math.floor(90 + (1 - listing.price / (maxBuy * 0.6)) * 10);
    } else if (listing.price <= maxBuy) {
      score = Math.floor(70 + (1 - (listing.price - maxBuy * 0.6) / (maxBuy * 0.4)) * 20);
    } else if (listing.price <= maxBuy * 1.3) {
      score = Math.floor(40 + (1 - (listing.price - maxBuy) / (maxBuy * 0.3)) * 30);
    } else {
      score = Math.floor(Math.max(0, 40 - ((listing.price - maxBuy * 1.3) / maxBuy) * 30));
    }
    score = Math.min(100, Math.max(0, score));

    // 4. Hot Deal classification
    // Validation rules: Never mark as hot deal if low confidence, not a manga, unit sale confusion, or incoherencies
    const isSuspicious = type === 'unité' || totalVolumes <= 0 || listing.price <= 1.5 || ai.confidence < 70 || ai.coherenceScore < 60;
    
    let badgeLabel = '❌ MAUVAIS DEAL';
    let badgeClass = 'avoid';

    if (listing.price <= maxBuy * 0.75 && roi >= 40 && !isSuspicious) {
      badgeLabel = '🔥 HOT DEAL';
      badgeClass = 'excellent';
    } else if (listing.price <= maxBuy || roi >= 30) {
      badgeLabel = '📈 BON DEAL';
      badgeClass = 'good';
    } else if (roi > 0) {
      badgeLabel = '⚠️ MOYEN';
      badgeClass = 'good';
    }

    const ageSec = Math.floor((Date.now() - listing.receivedAt) / 1000);

    return {
      ai,
      matched: true,
      roi,
      margin,
      score,
      badgeLabel,
      badgeClass,
      maxBuy,
      series,
      ageSec
    };
  };

  const processedListings = listings
    .map(lst => {
      const analysis = analyzeListing(lst);
      return { ...lst, analysis };
    })
    .filter(lst => {
      // 1. AI filters
      if (filterMangaOnly && !lst.analysis.ai.isManga) return false;
      if (filterStrictTime && lst.analysis.ageSec > 40) return false; // Strict recent means received in past 40 seconds
      
      // 2. UI filters
      if (filterRentable && lst.analysis.margin <= 0) return false;
      if (filterHighROI && lst.analysis.roi < 50) return false;
      if (filterHotDeal && lst.analysis.badgeLabel !== '🔥 HOT DEAL') return false;
      
      if (maxPrice && lst.price > parseFloat(maxPrice)) return false;
      if (minScore && lst.analysis.score < parseInt(minScore)) return false;
      
      return true;
    })
    .sort((a, b) => b.receivedAt - a.receivedAt);

  return (
    <div>
      {/* Title & Live Status Indicator */}
      <section style={{ padding: '20px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Sniper de Deals <span style={{ color: 'var(--accent-gold)' }}>Copping</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Moteur de recherche temps réel enrichi par une **IA d'analyse d'annonces** (lots vs unité, détection manga, classification volumes).
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
                {isLiveActive ? 'LIVE : ACTIF' : 'LIVE : PAUSE'}
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
          <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '12px' }}>⚠️ OpenAI 429 : <strong style={{ color: stats.total429Errors > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>{stats.total429Errors}</strong></div>
          <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '12px' }}>🎯 Cache Hits : <strong style={{ color: 'var(--success)' }}>{stats.cacheHits}</strong></div>
          <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '12px' }}>🔍 Cache Misses : <strong>{stats.cacheMisses}</strong></div>
          <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '12px' }}>🤖 OpenAI Calls : <strong>{stats.openAiCalls}</strong></div>
          <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '12px' }}>💵 Coût Estimé OpenAI : <strong style={{ color: 'var(--accent-gold)' }}>${stats.estimatedOpenAiCost.toFixed(5)}</strong></div>
          {stats.cooldownActive && (
            <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '12px', color: 'var(--danger)', fontWeight: 700, animation: 'pulse 1s infinite' }}>⚠️ REPOS ANTI-BLOCAGE (60s)</div>
          )}
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
            <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>☑️ Manga uniquement</span>
          </label>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={filterStrictTime} onChange={(e) => setFilterStrictTime(e.target.checked)} style={checkboxStyle} />
            <span style={{ color: '#ff55aa', fontWeight: 700 }}>☑️ Annonces récentes uniquement</span>
          </label>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={filterRentable} onChange={(e) => setFilterRentable(e.target.checked)} style={checkboxStyle} />
            <span>Rentables uniquement</span>
          </label>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={filterHighROI} onChange={(e) => setFilterHighROI(e.target.checked)} style={checkboxStyle} />
            <span>ROI Élevé (&gt;50%)</span>
          </label>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={filterHotDeal} onChange={(e) => setFilterHotDeal(e.target.checked)} style={checkboxStyle} />
            <span>🔥 HOT DEALS</span>
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

          <div style={inputFilterWrapperStyle}>
            <span style={inputFilterLabelStyle}>Score Min (0-100)</span>
            <input 
              type="number" 
              placeholder="Ex: 70" 
              value={minScore} 
              onChange={(e) => setMinScore(e.target.value)} 
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
          const { ai, roi, margin, score, badgeLabel, badgeClass, maxBuy, matched, series, ageSec } = lst.analysis;
          
          return (
            <div key={lst.id} className="glass-panel" style={listingCardStyle(badgeClass === 'excellent' && matched)}>
              {/* Header: Title and Published Info */}
              <div style={listingCardHeaderStyle}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={matched ? sourceLabelStyle : unMatchedLabelStyle}>
                    {matched ? `Vinted • ${series}` : 'Vinted • Manga non reconnu'}
                  </span>
                  
                  {/* AI Categorization Badges */}
                  <span style={ai.isManga ? aiMangaBadgeStyle : aiNonMangaBadgeStyle}>
                    {ai.isManga ? `🤖 IA (${ai.isExternalAI ? 'OpenAI' : 'Local'}): MANGA` : `🤖 IA (${ai.isExternalAI ? 'OpenAI' : 'Local'}): NON MANGA`}
                  </span>
                  
                  <span style={ai.type === 'unité' ? aiUnitBadgeStyle : aiLotBadgeStyle}>
                    {ai.type === 'unité' ? 'TOME UNIQUEMENT' : `LOT (${ai.totalVolumes} tomes)`}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={ageSec <= 5 ? liveBadgeStyle : timeLabelStyle}>
                    {ageSec <= 5 ? '⚡ À L\'INSTANT' : `Reçu il y a ${ageSec}s`}
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
                      series={matched ? series : 'Manga'} 
                      volumeRange={matched ? `Tomes ${ai.startVolume}-${ai.endVolume}` : 'Inconnu'} 
                      height={140} 
                    />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <h3 style={listingTitleStyle}>{lst.title}</h3>
                  <p style={listingDescStyle}>{lst.description}</p>
                  
                  {/* AI Diagnosis Log Enclosure */}
                  <div style={aiDiagnosisPanelStyle}>
                    <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>VERDICT IA :</span> {ai.aiVerdict}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '12px' }}>
                      (Confiance: {ai.confidence}%, Cohérence: {ai.coherenceScore}%)
                    </span>
                  </div>

                  {/* Deal calculations & comparison */}
                  {matched && ai.isManga ? (
                    <div style={pricingGridStyle}>
                      <div>
                        <span style={pricingLabelStyle}>{ai.type === 'unité' ? 'Prix Unitaire Vinted :' : 'Prix du Lot :'}:</span>
                        <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{lst.price.toFixed(2)} €</strong>
                      </div>
                      <div>
                        <span style={pricingLabelStyle}>{ai.type === 'unité' ? 'Achat Max Unitaire :' : `Max Buy pour ${ai.totalVolumes} tomes :`}</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{maxBuy.toFixed(2)} €</span>
                      </div>
                      <div>
                        <span style={pricingLabelStyle}>Marge brute :</span>
                        <strong style={{ fontSize: '1.2rem', color: margin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {margin >= 0 ? '+' : ''}{margin.toFixed(2)} €
                        </strong>
                      </div>
                      <div>
                        <span style={pricingLabelStyle}>ROI estimé :</span>
                        <strong style={{ fontSize: '1.2rem', color: roi >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {roi >= 0 ? '+' : ''}{roi.toFixed(0)} %
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div style={noMatchPricingStyle}>
                      <span style={{ color: 'var(--text-secondary)' }}>Prix Annoncé : </span>
                      <strong style={{ fontSize: '1.2rem', color: '#ffffff' }}>{lst.price.toFixed(2)} €</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '12px' }}>
                        {!ai.isManga ? "(Exclu car détecté comme hors-manga)" : "(Associez ce manga dans votre Tracker pour calculer le ROI)"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer: Verdict scoring and link */}
              <div style={listingCardFooterStyle}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`badge-roi ${matched && ai.isManga ? badgeClass : 'avoid'}`} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                    {badgeLabel}
                  </span>
                  
                  {/* Score Indicator */}
                  {matched && ai.isManga && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700 }}>SCORE DEAL</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--accent-gold)' : 'var(--danger)' }}>
                        {score}/100
                      </div>
                    </div>
                  )}
                </div>

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

const listingCardStyle = (isHot: boolean): React.CSSProperties => ({
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  position: 'relative',
  borderLeft: isHot ? '4px solid var(--accent-gold)' : '1px solid var(--border-light)',
  boxShadow: isHot ? 'inset 0 0 15px rgba(255, 170, 0, 0.05)' : 'var(--glass-shadow)',
  transition: 'all 0.3s ease-in-out'
});

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

const unMatchedLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  padding: '2px 8px',
  borderRadius: '4px',
  textTransform: 'uppercase',
};

const aiMangaBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 800,
  color: 'var(--success)',
  backgroundColor: 'rgba(46, 204, 113, 0.1)',
  padding: '2px 8px',
  borderRadius: '4px',
};

const aiNonMangaBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 800,
  color: 'var(--danger)',
  backgroundColor: 'rgba(231, 76, 60, 0.1)',
  padding: '2px 8px',
  borderRadius: '4px',
};

const aiUnitBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 800,
  color: '#ff88dd',
  backgroundColor: 'rgba(255, 136, 221, 0.1)',
  padding: '2px 8px',
  borderRadius: '4px',
};

const aiLotBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 800,
  color: '#88ddff',
  backgroundColor: 'rgba(136, 221, 255, 0.1)',
  padding: '2px 8px',
  borderRadius: '4px',
};

const aiDiagnosisPanelStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 170, 0, 0.03)',
  border: '1px solid rgba(255, 170, 0, 0.15)',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.4,
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
  animation: 'pulse 1s infinite'
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

const pricingGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: '12px',
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-light)',
  borderRadius: '8px',
  padding: '10px',
  marginTop: '4px',
};

const noMatchPricingStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px dashed var(--border-medium)',
  borderRadius: '8px',
  padding: '12px',
  marginTop: '4px',
  display: 'flex',
  alignItems: 'center',
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
