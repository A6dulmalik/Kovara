/**
 * Handlers for pool contract events.
 *
 * Covered events:
 *  - PoolCreatedEvent   → inserts a new row in the pools table
 *  - PoolDepositEvent   → increases pool balance
 *  - PoolWithdrawEvent  → decreases pool balance
 *  - PoolAdminAddedEvent   → appends an admin to the pool's admin list
 *  - PoolAdminRemovedEvent → removes an admin from the pool's admin list
 *
 * All handlers are idempotent when the caller enforces a ledger watermark
 * to prevent event replay.
 */

import { Database } from "../db";

export interface PoolCreatedEvent {
  pool_id: string;
  token: string;
  admins: string[];
  threshold: number;
  ledger: number;
}

export interface PoolDepositEvent {
  depositor: string;
  pool_id: string;
  token: string;
  amount: bigint;
  ledger: number;
}

export interface PoolWithdrawEvent {
  recipient: string;
  pool_id: string;
  amount: bigint;
  ledger: number;
}

export interface PoolAdminAddedEvent {
  pool_id: string;
  new_admin: string;
  ledger: number;
}

export interface PoolAdminRemovedEvent {
  pool_id: string;
  removed_admin: string;
  ledger: number;
}

function validatePoolId(poolId: string): void {
  if (!poolId || typeof poolId !== "string" || poolId.trim() === "") {
    throw new Error("Invalid pool ID: must be a non-empty string");
  }
}

/**
 * Handle a PoolCreated event.
 *
 * Inserts the pool row with an initial balance of 0.  Safe to replay:
 * insertPool must be implemented as an INSERT … ON CONFLICT DO NOTHING
 * (or equivalent) so duplicate events are silently ignored.
 */
export async function handlePoolCreated(db: Database, event: PoolCreatedEvent): Promise<void> {
  validatePoolId(event.pool_id);
  if (!event.token) {
    throw new Error("PoolCreated event missing required field: token");
  }
  if (!Array.isArray(event.admins) || event.admins.length === 0) {
    throw new Error("PoolCreated event must have at least one admin");
  }
  if (event.threshold < 1 || event.threshold > event.admins.length) {
    throw new Error("PoolCreated event threshold must be between 1 and admins.length");
  }

  await db.insertPool({
    pool_id: event.pool_id,
    token: event.token,
    balance: BigInt(0),
    admins: event.admins,
    threshold: event.threshold,
    created_ledger: event.ledger,
    updated_ledger: event.ledger,
  });
}

/**
 * Handle a PoolDeposit event.
 *
 * Adds the deposited amount to the pool's running balance.
 * Idempotent when replayed: the underlying upsert uses the pool_id as the
 * primary key and the balance adjustment is additive, so callers must
 * ensure events are not replayed (use the ledger watermark).
 */
export async function handlePoolDeposit(db: Database, event: PoolDepositEvent): Promise<void> {
  validatePoolId(event.pool_id);
  if (event.amount <= BigInt(0)) {
    throw new Error("PoolDeposit event amount must be positive");
  }

  await db.adjustPoolBalance(event.pool_id, event.amount, event.ledger);
}

/**
 * Handle a PoolWithdraw event.
 *
 * Subtracts the withdrawn amount from the pool's running balance.
 */
export async function handlePoolWithdraw(db: Database, event: PoolWithdrawEvent): Promise<void> {
  validatePoolId(event.pool_id);
  if (event.amount <= BigInt(0)) {
    throw new Error("PoolWithdraw event amount must be positive");
  }

  await db.adjustPoolBalance(event.pool_id, -event.amount, event.ledger);
}

/**
 * Handle a PoolAdminAdded event.
 *
 * Appends a new admin address to the pool's admins list.
 * Idempotent: if the admin already exists the database layer must silently
 * skip the insertion (e.g. INSERT … ON CONFLICT DO NOTHING).
 */
export async function handlePoolAdminAdded(
  db: Database,
  event: PoolAdminAddedEvent
): Promise<void> {
  validatePoolId(event.pool_id);
  if (!event.new_admin) {
    throw new Error("PoolAdminAdded event missing required field: new_admin");
  }

  await db.addPoolAdmin(event.pool_id, event.new_admin, event.ledger);
}

/**
 * Handle a PoolAdminRemoved event.
 *
 * Removes an admin address from the pool's admins list.
 * Idempotent: if the admin does not exist the database layer must silently
 * skip the deletion.
 */
export async function handlePoolAdminRemoved(
  db: Database,
  event: PoolAdminRemovedEvent
): Promise<void> {
  if (!event.pool_id) {
    throw new Error("PoolAdminRemoved event missing required field: pool_id");
  }
  if (!event.removed_admin) {
    throw new Error("PoolAdminRemoved event missing required field: removed_admin");
  }

  await db.removePoolAdmin(event.pool_id, event.removed_admin, event.ledger);
}
