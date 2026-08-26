# `kovara-index`

Daily Kōvara Value Index (KVI) records — one per country, per day.

Implements **CT-035** (complete daily index events) and **CT-036** (contract
storage versioning). This crate is deliberately the minimum surface those two
issues need; the rest of the index behaviour belongs to other issues and will
extend it.

## What is here, and what is not

| Issue | Owns | State |
|---|---|---|
| CT-035 | The `DailyIndexUpdated` event and its fields | **This crate** |
| CT-036 | Schema versioning and rejection of incompatible data | **This crate** |
| CT-030 | Daily index storage semantics | Not implemented |
| CT-031 | KVI rounding rules for `value` | Not implemented |
| CT-032 | Deterministic aggregation producing `value` | Not implemented |
| CT-033 | Rejection of duplicate index updates | Not implemented |
| CT-034 | The authorization policy for who may update | Not implemented |

`set_daily_index` therefore accepts a value some other component computed,
requires only that the named updater signed for itself, and lets a later write
replace an earlier one. Each of those is a named issue above. Guessing at
their semantics now would only have to be undone.

## Storage versioning policy (CT-036)

Two mechanisms doing two different jobs.

**The schema version is recorded at initialization**, and every operation
checks it. A deployment initialized under one schema and then handed code
expecting another fails with `IncompatibleSchema` rather than reading records
it does not understand. Reads are guarded as well as writes — a bad read is
the quieter failure, because it returns a plausible wrong number instead of an
error.

**Record keys embed the schema version.** `DailyIndex(1, "NG", d)` and
`DailyIndex(2, "NG", d)` are different entries, so two schemas' data occupy
disjoint keyspaces.

That second part is what makes a future migration possible: v2 records can be
written alongside v1 rather than on top, so a migration is resumable and a
failed one leaves the original data intact.

### Changing the schema

1. Change the stored shape or the meaning of a key.
2. Bump `SCHEMA_VERSION` **in the same commit**.
3. Every existing deployment now rejects all operations until migrated. That
   is the intended outcome — the alternative is decoding a v1 record as
   though it were v2.

Executing a migration is **out of scope here.** CT-036 asks for versioning and
rejection, not a migration engine; the versioned keyspace is the precondition
for one. A migration entry point belongs in its own issue, and it should read
under the old schema version and write under the new one.

### Inspecting a deployment

```
deployed_schema_version() -> Option<u32>   what this deployment was initialized at
expected_schema_version() -> u32           what this build understands
is_schema_compatible()    -> bool          whether they agree
```

Deployment tooling should call these rather than provoking an error to find
out.

## The daily index event (CT-035)

`DailyIndexUpdated` carries every field the issue requires — country, date,
value, basket version, source period, and updater — so a consumer can act on
the event alone without a follow-up read.

`country` and `date` are **topics**, because those are the two dimensions an
indexer filters on. Everything else is in the data section.

Two fields exist because consumers could not otherwise interpret the number:

- **`basket_version`** — without it, a consumer cannot tell a real movement in
  prices from a change in what is being measured. Zero is rejected, since zero
  is what "no basket recorded" would look like and that is precisely the
  ambiguity this removes.
- **`source_period_start` / `source_period_end`** — the window the underlying
  observations cover, which is not the same as the day the index is filed
  under.

`schema_version` rides along too, so a consumer can tell which storage schema
produced a record — which matters while a migration is in progress and both
schemas are briefly live.

## Build and test

```bash
cd packages/contracts

cargo test                                       # 23 tests
cargo build --target wasm32v1-none --release     # -> target/wasm32v1-none/release/kovara_index.wasm
```

Use **`wasm32v1-none`**, not `wasm32-unknown-unknown`. Rust 1.82+ enables
reference-types and multi-value on the latter, which the Soroban environment
does not support; the build fails with an explicit error saying so.
