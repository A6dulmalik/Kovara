# Kovara Linkora Contract

A Soroban smart contract powering the Kovara social media protocol on Stellar. It provides:

- **Profiles** — username registration with a reverse-index for uniqueness and a designated SEP-41 creator token for tips.
- **Social graph** — follow / unfollow with bidirectional list maintenance; block / unblock.
- **Posts** — content creation (1–280 chars), per-author index, and pagination.
- **Reactions** — like tracking per post, idempotent.
- **Tipping** — SEP-41 token transfers with a configurable protocol fee (basis-points), per-tipper cooldown window, and a block-list check.
- **Community pools** — named token vaults with M-of-N admin quorum for deposits and withdrawals.
- **Proposals** — structured withdrawal proposals for pools; signers accumulate until the pool threshold is met, then funds are transferred automatically.
- **Admin controls** — contract admin can set the fee, treasury address, and tip cooldown window. Pool admins are distinct from the contract admin.

---

## Storage layout

| `StorageKey` variant | Storage type | Description |
|---|---|---|
| `Post(u64)` | persistent | post data keyed by auto-incremented ID |
| `Profile(Address)` | persistent | user profile (username + creator_token) |
| `Following(Address)` | persistent | ordered list of addresses this user follows |
| `Followers(Address)` | persistent | ordered list of addresses that follow this user |
| `Pool(Symbol)` | persistent | pool data (token, balance, admins, threshold) |
| `Proposal(u64)` | persistent | withdrawal proposal (pool_id, amount, recipient, signers, status) |
| `Like(u64, Address)` | persistent | presence flag: user has liked a post |
| `AuthorPosts(Address)` | persistent | ordered list of post IDs by author |
| `Blocks(Address)` | persistent | map of addresses blocked by a user |
| `UsernameIndex(String)` | persistent | reverse index: username → owner address |
| `TipCooldown(u64, Address)` | temporary | last-tip ledger sequence for (post_id, tipper) |

Instance storage keys: `INITIALIZED`, `ADMIN`, `TREASURY`, `FEE_BPS`, `TIP_COOLDOWN_WINDOW`, `POST_CT`, `PROFILE_CREATED_CT`, `PROPOSAL_CT`.

---

## Public entry points

### Initialization

| Function | Description |
|---|---|
| `initialize(admin, treasury, fee_bps)` | One-time contract setup. Panics if called again. |

### Profiles

| Function | Description |
|---|---|
| `set_profile(user, username, creator_token)` | Create or update a profile. Manages the reverse index automatically. |
| `get_profile(user)` | Return the profile for `user`, or `None`. |
| `get_profile_count()` | Number of unique addresses that have ever registered. |
| `delete_profile(user)` | Remove the profile and free the username from the reverse index. |
| `get_address_by_username(username)` | Resolve a username to an address. |

### Social graph

| Function | Description |
|---|---|
| `follow(follower, followee)` | Add to both `Following` and `Followers` lists. Idempotent. |
| `unfollow(follower, followee)` | Remove from both lists. |
| `get_following(user, offset, limit)` | Paginate following list (max 50 per page). |
| `get_followers(user, offset, limit)` | Paginate followers list (max 50 per page). |
| `block_user(blocker, blocked)` | Add `blocked` to `blocker`'s block map. |
| `unblock_user(blocker, blocked)` | Remove from block map. |
| `is_blocked(blocker, blocked)` | Return `true` if `blocked` is in `blocker`'s map. |

### Posts

| Function | Description |
|---|---|
| `create_post(author, content)` | Publish a post (1–280 chars). Returns the new post ID. |
| `get_post(post_id)` | Return the post, or `None`. |
| `delete_post(author, post_id)` | Author-only deletion. |
| `get_posts_by_author(author, offset, limit)` | Paginate an author's post IDs. |

### Reactions

| Function | Description |
|---|---|
| `like_post(user, post_id)` | Like a post. Idempotent. |
| `get_like_count(post_id)` | Return the total like count for a post. |
| `has_liked(user, post_id)` | Return `true` if the user has liked the post. |

### Tipping

| Function | Description |
|---|---|
| `tip(tipper, post_id, token, amount)` | Transfer `amount` tokens to the post author minus the fee. |
| `set_tip_cooldown_window(cooldown_ledgers)` | Admin-only. Set the per-tipper per-post cooldown. |
| `get_tip_cooldown_window()` | Return the current cooldown in ledgers. |

### FlowRewards

| Function | Description |
|---|---|
| `accrue_reward(role, recipient, token, amount)` | Admin-only reward accrual. |
| `get_reward_balance(role, user, token)` | Return an unclaimed reward balance. |
| `claim_reward(claimant, role, token)` | Transfer the claimant's accrued reward. |
| `fund_rewards(depositor, token, amount)` | Authenticated deposit of reward assets. |
| `recover_rewards(recipient, token, amount)` | Admin-only recovery of unreserved assets. |
| `get_reward_liability(token)` | Return total outstanding claims for a token. |

### Community pools

| Function | Description |
|---|---|
| `create_pool(admin, pool_id, token, initial_admins, threshold)` | Create a named pool with M-of-N governance. |
| `pool_deposit(depositor, pool_id, token, amount)` | Deposit tokens into a pool. |
| `pool_withdraw(signers, pool_id, amount, recipient)` | Withdraw if ≥ threshold admins sign. |
| `get_pool(pool_id)` | Return pool data, or `None`. |
| `get_pool_admins(pool_id)` | Return the admin list for a pool. |
| `add_pool_admin(signers, pool_id, new_admin)` | Add an admin (requires quorum). |
| `remove_pool_admin(signers, pool_id, admin)` | Remove an admin (requires quorum; threshold must remain reachable). |
| `update_pool_threshold(signers, pool_id, threshold)` | Change the quorum threshold (requires current quorum). |

### Proposals

| Function | Description |
|---|---|
| `create_proposal(proposer, pool_id, amount, recipient)` | Create a withdrawal proposal. Proposer auto-signs; auto-executes if threshold is 1. |
| `sign_proposal(signer, proposal_id)` | Add a signature. Auto-executes once threshold is reached. |
| `get_proposal(proposal_id)` | Return the proposal, or `None`. |

### Admin

| Function | Description |
|---|---|
| `set_fee(fee_bps)` | Update the protocol fee (max 10 000 = 100%). |
| `set_treasury(treasury)` | Update the treasury address. |
| `get_fee_bps()` | Return the current fee in basis points. |
| `get_treasury()` | Return the current treasury address. |
| `upgrade(new_wasm_hash)` | Upgrade contract WASM. |

---

## Error codes

| Code | Name | Meaning |
|---|---|---|
| 1 | `AlreadyInitialized` | `initialize` called more than once |
| 2 | `InvalidFee` | fee exceeds 10 000 bps |
| 5 | `UsernameTaken` | username claimed by a different address |
| 7 | `Blocked` | operation blocked by block-list |
| 11 | `InvalidPaginationLimit` | limit is 0 or > 50 |
| 13 | `WrongTokenForTip` | token does not match author's creator_token |
| 14 | `TipCooldownNotExpired` | too soon to tip again |
| 15 | `PoolAlreadyExists` | pool with this ID already exists |
| 18 | `PoolNotFound` | pool ID not found |
| 19 | `WrongTokenForPool` | deposited token does not match pool token |
| 21 | `InsufficientSigners` | fewer signers than pool threshold |
| 22 | `UnauthorizedSigner` | signer is not in pool.admins |
| 23 | `LowBalance` | pool balance is below withdrawal amount |
| 30 | `NotInitialized` | contract not yet initialized |

See `ContractError` in `lib.rs` for the full list of error codes.

### FlowRewards treasury controls

`fund_rewards(depositor, token, amount)` requires the depositor's authorization,
rejects non-token assets, and transfers assets into the contract. Every accrued
reward increases a persistent per-token liability; every claim decreases it.
`recover_rewards(recipient, token, amount)` is admin-only and can transfer only
the token balance exceeding that liability. Funding and recovery emit events
(`RewardFundsDepositedEvent` and `RewardFundsRecoveredEvent`) for auditing.
Invalid assets, insufficient surplus, and attempts to withdraw reserved funds
fail without changing state.

---

## Testing

All tests live in `src/test.rs` under `#[cfg(test)]`. Each test creates a
fresh `Env::default()` and calls `setup_contract` so that no state leaks
between cases. The `mock_all_auths()` helper bypasses authorization checks,
allowing tests to focus on business logic.

```bash
cargo test -p linkora-contracts
```
