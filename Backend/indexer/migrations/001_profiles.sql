-- Migration: Create profiles table
-- Description: Stores on-chain profiles indexed from ProfileSetEvent

CREATE TABLE IF NOT EXISTS profiles (
    address        TEXT    PRIMARY KEY,
    username       TEXT    NOT NULL,
    creator_token  TEXT    NOT NULL DEFAULT '',
    updated_ledger INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username);
