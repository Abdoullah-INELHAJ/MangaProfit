import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'vinted_cache.json');

interface CacheData {
  searchCache: Record<string, { timestamp: number; data: any[] }>;
  openAiCache: Record<string, { timestamp: number; data: any }>;
}

let cacheMemory: CacheData = {
  searchCache: {},
  openAiCache: {}
};

// Load cache from disk at startup
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cacheMemory = {
      searchCache: parsed.searchCache || {},
      openAiCache: parsed.openAiCache || {}
    };
    console.log(`[Cache] Loaded persistent cache from disk (${Object.keys(cacheMemory.openAiCache).length} AI entries).`);
  }
} catch (err) {
  console.error("[Cache] Failed to load cache from disk:", err);
}

function saveCacheToDisk() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheMemory, null, 2), 'utf8');
  } catch (err) {
    console.error("[Cache] Failed to save cache to disk:", err);
  }
}

export const persistentCache = {
  getSearch(key: string, ttlMs: number): any[] | null {
    const entry = cacheMemory.searchCache[key];
    if (entry && (Date.now() - entry.timestamp < ttlMs)) {
      return entry.data;
    }
    return null;
  },
  setSearch(key: string, data: any[]) {
    cacheMemory.searchCache[key] = {
      timestamp: Date.now(),
      data
    };
    saveCacheToDisk();
  },
  getOpenAi(key: string): any | null {
    const entry = cacheMemory.openAiCache[key];
    // Keep OpenAI cache for 24 hours
    if (entry && (Date.now() - entry.timestamp < 24 * 60 * 60 * 1000)) {
      return entry.data;
    }
    return null;
  },
  setOpenAi(key: string, data: any) {
    cacheMemory.openAiCache[key] = {
      timestamp: Date.now(),
      data
    };
    saveCacheToDisk();
  },
  clearExpired(searchTtlMs: number) {
    const now = Date.now();
    let changed = false;
    for (const [k, v] of Object.entries(cacheMemory.searchCache)) {
      if (now - v.timestamp > searchTtlMs) {
        delete cacheMemory.searchCache[k];
        changed = true;
      }
    }
    for (const [k, v] of Object.entries(cacheMemory.openAiCache)) {
      if (now - v.timestamp > 24 * 60 * 60 * 1000) {
        delete cacheMemory.openAiCache[k];
        changed = true;
      }
    }
    if (changed) {
      saveCacheToDisk();
    }
  }
};
export default persistentCache;
