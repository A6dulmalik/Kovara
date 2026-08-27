/*
 * Minimal KovaraClient used by the mobile app to build transaction XDR.
 * Real implementations live in the published SDK; this stub matches the
 * surface area consumed by mobile hooks (createPost, tip, poolDeposit).
 */
export interface KovaraClientOptions {
  contractId: string;
  rpcUrl: string;
  treasuryBalance?: bigint;
}

const MAX_REWARD_AMOUNT = 1_000_000n;

export class KovaraClient {
  readonly contractId: string;
  readonly rpcUrl: string;
  readonly treasuryBalance: bigint | undefined;

  constructor(opts: KovaraClientOptions) {
    this.contractId = opts.contractId;
    this.rpcUrl = opts.rpcUrl;
    this.treasuryBalance = opts.treasuryBalance;
  }

  createPost(_author, string, _content: string): string {
    return `create_post_xdr_${this.contractId}`;
  }

  tip(_sender, string, _postId: number, amount: bigint): string {
    if (amount <= 0n) {
      throw new Error("Reward amount must be greater than zero");
    }
    if (amount > MAX_REWARD_AMOUNT) {
      throw new Error("Reward amount exceeds the maximum");
    }
    if (this.treasuryBalance === undefined) {
      throw new Error("Treasury balance is not configured");
    }
    if (amount > this.treasuryBalance) {
      throw new Error("Insufficient treasury balance");
    }
    return `tip_xdr_${this.contractId}`;
  }

  poolDeposit(
    _depositor: string,
    poolId: string,
    token: string,
    amount: bigint
  ): string {
    if (amount <= 0n) {
      throw new Error("Deposit amount must be greater than zero");
    }
    if (!poolId || !token) {
      throw new Error("poolId and token are required");
    }
    return `pool_deposit_xdr_${this.contractId}_${poolId}_${token}_$amount.toString()`;
  }
}
