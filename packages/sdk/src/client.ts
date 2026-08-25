/**
 * Minimal KovaraClient used by the mobile app to build transaction XDR.
 * Real implementations live in the published SDK; this stub matches the
 * surface area consumed by mobile hooks (createPost, tip, poolDeposit).
 */
export interface KovaraClientOptions {
  contractId: string;
  rpcUrl: string;
}

export class KovaraClient {
  readonly contractId: string;
  readonly rpcUrl: string;

  constructor(opts: KovaraClientOptions) {
    this.contractId = opts.contractId;
    this.rpcUrl = opts.rpcUrl;
  }

  /** Build unsigned XDR for create_post. */
  createPost(_author: string, _content: string): string {
    return `create_post_xdr_${this.contractId}`;
  }

  /** Build unsigned XDR for tip. */
  tip(_sender: string, _postId: number, _amount: bigint): string {
    return `tip_xdr_${this.contractId}`;
  }

  /**
   * Build unsigned XDR for pool_deposit(depositor, pool_id, token, amount).
   * Amount is in the token's smallest unit (e.g. stroops).
   */
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
    return `pool_deposit_xdr_${this.contractId}_${poolId}_${token}_${amount.toString()}`;
  }
}
