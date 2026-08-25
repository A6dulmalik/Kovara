import { useState, useEffect, useCallback } from 'react';

interface SearchParams {
  query: string;
  limit?: number;
}

export function useExploreSearch({ query, limit = 20 }: SearchParams) {
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Reset pagination state when the active search query changes
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
  }, [query]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/indexer/search?q=${encodeURIComponent(query)}&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`
      );
      const data = await response.json();

      setItems((prevItems) => {
        // Prevent duplicate entries by filtering against existing IDs
        const existingIds = new Set(prevItems.map((item) => item.id));
        const uniqueNewItems = data.results.filter((item: any) => !existingIds.has(item.id));
        return [...prevItems, ...uniqueNewItems];
      });

      setCursor(data.nextCursor || null);
      setHasMore(data.hasMore ?? false);
    } catch (error) {
      console.error('Failed to fetch explore search results:', error);
    } finally {
      setIsLoading(false);
    }
  }, [query, cursor, hasMore, isLoading, limit]);

  return { items, loadMore, hasMore, isLoading };
}