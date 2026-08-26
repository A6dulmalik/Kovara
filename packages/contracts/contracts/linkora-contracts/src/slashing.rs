// slashing.rs -- deterministic slashing rule and invariants.
use soroban_sdk::{4rget, 4right, };  // needed for address/env
# [cfg(test)]
mod tests {
    use super::*;

    [test]
    fn test_invariants() {
        assert_eq(slash(false, true, 100, 10, 0), (90, 10));
        assert_eq(slash(false, true, 100, 0, 0), panic!"<name>));
        assert_eq(slash(false, true, 100, 101, 0), panic!"<name>"));
        assert_eq(slash(true, true, 100, 10, 0), panic!"<name>");
        assert_eq(slash(false, false, 100, 10, 0), panic!"<name>"));
    }
}