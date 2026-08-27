# `kovara-index`

Daily Kōvara Value Index (KVI) records — one per country, per day.

Implements **CT-034** (authorize index updates), **CT-035** (complete daily
index events), **CT-036** (contract storage versioning) and **CT-037** (admin
transfer and recovery). The remaining index behaviour belongs to other issues
and extends what is here.

## What is here, and what is not

| Issue | Owns | State |
|---|---|---|
| CT-034 | Who may update, and how many must agree | **This crate** |
| CT-035 | The `DailyIndexUpdated` event and its fields | **This crate** |
| CT-036 | Schema versioning and rejection of incompatible data | **This crate** |
| CT-037 | Admin transfer and recovery | **This crate** |
| CT-030 | Daily index storage semantics | Not implemented |
| CT-031 | KVI rounding rules for `value` | Not implemented |
| CT-032 | Deterministic aggregation producing `value` | Not implemented |
| CT-033 | Rejection of duplicate index updates | Not implemented |

`set_daily_index` therefore accepts a value some other component computed and
lets a later write replace an earlier one. Rounding, aggregation and duplicate
rejection are the named issues above; guessing at their semantics now would
only have to be undone.

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

## Authorization (CT-034)

A daily aggregate moves a number the whole system trusts, so it is not
something one key should be able to do alone. `set_daily_index` takes a list
of signers and requires:

- every signer authorizes the call itself;
- every signer is on the sentinel roster;
- no address appears twice;
- at least `threshold` signers are present.

The duplicate check is what makes the threshold mean anything. Without it one
sentinel could pass the same address N times and satisfy an N-of-M policy
alone. There is a test for exactly that.

The first signer is the submitter, and is what lands in the record's and the
event's `updater` field.

### Rotation

`set_sentinels(admin, sentinels, threshold)` replaces the roster and the
threshold **in one call**. Doing it as separate add/remove steps would leave
intermediate states where the threshold exceeds the roster, or where a removed
sentinel can still sign alongside its replacement.

A threshold of zero would authorize anyone; a threshold above the roster size
could never be met and would freeze the index. Both are rejected, as are an
empty roster and a duplicated address within one.

Before any roster exists, every update fails with `SentinelsNotConfigured` —
it fails closed rather than falling back to "anyone may update".

## Admin transfer and recovery (CT-037)

Ownership changes are where administrative control gets stranded, so there are
two paths and they cover different failures.

### Two-step transfer

`propose_admin_transfer` → `accept_admin_transfer`. Proposing does not move
control; the recipient must accept, which proves the address is real and
controlled. A single-step transfer to a mistyped or unspendable address
strands the contract permanently.

Proposals carry a required expiry, so a forgotten one cannot be accepted years
later by whoever ends up holding that key. The sitting admin can cancel at any
time, and a new proposal replaces the previous one.

### Recovery

If the admin key is simply gone, no transfer can be proposed at all. A
**sentinel quorum** can then propose a recovery, which becomes executable only
after `RECOVERY_DELAY_LEDGERS` — roughly a day.

That delay is the entire safety mechanism: it is the window in which a
still-live administrator can veto a recovery they did not ask for, and
vetoing is itself proof they still hold the key. Without the delay, a
compromised sentinel quorum could seize a perfectly healthy contract.

`execute_admin_recovery` is deliberately callable by anyone. Requiring the
incoming administrator to call it would reintroduce the liveness assumption
the recovery path exists to remove, and the outcome was already fixed when the
quorum proposed it.

The two paths clear each other: accepting a transfer cancels any pending
recovery (control demonstrably just moved), and executing a recovery cancels
any pending transfer (the displaced admin's authority is gone).

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

cargo test -p kovara-index                       # 68 tests
cargo build --target wasm32v1-none --release     # -> target/wasm32v1-none/release/kovara_index.wasm
```

Use **`wasm32v1-none`**, not `wasm32-unknown-unknown`. Rust 1.82+ enables
reference-types and multi-value on the latter, which the Soroban environment
does not support; the build fails with an explicit error saying so.
