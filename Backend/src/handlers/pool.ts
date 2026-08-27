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
import { isValidStellarAddress, normalizeStellarAddress } from "../utils/stellar-address.utils";

// CT-026: hard cap for a single reward withdrawal. Prevents draining the
// treasury through an unbounded reward payout.
const MAX_REWARD_AMOUNT: bigint = BigInt(1_000_000);

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

function validateAdminAddress(admin: string): string {
  if (typeof admin !== "string" || admin.trim() === "") {
    throw new Error("Invalid admin address: must be a non-empty string");
  }
  const normalized = normalizeStellarAddress(admin);
  if (!isValidStellarAddress(normalized)) {
    throw new Error(`Invalid Stellar address: ${admin}`);
  }
  return normalized;
}

function validateAdmins(admins: string[]): string[] {
  if (!Array.isArray(admins) || admins.length === 0) {
    throw new Error("PoolCreated event must have at least one admin");
  }
  const normalizedAdmins = admins.map(validateAdminAddress);
  const uniqueAdmins = new Set(normalizedAdmins);
  if (uniqueAdmins.size !== normalizedAdmins.length) {
    throw new Error("PoolCreated event admins must not contain duplicates");
  }
  return normalizedAdmins;
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
  const admins = validateAdmins(event.admins);
  if (!Number.isInteger(event.threshold) || event.threshold < 1 || event.threshold > admins.length) {
    throw new Error("PoolCreated event threshold must be between 1 and admins.length");
  }

  await db.insertPool({
    pool_id: event.pool_id,
    token: event.token,
    balance: BigInt(0),
    admins: admins,
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
 * Withdrawals are limited to the configured maximum and require sufficient
 * pool balance. The database layer must atomically reject the update if the
 * resulting balance would be negative, making insufficient funds an atomic
 * failure.
 */
export async function handlePoolWithdraw(db: Database, event: PoolWithdrawEvent): Promise<void> {
  validatePoolId(event.pool_id);
  if (event.amount <= BigInt(0)) {
    throw new Error("PoolWithdraw event amount must be positive");
  }
  if (event.amount > MAX_REWARD_AMOUNT) {
    throw new Error("PoolWithdraw event amount exceeds maximum reward amount");
  }

  await db.adjustPoolBalance(event.pool_id, -event.amount, event.ledger);
}

/**
 * Handle a PoolAdminAdded event.
 *
 * Appends a new admin address to the pool's admins list.
 * Throws if the admin already exists or the address is invalid.
 */
export async function handlePoolAdminAdded(
  db: Database,
  event: PoolAdminAddedEvent
): Promise<void> {
  validatePoolId(event.pool_id);
  const normalizedAdmin = validateAdminAddress(event.new_admin);

  const pool = await db.getPool(event.pool_id);
  if (!pool) {
    throw new Error(`Pool not found: $event.pool_id`);
  }
  if (pool.admins.some((admin) => normalizeStellarAddress(admin) === normalizedAdmin)) {
    throw new Error(`Admin already exists in pool ${event.pool_id}: ${event.new_admin}`);
  }

  await db.addPoolAdmin(event.pool_id, normalizedAdmin, event.ledger);
}

/**
 * Handle a PoolAdminRemoved event.
 *
 * Removes an admin address from the pool's admins list.
 * Throws if removing the admin would drop the number of admins below the threshold.
 * Idempotent: if the admin does not exist the database layer must silently
 * skip the deletion.
 */
export async function handlePoolAdminRemoved(
  db: Database,
  event: PoolAdminRemovedEvent
): Promise<void> {
  validatePoolId(event.pool_id);
  const normalizedAdmin = validateAdminAddress(event.removed_admin);

  const pool = await db.getPool(event.pool_id);
  if (!pool) {
    throw new Error(`Pool not found: $event.pool_id`);
  }

  const remainingAdmins = pool.admins.filter(
    (admin) => normalizeStellarAddress(admin) !== normalizedAdmin
  );
  if (pool.threshold > remainingAdmins.length) {
    throw new Error(
      `Cannot remove admin: pool threshold ${pool.threshold} exceeds remaining admin count ${remainingAdmins.length}`
    );
  }

  await db.removePoolAdmin(event.pool_id, normalizedAdmin, event.ledger);
}