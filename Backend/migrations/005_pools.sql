-- Migration 005: pools table
--
-- Stores the current state of every community pool created on-chain.
-- Balance is kept as a NUMERIC(39,0) to accommodate the full i128 range
-- used by the Soroban contract.
-- Admins are stored as a JSONB array of Stellar address strings; this lets
-- callers query membership with the @> operator without a separate join table.

CREATE TABLE IF NOT EXISTS pools (
    pool_id        TEXT        NOT NULL PRIMARY KEY,
    token          TEXT        NOT NULL,
    balance        NUMERIC(39, 0) NOT NULL DEFAULT 0,
    admins         JSONB       NOT NULL DEFAULT '[]',
    threshold      INTEGER     NOT NULL CHECK (threshold >= 1),
    created_ledger INTEGER     NOT NULL,
    updated_ledger INTEGER     NOT NULL,
    CHECK (balance >= 0)
);

-- Index on token for filtering pools by asset.
CREATE INDEX IF NOT EXISTS idx_pools_token ON pools (token);

-- ── Helper functions for idempotent admin list mutations ─────────────────────

-- Append an admin address to pools.admins if not already present.
CREATE OR REPLACE FUNCTION add_pool_admin(
    p_pool_id      TEXT,
    p_admin        TEXT,
    p_ledger       INTEGER
) RETURNS void LANGUAGE sql AS $$
    UPDATE pools
    SET    admins         = CASE
                               WHEN admins @> to_jsonb(p_admin)
                               THEN admins
                               ELSE admins || to_jsonb(p_admin)
                           END,
           updated_ledger = p_ledger
    WHERE  pool_id = p_pool_id;
$$;

-- Remove an admin address from pools.admins (no-op if absent).
CREATE OR REPLACE FUNCTION remove_pool_admin(
    p_pool_id      TEXT,
    p_admin        TEXT,
    p_ledger       INTEGER
) RETURNS void LANGUAGE sql AS $$
    UPDATE pools
    SET    admins         = (
               SELECT jsonb_agg(elem)
               FROM   jsonb_array_elements(admins) AS elem
               WHERE  elem <> to_jsonb(p_admin)
           ),
           updated_ledger = p_ledger
    WHERE  pool_id = p_pool_id;
$$;
