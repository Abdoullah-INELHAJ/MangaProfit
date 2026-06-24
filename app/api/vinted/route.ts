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

// Handshake to fetch Vinted cookies
async function fetchTokens() {
  try {
    console.log("[Vinted API] Handshake cookies negotiation...");
    const homeRes = await fetch("https://www.vinted.fr", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9"
      },
      next: { revalidate: 0 }
    });

    if (homeRes.status === 403) {
      total403Errors++;
      throw new Error("Vinted blocked handshake with 403 Forbidden");
    }

    const setCookieHeaders = homeRes.headers.getSetCookie ? homeRes.headers.getSetCookie() : [];
    let accessToken = '';
    let cleanCookies: Record<string, string> = {};
    
    for (const header of setCookieHeaders) {
      if (header) {
        const parts = header.split(';');
        const pair = parts[0].split('=');
        if (pair.length >= 2) {
          const key = pair[0].trim();
          const val = pair.slice(1).join('=').trim();
          if (val) {
            cleanCookies[key] = val;
            if (key === 'access_token_web') {
              accessToken = val;
            }
          }
        }
      }
    }
    
    const cookieString = Object.entries(cleanCookies).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookieString) {
      cachedCookie = cookieString;
      cachedToken = accessToken;
      tokenFetchedAt = Date.now();
    }
  } catch (err) {
    console.error("[Vinted API] Handshake failed:", err);
  }
}

// Sequential queue wrapper for Vinted queries
function queueVintedRequest(fn: () => Promise<any>): Promise<any> {
  const result = vintedQueueChain.then(fn);
  vintedQueueChain = result.catch(() => {});
  return result;
}

async function fetchCatalog(query: string, catalogIds = '', retry = true): Promise<any[]> {
  if (!cachedCookie || (Date.now() - tokenFetchedAt > 10 * 60 * 1000)) {
    await fetchTokens();
  }

  // Anti-Blocking jitter
  const jitter = Math.floor(Math.random() * 1000) + 500;
  await delay(jitter);

  totalVintedRequests++;
  let url = `https://www.vinted.fr/api/v2/catalog/items?search_text=${encodeURIComponent(query)}&per_page=20&order=newest_first`;
  if (catalogIds) {
    url += `&catalog_ids=${catalogIds}`;
  }
  
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Cookie": cachedCookie
  };

  if (cachedToken) {
    headers["Authorization"] = `Bearer ${cachedToken}`;
  }

  const res = await fetch(url, { headers, next: { revalidate: 0 } });
  
  if (res.status === 403) {
    total403Errors++;
    throw new Error("Vinted search returned 403 Forbidden");
  }

  if (res.status === 401 && retry) {
    cachedCookie = '';
    cachedToken = '';
    return fetchCatalog(query, catalogIds, false);
  }

  if (!res.ok) {
    throw new Error(`Vinted search failed: ${res.status}`);
  }

  const data = await res.json();
  const items = data?.items || [];
  
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
    
    let itemUrl = item?.url || '';
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
  });
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
    
    // Check persistent search cache (survives restarts, TTL 10s max as requested)
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
    const items = await queueVintedRequest(() => fetchCatalog(query, catalogIds));
    
    // Save to persistent cache
    persistentCache.setSearch(cacheKey, items);
    persistentCache.clearExpired(10000);

    return NextResponse.json({ 
      items, 
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
