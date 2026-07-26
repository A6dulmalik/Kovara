import { Pool } from "pg";
import { logger } from "../logger";

export interface PostCreatedEvent {
  id: bigint;
  author: string;
}

export interface PostDeletedEvent {
  post_id: bigint;
  author: string;
}

export interface PostEventContext {
  txHash: string;
  ledgerSeq: number;
  timestamp: Date;
  content?: string;
}

export async function handlePostCreated(
  pool: Pool,
  event: PostCreatedEvent,
  context: PostEventContext
): Promise<void> {
  const { id, author } = event;
  const { timestamp, content } = context;
  const postContent = content || "";

  const query = `
    INSERT INTO posts (id, author, content, tip_total, like_count, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO NOTHING
  `;

  const values = [
    id.toString(),
    author,
    postContent,
    0,
    0,
    timestamp,
  ];

  try {
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      logger.info(`Post ${id} already exists (idempotent skip)`);
    } else {
      logger.always(`Post ${id} created by ${author}`);
    }
  } catch (error) {
    logger.error(`Error handling PostCreatedEvent for post ${id}:`, error);
    throw error;
  }
}

export async function handlePostDeleted(
  pool: Pool,
  event: PostDeletedEvent,
  context: PostEventContext
): Promise<void> {
  const { post_id, author } = event;
  const { timestamp } = context;

  const query = `
    UPDATE posts
    SET deleted_at = $1
    WHERE id = $2 AND author = $3 AND deleted_at IS NULL
  `;

  const values = [timestamp, post_id.toString(), author];

  try {
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      logger.info(`Post ${post_id} already deleted or not found (idempotent skip)`);
    } else {
      logger.always(`Post ${post_id} deleted by ${author}`);
    }
  } catch (error) {
    logger.error(`Error handling PostDeletedEvent for post ${post_id}:`, error);
    throw error;
  }
}

export async function fetchPostContent(_contractId: string, _postId: bigint): Promise<string> {
  return "";
}

export function createMockPostCreatedEvent(
  id: bigint = 1n,
  author: string = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
): { event: PostCreatedEvent; context: PostEventContext } {
  return {
    event: { id, author },
    context: {
      txHash: "0x1234567890abcdef",
      ledgerSeq: 12345,
      timestamp: new Date(),
      content: "Test post content",
    },
  };
}

export function createMockPostDeletedEvent(
  post_id: bigint = 1n,
  author: string = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
): { event: PostDeletedEvent; context: PostEventContext } {
  return {
    event: { post_id, author },
    context: {
      txHash: "0xabcdef1234567890",
      ledgerSeq: 12346,
      timestamp: new Date(),
    },
  };
}