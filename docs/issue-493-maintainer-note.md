# Issue 493 maintainer note

The requested change describes a bounded appeal path for irreversible SentinelPool
slashes. I inspected this branch and the current contract workspace, but there is
no SentinelPool contract, slash state machine, verifier-slashing entrypoint, or
dispute model present to extend. The existing `kovara-index` contract only stores
daily index records and has sentinel authorization for index updates; adding an
appeal mechanism there would change the wrong contract and could weaken unrelated
authorization guarantees.

No contract behavior was changed in this PR. Please point the contributor to the
branch or package that owns SentinelPool slashing, and specify the slash record,
appeal authority, deadline, and reversal semantics. Once that scope is available,
the bounded appeal and regression tests can be implemented safely.
