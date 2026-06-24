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
    }
  } catch (err) {
    console.error("[Server IP] Failed to fetch server IP:", err);
  } finally {
    isFetchingIp = false;
  }
}

// Sequential queue wrapper for Vinted queries
function queueVintedRequest(fn: () => Promise<any>): Promise<any> {
  const result = vintedQueueChain.then(fn);
  vintedQueueChain = result.catch(() => {});
  return result;
}

/**
 * Extracts a JSON array from a string starting at `startAt` (which must point to '[').
 * Correctly handles nested arrays/objects and ignores brackets inside JSON strings.
 */
function extractJsonArray(source: string, startAt: number): string | null {
  let i = startAt;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (; i < source.length; i++) {
    const ch = source[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return source.substring(startAt, i + 1);
    }
  }
  return null;
}

/**
 * Unescape Next.js flight data (double-encoded JSON inside HTML scripts).
 * Handles the \" -> " conversion carefully to avoid breaking valid JSON escapes.
 */
function unescapeFlightData(raw: string): string {
  // Replace \\" (escaped-backslash + quote) with placeholder before unescaping quotes
  return raw
    .replace(/\\\\"/g, '\x00DQ\x00')
    .replace(/\\"/g, '"')
    .replace(/\x00DQ\x00/g, '\\"')
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u2019/gi, "'")
    .replace(/\\u00[0-9a-f]{2}/gi, (m) => {
      try { return JSON.parse(`"${m}"`); } catch { return m; }
    })
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, '')
    .replace(/\\\\/g, '\\');
}

/**
 * Maps raw Vinted item objects to our normalized format and sorts by ID descending.
 */
function mapItems(items: any[]): any[] {
  return items
    .filter((item: any) => item && item.id)
    .map((item: any) => {
      let priceNum = 0;
      if (item?.price) {
        priceNum = typeof item.price === 'object'
          ? parseFloat(item.price.amount || '0')
          : parseFloat(item.price);
      }

      let imageUrl = '';
      if (item?.photos?.length > 0 && item.photos[0]?.url) {
        imageUrl = item.photos[0].url;
      } else if (item?.photo?.url) {
        imageUrl = item.photo.url;
      }

      let itemUrl = item?.url || item?.path || '';
      if (itemUrl && !itemUrl.startsWith('http')) {
        itemUrl = `https://www.vinted.fr${itemUrl}`;
      }

      return {
        id: String(item.id),
        title: item?.title || 'Annonce Vinted',
        price: priceNum,
        url: itemUrl,
        imageUrl,
        condition: item?.status || item?.item_box?.second_line || 'Bon état',
        description: item?.item_box?.accessibility_label || item?.description || 'Pas de description disponible.'
      };
    })
    .sort((a: any, b: any) => Number(b.id) - Number(a.id));
}

async function fetchCatalog(query: string, catalogIds = ''): Promise<any[]> {
  // Anti-Blocking jitter
  const jitter = Math.floor(Math.random() * 500) + 200;
  await delay(jitter);

  totalVintedRequests++;

  // /catalog supports catalog_id filtering for all categories
  let url = `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(query)}`;
  if (catalogIds) url += `&catalog_id=${catalogIds}`;
  url += `&order=newest_first`;

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Cache-Control": "no-cache",
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

  // ─── Strategy 1: __NEXT_DATA__ script tag (clean JSON, most reliable) ─────
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const candidates = [
        nextData?.props?.pageProps?.items,
        nextData?.props?.pageProps?.catalogItems?.items,
        nextData?.props?.pageProps?.catalog?.items,
        nextData?.props?.pageProps?.searchResults?.items,
      ];
      for (const c of candidates) {
        if (Array.isArray(c) && c.length > 0) {
          console.log(`[Vinted] Strategy 1 (__NEXT_DATA__): ${c.length} items`);
          return mapItems(c);
        }
      }
    } catch (e) {
      console.warn('[Vinted] Strategy 1 failed:', (e as Error).message?.slice(0, 80));
    }
  }

  // ─── Strategy 2: Flight data - scan for \"items\":[ occurrences ─────────────
  const MARKER = '\\"items\\":[';
  let searchFrom = 0;
  let attempt = 0;

  while (attempt < 8) {
    attempt++;
    const markerIdx = html.indexOf(MARKER, searchFrom);
    if (markerIdx === -1) break;

    const arrayStart = markerIdx + MARKER.length - 1; // points to '['
    const rawChunk = extractJsonArray(html, arrayStart);

    if (!rawChunk || rawChunk === '[]') {
      searchFrom = markerIdx + 1;
      continue;
    }

    try {
      const unescaped = unescapeFlightData(rawChunk);
      const parsed = JSON.parse(unescaped);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
        console.log(`[Vinted] Strategy 2 (flight, attempt ${attempt}): ${parsed.length} items`);
        return mapItems(parsed);
      }
    } catch (e) {
      // Log only first 100 chars of error to avoid noise
      console.warn(`[Vinted] Strategy 2 attempt ${attempt} (len=${rawChunk.length}): ${(e as Error).message?.slice(0, 100)}`);
    }

    searchFrom = markerIdx + 1;
  }

  // ─── Strategy 3: Inline scripts with unescaped "items":[ ─────────────────
  const inlineScriptRe = /<script[^>]*>([\s\S]{50,}?)<\/script>/g;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = inlineScriptRe.exec(html)) !== null) {
    const script = scriptMatch[1];
    if (!script.includes('"items":[')) continue;

    const idx = script.indexOf('"items":[');
    const arrayStart = idx + '"items":'.length;
    const chunk = extractJsonArray(script, arrayStart);
    if (!chunk || chunk === '[]') continue;

    try {
      const parsed = JSON.parse(chunk);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
        console.log(`[Vinted] Strategy 3 (inline script): ${parsed.length} items`);
        return mapItems(parsed);
      }
    } catch (_) { /* try next */ }
  }

  console.warn('[Vinted] All strategies failed, returning empty array');
  return [];
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
        stats: { totalVintedRequests, total403Errors, cacheHits, cacheMisses }
      });
    }

    cacheMisses++;

    // Queue Vinted request
    const allItems = await queueVintedRequest(() => fetchCatalog(query, catalogIds));

    // Save to persistent cache
    persistentCache.setSearch(cacheKey, allItems);
    persistentCache.clearExpired(10000);

    return NextResponse.json({
      items: allItems,
      cached: false,
      serverIp: serverIpCached || 'Verification...',
      stats: { totalVintedRequests, total403Errors, cacheHits, cacheMisses }
    });

  } catch (error: any) {
    console.error("[Vinted API] Request failed:", error);
    return NextResponse.json({
      items: [],
      error: "Une erreur est survenue lors de la communication avec Vinted.",
      details: error.message || String(error),
      serverIp: serverIpCached || 'Verification...',
      stats: { totalVintedRequests, total403Errors, cacheHits, cacheMisses }
    }, { status: 200 });
  }
}
