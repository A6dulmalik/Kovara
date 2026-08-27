import React, { useState } from 'react';
import { useExploreSearch } from '../hooks/useExploreSearch';

export const ExplorePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { items, loadMore, hasMore, isLoading } = useExploreSearch({ query: searchQuery });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <input
        type="text"
        placeholder="Search explore records..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 border rounded-md"
      />

      <div className="grid grid-cols-1 gap-4">
        {items.map((item) => (
          <div key={item.id} className="p-4 border rounded-lg shadow-sm">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-gray-600">{item.description}</p>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isLoading}
          className="w-full py-2 bg-gray-200 rounded-md font-medium"
        >
          {isLoading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
};