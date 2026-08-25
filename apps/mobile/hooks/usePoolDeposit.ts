import { useState, useCallback } from "react";

import { useNetwork } from "./useNetwork";
import { useWallet } from "./useWallet";
import { sdkPoolDeposit } from "../utils/sdkPoolDeposit";

export interface DepositState {
  pending: boolean;
  success: boolean;
  error: string | null;
  txHash?: string;
}

export interface UsePoolDepositReturn extends DepositState {
  deposit: (poolId: string, amount: string, token: string) => Promise<void>;
  reset: () => void;
}

// Global wallet kit reference (set by WalletContext) — same pattern as useTip.
declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
  var __Kovara_WALLET_KIT__: any;
}

/**
 * MO-007: Signs, submits, and confirms a real pool deposit via the SDK and
 * wallet kit. Returns the Stellar transaction hash (not a random mock).
 */
export function usePoolDeposit(): UsePoolDepositReturn {
  const { address, connected } = useWallet();
  const { contractId, rpcUrl } = useNetwork();
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string>();

  const deposit = useCallback(
    async (poolId: string, amount: string, token: string) => {
      setPending(true);
      setError(null);
      setSuccess(false);
      setTxHash(undefined);

      try {
        if (!connected || !address) {
          throw new Error("Connect your wallet to deposit into this pool.");
        }

        if (!amount || parseFloat(amount) <= 0) {
          throw new Error("Amount must be greater than zero");
        }

        if (!token) {
          throw new Error("Token is required");
        }

        const walletKit = globalThis.__Kovara_WALLET_KIT__;
        if (!walletKit) {
          throw new Error("Wallet not initialized. Please reconnect.");
        }

        // Convert human amount to smallest unit (7 decimals for Stellar assets by default).
        const decimals = 7;
        const amountBigInt = BigInt(
          Math.floor(parseFloat(amount) * Math.pow(10, decimals))
        );

        if (amountBigInt <= 0n) {
          throw new Error("Amount must be greater than zero");
        }

        const result = await sdkPoolDeposit(
          contractId,
          rpcUrl,
          address,
          poolId,
          token,
          amountBigInt,
          walletKit
        );

        setTxHash(result.txHash);
        setSuccess(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Deposit failed. Please try again.";
        setError(message);
        setSuccess(false);
      } finally {
        setPending(false);
      }
    },
    [address, connected, contractId, rpcUrl]
  );

  const reset = useCallback(() => {
    setPending(false);
    setSuccess(false);
    setError(null);
    setTxHash(undefined);
  }, []);

  return {
    pending,
    success,
    error,
    txHash,
    deposit,
    reset,
  };
}
