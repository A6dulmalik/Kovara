import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { Database } from "../db";
import { createProfilesRouter } from "./routes/profiles";
import { createPostsRouter } from "./routes/posts";
import { createFollowsRouter } from "./routes/follows";
import { createPoolsRouter } from "./routes/pools";
import { sendError, sendRateLimitError, sendSuccess } from "./response";

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10);

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    return req.ip ?? "unknown";
  },
  handler: (req: Request, res: Response): void => {
    const retryAfter = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    sendRateLimitError(res, retryAfter);
  },
});

export function createApp(db: Database): express.Application {
  const app = express();
  app.use(express.json());

  app.use("/api", apiLimiter);

  app.use("/api/profiles", createProfilesRouter(db));
  app.use("/api/posts", createPostsRouter(db));
  app.use("/api/follows", createFollowsRouter(db));
  app.use("/api/pools", createPoolsRouter(db));

  interface SearchQuery {
    query: string;
    limit?: number;
    offset?: number;
  }

  interface Post {
    id: number;
    author: string;
    content: string;
    tip_total: string;
    timestamp: number;
  }

  interface SearchResponse {
    posts: Post[];
    total: number;
    has_more: boolean;
  }

  const MAX_LIMIT = 100;
  const DEFAULT_LIMIT = 20;
  const DEFAULT_OFFSET = 0;

  app.post(
    "/api/search/posts",
    (req: Request, res: Response): void => {
      const body = req.body as Partial<SearchQuery>;

      if (
        body.query === undefined ||
        body.query === null ||
        typeof body.query !== "string" ||
        body.query.trim() === ""
      ) {
        sendError(res, 400, "query is required", "INVALID_QUERY");
        return;
      }

      const limit = body.limit !== undefined ? Number(body.limit) : DEFAULT_LIMIT;
      const offset = body.offset !== undefined ? Number(body.offset) : DEFAULT_OFFSET;

      if (!Number.isInteger(limit) || limit < 1) {
        sendError(res, 400, "limit must be a positive integer", "INVALID_QUERY");
        return;
      }

      if (limit > MAX_LIMIT) {
        sendError(res, 400, `limit cannot exceed ${MAX_LIMIT}`, "LIMIT_EXCEEDED");
        return;
      }

      if (!Number.isInteger(offset) || offset < 0) {
        sendError(res, 400, "offset must be a non-negative integer", "INVALID_QUERY");
        return;
      }

      const result: SearchResponse = { posts: [], total: 0, has_more: false };
      sendSuccess(res, result);
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error(err);
    sendError(res, 500, "Internal server error", "INTERNAL_ERROR");
  });

  return app;
}

const _stub = {} as any;
export const app = createApp(_stub);
export { apiLimiter };

if (require.main === module) {
  const PORT = parseInt(process.env.PORT ?? "3001", 10);
  app.listen(PORT, () => {
    console.log(`Indexer API listening on port ${PORT}`);
    console.log(
      `Rate limit: ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW_MS / 1000}s per IP`
    );
  });
}