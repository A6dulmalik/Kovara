/**
 * Like Event Handler
 * Handles LikePostEvent from the Kovara contract
 */

import { Pool } from "pg";

export interface LikePostEvent {
  user: string;
  post_id: bigint;
}

export interface LikeEventContext {
  txHash: string;
  ledgerSeq: number;
  timestamp: Date;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 50;

function isSerializationError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "40001" || code === "40P01") return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("could not serialize access") || msg.includes("serialization failure")) {
      return true;
    }
  }
  return false;
}

/**
 * Handle LikePostEvent
 * 1. Checks that the post exists
 * 2. Inserts like record into likes table
 * 3. Increments like_count on the corresponding post
 * Uses SERIALIZABLE isolation with retries to prevent concurrent
 * like double-counting or corruption. Idempotent: Uses
 * (post_id, user_address) unique constraint.
 */
export async function handleLike(
  pool: Pool,
  event: LikePostEvent,
  context: LikeEventContext
): Promise<void> {
  const { user, post_id } = event;
  const { txHash, timestamp } = context;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");

      const postCheck = await client.query(
        "SELECT id FROM posts WHERE id = $1 AND deleted_at IS NULL",
        [post_id.toString()]
      );
      if (postCheck.rowCount === 0) {
        await client.query("COMMIT");
        console.warn(`Post ${post_id} not found or deleted, skipping like`);
        client.release();
        return;
      }

      const insertLikeQuery = `
        INSERT INTO likes (post_id, user_address, created_at, tx_hash)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (post_id, user_address) DO NOTHING
        RETURNING id
      `;

      const insertValues = [post_id.toString(), user, timestamp, txHash];

      const insertResult = await client.query(insertLikeQuery, insertValues);

      if (insertResult.rowCount === 0) {
        console.log(`Like already exists for user ${user} on post ${post_id} (idempotent skip)`);
        await client.query("COMMIT");
        client.release();
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
        console.warn(`Post ${post_id} not found or deleted, like recorded but post not updated`);
      } else {
        console.log(`Like from ${user} added to post ${post_id}`);
      }

      await client.query("COMMIT");
      client.release();
      return;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      client.release();

      if (isSerializationError(error) && attempt < MAX_RETRIES) {
        console.warn(
          `Serialization failure on attempt ${attempt}/${MAX_RETRIES} for like on post ${post_id}, retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }

      console.error(`Error handling LikePostEvent for post ${post_id}:`, error);
      throw error;
    }
  }
}

/**
 * Unit test helper: Mock event data
 */
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
