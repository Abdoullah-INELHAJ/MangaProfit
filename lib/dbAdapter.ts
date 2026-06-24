import { DEFAULT_MANGAS, Manga } from './defaultData';

const LOCAL_STORAGE_KEY = 'mangaprofit_data_v2'; // Upgraded database version key
const FAVORITES_KEY = 'mangaprofit_favorites';
const TAGS_KEY = 'mangaprofit_tags';

export function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && window.localStorage !== undefined;
}

// Helper to parse volume range from text
export function parseVolumeRange(title: string, rangeText: string): { debut: number; fin: number } {
  const combined = `${rangeText} ${title}`.toLowerCase();
  
  // Try pattern "20 et +" or "11+" or "10 & +"
  const plusMatch = combined.match(/\b(\d+)\s*(?:et\s*\+|\+|\&\s*\+)/i);
  if (plusMatch) {
    return { debut: parseInt(plusMatch[1], 10), fin: 999 };
  }
  
  // Try pattern "1 à 10" or "10 à 20" or "1-10" or "10 16"
  const rangeMatch = combined.match(/\b(\d+)\s*(?:a|à|au|et|-)\s*(\d+)\b/i);
  if (rangeMatch) {
    return { debut: parseInt(rangeMatch[1], 10), fin: parseInt(rangeMatch[2], 10) };
  }
  
  // Find any consecutive numbers in sequence
  const numbers = combined.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    const parsed = numbers.map(n => parseInt(n, 10));
    return { debut: Math.min(...parsed), fin: Math.max(...parsed) };
  } else if (numbers && numbers.length === 1) {
    const single = parseInt(numbers[0], 10);
    return { debut: single, fin: single };
  }
  
  return { debut: 1, fin: 1 };
}

// Helper to clean manga title (extract name without range numbers)
export function cleanTitle(title: string): string {
  let cleaned = title;
  const patternsToRemove = [
    /\b\d+\s*(?:a|à|et|au|-)\s*\d+\b/gi,
    /\b\d+\s*(?:et\s*\+|\+|\&\s*\+)/gi,
    /\b\d+\s+\d+\b/gi,
    /\bcollector\b.*/gi,
    /\btome\s+\d+\b/gi,
    /\bvol\.*\s*\d+\b/gi
  ];
  
  patternsToRemove.forEach(pat => {
    cleaned = cleaned.replace(pat, '');
  });
  
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (!cleaned) cleaned = title;
  return cleaned;
}

// Get all mangas (from localStorage or defaults)
export function getMangas(): Manga[] {
  if (!isLocalStorageAvailable()) return DEFAULT_MANGAS;
  
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) {
    // Seed localStorage on first load
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MANGAS));
    return DEFAULT_MANGAS;
  }
  
  try {
    const mangas: Manga[] = JSON.parse(saved);
    const favorites = getFavorites();
    const tagsMap = getTagsMap();
    
    return mangas.map(m => ({
      ...m,
      isFavorite: favorites.includes(m.id),
      tags: tagsMap[m.id] || m.tags || []
    }));
  } catch (e) {
    console.error('Error parsing saved mangas:', e);
    return DEFAULT_MANGAS;
  }
}

// Get single manga by ID
export function getMangaById(id: string): Manga | undefined {
  const mangas = getMangas();
  return mangas.find(m => m.id === id);
}

// Save all mangas to LocalStorage
export function saveMangas(mangas: Manga[]): void {
  if (!isLocalStorageAvailable()) return;
  
  // Clean favorites and tags before saving main database (to keep database lean)
  const cleaned = mangas.map(({ isFavorite, tags, ...rest }) => rest);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
  
  // Save favorites and tags separately
  const favorites = mangas.filter(m => m.isFavorite).map(m => m.id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  
  const tagsMap: Record<string, string[]> = {};
  mangas.forEach(m => {
    if (m.tags && m.tags.length > 0) {
      tagsMap[m.id] = m.tags;
    }
  });
  localStorage.setItem(TAGS_KEY, JSON.stringify(tagsMap));
}

// Get list of favorite IDs
export function getFavorites(): string[] {
  if (!isLocalStorageAvailable()) return [];
  const saved = localStorage.getItem(FAVORITES_KEY);
  return saved ? JSON.parse(saved) : [];
}

// Get tags map (mangaId -> tagList)
export function getTagsMap(): Record<string, string[]> {
  if (!isLocalStorageAvailable()) return {};
  const saved = localStorage.getItem(TAGS_KEY);
  return saved ? JSON.parse(saved) : {};
}

// Helper to generate slug ID
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Calculate ROI and total pricing details for a lot range of volumes
export interface LotPricingDetail {
  volume: number;
  prix_moyen_neuf: number;
  prix_achat_max: number;
  prix_vente_min: number;
  prix_vente_max: number;
  sourceSegment: string;
}

export interface LotPricingResult {
  totalVolumes: number;
  prix_moyen_neuf: number;
  prix_achat_max: number;
  prix_vente_min: number;
  prix_vente_max: number;
  details: LotPricingDetail[];
}

export function calculateLotPricing(
  titre: string,
  startVol: number,
  endVol: number,
  allMangas: Manga[],
  fallbackManga: Manga
): LotPricingResult {
  const details: LotPricingDetail[] = [];
  let totalNeuf = 0;
  let totalAchatMax = 0;
  let totalVenteMin = 0;
  let totalVenteMax = 0;

  // Normalise title to check matching segment
  const cleanTitreLower = cleanTitle(titre).toLowerCase();
  
  // Filter all segments belonging to this manga series
  const segments = allMangas.filter(m => cleanTitle(m.titre).toLowerCase() === cleanTitreLower);

  const start = Math.min(startVol, endVol);
  const end = Math.max(startVol, endVol);

  for (let v = start; v <= end; v++) {
    // Find the correct pricing segment for volume v
    let matchedSegment = segments.find(s => v >= s.volume_debut && v <= s.volume_fin);
    
    // If not found, try a wider find or fallback to the current item
    if (!matchedSegment && segments.length > 0) {
      // Fallback: if v is higher than any fin, grab the last segment (e.g. 20 et +)
      // if v is lower, grab the first segment
      const sorted = [...segments].sort((a, b) => a.volume_debut - b.volume_debut);
      if (v > sorted[sorted.length - 1].volume_fin) {
        matchedSegment = sorted[sorted.length - 1];
      } else {
        matchedSegment = sorted[0];
      }
    }

    const activeManga = matchedSegment || fallbackManga;

    totalNeuf += activeManga.prix_moyen_neuf;
    totalAchatMax += activeManga.prix_achat_max;
    totalVenteMin += activeManga.prix_vente_min;
    totalVenteMax += activeManga.prix_vente_max;

    details.push({
      volume: v,
      prix_moyen_neuf: activeManga.prix_moyen_neuf,
      prix_achat_max: activeManga.prix_achat_max,
      prix_vente_min: activeManga.prix_vente_min,
      prix_vente_max: activeManga.prix_vente_max,
      sourceSegment: activeManga.nom_arc_collection
    });
  }

  return {
    totalVolumes: details.length,
    prix_moyen_neuf: totalNeuf,
    prix_achat_max: totalAchatMax,
    prix_vente_min: totalVenteMin,
    prix_vente_max: totalVenteMax,
    details
  };
}

// Parse Semicolon/Comma separated CSV
export function parseCSVData(csvText: string): Manga[] {
  const lines = csvText.split(/\r?\n/);
  const parsedMangas: Manga[] = [];
  
  let headerIndex = -1;
  let delimiter = ';';
  
  // Find the header row
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (line.includes('Manga') || line.includes('Titre') || line.includes('Achat Max')) {
      headerIndex = i;
      if (line.split(';').length > line.split(',').length) {
        delimiter = ';';
      } else {
        delimiter = ',';
      }
      break;
    }
  }
  
  const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;
  
  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = splitCSVLine(line, delimiter);
    if (cols.length < 3) continue;
    
    const displayTitle = cols[0]?.trim();
    if (!displayTitle || displayTitle.toLowerCase().includes('manga / titre') || displayTitle.toLowerCase().includes('prix max d')) {
      continue;
    }
    
    const condition = cols[1]?.trim() || 'TBE';
    const retailPrice = parseFloat(cols[2]?.replace(',', '.') || '0') || 0;
    const maxBuyPrice = parseFloat(cols[3]?.replace(',', '.') || '0') || 0;
    const minSellPrice = parseFloat(cols[4]?.replace(',', '.') || '0') || 0;
    const maxSellPrice = parseFloat(cols[5]?.replace(',', '.') || '0') || 0;
    const notes = cols[7]?.trim() || '';
    
    // Series and Volume extraction
    const titre = cleanTitle(displayTitle);
    const { debut, fin } = parseVolumeRange(displayTitle, '');

    const hypeScore = Math.floor(Math.random() * 40) + 50;
    const popularity = hypeScore >= 80 ? 'Très forte' : hypeScore >= 65 ? 'Forte' : hypeScore >= 50 ? 'Moyenne' : 'Faible';
    
    parsedMangas.push({
      id: generateSlug(displayTitle),
      titre,
      nom_arc_collection: displayTitle,
      volume_debut: debut,
      volume_fin: fin,
      état: condition,
      prix_moyen_neuf: retailPrice,
      prix_achat_max: maxBuyPrice,
      prix_vente_min: minSellPrice,
      prix_vente_max: maxSellPrice,
      notes,
      hypeScore,
      popularity,
      tags: [],
      isFavorite: false
    });
  }
  
  return parsedMangas;
}

// Split CSV lines keeping quoted values intact
function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result.map(s => s.replace(/^"|"$/g, '').trim());
}

// Convert dataset back to CSV string
export function exportToCSV(mangas: Manga[]): string {
  const delimiter = ';';
  const headers = [
    'Manga / Titre',
    'État (TBE/BE/Correct)',
    'Prix neuf moyen (€)',
    'Prix Vinted Achat Max (€)',
    'Prix Vinted Revente min (€)',
    'Prix Vinted Revente Max (€)',
    'Verdict',
    'Notes / lien'
  ];
  
  const rows = mangas.map(m => [
    m.nom_arc_collection,
    m.état,
    m.prix_moyen_neuf.toString().replace('.', ','),
    m.prix_achat_max.toString().replace('.', ','),
    m.prix_vente_min.toString().replace('.', ','),
    m.prix_vente_max.toString().replace('.', ','),
    m.hypeScore >= 75 ? '⭐ Excellent' : m.hypeScore >= 60 ? '👍 Bon' : '⚠️ Moyen',
    m.notes || ''
  ]);
  
  const csvContent = [
    '🎌  MANGA PRICE TRACKER  —  Vinted;;;;;;;', 
    headers.join(delimiter),
    ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(delimiter))
  ].join('\n');
  
  return csvContent;
}
