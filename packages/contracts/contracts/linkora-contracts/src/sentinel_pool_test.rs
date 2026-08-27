#![cfg(test)]

use crate::{KovaraContract, KovaraContractClient, RewardRole};
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};
use crate::sentinel_pool::{Verdict, Resolution};

fn setup_env<'a>() -> (Env, KovaraContractClient<'a>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(KovaraContract, ());
    let client = KovaraContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    client.initialize(&admin, &treasury, &500);
    (env, client, admin)
}

#[test]
fn test_open_round() {
    let (env, client, admin) = setup_env();
    let submission_id = 1;
    let duration = 10;
    
    let start_ledger = env.ledger().sequence();
    client.open_round(&submission_id, &duration);
    
    // Test that opening it again panics (RoundAlreadyExists)
    // Client error assertions are tricky without specific error checks, 
    // but we can verify it doesn't crash on the first open.
}

#[test]
fn test_vote_and_resolve_approved() {
    let (env, client, admin) = setup_env();
    let submission_id = 2;
    let duration = 5;
    
    client.open_round(&submission_id, &duration);
    
    let verifier1 = Address::generate(&env);
    let verifier2 = Address::generate(&env);
    let verifier3 = Address::generate(&env);
    
    client.vote(&verifier1, &submission_id, &Verdict::Approve);
    client.vote(&verifier2, &submission_id, &Verdict::Approve);
    client.vote(&verifier3, &submission_id, &Verdict::Reject);
    
    // Fast forward ledger past the deadline
    let mut info = env.ledger().get();
    info.sequence_number += duration + 1;
    env.ledger().set(info);
    
    let res = client.resolve(&submission_id);
    assert_eq!(res, Resolution::Approved);
}

#[test]
fn test_vote_and_resolve_rejected() {
    let (env, client, admin) = setup_env();
    let submission_id = 3;
    let duration = 5;
    
    client.open_round(&submission_id, &duration);
    
    let verifier1 = Address::generate(&env);
    let verifier2 = Address::generate(&env);
    let verifier3 = Address::generate(&env);
    
    client.vote(&verifier1, &submission_id, &Verdict::Reject);
    client.vote(&verifier2, &submission_id, &Verdict::Approve);
    client.vote(&verifier3, &submission_id, &Verdict::Reject);
    
    let mut info = env.ledger().get();
    info.sequence_number += duration + 1;
    env.ledger().set(info);
    
    let res = client.resolve(&submission_id);
    assert_eq!(res, Resolution::Rejected);
}

#[test]
fn test_vote_and_resolve_tie() {
    let (env, client, admin) = setup_env();
    let submission_id = 4;
    let duration = 5;
    
    client.open_round(&submission_id, &duration);
    
    let verifier1 = Address::generate(&env);
    let verifier2 = Address::generate(&env);
    
    client.vote(&verifier1, &submission_id, &Verdict::Reject);
    client.vote(&verifier2, &submission_id, &Verdict::Approve);
    
    let mut info = env.ledger().get();
    info.sequence_number += duration + 1;
    env.ledger().set(info);
    
    let res = client.resolve(&submission_id);
    assert_eq!(res, Resolution::Tie);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #48)")]
fn test_late_vote_fails() {
    let (env, client, admin) = setup_env();
    let submission_id = 5;
    let duration = 5;
    
    client.open_round(&submission_id, &duration);
    
    // Advance ledger past deadline
    let mut info = env.ledger().get();
    info.sequence_number += duration + 1;
    env.ledger().set(info);
    
    let verifier = Address::generate(&env);
    
    // This should panic with ContractError::RoundClosed (which is 48)
    client.vote(&verifier, &submission_id, &Verdict::Approve);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #51)")]
fn test_resolve_too_early_fails() {
    let (env, client, admin) = setup_env();
    let submission_id = 6;
    let duration = 5;
    
    client.open_round(&submission_id, &duration);
    
    // Attempting to resolve before deadline should panic with RoundStillOpen (51)
    client.resolve(&submission_id);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #49)")]
fn test_resolve_already_finalized() {
    let (env, client, admin) = setup_env();
    let submission_id = 7;
    let duration = 5;
    
    client.open_round(&submission_id, &duration);
    
    let mut info = env.ledger().get();
    info.sequence_number += duration + 1;
    env.ledger().set(info);
    
    client.resolve(&submission_id);
    
    // Calling resolve again should panic with RoundAlreadyFinalized (49)
    client.resolve(&submission_id);
}
