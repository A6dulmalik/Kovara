// hooks/useProfile.ts

import { useEffect, useState } from 'react';
import { getProfile } from '@/lib/contracts/profile';

export function useProfile(address?: string) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
      // onPress={() => router.push("/connect" as Parameters<typeof router.push>[0])}

    async function load() {
      setLoading(true);

      try {
        const result = await getProfile(address);
        setProfile(result);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [address]);

  return {
    profile,
    loading,
  };
}