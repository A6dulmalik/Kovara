-- Migration: Create follows table
-- Description: Stores the directed follow graph indexed from FollowEvent / UnfollowEvent

CREATE TABLE IF NOT EXISTS follows (
    follower   TEXT    NOT NULL,
    followee   TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (follower, followee)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows (followee);
