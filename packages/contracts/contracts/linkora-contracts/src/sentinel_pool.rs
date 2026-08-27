use soroban_sdk::{
    contractevent, contractimpl, panic_with_error, Address, Env, Symbol,
};

use crate::{ContractError, KovaraContract, StorageKey};

// ── Types ─────────────────────────────────────────────────────────────────────

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Verdict {
    Approve,
    Reject,
}

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Resolution {
    Approved,
    Rejected,
    Tie,
}

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RoundStatus {
    Open,
    Finalized(Resolution),
}

#[soroban_sdk::contracttype]
#[derive(Clone, Debug)]
pub struct VoteRound {
    pub submission_id: u64,
    pub start_ledger: u32,
    pub end_ledger: u32,
    pub status: RoundStatus,
    pub votes_approve: u32,
    pub votes_reject: u32,
}

// ── Events ────────────────────────────────────────────────────────────────────

#[contractevent]
#[derive(Clone)]
pub struct VoteCastEvent {
    #[topic]
    pub submission_id: u64,
    #[topic]
    pub verifier: Address,
    pub verdict: Verdict,
}

#[contractevent]
#[derive(Clone)]
pub struct RoundFinalizedEvent {
    #[topic]
    pub submission_id: u64,
    pub resolution: Resolution,
}

#[contractevent]
#[derive(Clone)]
pub struct RoundOpenedEvent {
    #[topic]
    pub submission_id: u64,
    pub start_ledger: u32,
    pub end_ledger: u32,
}

// ── impl ──────────────────────────────────────────────────────────────────────

#[contractimpl]
impl KovaraContract {
    /// Open a new voting round for a submission.
    /// 
    /// Admin-only. 
    ///
    /// # Panics
    /// - `RoundAlreadyExists` if the round for this submission is already open.
    pub fn open_round(env: Env, submission_id: u64, duration_ledgers: u32) {
        Self::require_initialized(&env);
        Self::bump_instance(&env);
        Self::require_admin(&env);

        let key = StorageKey::VoteRound(submission_id);
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, ContractError::RoundAlreadyExists);
        }

        let start_ledger = env.ledger().sequence();
        let end_ledger = start_ledger + duration_ledgers;

        let round = VoteRound {
            submission_id,
            start_ledger,
            end_ledger,
            status: RoundStatus::Open,
            votes_approve: 0,
            votes_reject: 0,
        };

        env.storage().persistent().set(&key, &round);
        Self::bump(&env, &key);

        RoundOpenedEvent {
            submission_id,
            start_ledger,
            end_ledger,
        }
        .publish(&env);
    }

    /// Cast a verification vote on a submission.
    ///
    /// # Panics
    /// - `RoundNotFound` if the round does not exist.
    /// - `RoundClosed` if the current ledger is past the end ledger.
    /// - `RoundAlreadyFinalized` if the round has already been resolved.
    /// - `AlreadyVoted` if the verifier has already voted.
    pub fn vote(env: Env, verifier: Address, submission_id: u64, verdict: Verdict) {
        Self::require_initialized(&env);
        Self::bump_instance(&env);
        verifier.require_auth();

        let key = StorageKey::VoteRound(submission_id);
        let mut round: VoteRound = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::RoundNotFound));

        match round.status {
            RoundStatus::Open => {}
            RoundStatus::Finalized(_) => {
                panic_with_error!(&env, ContractError::RoundAlreadyFinalized);
            }
        }

        if env.ledger().sequence() > round.end_ledger {
            panic_with_error!(&env, ContractError::RoundClosed);
        }

        let voted_key = StorageKey::HasVoted(submission_id, verifier.clone());
        if env.storage().persistent().has(&voted_key) {
            panic_with_error!(&env, ContractError::AlreadyVoted);
        }

        match verdict {
            Verdict::Approve => round.votes_approve += 1,
            Verdict::Reject => round.votes_reject += 1,
        }

        env.storage().persistent().set(&voted_key, &true);
        env.storage().persistent().set(&key, &round);
        Self::bump(&env, &voted_key);
        Self::bump(&env, &key);

        VoteCastEvent {
            submission_id,
            verifier,
            verdict,
        }
        .publish(&env);
    }

    /// Resolve quorum for a submission and emit one immutable outcome.
    ///
    /// # Panics
    /// - `RoundNotFound` if the round does not exist.
    /// - `RoundStillOpen` if the current ledger is before or equal to the end ledger.
    /// - `RoundAlreadyFinalized` if the round has already been resolved.
    pub fn resolve(env: Env, submission_id: u64) -> Resolution {
        Self::require_initialized(&env);
        Self::bump_instance(&env);

        let key = StorageKey::VoteRound(submission_id);
        let mut round: VoteRound = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::RoundNotFound));

        if let RoundStatus::Finalized(_) = round.status {
            panic_with_error!(&env, ContractError::RoundAlreadyFinalized);
        }

        if env.ledger().sequence() <= round.end_ledger {
            panic_with_error!(&env, ContractError::RoundStillOpen);
        }

        let resolution = if round.votes_approve > round.votes_reject {
            Resolution::Approved
        } else if round.votes_reject > round.votes_approve {
            Resolution::Rejected
        } else {
            Resolution::Tie
        };

        round.status = RoundStatus::Finalized(resolution.clone());
        env.storage().persistent().set(&key, &round);
        Self::bump(&env, &key);

        RoundFinalizedEvent {
            submission_id,
            resolution: resolution.clone(),
        }
        .publish(&env);

        resolution
    }
}
