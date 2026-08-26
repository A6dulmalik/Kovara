//! Tests for CT-035 (complete daily index events) and CT-036 (storage
//! versioning).

use crate::{
    DailyIndex, DailyIndexUpdated, DataKey, Error, KovaraIndex, KovaraIndexClient, SCHEMA_VERSION,
};
use soroban_sdk::testutils::{Address as _, Events};
use soroban_sdk::{symbol_short, vec, Address, Env, Event, IntoVal, Symbol};

struct Fixture<'a> {
    env: Env,
    client: KovaraIndexClient<'a>,
    contract_id: Address,
    admin: Address,
    updater: Address,
}

fn deploy() -> Fixture<'static> {
    let env = Env::default();
    let contract_id = env.register(KovaraIndex, ());
    let client = KovaraIndexClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let updater = Address::generate(&env);

    env.mock_all_auths();

    Fixture {
        env,
        client,
        contract_id,
        admin,
        updater,
    }
}

fn deploy_initialized() -> Fixture<'static> {
    let f = deploy();
    f.client.initialize(&f.admin);
    f
}

const NG: Symbol = symbol_short!("NG");
const DATE: u64 = 20_140;
const VALUE: i128 = 1_234_567;
const BASKET: u32 = 7;
const PERIOD_START: u64 = 1_700_000_000;
const PERIOD_END: u64 = 1_700_086_400;

fn set_index(f: &Fixture) {
    f.client.set_daily_index(
        &f.updater,
        &NG,
        &DATE,
        &VALUE,
        &BASKET,
        &PERIOD_START,
        &PERIOD_END,
    );
}

// ── Initialization and schema versioning (CT-036) ────────────────────────

#[test]
fn a_fresh_deployment_has_no_schema_version() {
    let f = deploy();

    assert_eq!(f.client.deployed_schema_version(), None);
    assert_eq!(f.client.expected_schema_version(), SCHEMA_VERSION);
    assert!(!f.client.is_schema_compatible());
}

#[test]
fn initialization_records_the_schema_version_and_admin() {
    let f = deploy_initialized();

    assert_eq!(f.client.deployed_schema_version(), Some(SCHEMA_VERSION));
    assert_eq!(f.client.admin(), Some(f.admin.clone()));
    assert!(f.client.is_schema_compatible());
}

#[test]
fn initializing_twice_is_rejected() {
    let f = deploy_initialized();

    assert_eq!(
        f.client.try_initialize(&f.admin),
        Err(Ok(Error::AlreadyInitialized))
    );
}

/// Operations must not run against a contract with no recorded schema —
/// there is nothing to check compatibility against.
#[test]
fn operations_are_rejected_before_initialization() {
    let f = deploy();

    assert_eq!(
        f.client.try_set_daily_index(
            &f.updater,
            &NG,
            &DATE,
            &VALUE,
            &BASKET,
            &PERIOD_START,
            &PERIOD_END
        ),
        Err(Ok(Error::NotInitialized))
    );

    assert_eq!(
        f.client.try_get_daily_index(&NG, &DATE),
        Err(Ok(Error::NotInitialized))
    );
}

/// The core CT-036 requirement: a deployment whose stored schema does not
/// match this build must be refused rather than operated on.
#[test]
fn an_incompatible_schema_is_rejected_for_writes() {
    let f = deploy_initialized();

    // Simulate data written by a future release.
    f.env.as_contract(&f.contract_id, || {
        f.env
            .storage()
            .instance()
            .set(&DataKey::Schema, &(SCHEMA_VERSION + 1));
    });

    assert!(!f.client.is_schema_compatible());
    assert_eq!(
        f.client.try_set_daily_index(
            &f.updater,
            &NG,
            &DATE,
            &VALUE,
            &BASKET,
            &PERIOD_START,
            &PERIOD_END
        ),
        Err(Ok(Error::IncompatibleSchema))
    );
}

/// Reads are guarded too. Returning a record decoded under the wrong schema
/// is precisely the failure this prevents, and it is the quieter half —
/// a bad read produces a plausible wrong number rather than an error.
#[test]
fn an_incompatible_schema_is_rejected_for_reads() {
    let f = deploy_initialized();
    set_index(&f);

    f.env.as_contract(&f.contract_id, || {
        f.env
            .storage()
            .instance()
            .set(&DataKey::Schema, &(SCHEMA_VERSION + 1));
    });

    assert_eq!(
        f.client.try_get_daily_index(&NG, &DATE),
        Err(Ok(Error::IncompatibleSchema))
    );
}

/// An older stored schema is just as incompatible as a newer one — this
/// build cannot know the shape of data it predates either.
#[test]
fn an_older_schema_is_also_rejected() {
    let f = deploy_initialized();

    f.env.as_contract(&f.contract_id, || {
        f.env.storage().instance().set(&DataKey::Schema, &0u32);
    });

    assert_eq!(
        f.client.try_get_daily_index(&NG, &DATE),
        Err(Ok(Error::IncompatibleSchema))
    );
}

/// Records are keyed by schema version, so two schemas' data occupy disjoint
/// keyspaces. That is what lets a migration write v2 records without
/// destroying v1, and it is why a failed migration is recoverable.
#[test]
fn records_under_different_schemas_do_not_collide() {
    let f = deploy_initialized();
    set_index(&f);

    let other_schema = SCHEMA_VERSION + 1;

    f.env.as_contract(&f.contract_id, || {
        // A record written by a different schema, at the same country/date.
        let foreign = DailyIndex {
            country: NG,
            date: DATE,
            value: 999,
            basket_version: 1,
            source_period_start: PERIOD_START,
            source_period_end: PERIOD_END,
            updater: f.updater.clone(),
            schema_version: other_schema,
        };

        f.env
            .storage()
            .persistent()
            .set(&DataKey::DailyIndex(other_schema, NG, DATE), &foreign);

        // The v1 record is untouched.
        let ours: DailyIndex = f
            .env
            .storage()
            .persistent()
            .get(&DataKey::DailyIndex(SCHEMA_VERSION, NG, DATE))
            .expect("v1 record still present");

        assert_eq!(ours.value, VALUE);
        assert_eq!(ours.schema_version, SCHEMA_VERSION);
    });
}

#[test]
fn stored_records_carry_the_schema_they_were_written_under() {
    let f = deploy_initialized();
    set_index(&f);

    let record = f.client.get_daily_index(&NG, &DATE).unwrap();

    assert_eq!(record.schema_version, SCHEMA_VERSION);
}

// ── Complete daily index events (CT-035) ─────────────────────────────────

/// Build the event the contract is expected to have emitted, from the field
/// values it was given.
///
/// Comparing against a constructed `DailyIndexUpdated` rather than poking at
/// topics and data by hand means the assertion covers *every* field: if a
/// field were dropped from the event, or emitted with the wrong value, this
/// stops matching.
fn expected_event(
    f: &Fixture,
    event: &DailyIndexUpdated,
) -> soroban_sdk::Vec<(
    Address,
    soroban_sdk::Vec<soroban_sdk::Val>,
    soroban_sdk::Val,
)> {
    vec![
        &f.env,
        (
            f.contract_id.clone(),
            event.topics(&f.env),
            event.data(&f.env),
        ),
    ]
}

/// Events from the most recent invocation only — `Events::all()` does not
/// accumulate across calls, so anything asserting on an event has to look
/// immediately after the call that emitted it.
fn emitted_count(f: &Fixture) -> usize {
    f.env.events().all().events().len()
}

/// The acceptance criterion: events include country, date, value, basket,
/// source period, and updater.
#[test]
fn the_event_carries_every_required_field() {
    let f = deploy_initialized();
    set_index(&f);

    let expected = DailyIndexUpdated {
        country: NG,
        date: DATE,
        value: VALUE,
        basket_version: BASKET,
        source_period_start: PERIOD_START,
        source_period_end: PERIOD_END,
        updater: f.updater.clone(),
        schema_version: SCHEMA_VERSION,
    };

    assert_eq!(f.env.events().all(), expected_event(&f, &expected));
}

/// Country and date are topics so an indexer can subscribe to one country
/// without decoding every event body.
#[test]
fn country_and_date_are_indexable_topics() {
    let f = deploy_initialized();
    set_index(&f);

    let event = DailyIndexUpdated {
        country: NG,
        date: DATE,
        value: VALUE,
        basket_version: BASKET,
        source_period_start: PERIOD_START,
        source_period_end: PERIOD_END,
        updater: f.updater.clone(),
        schema_version: SCHEMA_VERSION,
    };

    let topics = event.topics(&f.env);

    let country_topic: soroban_sdk::Val = NG.into_val(&f.env);
    let date_topic: soroban_sdk::Val = DATE.into_val(&f.env);
    let value_val: soroban_sdk::Val = VALUE.into_val(&f.env);

    assert!(
        topics.contains(country_topic),
        "country should be a topic: {topics:?}"
    );
    assert!(
        topics.contains(date_topic),
        "date should be a topic: {topics:?}"
    );

    // And the value is not a topic — it belongs in the data section.
    assert!(!topics.contains(value_val));
}

/// The event must describe the record that was actually stored — a consumer
/// acting on the event alone must not diverge from one that reads state.
#[test]
fn the_event_matches_the_stored_record() {
    let f = deploy_initialized();
    set_index(&f);

    // Capture the event before any further call: the read below would
    // otherwise replace it, since events do not accumulate.
    let emitted = f.env.events().all();

    let stored = f.client.get_daily_index(&NG, &DATE).unwrap();

    let from_storage = DailyIndexUpdated {
        country: stored.country.clone(),
        date: stored.date,
        value: stored.value,
        basket_version: stored.basket_version,
        source_period_start: stored.source_period_start,
        source_period_end: stored.source_period_end,
        updater: stored.updater.clone(),
        schema_version: stored.schema_version,
    };

    assert_eq!(emitted, expected_event(&f, &from_storage));
}

/// Every accepted update emits exactly one event — not zero, and not a
/// duplicate.
#[test]
fn each_update_emits_exactly_one_event() {
    let f = deploy_initialized();

    set_index(&f);
    assert_eq!(emitted_count(&f), 1);

    f.client.set_daily_index(
        &f.updater,
        &symbol_short!("KE"),
        &DATE,
        &VALUE,
        &BASKET,
        &PERIOD_START,
        &PERIOD_END,
    );
    assert_eq!(emitted_count(&f), 1);
}

/// A rejected update must emit nothing — an event for a write that did not
/// happen is worse than no event.
#[test]
fn a_rejected_update_emits_no_event() {
    let f = deploy_initialized();

    assert_eq!(
        f.client.try_set_daily_index(
            &f.updater,
            &NG,
            &DATE,
            &VALUE,
            &0u32, // invalid basket
            &PERIOD_START,
            &PERIOD_END
        ),
        Err(Ok(Error::InvalidBasketVersion))
    );

    assert_eq!(emitted_count(&f), 0);
}

// ── Field validation ─────────────────────────────────────────────────────

/// Zero is reserved for "no basket recorded", which is the ambiguity CT-035
/// exists to remove — so it cannot also be a valid basket.
#[test]
fn a_zero_basket_version_is_rejected() {
    let f = deploy_initialized();

    assert_eq!(
        f.client.try_set_daily_index(
            &f.updater,
            &NG,
            &DATE,
            &VALUE,
            &0u32,
            &PERIOD_START,
            &PERIOD_END
        ),
        Err(Ok(Error::InvalidBasketVersion))
    );
}

#[test]
fn a_backwards_source_period_is_rejected() {
    let f = deploy_initialized();

    assert_eq!(
        f.client.try_set_daily_index(
            &f.updater,
            &NG,
            &DATE,
            &VALUE,
            &BASKET,
            &PERIOD_END,
            &PERIOD_START
        ),
        Err(Ok(Error::InvalidSourcePeriod))
    );
}

/// A period covering a single instant is legitimate — a spot observation.
#[test]
fn an_instantaneous_source_period_is_accepted() {
    let f = deploy_initialized();

    f.client.set_daily_index(
        &f.updater,
        &NG,
        &DATE,
        &VALUE,
        &BASKET,
        &PERIOD_START,
        &PERIOD_START,
    );

    let record = f.client.get_daily_index(&NG, &DATE).unwrap();

    assert_eq!(record.source_period_start, record.source_period_end);
}

/// A rejected write must leave storage untouched.
#[test]
fn a_rejected_update_stores_nothing() {
    let f = deploy_initialized();

    assert!(f
        .client
        .try_set_daily_index(
            &f.updater,
            &NG,
            &DATE,
            &VALUE,
            &0u32,
            &PERIOD_START,
            &PERIOD_END
        )
        .is_err());

    assert_eq!(f.client.get_daily_index(&NG, &DATE), None);
}

// ── Storage round-trip ───────────────────────────────────────────────────

#[test]
fn a_record_round_trips() {
    let f = deploy_initialized();
    set_index(&f);

    let record = f.client.get_daily_index(&NG, &DATE).unwrap();

    assert_eq!(
        record,
        DailyIndex {
            country: NG,
            date: DATE,
            value: VALUE,
            basket_version: BASKET,
            source_period_start: PERIOD_START,
            source_period_end: PERIOD_END,
            updater: f.updater.clone(),
            schema_version: SCHEMA_VERSION,
        }
    );
}

#[test]
fn an_unknown_country_or_date_reads_as_none() {
    let f = deploy_initialized();
    set_index(&f);

    assert_eq!(f.client.get_daily_index(&symbol_short!("ZZ"), &DATE), None);
    assert_eq!(f.client.get_daily_index(&NG, &(DATE + 1)), None);
}

#[test]
fn records_are_kept_per_country_and_per_date() {
    let f = deploy_initialized();

    f.client.set_daily_index(
        &f.updater,
        &NG,
        &DATE,
        &100,
        &BASKET,
        &PERIOD_START,
        &PERIOD_END,
    );
    f.client.set_daily_index(
        &f.updater,
        &symbol_short!("KE"),
        &DATE,
        &200,
        &BASKET,
        &PERIOD_START,
        &PERIOD_END,
    );
    f.client.set_daily_index(
        &f.updater,
        &NG,
        &(DATE + 1),
        &300,
        &BASKET,
        &PERIOD_START,
        &PERIOD_END,
    );

    assert_eq!(f.client.get_daily_index(&NG, &DATE).unwrap().value, 100);
    assert_eq!(
        f.client
            .get_daily_index(&symbol_short!("KE"), &DATE)
            .unwrap()
            .value,
        200
    );
    assert_eq!(
        f.client.get_daily_index(&NG, &(DATE + 1)).unwrap().value,
        300
    );
}

/// Negative values are storable. Whether the index may go negative is CT-031
/// and CT-032's decision; this crate must not pre-empt it by rejecting them.
#[test]
fn a_negative_value_is_stored_as_given() {
    let f = deploy_initialized();

    f.client.set_daily_index(
        &f.updater,
        &NG,
        &DATE,
        &-42,
        &BASKET,
        &PERIOD_START,
        &PERIOD_END,
    );

    assert_eq!(f.client.get_daily_index(&NG, &DATE).unwrap().value, -42);
}

/// Authorization *policy* is CT-034's. What this pins is narrower and still
/// necessary: the address recorded as `updater` is the address that signed,
/// so the field means something.
#[test]
#[should_panic(expected = "Unauthorized function call for address")]
fn an_unsigned_update_is_rejected_by_the_host() {
    let f = deploy_initialized();

    f.env.set_auths(&[]);

    set_index(&f);
}
