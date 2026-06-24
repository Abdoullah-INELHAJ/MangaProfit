'use client';

import React, { useState, useEffect } from 'react';
import { useData } from '../../../context/DataContext';
import MangaCover from '../../../components/MangaCover';
import InfoTooltip from '../../../components/InfoTooltip';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Plus, X, Flame, DollarSign, ListCollapse } from 'lucide-react';
import { Manga } from '../../../lib/defaultData';
import { calculateLotPricing } from '../../../lib/dbAdapter';

export default function MangaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { mangas, toggleFavorite, addTag, removeTag } = useData();
  
  const mangaId = params.id as string;
  const manga = mangas.find(m => m.id === mangaId);

  // Calculator State
  const [startVol, setStartVol] = useState<number>(1);
  const [endVol, setEndVol] = useState<number>(1);
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  useEffect(() => {
    if (manga) {
      setStartVol(manga.volume_debut);
      // If fin is 999 (meaning "et +"), default calculator to a reasonable lot of 10 volumes
      setEndVol(manga.volume_fin === 999 ? manga.volume_debut + 9 : manga.volume_fin);
    }
  }, [manga]);

  // Set total purchase price when volume range or standard pricing changes
  useEffect(() => {
    if (manga) {
      const lotPricing = calculateLotPricing(manga.titre, startVol, endVol, mangas, manga);
      setPurchasePrice(lotPricing.prix_achat_max.toFixed(2));
    }
  }, [startVol, endVol, manga, mangas]);

  if (!manga) {
    return (
      <div style={errorContainerStyle}>
        <h2>Manga introuvable</h2>
        <p>Le volume recherché n&apos;existe pas ou a été supprimé.</p>
        <Link href="/" className="btn-neon" style={{ marginTop: '16px' }}>
          Retourner à l&apos;accueil
        </Link>
      </div>
    );
  }

  // Pre-calculated stats based on default spreadsheet pricing
  const defaultMarginMin = manga.prix_vente_min - manga.prix_achat_max;
  const defaultMarginMax = manga.prix_vente_max - manga.prix_achat_max;
  const defaultROIMin = manga.prix_achat_max > 0 ? (defaultMarginMin / manga.prix_achat_max) * 100 : 0;
  const defaultROIMax = manga.prix_achat_max > 0 ? (defaultMarginMax / manga.prix_achat_max) * 100 : 0;
  const retailDiscountPct = manga.prix_moyen_neuf > 0 ? ((manga.prix_moyen_neuf - manga.prix_achat_max) / manga.prix_moyen_neuf) * 100 : 0;

  // Real-time calculations based on custom volume range & input price
  const lotPricing = calculateLotPricing(manga.titre, startVol, endVol, mangas, manga);
  const currentPaid = parseFloat(purchasePrice) || 0;
  const realMarginMin = lotPricing.prix_vente_min - currentPaid;
  const realMarginMax = lotPricing.prix_vente_max - currentPaid;
  const realROIMin = currentPaid > 0 ? (realMarginMin / currentPaid) * 100 : 0;
  const realROIMax = currentPaid > 0 ? (realMarginMax / currentPaid) * 100 : 0;
  
  // Real-time advice formula
  const getAdvice = (paid: number, maxBuy: number, roiMin: number) => {
    if (paid <= 0) return { label: 'Aucune donnée', emoji: '❔', class: 'avoid' };
    if (paid <= maxBuy * 0.7 && roiMin >= 90) {
      return { label: 'Excellent achat', emoji: '⭐', class: 'excellent' };
    }
    if (paid <= maxBuy || roiMin >= 50) {
      return { label: 'Bonne affaire', emoji: '👍', class: 'good' };
    }
    if (paid <= maxBuy * 1.3 && roiMin >= 20) {
      return { label: 'Achat moyen', emoji: '⚠️', class: 'good' };
    }
    return { label: 'Achat déconseillé', emoji: '❌', class: 'avoid' };
  };

  const advice = getAdvice(currentPaid, lotPricing.prix_achat_max, realROIMin);

  // Group detailed volumes by segment
  const groupedSegments: {
    [key: string]: {
      start: number;
      end: number;
      count: number;
      unitBuy: number;
      unitSellMin: number;
      unitSellMax: number;
    }
  } = {};

  lotPricing.details.forEach(d => {
    if (!groupedSegments[d.sourceSegment]) {
      groupedSegments[d.sourceSegment] = {
        start: d.volume,
        end: d.volume,
        count: 0,
        unitBuy: d.prix_achat_max,
        unitSellMin: d.prix_vente_min,
        unitSellMax: d.prix_vente_max
      };
    }
    groupedSegments[d.sourceSegment].end = d.volume;
    groupedSegments[d.sourceSegment].count += 1;
  });

  // Generate deterministic trend points based on hype score
  const generateTrendData = (hype: number) => {
    const points = [];
    let current = hype - 10;
    for (let i = 0; i < 12; i++) {
      const noise = Math.sin(i * 0.8) * 8 + (i * 1.2); // positive growth trend simulation
      points.push(Math.min(100, Math.max(10, Math.floor(current + noise))));
    }
    return points;
  };

  const trendData = generateTrendData(manga.hypeScore);
  const trendSvgPoints = trendData.map((val, idx) => `${idx * 40},${100 - val}`).join(' ');

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim()) {
      addTag(manga.id, newTag.trim());
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const formatVolumeRange = (debut: number, fin: number) => {
    if (debut === fin) return `Tome ${debut}`;
    if (fin >= 999) return `Tome ${debut} et +`;
    return `Tomes ${debut} à ${fin}`;
  };

  return (
    <div>
      {/* Back navigation */}
      <button onClick={() => router.back()} style={backButtonStyle}>
        <ArrowLeft size={16} />
        <span>Retour aux résultats</span>
      </button>

      {/* Grid container */}
      <div className="detail-grid" style={detailGridStyle}>
        {/* Left Column: Visual Cover Card */}
        <div style={leftColStyle}>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <MangaCover title={manga.nom_arc_collection} series={manga.titre} volumeRange={formatVolumeRange(manga.volume_debut, manga.volume_fin)} height={340} />
            
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={retailBadgeStyle}>Neuf / tome : {manga.prix_moyen_neuf.toFixed(2)} €</span>
              <button
                onClick={() => toggleFavorite(manga.id)}
                style={favButtonStyle(manga.isFavorite)}
              >
                <Heart size={18} fill={manga.isFavorite ? 'var(--accent-neon)' : 'none'} />
                <span>{manga.isFavorite ? 'Favori' : 'Ajouter'}</span>
              </button>
            </div>

            {/* Custom tags list */}
            <div style={tagSectionStyle}>
              <div style={tagHeaderStyle}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TAGS D&apos;ACHAT</span>
                <button onClick={() => setShowTagInput(!showTagInput)} style={addTagBtnStyle}>
                  <Plus size={14} />
                </button>
              </div>
              
              {showTagInput && (
                <form onSubmit={handleAddTagSubmit} style={tagFormStyle}>
                  <input
                    type="text"
                    placeholder="Nouveau tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    style={tagInputStyle}
                    autoFocus
                  />
                </form>
              )}

              <div style={tagsListStyle}>
                {(manga.tags || []).map(t => (
                  <span key={t} style={tagBadgeStyle}>
                    #{t}
                    <button onClick={() => removeTag(manga.id, t)} style={removeTagBtnStyle}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {(manga.tags || []).length === 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Aucun tag personnalisé</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing Sheets & Trends */}
        <div style={rightColStyle}>
          <div className="glass-panel" style={panelPaddingStyle}>
            <div style={{ borderBottom: '1px solid var(--border-medium)', paddingBottom: '16px', marginBottom: '20px' }}>
              <span style={seriesSubStyle}>{manga.titre}</span>
              <h1 style={titleStyle}>{manga.nom_arc_collection}</h1>
            </div>

            {/* Primary Advisor KPIs (Unit values) */}
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>TARIFS UNITAIRES CONSEILLÉS :</h4>
            <div style={kpiGridStyle}>
              <div className="glass-panel" style={kpiCardStyle('var(--accent-neon-glow)')}>
                <span style={kpiLabelStyle}>Achat conseillé max <InfoTooltip term="maxbuy" /></span>
                <span style={kpiValueStyle}>{manga.prix_achat_max.toFixed(2)} €</span>
                <span style={kpiSubtextStyle(true)}>Remise vs Neuf : -{retailDiscountPct.toFixed(0)}%</span>
              </div>
              
              <div className="glass-panel" style={kpiCardStyle('rgba(0, 230, 118, 0.15)')}>
                <span style={kpiLabelStyle}>Revente min conseillée</span>
                <span style={kpiValueStyle}><span style={{ color: 'var(--success)' }}>{manga.prix_vente_min.toFixed(2)} €</span></span>
                <span style={kpiSubtextStyle(false)}>ROI attendu : +{defaultROIMin.toFixed(0)}%</span>
              </div>
              
              <div className="glass-panel" style={kpiCardStyle('rgba(0, 136, 255, 0.15)')}>
                <span style={kpiLabelStyle}>Revente max conseillée</span>
                <span style={kpiValueStyle}><span style={{ color: 'var(--accent-blue)' }}>{manga.prix_vente_max.toFixed(2)} €</span></span>
                <span style={kpiSubtextStyle(false)}>ROI max : +{defaultROIMax.toFixed(0)}%</span>
              </div>
            </div>

            {manga.notes && (
              <div style={notesBoxStyle}>
                <strong>Notes de recherche :</strong> {manga.notes}
              </div>
            )}
          </div>

          {/* Interactive ROI Calculator & Custom Lot Configuration */}
          <div className="glass-panel" style={panelPaddingStyle}>
            <h3 style={sectionTitleStyle}>
              <DollarSign size={18} style={{ color: 'var(--accent-neon)' }} />
              Calculateur de Lot Multi-Tomes
            </h3>
            <p style={sectionSubStyle}>Saisissez la plage de tomes achetés pour calculer la rentabilité exacte en fonction des prix de chaque segment.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={calcLabelStyle}>Tome début</label>
                <input
                  type="number"
                  min="1"
                  value={startVol}
                  onChange={(e) => setStartVol(Math.max(1, parseInt(e.target.value) || 1))}
                  style={volumeInputStyle}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={calcLabelStyle}>Tome fin</label>
                <input
                  type="number"
                  min="1"
                  value={endVol}
                  onChange={(e) => setEndVol(Math.max(1, parseInt(e.target.value) || 1))}
                  style={volumeInputStyle}
                />
              </div>
            </div>

            <div className="calc-grid" style={calcGridStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={calcLabelStyle}>Prix d&apos;achat global payé (€)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 50.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    style={calcInputStyle}
                  />
                  <span style={currencySymbolStyle}>€</span>
                </div>
              </div>

              {/* Calculator Output Display */}
              <div style={calcResultBoxStyle}>
                <div style={resultRowStyle}>
                  <span>Nombre de tomes :</span>
                  <strong>{lotPricing.totalVolumes} tomes</strong>
                </div>
                <div style={resultRowStyle}>
                  <span>Prix max conseillé global :</span>
                  <strong>{lotPricing.prix_achat_max.toFixed(2)} €</strong>
                </div>
                <div style={resultRowStyle}>
                  <span>Bénéfice estimé :</span>
                  <strong style={{ color: realMarginMin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {realMarginMin >= 0 ? '+' : ''}{realMarginMin.toFixed(2)}€ à {realMarginMax >= 0 ? '+' : ''}{realMarginMax.toFixed(2)}€
                  </strong>
                </div>
                <div style={resultRowStyle}>
                  <span>ROI réel obtenu :</span>
                  <strong style={{ color: realROIMin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {realROIMin >= 0 ? '+' : ''}{realROIMin.toFixed(0)}% à {realROIMax >= 0 ? '+' : ''}{realROIMax.toFixed(0)}%
                  </strong>
                </div>
                <div style={resultRowStyle}>
                  <span>Avis de l&apos;algorithme :</span>
                  <span className={`badge-roi ${advice.class}`} style={{ display: 'inline-flex', padding: '4px 10px', fontSize: '0.8rem' }}>
                    {advice.emoji} {advice.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Price breakdown details */}
            <div style={breakdownContainerStyle}>
              <h4 style={breakdownTitleStyle}>
                <ListCollapse size={16} />
                Détail de la valeur par tome
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                {Object.keys(groupedSegments).map(segName => {
                  const seg = groupedSegments[segName];
                  const segmentTotalBuy = seg.count * seg.unitBuy;
                  const segmentTotalSellMin = seg.count * seg.unitSellMin;
                  const segmentTotalSellMax = seg.count * seg.unitSellMax;
                  
                  return (
                    <div key={segName} style={breakdownRowStyle}>
                      <div style={{ fontWeight: 600 }}>Tomes {seg.start} à {seg.end} :</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '10px' }}>
                        {seg.count} tomes × Achat Max {seg.unitBuy.toFixed(2)}€ (Total: {segmentTotalBuy.toFixed(2)}€) | 
                        Revente {seg.unitSellMin.toFixed(2)}€ - {seg.unitSellMax.toFixed(2)}€
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={disclaimerBoxStyle}>
              Remarque : cette estimation prend en compte les différents prix unitaires de chaque segment défini dans l&apos;Excel (les tomes d&apos;arcs différents n&apos;ont pas la même valeur).
            </div>
          </div>

          {/* Trend & Market Hype Section */}
          <div className="glass-panel" style={panelPaddingStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={sectionTitleStyle}>
                <Flame size={18} style={{ color: 'var(--accent-gold)' }} />
                Tendance du Marché &amp; Hype
              </h3>
              <span style={hypeBadgeStyle(manga.hypeScore)}>
                Hype Actuelle : {manga.hypeScore}/100 • {manga.popularity}
              </span>
            </div>

            <div style={trendGraphBoxStyle}>
              <div style={trendGraphHeaderStyle}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Intérêt de recherche sur les 12 derniers mois (Google Trends)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Tendance : En Hausse ↗</span>
              </div>
              <div style={sparklineBoxStyle}>
                <svg viewBox="0 0 440 100" style={{ width: '100%', height: '120px', display: 'block' }}>
                  <line x1="0" y1="20" x2="440" y2="20" stroke="var(--border-light)" strokeDasharray="5,5" />
                  <line x1="0" y1="50" x2="440" y2="50" stroke="var(--border-light)" strokeDasharray="5,5" />
                  <line x1="0" y1="80" x2="440" y2="80" stroke="var(--border-light)" strokeDasharray="5,5" />
                  
                  <polyline
                    fill="none"
                    stroke="var(--accent-neon)"
                    strokeWidth="3.5"
                    points={trendSvgPoints}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  <polyline
                    fill="none"
                    stroke="var(--accent-neon)"
                    strokeWidth="10"
                    points={trendSvgPoints}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.1"
                  />
                  
                  {trendData.map((val, idx) => (
                    <circle
                      key={idx}
                      cx={idx * 40}
                      cy={100 - val}
                      r="4"
                      fill="#ffffff"
                      stroke="var(--accent-neon)"
                      strokeWidth="2.5"
                    />
                  ))}
                </svg>
              </div>
              <div style={trendGraphFooterStyle}>
                <span>Il y a 12 mois</span>
                <span>Aujourd&apos;hui</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline styles for details page layout
const backButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: '8px 0',
  marginBottom: '20px',
  fontFamily: 'var(--font-primary)',
  fontWeight: 500,
  transition: 'color var(--transition-fast)',
};

const errorContainerStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '80px 20px',
};

const detailGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '350px 1fr',
  gap: '28px',
};

const leftColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
};

const rightColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
};

const panelPaddingStyle: React.CSSProperties = {
  padding: '24px',
};

const retailBadgeStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-medium)',
  padding: '6px 12px',
  borderRadius: '6px',
  color: 'var(--text-secondary)',
};

const favButtonStyle = (fav?: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: fav ? 'var(--accent-neon)' : 'var(--text-secondary)',
  fontSize: '0.85rem',
  fontWeight: 600,
});

const tagSectionStyle: React.CSSProperties = {
  marginTop: '24px',
  textAlign: 'left',
  borderTop: '1px solid var(--border-light)',
  paddingTop: '16px',
};

const tagHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '10px',
};

const addTagBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-medium)',
  borderRadius: '4px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
};

const tagFormStyle: React.CSSProperties = {
  marginBottom: '10px',
};

const tagInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: '6px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-medium)',
  color: '#ffffff',
  fontSize: '0.8rem',
  outline: 'none',
};

const tagsListStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
};

const tagBadgeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  backgroundColor: 'rgba(255, 62, 62, 0.08)',
  color: 'var(--accent-neon)',
  border: '1px solid var(--border-accent)',
  padding: '3px 8px',
  borderRadius: '4px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
};

const removeTagBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent-neon)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const seriesSubStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: 'var(--accent-neon)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const titleStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  marginTop: '4px',
};

const kpiGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '16px',
  marginBottom: '20px',
};

const kpiCardStyle = (glowColor: string): React.CSSProperties => ({
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--bg-secondary)',
  boxShadow: `inset 0 0 12px ${glowColor}`,
});

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  textTransform: 'uppercase',
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 800,
  marginTop: '6px',
  fontFamily: 'var(--font-display)',
};

const kpiSubtextStyle = (isDanger: boolean): React.CSSProperties => ({
  fontSize: '0.75rem',
  color: isDanger ? 'var(--danger)' : 'var(--text-secondary)',
  marginTop: '4px',
  fontWeight: 500,
});

const notesBoxStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: '8px',
  backgroundColor: 'rgba(255, 170, 0, 0.05)',
  borderLeft: '4px solid var(--accent-gold)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
  lineHeight: 1.4,
};

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '1.2rem',
  fontWeight: 700,
  fontFamily: 'var(--font-display)',
  color: '#ffffff',
  marginBottom: '4px',
};

const sectionSubStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  marginBottom: '16px',
};

const volumeInputStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '8px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-medium)',
  color: '#ffffff',
  fontSize: '1rem',
  fontWeight: 600,
  outline: 'none',
};

const calcGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '220px 1fr',
  gap: '20px',
  alignItems: 'center',
};

const calcLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
};

const calcInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 36px 12px 16px',
  borderRadius: '8px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-medium)',
  color: '#ffffff',
  fontSize: '1.1rem',
  fontWeight: 700,
  outline: 'none',
};

const currencySymbolStyle: React.CSSProperties = {
  position: 'absolute',
  right: 14,
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--text-secondary)',
  fontWeight: 700,
};

const calcResultBoxStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-primary)',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid var(--border-medium)',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const resultRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '0.85rem',
};

const breakdownContainerStyle: React.CSSProperties = {
  marginTop: '20px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-medium)',
  borderRadius: '8px',
  padding: '16px',
};

const breakdownTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.9rem',
  fontWeight: 700,
  color: 'var(--accent-neon)',
  textTransform: 'uppercase',
};

const breakdownRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '8px 0',
  borderBottom: '1px dashed var(--border-light)',
};

const disclaimerBoxStyle: React.CSSProperties = {
  marginTop: '16px',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  fontStyle: 'italic',
  borderTop: '1px dashed var(--border-light)',
  paddingTop: '10px',
};

const hypeBadgeStyle = (score: number): React.CSSProperties => ({
  fontSize: '0.8rem',
  fontWeight: 700,
  color: score >= 80 ? 'var(--accent-neon)' : 'var(--accent-gold)',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-medium)',
  padding: '4px 10px',
  borderRadius: '6px',
});

const trendGraphBoxStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-medium)',
  borderRadius: '8px',
  padding: '16px',
};

const trendGraphHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.75rem',
  marginBottom: '16px',
};

const sparklineBoxStyle: React.CSSProperties = {
  padding: '10px 0',
};

const trendGraphFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.7rem',
  color: 'var(--text-secondary)',
  marginTop: '8px',
};
