"use client";

import { useEffect, useState, useCallback } from "react";
import { useWalletContext } from "@/components/WalletProvider";
import { profileClient } from "@/services/profile-client";

// Re-export the context hook as the canonical useWallet for simple consumers
export { useWalletContext as useWallet } from "@/components/WalletProvider";

export type WalletState =
  | "loading"
  | "not_installed"
  | "not_connected"
  | "connected_no_profile"
  | "ready";

export type { WalletProviderKind, WalletProviderOption } from "@/lib/walletProviders";
export { getSupportedWalletProviders, walletProviderOptions } from "@/lib/walletProviders";

export interface UserProfile {
  username?: string;
  bio?: string;
  avatarUrl?: string;
  [key: string]: any;
}

export interface WalletInfo {
  address: string | null;
  network: string | null;
  balance: string | null;
  profile: UserProfile | null;
}

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";

async function fetchXlmBalance(address: string): Promise<string> {
  try {
    const res = await fetch(`${HORIZON_TESTNET}/accounts/${address}`);
    if (!res.ok) return "0";
    const data = await res.json();
    const native = (
      data.balances as { asset_type: string; balance: string }[]
    ).find((b) => b.asset_type === "native");
    return native?.balance ?? "0";
  } catch {
    return "0";
  }
}

/**
 * useOnboardingWallet — full onboarding state machine used by OnboardingFlow.
 * Fetches profile data from chain/indexer, manages loading/error states, and clears on disconnect.
 */
export function useOnboardingWallet() {
  const { address, connected, network, connect: ctxConnect, disconnect: ctxDisconnect } = useWalletContext();

  const [state, setState] = useState<WalletState>("loading");
  const [balance, setBalance] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const detectState = useCallback(async () => {
    const freighterAvailable =
      typeof window !== "undefined" &&
      !!(window as unknown as { freighter?: unknown }).freighter;

    const providers = getSupportedWalletProviders({
      freighter: freighterAvailable,
      walletconnect: true,
    });

    if (!providers.length) {
      setState("not_installed");
      setProfile(null);
      setBalance(null);
      return;
    }

    if (!connected || !address) {
      setState("not_connected");
      setBalance(null);
      setProfile(null);
      setProfileError(null);
      return;
    }

    try {
      setIsLoadingProfile(true);
      setProfileError(null);

      // Fetch balance and profile data concurrently
      const [bal, userProfile] = await Promise.all([
        fetchXlmBalance(address),
        profileClient.getProfile(address).catch(() => null),
      ]);

      setBalance(bal);
      setProfile(userProfile);

      if (userProfile && (userProfile.username || userProfile.bio)) {
        setState("ready");
      } else {
        setState("connected_no_profile");
      }
    } catch (err: any) {
      setProfileError(err.message || "Failed to load profile data");
      setState("connected_no_profile");
      setProfile(null);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [address, connected]);

  useEffect(() => {
    detectState();
  }, [detectState]);

  const connect = useCallback(async () => {
    await ctxConnect();
  }, [ctxConnect]);

  const disconnect = useCallback(() => {
    setProfile(null);
    setBalance(null);
    setProfileError(null);
    setState("not_connected");
    if (ctxDisconnect) {
      ctxDisconnect();
    }
  }, [ctxDisconnect]);

  const markProfileCreated = useCallback((newProfile?: UserProfile) => {
    if (newProfile) setProfile(newProfile);
    setState("ready");
  }, []);

  const wallet: WalletInfo = { address, network, balance, profile };

  return {
    state,
    wallet,
    profile,
    isLoadingProfile,
    profileError,
    connect,
    disconnect,
    markProfileCreated,
    refresh: detectState,
  };
}