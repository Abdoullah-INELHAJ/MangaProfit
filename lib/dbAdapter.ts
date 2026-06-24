import { DEFAULT_MANGAS, Manga } from './defaultData';

const LOCAL_STORAGE_KEY = 'mangaprofit_data';
const FAVORITES_KEY = 'mangaprofit_favorites';
const TAGS_KEY = 'mangaprofit_tags';

export function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && window.localStorage !== undefined;
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
    // Combine with favorites
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

// Parse Semicolon/Comma separated CSV
export function parseCSVData(csvText: string): Manga[] {
  const lines = csvText.split(/\r?\n/);
  const parsedMangas: Manga[] = [];
  
  let headerIndex = -1;
  let delimiter = ';';
  
  // Try to find the header row. Standard header row has "Manga / Titre" or similar.
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (line.includes('Manga') || line.includes('Titre') || line.includes('Achat Max')) {
      headerIndex = i;
      // Detect delimiter
      if (line.split(';').length > line.split(',').length) {
        delimiter = ';';
      } else {
        delimiter = ',';
      }
      break;
    }
  }
  
  // If no header found, assume standard structure and starts at row 0 or 1
  const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;
  
  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split respecting possible quotes (simple CSV parser)
    const cols = splitCSVLine(line, delimiter);
    if (cols.length < 3) continue;
    
    const title = cols[0]?.trim();
    if (!title || title.toLowerCase().includes('manga / titre') || title.toLowerCase().includes('prix max d')) {
      continue; // Skip comments/headers
    }
    
    const condition = cols[1]?.trim() || 'TBE';
    const retailPrice = parseFloat(cols[2]?.replace(',', '.') || '0') || 0;
    const maxBuyPrice = parseFloat(cols[3]?.replace(',', '.') || '0') || 0;
    const minSellPrice = parseFloat(cols[4]?.replace(',', '.') || '0') || 0;
    const maxSellPrice = parseFloat(cols[5]?.replace(',', '.') || '0') || 0;
    const notes = cols[7]?.trim() || '';
    
    // Series and Volume extraction
    let series = title;
    let volumeRange = 'Tome Unique / Lot';
    
    const match = title.match(/(.*?)\s+(\d+\s+a\s+\d+|\d+\s+et\s+\+)/i);
    if (match) {
      series = match[1].trim();
      volumeRange = match[2].trim().replace(/\s+a\s+/i, ' à ').replace(/\s+et\s+\+/i, ' & +');
    } else if (title.includes('Collector')) {
      const parts = title.split(/Collector/i);
      series = parts[0].trim();
      volumeRange = 'Collector';
    }
    
    // Dynamic hype and popularity score
    const hypeScore = Math.floor(Math.random() * 40) + 50; // Random default 50-90
    const popularity = hypeScore >= 80 ? 'Très forte' : hypeScore >= 65 ? 'Forte' : hypeScore >= 50 ? 'Moyenne' : 'Faible';
    
    parsedMangas.push({
      id: generateSlug(title),
      title,
      series,
      volumeRange,
      condition,
      retailPrice,
      maxBuyPrice,
      minSellPrice,
      maxSellPrice,
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
  
  // Clean double quotes
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
    m.title,
    m.condition,
    m.retailPrice.toString().replace('.', ','),
    m.maxBuyPrice.toString().replace('.', ','),
    m.minSellPrice.toString().replace('.', ','),
    m.maxSellPrice.toString().replace('.', ','),
    m.hypeScore >= 75 ? '⭐ Excellent' : m.hypeScore >= 60 ? '👍 Bon' : '⚠️ Moyen',
    m.notes
  ]);
  
  const csvContent = [
    '🎌  MANGA PRICE TRACKER  —  Vinted;;;;;;;', // Excel header title line
    headers.join(delimiter),
    ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(delimiter))
  ].join('\n');
  
  return csvContent;
}
