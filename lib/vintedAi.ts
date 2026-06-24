/**
 * AI Listing Analysis Engine for Vinted Manga Profit
 * Combines Natural Language Processing (NLP) rules, semantic checks,
 * and simulated image/OCR analysis to classify Vinted listings.
 */

export interface AIAnalysisResult {
  isManga: boolean;
  type: 'lot' | 'unité' | 'collection';
  startVolume: number;
  endVolume: number;
  totalVolumes: number;
  coherenceScore: number; // 0 to 100
  correctedPricePerTome: number;
  confidence: number; // 0 to 100
  aiVerdict: string;
  isExternalAI?: boolean;
}

/**
 * AI engine to analyze a Vinted listing based on title, description, price, and image
 */
export function analyzeListingAI(
  title: string,
  description: string,
  price: number,
  searchQuery: string
): AIAnalysisResult {
  const fullText = `${title} \n ${description}`.toLowerCase();
  
  // 1. Classification: Manga vs Non-Manga (Books vs clothes, cards, pop figures, etc.)
  const positiveMangaKeywords = [
    'tome', 'volume', 'manga', 'shonen', 'shojo', 'seinen', 'double', 
    'deluxe', 'collec', 'pages', 'edition', 'livre', 'lecture', 'sens de', 
    'dessinee', 'bd', 'relié', 'broché'
  ];
  
  const negativeMangaKeywords = [
    'carte', 'card', 'tcg', 'figurine', 'funko', 'pop', 'jeu', 't-shirt', 
    'sweat', 'vetement', 'habits', 'porte-clef', 'poster', 'console', 
    'switch', 'ps4', 'ps5', 'hoodie', 'collier', 'bague', 'peluche', 
    'pins', 'mug', 'tasse', 'cosplay'
  ];

  let positiveScore = 0;
  let negativeScore = 0;

  positiveMangaKeywords.forEach(kw => {
    if (fullText.includes(kw)) positiveScore += 2;
  });

  negativeMangaKeywords.forEach(kw => {
    if (fullText.includes(kw)) negativeScore += 5;
  });

  // Basic title indicator (titles containing series names usually score higher)
  if (title.toLowerCase().includes(searchQuery.toLowerCase())) {
    positiveScore += 4;
  }

  // Simulated visual OCR / image classification
  // If the listing description contains words relating to photos or covers
  if (fullText.includes('photo') || fullText.includes('couverture') || fullText.includes('tranche')) {
    positiveScore += 1;
  }

  const isManga = positiveScore > negativeScore;

  // 2. Type detection: Lot vs Unité vs Collection
  const unitKeywords = [
    'à l\'unité', 'l\'unité', 'le tome', 'tome à', 'vendus individuellement', 
    'choix des tomes', 'tome au choix', 'unité', 'unitaire', 'tome de votre choix'
  ];

  const collectionKeywords = [
    'intégrale', 'complete', 'toute la collection', 'série complète', 
    'tous les tomes', 'full set'
  ];

  let type: 'lot' | 'unité' | 'collection' = 'lot'; // default

  const hasUnitKeyword = unitKeywords.some(kw => fullText.includes(kw));
  const hasCollectionKeyword = collectionKeywords.some(kw => fullText.includes(kw));

  if (hasUnitKeyword) {
    type = 'unité';
  } else if (hasCollectionKeyword) {
    type = 'collection';
  }

  // 3. Volume range and count extraction
  let startVolume = 1;
  let endVolume = 1;
  let totalVolumes = 1;

  // Try parsing range like "1 à 10", "8 à 12"
  const rangeMatch = fullText.match(/\b(?:tomes?|vols?|t)?\s*(\d+)\s*(?:a|à|au|et|-)\s*(\d+)\b/i);
  if (rangeMatch) {
    startVolume = parseInt(rangeMatch[1], 10);
    endVolume = parseInt(rangeMatch[2], 10);
    totalVolumes = Math.max(1, endVolume - startVolume + 1);
  } else {
    // Try single quantity like "5 tomes" or "10 volumes"
    const qtyMatch = fullText.match(/\b(\d+)\s*(?:tomes?|vols?|volumes?|mangas?)\b/i);
    if (qtyMatch) {
      totalVolumes = parseInt(qtyMatch[1], 10);
      startVolume = 1;
      endVolume = totalVolumes;
    } else {
      // Fallback single tome check (e.g. "One Piece 95")
      const singleMatch = title.match(/\b(?:tome|vol|v)?\s*(\d+)\b/i);
      if (singleMatch) {
        const num = parseInt(singleMatch[1], 10);
        if (num < 110) { // standard volume limit
          startVolume = num;
          endVolume = num;
          totalVolumes = 1;
        }
      }
    }
  }

  // If collection complete, adjust to higher volumes count if requested query has more
  if (type === 'collection' && totalVolumes === 1) {
    totalVolumes = 20; // Default estimate for a complete set
    endVolume = 20;
  }

  // 4. Coherence score with user query (typo matching / inclusion)
  let coherenceScore = 0;
  const cleanQuery = searchQuery.toLowerCase().trim();
  const cleanTitle = title.toLowerCase();

  if (cleanTitle.includes(cleanQuery)) {
    coherenceScore = 100;
  } else {
    // Split keywords
    const queryParts = cleanQuery.split(' ');
    let matches = 0;
    queryParts.forEach(part => {
      if (part.length > 2 && cleanTitle.includes(part)) {
        matches++;
      }
    });
    coherenceScore = Math.round((matches / queryParts.length) * 100);
  }

  // If query is abbreviation like "op" for "one piece"
  if (cleanQuery === 'op' && (cleanTitle.includes('one piece') || cleanTitle.includes('onepiece'))) {
    coherenceScore = 95;
  }

  // 5. Corrected price per tome calculation
  const correctedPricePerTome = type === 'unité' ? price : (totalVolumes > 0 ? price / totalVolumes : price);

  // Confidence score of the AI verdict
  let confidence = 50;
  if (isManga) confidence += 20;
  if (rangeMatch || hasUnitKeyword) confidence += 20;
  if (coherenceScore > 80) confidence += 10;

  // AI Verdict sentence
  let aiVerdict = '';
  if (!isManga) {
    aiVerdict = "⚠️ NON MANGA : Classifié comme produit dérivé, vêtement ou accessoire.";
  } else if (type === 'unité') {
    aiVerdict = `✅ MANGA UNIQUES : Vente à l'unité détectée. Tome ${startVolume} analysé.`;
  } else if (type === 'collection') {
    aiVerdict = `⭐ COLLECTION COMPLÈTE : Ensemble de la série détecté (${totalVolumes} tomes).`;
  } else {
    aiVerdict = `📦 LOT DÉTECTÉ : Lot de ${totalVolumes} tomes (Tomes ${startVolume} à ${endVolume}).`;
  }

  return {
    isManga,
    type,
    startVolume,
    endVolume,
    totalVolumes,
    coherenceScore,
    correctedPricePerTome,
    confidence: Math.min(100, confidence),
    aiVerdict
  };
}
