import { NextResponse } from 'next/server';
import { analyzeListingAI } from '../../../lib/vintedAi';
import { persistentCache } from '../../../lib/persistentCache';

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Global Server-Side Monitoring Metrics
let totalVintedRequests = 0;
let total403Errors = 0;
let total429Errors = 0;
let cacheHits = 0;
let cacheMisses = 0;
let openAiCalls = 0;
let estimatedOpenAiCost = 0; // in USD

// Server IP address cache
let serverIpCached = '';
let isFetchingIp = false;

// Cache Mode
const CACHE_DURATION_MS = 5000; // 5 seconds cache for near-instant search updates

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

// OpenAI API batch calls with rate limits, retries, and cost estimation

// OpenAI API batch calls with rate limits, retries, and cost estimation
async function callOpenAIBatch(batchItems: any[], searchQuery: string, retryCount = 0): Promise<Record<string, any>> {
  if (batchItems.length === 0) return {};
  
  // Rate Limit: enforce spacing
  await delay(1200);

  try {
    const payload = batchItems.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description.substring(0, 250),
      price: item.price
    }));

    openAiCalls++;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a Vinted manga search assistant. Analyze the Vinted listings and return a JSON object. The keys must be the item 'id's. Each value must be an object with fields: 'isManga' (boolean), 'type' ('lot' | 'unité' | 'collection'), 'startVolume' (integer), 'endVolume' (integer), 'totalVolumes' (integer), 'mangaName' (string, normalized title of the series), 'confidence' (integer, 0-100), 'aiVerdict' (string, 1-sentence diagnostic explanation in French)."
          },
          {
            role: "user",
            content: `Search query: "${searchQuery}". Analyze this batch:\n` + JSON.stringify(payload)
          }
        ]
      })
    });

    if (response.status === 429) {
      total429Errors++;
      const delayMs = Math.pow(2, retryCount) * 1500 + Math.random() * 500;
      console.warn(`[OpenAI] 429 Rate Limit. Retrying in ${Math.round(delayMs)}ms...`);
      await delay(delayMs);
      return callOpenAIBatch(batchItems, searchQuery, retryCount + 1);
    }

    if (!response.ok) {
      throw new Error(`OpenAI HTTP ${response.status}`);
    }

    const result = await response.json();
    
    // Estimate Cost (gpt-4o-mini rates: $0.15/1M input tokens, $0.60/1M output tokens)
    const promptTokens = result.usage?.prompt_tokens || 1000;
    const completionTokens = result.usage?.completion_tokens || 500;
    const cost = (promptTokens * 0.15 / 1000000) + (completionTokens * 0.60 / 1000000);
    estimatedOpenAiCost += cost;

    return JSON.parse(result.choices[0].message.content);
  } catch (err) {
    console.error("[OpenAI] Batch call error:", err);
    return {};
  }
}

// Sequential queue wrapper for Vinted queries
function queueVintedRequest(fn: () => Promise<any>): Promise<any> {
  const result = vintedQueueChain.then(fn);
  // Prevent queue chain rejection blocking next items
  vintedQueueChain = result.catch(() => {});
  return result;
}

async function fetchCatalog(query: string, catalogIds = '', retry = true): Promise<any[]> {

  if (!cachedCookie || (Date.now() - tokenFetchedAt > 10 * 60 * 1000)) {
    await fetchTokens();
  }

  // Anti-Blocking: Add random jitter (500ms to 2000ms delay) before Vinted request
  const jitter = Math.floor(Math.random() * 1500) + 500;
  await delay(jitter);

  totalVintedRequests++;
  let url = `https://www.vinted.fr/api/v2/catalog/items?search_text=${encodeURIComponent(query)}&per_page=15&order=newest_first`;
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
  
  const rawListings = items.map((item: any) => {
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

  const needsOpenAiAnalysis: any[] = [];
  const localAnalysisResults = rawListings.map((lst: any) => {
    const cacheKey = `${lst.id}-${lst.price}`;
    
    // Check OpenAI persistent cache
    const cachedAi = persistentCache.getOpenAi(cacheKey);
    if (cachedAi) {
      return {
        ...lst,
        ai: cachedAi
      };
    }

    // Local pre-analysis (80% Rule)
    const localResult = analyzeListingAI(lst.title, lst.description, lst.price, query);
    if (localResult.confidence >= 80 && localResult.isManga) {
      const localExtended = {
        ...localResult,
        isExternalAI: false
      };
      persistentCache.setOpenAi(cacheKey, localExtended);
      return {
        ...lst,
        ai: localExtended
      };
    }

    // Unconfident -> Queue for OpenAI Batch
    needsOpenAiAnalysis.push(lst);
    return lst;
  });

  if (needsOpenAiAnalysis.length > 0) {
    try {
      const openAiResults = await callOpenAIBatch(needsOpenAiAnalysis, query);
      
      return localAnalysisResults.map((lst: any) => {
        const cacheKey = `${lst.id}-${lst.price}`;
        
        if (openAiResults && openAiResults[lst.id]) {
          const res = openAiResults[lst.id];
          const enriched = {
            isManga: Boolean(res.isManga),
            type: String(res.type || 'lot') as 'lot' | 'unité' | 'collection',
            startVolume: Number(res.startVolume || 1),
            endVolume: Number(res.endVolume || 1),
            totalVolumes: Number(res.totalVolumes || 1),
            mangaName: String(res.mangaName || query),
            confidence: Number(res.confidence || 85),
            aiVerdict: String(res.aiVerdict || "Analyse OpenAI effectuée."),
            isExternalAI: true
          };
          persistentCache.setOpenAi(cacheKey, enriched);
          return {
            ...lst,
            ai: enriched
          };
        }

        // Check if we requested it but it failed -> return fallback
        if (needsOpenAiAnalysis.some(item => item.id === lst.id)) {
          const fallback = {
            ...analyzeListingAI(lst.title, lst.description, lst.price, query),
            isExternalAI: false
          };
          persistentCache.setOpenAi(cacheKey, fallback);
          return {
            ...lst,
            ai: fallback
          };
        }

        return lst;
      });
    } catch (err) {
      console.error("[Vinted API] OpenAI batch call error, returning local fallbacks:", err);
    }
  }

  return localAnalysisResults;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const catalogIds = searchParams.get('catalog_ids') || '';
    
    if (!query.trim()) {
      return NextResponse.json({ items: [] });
    }

    // Try fetching IP address asynchronously
    fetchServerIp();

    const cacheKey = `${query.toLowerCase().trim()}_cat_${catalogIds}`;
    
    // Check persistent search cache (survives restarts, TTL 30s as requested)
    const cachedData = persistentCache.getSearch(cacheKey, CACHE_DURATION_MS);
    if (cachedData) {
      cacheHits++;
      console.log(`[Cache Hit] Serving persistent cached results for query: "${query}"`);
      return NextResponse.json({ 
        items: cachedData, 
        cached: true,
        serverIp: serverIpCached || 'Verification...',
        stats: {
          totalVintedRequests,
          total403Errors,
          total429Errors,
          cacheHits,
          cacheMisses,
          openAiCalls,
          estimatedOpenAiCost: Number(estimatedOpenAiCost.toFixed(5)),
          cooldownActive: false
        }
      });
    }

    cacheMisses++;
    
    // Queue Vinted request sequentially (Step 2)
    const items = await queueVintedRequest(() => fetchCatalog(query, catalogIds));
    
    // Save to persistent cache
    persistentCache.setSearch(cacheKey, items);

    // Clean expired cache items in background
    persistentCache.clearExpired(CACHE_DURATION_MS);

    return NextResponse.json({ 
      items, 
      cached: false,
      serverIp: serverIpCached || 'Verification...',
      stats: {
        totalVintedRequests,
        total403Errors,
        total429Errors,
        cacheHits,
        cacheMisses,
        openAiCalls,
        estimatedOpenAiCost: Number(estimatedOpenAiCost.toFixed(5)),
        cooldownActive: false
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
        total429Errors,
        cacheHits,
        cacheMisses,
        openAiCalls,
        estimatedOpenAiCost: Number(estimatedOpenAiCost.toFixed(5)),
        cooldownActive: false
      }
    }, { status: 200 });
  }
}
