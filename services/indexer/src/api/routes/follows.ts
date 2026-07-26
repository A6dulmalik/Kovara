import { Router, Request, Response } from "express";
import { Database } from "../../db";
import { ApiErrorResponse, FollowersResponse, FollowingResponse } from "../contracts";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

function parsePagination(
  query: Record<string, unknown>
): { limit: number; offset: number; cursor?: string } | ApiErrorResponse {
  const rawLimit = query.limit !== undefined ? Number(query.limit) : DEFAULT_LIMIT;
  const rawOffset = query.offset !== undefined ? Number(query.offset) : DEFAULT_OFFSET;
  const cursor = query.cursor !== undefined ? String(query.cursor) : undefined;

    if (!Number.isInteger(rawLimit) || rawLimit < 1) return null;
    if (rawLimit > 100) return null;
    if (!Number.isInteger(rawOffset) || rawOffset < 0) return null;

  return { limit: rawLimit, offset: rawOffset, cursor };
}

export function createFollowsRouter(db: Database): Router {
  const router = Router();

  /**
   * GET /follows/:address/followers
   * Returns accounts that follow the given address.
   */
  router.get(
    "/:address/followers",
    async (req: Request, res: Response<FollowersResponse | ApiErrorResponse>): Promise<void> => {
      const { address } = req.params;
      const pagination = parsePagination(req.query as Record<string, unknown>);

      if ("error" in pagination) {
        res.status(400).json(pagination);
        return;
      }

      const { limit, offset, cursor } = pagination;

      if (cursor) {
        const { followers, total } = await db.getFollowersAfter(address, cursor, limit);
        res.json({
          address,
          followers,
          total,
          limit,
          offset,
          has_more: followers.length === limit,
          next_offset: null,
          prev_offset: null,
        });
        return;
      }

      const { followers, total } = await db.getFollowers(address, limit, offset);
      const hasMore = offset + followers.length < total;
      res.json({
        address,
        followers,
        total,
        limit,
        offset,
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
        prev_offset: offset > 0 ? Math.max(0, offset - limit) : null,
      });
    }
  );

  /**
   * GET /follows/:address/following
   * Returns accounts that the given address follows.
   */
  router.get(
    "/:address/following",
    async (req: Request, res: Response<FollowingResponse | ApiErrorResponse>): Promise<void> => {
      const { address } = req.params;
      const pagination = parsePagination(req.query as Record<string, unknown>);

      if ("error" in pagination) {
        res.status(400).json(pagination);
        return;
      }

      const { limit, offset, cursor } = pagination;

      if (cursor) {
        const { following, total } = await db.getFollowingAfter(address, cursor, limit);
        res.json({
          address,
          following,
          total,
          limit,
          offset,
          has_more: following.length === limit,
          next_offset: null,
          prev_offset: null,
        });
        return;
      }

      const { following, total } = await db.getFollowing(address, limit, offset);
      const hasMore = offset + following.length < total;
      res.json({
        address,
        following,
        total,
        limit,
        offset,
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
        prev_offset: offset > 0 ? Math.max(0, offset - limit) : null,
      });
    }
  );

  return router;
}