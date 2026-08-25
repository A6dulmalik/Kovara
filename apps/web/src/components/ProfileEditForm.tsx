'use client';

import React, { useState } from 'react';
import { ProfileContractClient, ProfileData } from '@/lib/contract/profile';
import { useOnboardingWallet } from '@/hooks/useWallet';
import { Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react';

export type UpdateState = 'idle' | 'signing' | 'pending' | 'confirmed' | 'failed';

export function ProfileEditForm() {
  const { wallet, refresh } = useOnboardingWallet();
  const [username, setUsername] = useState(wallet.profile?.username || '');
  const [bio, setBio] = useState(wallet.profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(wallet.profile?.avatarUrl || '');

  const [txState, setTxState] = useState<UpdateState>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.address) {
      setErrorMessage('No wallet connected');
      return;
    }

    setErrorMessage(null);
    setTxHash(null);

    try {
      // 1. Signing state
      setTxState('signing');
      const profilePayload: ProfileData = { username, bio, avatarUrl };

      // 2. Pending / Submission state
      setTxState('pending');
      const hash = await ProfileContractClient.setProfile(wallet.address, profilePayload);
      
      setTxHash(hash);
      setTxState('confirmed');

      // 3. Refresh profile state across the application
      await refresh();
    } catch (err: any) {
      console.error('Profile update failed:', err);
      setErrorMessage(err.message || 'Transaction failed or was rejected');
      setTxState('failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-[#12121a] border border-gray-800 rounded-2xl shadow-xl space-y-4 text-white">
      <h2 className="text-xl font-bold">Edit Profile</h2>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Avatar URL</label>
        <input
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* State Feedback Section */}
      {txState === 'signing' && (
        <div className="flex items-center gap-2 p-3 bg-purple-900/30 border border-purple-500/40 rounded-lg text-purple-300 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Please sign the transaction in your wallet...</span>
        </div>
      )}

      {txState === 'pending' && (
        <div className="flex items-center gap-2 p-3 bg-blue-900/30 border border-blue-500/40 rounded-lg text-blue-300 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Submitting transaction to Soroban network...</span>
        </div>
      )}

      {txState === 'confirmed' && (
        <div className="p-3 bg-green-900/30 border border-green-500/40 rounded-lg text-green-300 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Profile updated successfully!</span>
          </div>
          {txHash && (
            <p className="text-xs text-gray-400 truncate">Hash: {txHash}</p>
          )}
        </div>
      )}

      {txState === 'failed' && (
        <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-500/40 rounded-lg text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{errorMessage || 'Failed to update profile.'}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={txState === 'signing' || txState === 'pending'}
        className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 font-medium rounded-lg transition flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" />
        <span>Save Changes</span>
      </button>
    </form>
  );
}