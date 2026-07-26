import { Pool } from "pg";
import { logger } from "../logger";

export interface TipEvent {
  tipper: string;
  post_id: bigint;
  amount: bigint;
  fee: bigint;
}

export interface TipEventContext {
  txHash: string;
  ledgerSeq: number;
  timestamp: Date;
}

export async function handleTip(
  pool: Pool,
  event: TipEvent,
  context: TipEventContext
): Promise<void> {
  const { tipper, post_id, amount, fee } = event;
  const { txHash, timestamp } = context;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertTipQuery = `
      INSERT INTO tips (post_id, tipper, amount, fee, created_at, tx_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tx_hash) DO NOTHING
      RETURNING id
    `;

    const insertValues = [
      post_id.toString(),
      tipper,
      amount.toString(),
      fee.toString(),
      timestamp,
      txHash,
    ];

    const insertResult = await client.query(insertTipQuery, insertValues);

    if (insertResult.rowCount === 0) {
      logger.info(`Tip already processed for tx ${txHash} (idempotent skip)`);
      await client.query("COMMIT");
      return;
    }

    const updatePostQuery = `
      UPDATE posts
      SET tip_total = tip_total + $1
      WHERE id = $2 AND deleted_at IS NULL
    `;

    const updateValues = [amount.toString(), post_id.toString()];
    const updateResult = await client.query(updatePostQuery, updateValues);

    if (updateResult.rowCount === 0) {
      logger.warn(`Post ${post_id} not found or deleted, tip recorded but post not updated`);
    } else {
      logger.always(`Tip of ${amount} from ${tipper} added to post ${post_id}`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`Error handling TipEvent for post ${post_id}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export function createMockTipEvent(
  tipper: string = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  post_id: bigint = 1n,
  amount: bigint = 1000000n,
  fee: bigint = 25000n
): { event: TipEvent; context: TipEventContext } {
  return {
    event: { tipper, post_id, amount, fee },
    context: {
      txHash: `0x${Math.random().toString(16).substring(2)}`,
      ledgerSeq: 12345,
      timestamp: new Date(),
    },
  };
}