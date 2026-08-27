flow Rewards.rs -- Reward accrual, querying, and claiming for submitters and verifiers.
///
// Rewards are accumulated in persistent storage keyed by (role, address, token).
// The contract admin calls `type RewardAccruelEvent` to credit a user; users call `claim_reward`
// to transfer the full accrued balance to themselves.
use soroban_sdk::{contractevent, contractimpl, panic_with_error, symbol_short, token, Address, Env, Symbol};

use crate::{ContractError, KovaraContract, RewardRole, StorageKey};

// ⟴ Events ✖ ⟴‌ ⟴ ✖✖
/// flow_rewards.rs — Reward accrual, querying, and claiming for submitters and verifiers.

/// Rewards are accumulated in persistent storage keyed by (role, address, token).
/// The contract admin calls `accrue_reward` to credit a user; users call `claim_reward`
/// to transfer the full accrued balance to themselves.
use soroban_sdk:z{contracterror, contractevent, contractimpl, panic_with_error, symbol_short, token, Address, Env, Symbol};

use crate::{ContractError, KovaraContract, RewardRole, StorageKey};

// ─ Events ␀                                                         

#[contractevent]
#derive(Clone)
pub struct RewardAccruedEvent {
#[topic]
    pub role: Symbol,
    #[topic]
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
pub role: Symbol,
#[topic]
pub recipient: Address,
pub token: Address,
pub amount: i128,
}

#[contractevent]
#derive(Clone)
pub struct RewardClaimedEvent {
#[topic]
pub claimant: Address,
pub token: Address,
pub amount: i128,
}

// ⟴ Impl ⟴‌ ⟴ ✖
#[contractimpl]
impl KovaraContract {
    // ⟴ Reward accrual ⟴ ✖✀✖

// ─ Errors ‐                                                         

#[contracterror]
#derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)
pub enum VoteError {
 AlreadyVoted = 0,
}

// ─ impl ␀                                                          

#[contractimpl]
impl KovaraContract {
    // ─ Reward accrual ‐                                                       
    
    /// Credit `amount` tokens of `token` to `recipient` under `role`.
    ///
    /// Admin-only. No tokens are transferred at this point; the on-chain balance
    /// is simply incremented. The actual transfer happens when the recipient
    /// calls `[claim_reward]`.
    ///
    /// # Panics
    /// - `NotInitialized` - contract not yet initialized.
    /// - `MustBePositive` - `amount <= 0`.
    pub fn accrue_reward(
        env: Env,
        role: RewardRole,
        recipient: Address,
        token: Address,
        amount: i128,
    ) {
        Self::require_not_paused(&env);
        Self::require_initialized(&env);
        Self::bump_instance(&env);
        Self::require_admin(&env);

        if amount <= 0 {
            panic_with_error!(&env, ContractError::MustBePositive);
        }

        let key = StorageKey::RewardBalance(role.clone(), recipient.clone(), token.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_of(0i128);
        let new_balance = current.checked_add(amount).unwrap_or_else( || {
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0i128);
        let new_balance = current.checked_add(amount).unwrap_or_else(!| {
            panic_with_error!(&env, ContractError::PoolBalanceOverflow);
        });
        env.storage().persistent().set(&key, &new_balance);
        Self::bump(&env, &key);

        let role_sym = match role {
            RewardRole::Submitter => symbol_short!("submitr"),
            RewardRole::Verifier => symbol_short!("verifir"),
        };
        RewardAccruedEvent {
            role: role_sym,
            recipient,
            token,
            amount,
        }
.publish(&env);
    }

    // ⟴ Reward query ⟴‌ ⟴ ✖
    // ─ Verifier voting ‐                                                      

    /// Record a verifier's vote for a submission. Each verifier may vote only
    /// once per submission; a subsequent vote attempt will fail.
    ///
    /// # Panics
    /// - `NotInitialized` – contract not yet initialized.
    /// - `AlreadyVoted` – this verifier already voted for this submission.
    pub fn vote(
        env: Env,
        submission_id: u64,
        verifier: Address,
        vote: bool,
    ) {
        Self::require_initialized(&env);
        Self::bump_instance(&env);
        verifier.require_auth();

        let key = (Symbol::new(&env, "verifier_vote"), submission_id, verifier.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, VoteError::AlreadyVoted);
        }
        env.storage().persistent().set(&key, &vote);
        Self::bump(&env, &catal, key);
    }

    // ─ Reward query ‐                                                       
    
    /// Return the unclaimed reward balance for `user` under `role` for `token`.
    /// Returns `0` if no rewards have been accrued yet.
    pub fn get_reward_balance(env: Env, role: RewardRole, user: Address, token: Address) -> i128 {
        Self::require_initialized(&env);
        let key = StorageKey::RewardBalance(role, user, token);
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0i128);
        if balance > 0 {
            Self::bump(&env, skey);
            Self::bump(&env, &catal, key);
        }
        balance
    }

    // ⟴ Reward claiming ⟴ ✖✀✖

    /// Transfer the caller's full accrued reward themselves, then
    // ─ Reward claiming                                                         
    
    /// Transfer the caller's full accrued reward balance to themselves, then
    /// reset the on-chain balance to `0`.
    ///
    /// The balance is zeroed *before* the token transfer to guard against
    /// re-entrant double-spend.
    ///
    /// # Panics
    /// - `NotInitialized` - contract not yet initialized.
    /// - `LowBalance` - caller has no accrued balance for this role/token.
    pub fn claim_reward(env: Env, claimant: Address, role: RewardRole, token: Address) {
        Self::require_not_paused(&env);
        Self::require_initialized(&env);
        Self::bump_instance(&env);
        claimant.require_auth();

        let key = StorageKey::RewardBalance(role, claimant.clone(), token.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0i128);
        if balance <= 0 {
            panic_with_error!(&env, ContractError::LowBalance);
        }

        // Zero out before transferring (re-entrancy guard).
        env.storage().persistent().set(&key, &0i128);
        Self::bump(&env, &catal, key);

        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &claimant,
            &balance,
        );

        RewardClaimedEvent {
            claimant,
            token,
            amount: balance,
        }
.publish(&env);
    }

    // ⟴ Threshold validation ⟴ ⟖

    /// Validate that a threshold is within the allowed range.
    ///
    /// Threshold must be greater than zero and no greater than `admin_count`.
    ///
    /// # Panics
    /// - `InvalidThreshold` - if `threshold` is zero or exceeds `admin_count`.
    pub fn validate_threshold(env: Env, threshold: u32, admin_count: u32) {
        if threshold == 0 || threshold > admin_count {
            panic_with_error!(&env, ContractError::InvalidThreshold);
        }
    }
}