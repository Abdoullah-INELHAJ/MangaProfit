import { NextResponse } from 'next/server';
import { persistentCache } from '../../../lib/persistentCache';

// Global Server-Side Monitoring Metrics (simplified)
let totalVintedRequests = 0;
let total403Errors = 0;
let cacheHits = 0;
let cacheMisses = 0;

// Server IP address cache
let serverIpCached = '';
let isFetchingIp = false;

// Vinted Token Cache
let cachedCookie = '';
let cachedToken = '';
let tokenFetchedAt = 0;

// Queue system for Vinted requests (ensures max 1 query executing at any time)
let vintedQueueChain = Promise.resolve();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retrieve server IP address
async function fetchServerIp() {
  if (serverIpCached || isFetchingIp) return;
  isFetchingIp = true;
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (res.ok) {
      const data = await res.json();
      serverIpCached = data.ip || 'Inconnue';
      console.log(`[Server IP] IP verified: ${serverIpCached}`);
    }
  } catch (err) {
    console.error("[Server IP] Failed to fetch server IP:", err);
  } finally {
    isFetchingIp = false;
  }
}

// Handshake to fetch Vinted cookies (unused now, kept for backward compatibility/simplicity)
async function fetchTokens() {
  console.log("[Vinted API] Skipping handshake as we use HTML scraping.");
}

// Sequential queue wrapper for Vinted queries
function queueVintedRequest(fn: () => Promise<any>): Promise<any> {
  const result = vintedQueueChain.then(fn);
  vintedQueueChain = result.catch(() => {});
  return result;
}

async function fetchCatalog(query: string, catalogIds = '', retry = true): Promise<any[]> {
  // Anti-Blocking jitter
  const jitter = Math.floor(Math.random() * 500) + 200;
  await delay(jitter);

  totalVintedRequests++;

  // Build target Vinted web url
  let url = `https://www.vinted.fr/vetements?search_text=${encodeURIComponent(query)}`;
  if (catalogIds) {
    // Correct query parameter for public catalog search filter
    url += `&catalog_id=${catalogIds}`;
  }
  url += `&order=newest_first`;

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9"
  };

  const res = await fetch(url, { headers, next: { revalidate: 0 } });
  
  if (res.status === 403) {
    total403Errors++;
    throw new Error("Vinted a retourné un code 403. Essayez de relancer ou d'attendre quelques secondes.");
  }

  if (!res.ok) {
    throw new Error(`Erreur lors du scraping Vinted (Status: ${res.status})`);
  }

  const html = await res.text();
  const index = html.indexOf('\\"items\\":[');
  
  if (index === -1) {
    if (html.includes('\\"items\\":[]')) {
      return [];
    }
    throw new Error("Impossible de trouver le payload des annonces dans la page Vinted.");
  }

  const startIndex = index + 10;
  let bracketCount = 0;
  let endIndex = -1;

  for (let i = startIndex; i < html.length; i++) {
    const char = html[i];
    if (char === '[') {
      bracketCount++;
    } else if (char === ']') {
      bracketCount--;
      if (bracketCount === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new Error("Erreur lors du parsing des crochets du flux d'annonces.");
  }

  const rawChunk = html.substring(startIndex, endIndex + 1);

  // Unescape JSON from NextJS flight data format inside the HTML push scripts
  const processed = rawChunk
    .replace(/\\\\"/g, '__ESCAPED_QUOTE__')
    .replace(/\\"/g, '"')
    .replace(/__ESCAPED_QUOTE__/g, '\\"')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');

  const items = JSON.parse(processed);
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item: any) => {
    let priceNum = 0;
    if (item?.price) {
      if (typeof item.price === 'object') {
        priceNum = parseFloat(item.price.amount || '0');
      } else {
        priceNum = parseFloat(item.price);
      }
    }
    
    let imageUrl = '';
    if (item?.photos && item.photos.length > 0 && item.photos[0]?.url) {
      imageUrl = item.photos[0].url;
    } else if (item?.photo?.url) {
      imageUrl = item.photo.url;
    }
    
    let itemUrl = item?.url || item?.path || '';
    if (itemUrl && !itemUrl.startsWith('http')) {
      itemUrl = `https://www.vinted.fr${itemUrl}`;
    }

    return {
      id: String(item?.id || Math.random().toString()),
      title: item?.title || 'Annonce Vinted',
      price: priceNum,
      url: itemUrl,
      imageUrl: imageUrl,
      condition: item?.status || item?.item_box?.second_line || 'Bon état',
      description: item?.item_box?.accessibility_label || 'Pas de description disponible.'
    };
  }).sort((a: any, b: any) => Number(b.id) - Number(a.id));
}

const NEGATIVE_KEYWORDS = [
  'carte', 'cards', 'booster', 'carddass', 't-shirt', 'tshirt', 'pull', 'sweat',
  'mug', 'figurine', 'figma', 'nendoroid', 'poster', 'badge', 'porte-clé', 'keychain',
  'drapeau', 'peluche', 'plaid', 'casquette', 'chaussettes', 'sac', 'cosplay',
  'jeu', 'console', 'switch', 'ps4', 'ps5', 'xbox', 'tome unique vide', 'classeur',
  'box vide', 'boite vide', 'funko', 'pop', 'jeux', 'deck', 'collier', 'bracelet'
];

async function verifyItemIsBook(item: { id: string; title: string; imageUrl: string }): Promise<boolean> {
  // 1. Check title against local negative keywords (instant filter, saves API calls)
  const normalizedTitle = item.title.toLowerCase();
  const matchesKeyword = NEGATIVE_KEYWORDS.find(kw => normalizedTitle.includes(kw));
  if (matchesKeyword) {
    console.log(`[Server Filter] Keyword exclusion: "${item.title}" contains "${matchesKeyword}"`);
    return false;
  }

  // 2. Check persistent OpenAI Cache (survives app restarts)
  const cached = persistentCache.getOpenAi(item.id);
  if (cached !== null) {
    return cached.is_book;
  }

  // If no image, assume it's a book by default to avoid false exclusions
  if (!item.imageUrl) {
    return true;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return true; // Skip AI check if key is not configured
  }

  try {
    console.log(`[Server AI Classifier] Running vision check for item ${item.id} ("${item.title}")`);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this Vinted listing image and its title: "${item.title}". Determine if the main product shown in the image is a book (manga volume, novel, comic book, or light novel). Respond strictly in JSON format with two keys: "is_book" (boolean) and "reason" (string, short explanation in French). Do not include any markdown formatting like \`\`\`json.`
              },
              {
                type: "image_url",
                image_url: {
                  url: item.imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 120,
        response_format: { type: "json_object" }
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.choices && data.choices[0]) {
        const parsed = JSON.parse(data.choices[0].message.content);
        persistentCache.setOpenAi(item.id, parsed);
        console.log(`[Server AI Classifier Result] Item ${item.id}: is_book=${parsed.is_book} - ${parsed.reason}`);
        return parsed.is_book;
      }
    } else {
      const errTxt = await res.text();
      console.error(`[Server AI Classifier Error] Vinted item ${item.id} classification failed:`, errTxt);
    }
  } catch (err) {
    console.error(`[Server AI Classifier Exception] Exception for item ${item.id}:`, err);
  }

  return true; // Fallback to true if OpenAI call fails
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const catalogIds = searchParams.get('catalog_ids') || '';
    
    if (!query.trim()) {
      return NextResponse.json({ items: [] });
    }

    fetchServerIp();

    const cacheKey = `${query.toLowerCase().trim()}_cat_${catalogIds}`;
    
    // Check persistent search cache
    const cachedData = persistentCache.getSearch(cacheKey, 10000);
    if (cachedData) {
      cacheHits++;
      return NextResponse.json({ 
        items: cachedData, 
        cached: true,
        serverIp: serverIpCached || 'Verification...',
        stats: {
          totalVintedRequests,
          total403Errors,
          cacheHits,
          cacheMisses
        }
      });
    }

    cacheMisses++;
    
    // Queue Vinted request
    const allItems = await queueVintedRequest(() => fetchCatalog(query, catalogIds));
    
    // Limit to top 25 items for parallel server-side verification to avoid high latency or rate limits
    const itemsToVerify = allItems.slice(0, 25);
    const verificationResults = await Promise.all(
      itemsToVerify.map((item: any) => verifyItemIsBook(item))
    );
    
    // Filter and return only items verified as books/mangas
    const verifiedItems = itemsToVerify.filter((_: any, index: number) => verificationResults[index]);

    // Save to persistent cache
    persistentCache.setSearch(cacheKey, verifiedItems);
    persistentCache.clearExpired(10000);

    return NextResponse.json({ 
      items: verifiedItems, 
      cached: false,
      serverIp: serverIpCached || 'Verification...',
      stats: {
        totalVintedRequests,
        total403Errors,
        cacheHits,
        cacheMisses
      }
    });
  } catch (error: any) {
    console.error("[Vinted API] Request failed:", error);
    return NextResponse.json({ 
      items: [], 
      error: "Une erreur est survenue lors de la communication avec Vinted.",
      details: error.message || String(error),
      serverIp: serverIpCached || 'Verification...',
      stats: {
        totalVintedRequests,
        total403Errors,
        cacheHits,
        cacheMisses
      }
    }, { status: 200 });
  }
}
