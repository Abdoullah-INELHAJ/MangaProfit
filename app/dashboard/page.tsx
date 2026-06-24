'use client';

import React from 'react';
import { useData } from '../../context/DataContext';
import Link from 'next/link';
import { TrendingUp, Award, DollarSign, Activity, Percent, BookOpen } from 'lucide-react';
import { Manga } from '../../lib/defaultData';

export default function DashboardPage() {
  const { mangas } = useData();

  // Calculations
  const totalMangas = mangas.length;
  
  const calculateROI = (m: Manga) => {
    if (m.prix_achat_max <= 0) return 0;
    return ((m.prix_vente_min - m.prix_achat_max) / m.prix_achat_max) * 100;
  };

  const calculateMargin = (m: Manga) => {
    return m.prix_vente_min - m.prix_achat_max;
  };

  const avgMaxBuy = totalMangas > 0 
    ? mangas.reduce((sum, m) => sum + m.prix_achat_max, 0) / totalMangas 
    : 0;

  const avgMargin = totalMangas > 0 
    ? mangas.reduce((sum, m) => sum + calculateMargin(m), 0) / totalMangas 
    : 0;

  const avgROI = totalMangas > 0 
    ? mangas.reduce((sum, m) => sum + calculateROI(m), 0) / totalMangas 
    : 0;

  // Sorting rankings
  const topROI = [...mangas]
    .sort((a, b) => calculateROI(b) - calculateROI(a))
    .slice(0, 5);

  const topMargin = [...mangas]
    .sort((a, b) => calculateMargin(b) - calculateMargin(a))
    .slice(0, 5);

  // Group by Hype category for Donut Chart
  const hypeCounts = mangas.reduce((acc, m) => {
    acc[m.popularity] = (acc[m.popularity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalPopularity = Object.values(hypeCounts).reduce((sum, count) => sum + count, 0);

  // Donut chart calculations
  const popularityTypes = [
    { label: 'Très forte', count: hypeCounts['Très forte'] || 0, color: 'var(--accent-neon)' },
    { label: 'Forte', count: hypeCounts['Forte'] || 0, color: 'var(--accent-gold)' },
    { label: 'Moyenne', count: hypeCounts['Moyenne'] || 0, color: 'var(--accent-blue)' },
    { label: 'Faible', count: hypeCounts['Faible'] || 0, color: 'var(--text-muted)' }
  ];

  let cumulativePercent = 0;

  // Bar Chart calculations for top 5 margins
  const maxMarginVal = topMargin.length > 0 ? calculateMargin(topMargin[0]) : 1;

  return (
    <div>
      {/* Page Title */}
      <section style={{ padding: '20px 0 32px' }}>
        <h1 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Tableau de Bord &amp; <span style={{ color: 'var(--accent-neon)' }}>Statistiques</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Consultez les indicateurs clés de votre catalogue et découvrez les mangas à cibler en priorité.
        </p>
      </section>

      {/* KPI Overview row */}
      <div style={kpiRowStyle}>
        <div className="glass-panel" style={kpiBoxStyle}>
          <div style={kpiIconStyle('rgba(255, 62, 62, 0.12)', 'var(--accent-neon)')}>
            <BookOpen size={20} />
          </div>
          <div>
            <span style={kpiLabelStyle}>Mangas suivis</span>
            <h2 style={kpiNumStyle}>{totalMangas}</h2>
            <span style={kpiSubStyle}>Dans la base locale</span>
          </div>
        </div>

        <div className="glass-panel" style={kpiBoxStyle}>
          <div style={kpiIconStyle('rgba(255, 170, 0, 0.12)', 'var(--accent-gold)')}>
            <DollarSign size={20} />
          </div>
          <div>
            <span style={kpiLabelStyle}>Prix d&apos;achat moyen u.</span>
            <h2 style={kpiNumStyle}>{avgMaxBuy.toFixed(2)} €</h2>
            <span style={kpiSubStyle}>Par tome ou lot</span>
          </div>
        </div>

        <div className="glass-panel" style={kpiBoxStyle}>
          <div style={kpiIconStyle('rgba(0, 230, 118, 0.12)', 'var(--success)')}>
            <TrendingUp size={20} />
          </div>
          <div>
            <span style={kpiLabelStyle}>Marge moy. u. estimée</span>
            <h2 style={kpiNumStyle}>+{avgMargin.toFixed(2)} €</h2>
            <span style={kpiSubStyle}>Bénéfice minimum brut</span>
          </div>
        </div>

        <div className="glass-panel" style={kpiBoxStyle}>
          <div style={kpiIconStyle('rgba(0, 136, 255, 0.12)', 'var(--accent-blue)')}>
            <Percent size={20} />
          </div>
          <div>
            <span style={kpiLabelStyle}>ROI moyen estimé</span>
            <h2 style={kpiNumStyle}>+{avgROI.toFixed(0)} %</h2>
            <span style={kpiSubStyle}>Retour sur investissement</span>
          </div>
        </div>
      </div>

      {/* Charts section */}
      <div style={chartsGridStyle}>
        {/* SVG Bar Chart: Margins */}
        <div className="glass-panel" style={chartPanelStyle}>
          <h3 style={chartTitleStyle}>
            <DollarSign size={18} style={{ color: 'var(--accent-neon)' }} />
            Top 5 des Meilleures Marges Unitaires (€)
          </h3>
          
          <div style={barChartContainerStyle}>
            {topMargin.map((m, index) => {
              const margin = calculateMargin(m);
              const barHeightPct = (margin / maxMarginVal) * 100;
              
              return (
                <div key={m.id} style={barWrapperStyle}>
                  <div style={barLabelValueStyle}>{margin.toFixed(2)}€</div>
                  {/* The bar */}
                  <div style={barOuterStyle}>
                    <div style={{ ...barInnerStyle, height: `${barHeightPct}%` }}></div>
                  </div>
                  <Link href={`/manga/${m.id}`} style={barLabelStyle}>
                    {m.nom_arc_collection.length > 14 ? `${m.nom_arc_collection.slice(0, 12)}...` : m.nom_arc_collection}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* SVG Donut Chart: Popularity Distribution */}
        <div className="glass-panel" style={chartPanelStyle}>
          <h3 style={chartTitleStyle}>
            <Activity size={18} style={{ color: 'var(--accent-gold)' }} />
            Répartition de la Hype Actuelle
          </h3>

          <div style={donutChartLayout}>
            {/* SVG circle rendering */}
            <div style={svgDonutWrapper}>
              <svg width="150" height="150" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                {popularityTypes.map((item, index) => {
                  const percent = totalPopularity > 0 ? (item.count / totalPopularity) * 100 : 0;
                  if (percent === 0) return null;
                  
                  const strokeDasharray = `${percent} ${100 - percent}`;
                  const strokeDashoffset = -cumulativePercent;
                  cumulativePercent += percent;
 
                  return (
                    <circle
                      key={item.label}
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="transparent"
                      stroke={item.color}
                      strokeWidth="4"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                    />
                  );
                })}
                <circle cx="18" cy="18" r="12" fill="var(--bg-secondary)" />
              </svg>
              <div style={donutCenterTextStyle}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{totalMangas}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Titres</span>
              </div>
            </div>

            {/* Legend */}
            <div style={donutLegendStyle}>
              {popularityTypes.map(item => {
                const percent = totalPopularity > 0 ? (item.count / totalPopularity) * 100 : 0;
                return (
                  <div key={item.label} style={legendRowStyle}>
                    <span style={{ ...legendDotStyle, backgroundColor: item.color }}></span>
                    <span style={{ flex: 1, fontSize: '0.85rem' }}>{item.label}</span>
                    <strong style={{ fontSize: '0.85rem' }}>{item.count} ({percent.toFixed(0)}%)</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Rankings List grid */}
      <div style={rankingsGridStyle}>
        {/* Top ROI Listing */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={rankingHeaderStyle}>
            <Award size={18} style={{ color: 'var(--success)' }} />
            Mangas par Meilleur ROI Unit. (%)
          </h3>
          <div style={listContainerStyle}>
            {topROI.map((m, index) => {
              const roi = calculateROI(m);
              return (
                <div key={m.id} style={rankingRowStyle}>
                  <span style={rankingNumberStyle}>{index + 1}</span>
                  <div style={{ flex: 1 }}>
                    <Link href={`/manga/${m.id}`} style={rankingTitleStyle}>{m.nom_arc_collection}</Link>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.titre}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1rem' }}>+{roi.toFixed(0)} %</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Achat: {m.prix_achat_max.toFixed(2)}€</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Profit Margins listing */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={rankingHeaderStyle}>
            <DollarSign size={18} style={{ color: 'var(--accent-blue)' }} />
            Meilleures Marges Unitaires (€)
          </h3>
          <div style={listContainerStyle}>
            {topMargin.map((m, index) => {
              const margin = calculateMargin(m);
              return (
                <div key={m.id} style={rankingRowStyle}>
                  <span style={rankingNumberStyle}>{index + 1}</span>
                  <div style={{ flex: 1 }}>
                    <Link href={`/manga/${m.id}`} style={rankingTitleStyle}>{m.nom_arc_collection}</Link>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.titre}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: '1rem' }}>+{margin.toFixed(2)} €</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Revente min: {m.prix_vente_min.toFixed(2)}€</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline styles for dashboard components
const kpiRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '20px',
  marginBottom: '32px',
};

const kpiBoxStyle: React.CSSProperties = {
  padding: '20px',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const kpiIconStyle = (bgColor: string, color: string): React.CSSProperties => ({
  backgroundColor: bgColor,
  color: color,
  width: '46px',
  height: '46px',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
};

const kpiNumStyle: React.CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 800,
  marginTop: '2px',
  fontFamily: 'var(--font-display)',
};

const kpiSubStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
};

const chartsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '24px',
  marginBottom: '32px',
};

const chartPanelStyle: React.CSSProperties = {
  padding: '24px',
  minHeight: '320px',
};

const chartTitleStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  fontFamily: 'var(--font-display)',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '24px',
  borderBottom: '1px solid var(--border-light)',
  paddingBottom: '12px',
};

const barChartContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'flex-end',
  height: '200px',
  paddingTop: '20px',
};

const barWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  flex: 1,
};

const barLabelValueStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--accent-neon)',
  marginBottom: '6px',
};

const barOuterStyle: React.CSSProperties = {
  width: '32px',
  height: '130px',
  backgroundColor: 'var(--bg-primary)',
  borderRadius: '4px',
  position: 'relative',
  overflow: 'hidden',
  border: '1px solid var(--border-medium)',
};

const barInnerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'linear-gradient(to top, var(--accent-neon) 0%, var(--accent-neon-hover) 100%)',
  borderRadius: '2px',
  transition: 'height 0.8s ease-out',
};

const barLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-secondary)',
  marginTop: '8px',
  textAlign: 'center',
  textDecoration: 'none',
  fontWeight: 500,
};

const donutChartLayout: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '32px',
  height: '180px',
};

const svgDonutWrapper: React.CSSProperties = {
  position: 'relative',
  width: '150px',
  height: '150px',
};

const donutCenterTextStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  pointerEvents: 'none',
};

const donutLegendStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  flex: 1,
};

const legendRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const legendDotStyle: React.CSSProperties = {
  width: '10px',
  height: '10px',
  borderRadius: '50%',
};

const rankingsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '24px',
};

const rankingHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontFamily: 'var(--font-display)',
  fontSize: '1.1rem',
  fontWeight: 700,
  marginBottom: '16px',
  borderBottom: '1px solid var(--border-light)',
  paddingBottom: '12px',
};

const listContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const rankingRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px',
  backgroundColor: 'var(--bg-secondary)',
  borderRadius: '8px',
  border: '1px solid var(--border-light)',
};

const rankingNumberStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.8rem',
  fontWeight: 700,
  border: '1px solid var(--border-medium)',
};

const rankingTitleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#ffffff',
  textDecoration: 'none',
};
