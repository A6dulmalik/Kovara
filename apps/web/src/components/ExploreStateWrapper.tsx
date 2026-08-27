import React from 'react';

interface ExploreStateWrapperProps {
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}

export const ExploreStateWrapper: React.FC<ExploreStateWrapperProps> = ({
  isLoading,
  error,
  isEmpty,
  onRetry,
  children,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="text-gray-500">Loading explore results...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-red-600 mb-4">Failed to load explore results: {error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-gray-600 mb-2">No results found</p>
        <p className="text-sm text-gray-400">Try adjusting your search query or filters to find what you're looking for.</p>
      </div>
    );
  }

  return <>{children}</>;
};