#![no_std]
//! `KovaraIndex` — daily Kōvara Value Index (KVI) records, one per country
//! per day.
//!
//! This crate currently carries the minimum surface needed by **CT-035**
//! (complete daily index events) and **CT-036** (contract storage
//! versioning). The rest of the index behaviour is owned by other issues and
//! will extend what is here rather than replace it:
//!
//! | Issue | Adds |
//! |---|---|
//! | CT-030 | Daily index storage semantics beyond the single record below |
//! | CT-031 | KVI rounding rules for `value` |
//! | CT-032 | Deterministic aggregation producing `value` |
//! | CT-033 | Rejection of duplicate index updates |
//! | CT-034 | The authorization policy for who may update |
//!
//! Deliberately **not** implemented here: rounding, aggregation, duplicate
//! rejection, and the authorization policy. `set_daily_index` therefore
//! accepts a value that some other component computed, requires only that the
//! named updater signed for itself, and allows a later write to replace an
//! earlier one. Each of those is a named issue above, and guessing at their
//! semantics now would only have to be undone.
//!
//! # Storage versioning (CT-036)
//!
//! Two mechanisms, and they do different jobs.
//!
//! **The schema version is recorded at initialization** and every operation
//! checks it. A contract deployed under one schema and then handed code
//! expecting another fails with [`Error::IncompatibleSchema`] rather than
//! reading records it does not understand. That is the "incompatible changes
//! are rejected" half.
//!
//! **Record keys embed the schema version**, so `DailyIndex(1, "NG", d)` and
//! `DailyIndex(2, "NG", d)` are different entries. That is the "storage keys
//! are versioned" half, and it is what makes a future migration possible: v2
//! records can be written alongside v1 rather than on top of them, so a
//! migration is resumable and a failed one leaves the old data intact.
//!
//! Executing a migration is out of scope here — CT-036 asks for versioning
//! and rejection, not a migration engine. The keyspace above is the
//! precondition for one.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, Symbol,
};

#[cfg(test)]
mod test;

/// The storage schema this build of the contract understands.
///
/// Bump this in the same commit as any change to the shape of a stored value
/// or to the meaning of a key. A deployment initialized under an older schema
/// then rejects every operation until it is migrated, which is the intended
/// outcome — the alternative is reading a v1 record as though it were v2.
pub const SCHEMA_VERSION: u32 = 1;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// `initialize` has already run.
    AlreadyInitialized = 1,

    /// The contract has not been initialized, so it has no schema version.
    NotInitialized = 2,

    /// The deployment's stored schema version does not match
    /// [`SCHEMA_VERSION`]. The data must be migrated before this code can
    /// safely operate on it.
    IncompatibleSchema = 3,

    /// `basket_version` was zero. Zero is reserved for "no basket recorded",
    /// which is exactly the ambiguity CT-035 exists to remove.
    InvalidBasketVersion = 4,

    /// The source period ends before it starts.
    InvalidSourcePeriod = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Instance: the schema version this deployment was initialized at.
    Schema,

    /// Instance: the administrator address recorded at initialization.
    Admin,

    /// Persistent: `(schema_version, country, date)` → [`DailyIndex`].
    ///
    /// The schema version leads the key so that records written under
    /// different schemas never collide.
    DailyIndex(u32, Symbol, u64),
}

/// One country's index value for one day.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DailyIndex {
    /// ISO country code the index covers.
    pub country: Symbol,

    /// The day this index describes, as days since the Unix epoch.
    pub date: u64,

    /// The index value, in the contract's fixed-point representation.
    ///
    /// CT-031 defines the rounding rules that produce this; CT-032 defines
    /// the aggregation. This crate stores whatever it is given.
    pub value: i128,

    /// Which basket definition the value was computed against.
    ///
    /// Without this a consumer cannot tell a real movement in prices from a
    /// change in what is being measured.
    pub basket_version: u32,

    /// Start of the period the underlying observations cover (Unix seconds).
    pub source_period_start: u64,

    /// End of the period the underlying observations cover (Unix seconds).
    pub source_period_end: u64,

    /// The address that submitted this record.
    pub updater: Address,

    /// The schema version in force when the record was written.
    pub schema_version: u32,
}

/// Emitted whenever a daily index record is written (CT-035).
///
/// Carries every field CT-035 requires — country, date, value, basket,
/// source period, updater — so a consumer can act on the event alone without
/// a follow-up read. `country` and `date` are topics because those are the
/// two dimensions an indexer filters on.
///
/// `schema_version` rides along so a consumer can tell which storage schema
/// produced the record, which matters the moment a migration is in progress
/// and both schemas are briefly live.
#[contractevent]
#[derive(Clone)]
pub struct DailyIndexUpdated {
    #[topic]
    pub country: Symbol,

    #[topic]
    pub date: u64,

    pub value: i128,
    pub basket_version: u32,
    pub source_period_start: u64,
    pub source_period_end: u64,
    pub updater: Address,
    pub schema_version: u32,
}

#[contract]
pub struct KovaraIndex;

#[contractimpl]
impl KovaraIndex {
    /// Initialize the contract, recording the admin and the schema version.
    ///
    /// # Errors
    /// * `AlreadyInitialized` — initialization has already happened
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Schema) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::Schema, &SCHEMA_VERSION);

        Ok(())
    }

    /// The schema version this deployment was initialized at.
    ///
    /// `None` before initialization. Deployment tooling uses this to decide
    /// whether a migration is needed without having to provoke an error.
    pub fn deployed_schema_version(env: Env) -> Option<u32> {
        env.storage().instance().get(&DataKey::Schema)
    }

    /// The schema version this build of the contract understands.
    pub fn expected_schema_version(_env: Env) -> u32 {
        SCHEMA_VERSION
    }

    /// Whether this deployment's data is compatible with this build.
    pub fn is_schema_compatible(env: Env) -> bool {
        Self::require_compatible_schema(&env).is_ok()
    }

    /// The administrator recorded at initialization.
    pub fn admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    /// Write a daily index record and emit [`DailyIndexUpdated`].
    ///
    /// The `updater` signs for itself. *Which* addresses are permitted to
    /// update is CT-034's decision, not this function's — this establishes
    /// only that the address named in the record and the event is the address
    /// that actually authorized the call, so the `updater` field means
    /// something.
    ///
    /// # Errors
    /// * `NotInitialized` — the contract has no schema version yet
    /// * `IncompatibleSchema` — stored schema differs from [`SCHEMA_VERSION`]
    /// * `InvalidBasketVersion` — `basket_version` is zero
    /// * `InvalidSourcePeriod` — the period ends before it starts
    #[allow(clippy::too_many_arguments)]
    pub fn set_daily_index(
        env: Env,
        updater: Address,
        country: Symbol,
        date: u64,
        value: i128,
        basket_version: u32,
        source_period_start: u64,
        source_period_end: u64,
    ) -> Result<(), Error> {
        let schema_version = Self::require_compatible_schema(&env)?;

        updater.require_auth();

        // Only the two fields CT-035 introduces are validated here. Country,
        // date and value validation belong to CT-004, CT-005 and CT-030.
        if basket_version == 0 {
            return Err(Error::InvalidBasketVersion);
        }

        if source_period_end < source_period_start {
            return Err(Error::InvalidSourcePeriod);
        }

        let record = DailyIndex {
            country: country.clone(),
            date,
            value,
            basket_version,
            source_period_start,
            source_period_end,
            updater: updater.clone(),
            schema_version,
        };

        env.storage().persistent().set(
            &DataKey::DailyIndex(schema_version, country.clone(), date),
            &record,
        );

        DailyIndexUpdated {
            country,
            date,
            value,
            basket_version,
            source_period_start,
            source_period_end,
            updater,
            schema_version,
        }
        .publish(&env);

        Ok(())
    }

    /// Read a daily index record.
    ///
    /// # Errors
    /// * `NotInitialized` / `IncompatibleSchema` — as above. Reads are
    ///   guarded too: returning a record decoded under the wrong schema is
    ///   the failure mode this is meant to prevent.
    pub fn get_daily_index(
        env: Env,
        country: Symbol,
        date: u64,
    ) -> Result<Option<DailyIndex>, Error> {
        let schema_version = Self::require_compatible_schema(&env)?;

        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::DailyIndex(schema_version, country, date)))
    }

    /// Return the deployment's schema version, or fail if it is unusable.
    fn require_compatible_schema(env: &Env) -> Result<u32, Error> {
        let stored: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Schema)
            .ok_or(Error::NotInitialized)?;

        if stored != SCHEMA_VERSION {
            return Err(Error::IncompatibleSchema);
        }

        Ok(stored)
    }
}
