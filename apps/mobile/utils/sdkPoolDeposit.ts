import { KovaraClient } from "../../../packages/sdk/src/client";
import type { WalletKitAdapter } from "../types/walletContext.types";

export interface PoolDepositResult {
  txHash: string;
  amount: bigint;
  poolId: string;
  token: string;
}

/**
 * Build, sign, submit, and confirm a pool_deposit transaction.
 * Returns a real Stellar transaction hash from the wallet / RPC.
 */
export async function sdkPoolDeposit(
  contractId: string,
  rpcUrl: string,
  depositor: string,
  poolId: string,
  token: string,
  amount: bigint,
  walletKit: WalletKitAdapter
): Promise<PoolDepositResult> {
  if (amount <= 0n) {
    throw new Error("Amount must be greater than zero");
  }
  if (!token?.trim()) {
    throw new Error("Token is required");
  }
  if (!poolId?.trim()) {
    throw new Error("Pool ID is required");
  }
  if (!depositor?.trim()) {
    throw new Error("Wallet not connected");
  }

  const client = new KovaraClient({ contractId, rpcUrl });
  const txXdr = client.poolDeposit(depositor, poolId, token, amount);

  let txHash: string;

  if (typeof walletKit.signAndSubmitTransaction === "function") {
    const res = await walletKit.signAndSubmitTransaction({ txXdr, rpcUrl });
    txHash = res.hash ?? res.txHash ?? "";
  } else if (typeof walletKit.signTransaction === "function") {
    const signed = await walletKit.signTransaction({ txXdr });
    const { rpc } = await import("@stellar/stellar-sdk");
    const server = new rpc.Server(rpcUrl);
    const res = await server.submitTransaction(signed.signedTxXdr);
    txHash = (res as { hash?: string })?.hash ?? "";
  } else {
    throw new Error("Wallet signing not available");
  }

  if (!txHash) {
    throw new Error("Transaction submitted but no hash was returned");
  }

  return { txHash, amount, poolId, token };
}
