import { useState, useCallback } from 'react';
import { indexerClient } from '@/lib/indexer-client';

export interface ProfileUpdatePayload {
  name?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface ProfileUpdateState {
  isLoading: boolean;
  isRetrying: boolean;
  error: string | null;
  confirmationHash: string | null;
}

export function useProfileUpdate(onSuccess?: () => void) {
  const [state, setState] = useState<ProfileUpdateState>({
    isLoading: false,
    isRetrying: false,
    error: null,
    confirmationHash: null,
  });

  const updateProfile = useCallback(
    async (payload: ProfileUpdatePayload, token: string, existingHash?: string) => {
      // Generate or reuse idempotency hash/confirmation state to survive retries
      const confirmationHash = existingHash || `prof_hash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      setState((prev) => ({
        ...prev,
        isLoading: true,
        isRetrying: !!existingHash,
        error: null,
        confirmationHash,
      }));

      try {
        await indexerClient.request({
          endpoint: 'profile/update',
          method: 'PUT',
          body: { ...payload, confirmationHash },
          token,
        });

        setState({
          isLoading: false,
          isRetrying: false,
          error: null,
          confirmationHash,
        });

        if (onSuccess) {
          onSuccess();
        }
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRetrying: true,
          error: err.message || 'Failed to update profile',
        }));
        throw err;
      }
    },
    [onSuccess]
  );

  return {
    ...state,
    updateProfile,
  };
}