/**
 * Static checks for the follow/tip/like performance-index migrations
 * (BA-018 #453, BA-019 #454, BA-020 #455).
 *
 * The repo's DB layer is mocked in every other test (no real database is
 * required — see the comment at the top of src/db.ts), so these tests read
 * the migration SQL files directly and assert on their contents rather than
 * applying them against a live PostgreSQL instance.
 */

import { readFileSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "migrations");

function readMigration(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
}

describe("007_follows_pagination_index.sql (BA-018 #453)", () => {
  const sql = readMigration("007_follows_pagination_index.sql");

  it("adds a composite index covering the followers-list pagination direction", () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_follows_followee_follower\s+ON follows\s*\(\s*followee\s*,\s*follower\s*\)/i
    );
  });

  it("uses IF NOT EXISTS, matching the repo's existing migration convention", () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/i);
  });
});

describe("008_tips_activity_indexes.sql (BA-019 #454)", () => {
  const sql = readMigration("008_tips_activity_indexes.sql");

  it("indexes tips by post_id", () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_tips_post_id\s+ON tips\s*\(\s*post_id\s*\)/i);
  });

  it("indexes tips by tipper", () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_tips_tipper\s+ON tips\s*\(\s*tipper\s*\)/i);
  });

  it("does not use invalid MySQL-style inline INDEX table items", () => {
    // The bug this migration works around: `CREATE TABLE ... (INDEX name (col))`
    // is not valid PostgreSQL syntax. Every index here must be a standalone
    // CREATE INDEX statement.
    expect(sql).not.toMatch(/^\s*INDEX\s+\w+\s*\(/im);
  });
});
