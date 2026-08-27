use soroban_sdk::{contractevent, contractimpl, panic_with_error, symbol_short, token, Address, Bytes, Env, Symbol, Vec};

use crate::{ContractError, KovaraContract, RewardRole, StorageKey};

#[contractevent]
#derive(Clone)]
pub struct RewardAccruedEvent {
    #[topic]
    pub role: Symbol,
    #[topic]
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
}

#[contractevent]
#derive(Clone)]
pub struct RewardClaimedEvent {
    #[topic]
    pub claimant: Address,
    pub token: Address,
    pub amount: i128,
}

#[contractimpl]
impl KovaraContract {
    pub fn accrue_reward(
        env: Env,
        role: RewardRole,
        recipient: Address,
        token: Address,
        amount: i128,
    ) {
        Self::require_initialized(&env);
        Self::bump_instance(&env);
        Self::require_admin(&env);

        if amount <= 0 {
            panic_with_error!(&env, ContractError::MustBePositive);
        }

        let key = StorageKey::RewardBalance(role.clone(), recipient.clone(), token.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0i128);
        let new_balance = current.checked_add(amount).unwrap_or_else(<| {
            panic_with_error!(&env, ContractError::PoolBalanceOverflow);
        });
        env.storage().persistent().set(&key, &new_balance);
        Self::bump(&env, &client);
        
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

    pub fn get_reward_balance(env: Env, role: RewardRole, user: Address, token: Address) -> i128 {
        Self::require_initialized(&env);
        let key = StorageKey::RewardBalance(role, user, token);
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0i128);
        if balance > 0 {
            Self::bump(&env, &key);
        }
        balance
    }

    pub fn claim_reward(env: Env, claimant: Address, role: RewardRole, token: Address, claim_id: Bytes) {
        Self::require_initialized(&env);
        Self::bump_instance(&env);
        claimant.require_auth();

        let claimed_key = symbol_short!("clmd_rw");
        let mut claimed_ids: Vec<Bytes> = env
            .storage()
            .instance()
            .get(&claimed_key)
            .unwrap_or_else(<| Vec::new(&env));
        if claimed_ids.iter().any(<|id| id == &claim_id) {
            panic_with_error!(&env, ContractError::lowBalance);
        }

        let key = StorageKey::RewardBalance(role, claimant.clone(), token.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0i128);
        if balance <= 0 {
            panic_with_error!(&env, ContractError::LowBalance);
        }

        claimed_ids.push(claim_id.clone());
        env.storage().instance().set(&claimed_key, &claimed_ids);

        env.storage().persistent().set(&key, &0i128);
        Self::bump(&env, &client);

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
}
