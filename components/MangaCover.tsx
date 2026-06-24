'use client';

import React from 'react';

interface MangaCoverProps {
  title: string;
  series: string;
  volumeRange?: string;
  height?: number;
}

export default function MangaCover({ title, series, volumeRange, height = 220 }: MangaCoverProps) {
  // Generate a deterministic HSL color based on series name string hash
  const getHashColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 70%, 45%)`;
  };

  const primaryColor = getHashColor(series);
  
  return (
    <div style={{ ...containerStyle, height: `${height}px`, background: `linear-gradient(135deg, ${primaryColor} 0%, #15161c 100%)` }}>
      {/* Halftone Dot pattern overlay */}
      <div style={halftoneStyle}></div>
      
      {/* Manga Frame Border */}
      <div style={innerFrameStyle}>
        <div style={seriesTextStyle}>{series}</div>
        
        {/* Visual elements representing comic panel */}
        <div style={artPanelStyle}>
          <span style={japanSymbolStyle}>🎌</span>
        </div>
        
        <div style={volumeTextStyle}>
          {volumeRange && volumeRange !== 'Tome Unique / Lot' ? volumeRange : 'VOL. LOT'}
        </div>
      </div>
    </div>
  );
}

// Inline styles for the cover placeholder
const containerStyle: React.CSSProperties = {
  width: '100%',
  position: 'relative',
  borderRadius: '12px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  border: '3px solid #000000',
  boxShadow: '4px 4px 0px #000000',
};

const halftoneStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundImage: 'radial-gradient(rgba(0, 0, 0, 0.45) 15%, transparent 16%)',
  backgroundSize: '8px 8px',
  opacity: 0.35,
  pointerEvents: 'none',
};

const innerFrameStyle: React.CSSProperties = {
  margin: '10px',
  border: '2px solid #ffffff',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '8px',
  background: 'rgba(0, 0, 0, 0.25)',
  backdropFilter: 'blur(2px)',
};

const seriesTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '1rem',
  fontWeight: 800,
  textAlign: 'center',
  color: '#ffffff',
  textTransform: 'uppercase',
  textShadow: '2px 2px 0px #000000',
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
};

const artPanelStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  flex: 1,
};

const japanSymbolStyle: React.CSSProperties = {
  fontSize: '2rem',
  filter: 'drop-shadow(2px 2px 0px #000000)',
};

const volumeTextStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#000000',
  fontFamily: 'var(--font-display)',
  fontSize: '0.75rem',
  fontWeight: 700,
  textAlign: 'center',
  padding: '3px 6px',
  borderRadius: '4px',
  border: '2px solid #000000',
  textTransform: 'uppercase',
  alignSelf: 'center',
  boxShadow: '2px 2px 0px #000000',
};
