'use client';

import { useState } from 'react';

export function useCreatePost() {
  const [loading, setLoading] = useState(false);

  const createPost = async (
    content: string
  ) => {
    setLoading(true);
      // onPress={() => router.push("/connect" as Parameters<typeof router.push>[0])}

    try {
      const response = await fetch(
        '/api/posts/create',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            content,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          'Failed to create post'
        );
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    createPost,
  };
}