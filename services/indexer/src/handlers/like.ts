import { Pool } from "pg";
import { logger } from "../logger";

export interface LikePostEvent {
  user: string;
  post_id: bigint;
}

export interface LikeEventContext {
  txHash: string;
  ledgerSeq: number;
  timestamp: Date;
}

export async function handleLike(
  pool: Pool,
  event: LikePostEvent,
  context: LikeEventContext
): Promise<void> {
  const { user, post_id } = event;
  const { txHash, timestamp } = context;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertLikeQuery = `
      INSERT INTO likes (post_id, user_address, created_at, tx_hash)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (post_id, user_address) DO NOTHING
      RETURNING id
    `;

    const insertValues = [post_id.toString(), user, timestamp, txHash];

    const insertResult = await client.query(insertLikeQuery, insertValues);

    if (insertResult.rowCount === 0) {
      logger.info(`Like already exists for user ${user} on post ${post_id} (idempotent skip)`);
      await client.query("COMMIT");
      return;
    }

    const updatePostQuery = `
      UPDATE posts
      SET like_count = like_count + 1
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const updateValues = [post_id.toString()];
    const updateResult = await client.query(updatePostQuery, updateValues);

    if (updateResult.rowCount === 0) {
      logger.warn(`Post ${post_id} not found or deleted, like recorded but post not updated`);
    } else {
      logger.always(`Like from ${user} added to post ${post_id}`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(`Error handling LikePostEvent for post ${post_id}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export function createMockLikeEvent(
  user: string = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  post_id: bigint = 1n
): { event: LikePostEvent; context: LikeEventContext } {
  return {
    event: { user, post_id },
    context: {
      txHash: `0x${Math.random().toString(16).substring(2)}`,
      ledgerSeq: 12345,
      timestamp: new Date(),
    },
  };
}