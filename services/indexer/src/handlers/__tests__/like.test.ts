/**
 * Unit tests for like event handler
 */

import { Pool } from "pg";
import { handleLike, createMockLikeEvent } from "../like";

// Mock pg Pool and Client
const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockClient = {
  query: mockQuery,
  release: mockRelease,
};
const mockConnect = jest.fn().mockResolvedValue(mockClient);
const mockPool = {
  connect: mockConnect,
} as unknown as Pool;

describe("Like Event Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should insert like and increment post like_count", async () => {
    const { event, context } = createMockLikeEvent("GUSER123", 1n);

    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // BEGIN
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }); // Post exists check
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // INSERT like
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE post
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // COMMIT

    await handleLike(mockPool, event, context);

    expect(mockQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockQuery).toHaveBeenCalledWith(
      "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id FROM posts"),
      expect.arrayContaining(["1"])
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO likes"),
      expect.arrayContaining(["1", "GUSER123", context.timestamp, context.txHash])
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE posts"),
      expect.arrayContaining(["1"])
    );
    expect(mockQuery).toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalled();
  });

  it("should be idempotent (skip duplicate like)", async () => {
    const { event, context } = createMockLikeEvent("GUSER123", 1n);

    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // BEGIN
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }); // Post exists check
    mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // INSERT like (conflict)
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // COMMIT

    await handleLike(mockPool, event, context);

    expect(mockQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (post_id, user_address) DO NOTHING"),
      expect.any(Array)
    );
    expect(mockQuery).toHaveBeenCalledWith("COMMIT");
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE posts"),
      expect.any(Array)
    );
  });

  it("should rollback on error", async () => {
    const { event, context } = createMockLikeEvent("GUSER123", 1n);

    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // BEGIN
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }); // Post exists check
    mockQuery.mockRejectedValueOnce(new Error("DB error")); // INSERT fails
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // ROLLBACK

    await expect(handleLike(mockPool, event, context)).rejects.toThrow("DB error");

    expect(mockQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalled();
  });

  it("should skip like when post does not exist", async () => {
    const { event, context } = createMockLikeEvent();

    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // BEGIN
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // Post not found
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // COMMIT

    await handleLike(mockPool, event, context);

    expect(mockQuery).toHaveBeenCalledWith("COMMIT");
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO likes"),
      expect.any(Array)
    );
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE posts"),
      expect.any(Array)
    );
    expect(mockRelease).toHaveBeenCalled();
  });

  it("should retry on serialization failure", async () => {
    const { event, context } = createMockLikeEvent("GUSER123", 1n);

    const serErr = new Error("could not serialize access");
    (serErr as any).code = "40001";

    // First attempt
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // BEGIN
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }); // Post exists check
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // INSERT like
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE post
    mockQuery.mockRejectedValueOnce(serErr); // COMMIT fails with serialization error
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // ROLLBACK

    // Second attempt
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // BEGIN
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }); // Post exists check
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // INSERT like (idempotent)
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE post
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // COMMIT

    await handleLike(mockPool, event, context);

    expect(mockConnect).toHaveBeenCalledTimes(2);
  });
});
