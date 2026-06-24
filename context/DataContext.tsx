'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Manga } from '../lib/defaultData';
import { getMangas, saveMangas, isLocalStorageAvailable } from '../lib/dbAdapter';

interface Filters {
  condition: string;
  series: string;
  tag: string;
  sortBy: 'title' | 'roi' | 'margin' | 'popularity' | 'retailPrice';
  sortOrder: 'asc' | 'desc';
}

interface DataContextType {
  mangas: Manga[];
  filteredMangas: Manga[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  toggleFavorite: (id: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  updateMangaList: (newList: Manga[]) => void;
  resetDatabase: () => void;
  allSeries: string[];
  allTags: string[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [filteredMangas, setFilteredMangas] = useState<Manga[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({
    condition: 'Tous',
    series: 'Toutes',
    tag: 'Tous',
    sortBy: 'popularity',
    sortOrder: 'desc'
  });

  // Load initial data
  useEffect(() => {
    const data = getMangas();
    setMangas(data);
    setIsLoading(false);
  }, []);

  // Sync to local storage when state changes
  const updateMangaList = (newList: Manga[]) => {
    setMangas(newList);
    saveMangas(newList);
  };

  // Toggle favorite status
  const toggleFavorite = (id: string) => {
    const updated = mangas.map(m => {
      if (m.id === id) {
        return { ...m, isFavorite: !m.isFavorite };
      }
      return m;
    });
    updateMangaList(updated);
  };

  // Add tag to manga
  const addTag = (id: string, tag: string) => {
    const formattedTag = tag.trim().toLowerCase();
    if (!formattedTag) return;
    
    const updated = mangas.map(m => {
      if (m.id === id) {
        const currentTags = m.tags || [];
        if (currentTags.includes(formattedTag)) return m;
        return { ...m, tags: [...currentTags, formattedTag] };
      }
      return m;
    });
    updateMangaList(updated);
  };

  // Remove tag from manga
  const removeTag = (id: string, tag: string) => {
    const updated = mangas.map(m => {
      if (m.id === id) {
        const currentTags = m.tags || [];
        return { ...m, tags: currentTags.filter(t => t !== tag) };
      }
      return m;
    });
    updateMangaList(updated);
  };

  // Reset database back to default Excel seed
  const resetDatabase = () => {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem('mangaprofit_data');
      localStorage.removeItem('mangaprofit_favorites');
      localStorage.removeItem('mangaprofit_tags');
    }
    const data = getMangas();
    setMangas(data);
  };

  // Helper calculation values for filtering & sorting
  const getMangaROI = (m: Manga): number => {
    if (m.maxBuyPrice <= 0) return 0;
    const margin = m.minSellPrice - m.maxBuyPrice;
    return (margin / m.maxBuyPrice) * 100;
  };

  const getMangaMargin = (m: Manga): number => {
    return m.minSellPrice - m.maxBuyPrice;
  };

  const getMangaPopularityValue = (m: Manga): number => {
    return m.hypeScore;
  };

  // Apply filters and search query
  useEffect(() => {
    let result = [...mangas];

    // Search query with simple spelling tolerance / substring match
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(m => {
        const titleMatch = m.title.toLowerCase().includes(query);
        const seriesMatch = m.series.toLowerCase().includes(query);
        
        // Simple typo tolerance (levenshtein distance distance 1 or 2, simplified)
        // Check if characters of query appear sequentially in title
        let charIdx = 0;
        for (let i = 0; i < m.title.length && charIdx < query.length; i++) {
          if (m.title[i].toLowerCase() === query[charIdx]) {
            charIdx++;
          }
        }
        const typoMatch = charIdx === query.length;
        
        return titleMatch || seriesMatch || typoMatch;
      });
    }

    // Condition filter
    if (filters.condition !== 'Tous') {
      result = result.filter(m => m.condition === filters.condition);
    }

    // Series/Category filter
    if (filters.series !== 'Toutes') {
      result = result.filter(m => m.series === filters.series);
    }

    // Custom Tag filter
    if (filters.tag !== 'Tous') {
      result = result.filter(m => m.tags && m.tags.includes(filters.tag.toLowerCase()));
    }

    // Sort operations
    result.sort((a, b) => {
      let valA: any = a.title.toLowerCase();
      let valB: any = b.title.toLowerCase();

      if (filters.sortBy === 'roi') {
        valA = getMangaROI(a);
        valB = getMangaROI(b);
      } else if (filters.sortBy === 'margin') {
        valA = getMangaMargin(a);
        valB = getMangaMargin(b);
      } else if (filters.sortBy === 'popularity') {
        valA = getMangaPopularityValue(a);
        valB = getMangaPopularityValue(b);
      } else if (filters.sortBy === 'retailPrice') {
        valA = a.retailPrice;
        valB = b.retailPrice;
      }

      if (valA < valB) return filters.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredMangas(result);
  }, [mangas, searchQuery, filters]);

  // Extract all unique series
  const allSeries = Array.from(new Set(mangas.map(m => m.series))).sort();

  // Extract all unique tags
  const allTags = Array.from(
    new Set(
      mangas.reduce<string[]>((acc, m) => {
        if (m.tags) acc.push(...m.tags);
        return acc;
      }, [])
    )
  ).sort();

  return (
    <DataContext.Provider
      value={{
        mangas,
        filteredMangas,
        isLoading,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        toggleFavorite,
        addTag,
        removeTag,
        updateMangaList,
        resetDatabase,
        allSeries,
        allTags
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
