'use client';

import React from 'react';
import { Info } from 'lucide-react';

// Common glossary definitions
const GLOSSARY: Record<string, { definition: string; example: string }> = {
  roi: {
    definition: "Le ROI (Retour sur Investissement) indique combien vous gagnez par rapport à votre mise initiale.",
    example: "Exemple: Si vous achetez à 10€ et revendez à 15€, la marge est de 5€, donc votre ROI est de +50%."
  },
  margin: {
    definition: "La Marge brute est la différence brute entre le prix de revente estimé et le prix d'achat.",
    example: "Exemple: Achat à 5€, revente à 12€ => Marge = 7€."
  },
  rentability: {
    definition: "Mesure synthétique qui évalue si l'achat est intéressant financièrement en combinant ROI, marge et rapidité de vente.",
    example: "Excellent: ROI > 80% | Correct: ROI 40-80% | Déconseillé: ROI < 40%."
  },
  hype: {
    definition: "Score d'attractivité sur 100 du manga sur le marché de l'occasion en ce moment.",
    example: "Exemple: Un manga très recherché comme One Piece aura une hype de 80+, se revendant très rapidement."
  },
  maxbuy: {
    definition: "Le prix maximum conseillé pour acquérir le manga sur Vinted afin de rester rentable.",
    example: "Exemple: Si le prix de revente attendu est de 5€, vous ne devriez pas l'acheter plus de 2,5€ (50% max)."
  },
  retail: {
    definition: "Le prix moyen d'un tome neuf identique dans les commerces classiques (FNAC, Librairies).",
    example: "Exemple: Un tome de One Piece coûte 7,20€ neuf en magasin."
  },
  potential_profit: {
    definition: "Le gain financier estimé que vous pouvez réaliser après revente.",
    example: "Bénéfice = Prix de revente (min/max) - Prix d'achat réel payé."
  }
};

interface InfoTooltipProps {
  term: keyof typeof GLOSSARY;
}

export default function InfoTooltip({ term }: InfoTooltipProps) {
  const item = GLOSSARY[term];
  if (!item) return null;

  return (
    <span className="tooltip-container" tabIndex={0}>
      <Info size={14} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
      <span className="tooltip-box">
        <strong>{item.definition}</strong>
        <span style={{ display: 'block', marginTop: '6px', opacity: 0.85, fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
          {item.example}
        </span>
      </span>
    </span>
  );
}
