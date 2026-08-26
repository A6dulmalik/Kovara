#!/usr/bin/env bash
set -euo pipefail

NETWORK="${STELLAR_NETWORK:-testnet}"
SOURCE_ACCOUNT="${STELLAR_SOURCE_ACCOUNT:?Set STELLAR_SOURCE_ACCOUNT to the funded deployment account}"
OUTPUT_FILE="${DEPLOYMENT_OUTPUT:-deployment-${NETWORK}.env}"
WASM="target/wasm32v1-none/release/linkora_contracts.wasm"
FETCHED_WASM="${WASM}.fetched"

stellar contract build
[[ -f "$WASM" ]] || { echo "Missing contract artifact: $WASM" >&2; exit 1; }

CONTRACT_ID="$(stellar contract deploy \
  --wasm "$WASM" \
  --network "$NETWORK" \
  --source-account "$SOURCE_ACCOUNT")"

stellar contract fetch \
  --id "$CONTRACT_ID" \
  --network "$NETWORK" \
  --output "$FETCHED_WASM"

LOCAL_HASH="$(sha256sum "$WASM" | awk '{print $1}')"
DEPLOYED_HASH="$(sha256sum "$FETCHED_WASM" | awk '{print $1}')"
[[ "$LOCAL_HASH" == "$DEPLOYED_HASH" ]] || {
  echo "WASM hash mismatch: local=$LOCAL_HASH deployed=$DEPLOYED_HASH" >&2
  exit 1
}

{
  printf 'STELLAR_NETWORK=%q\n' "$NETWORK"
  printf 'CONTRACT_ID=%q\n' "$CONTRACT_ID"
  printf 'WASM_SHA256=%q\n' "$LOCAL_HASH"
} > "$OUTPUT_FILE"

rm -f "$FETCHED_WASM"
printf 'Deployment verified: %s (WASM SHA-256 %s)\n' "$CONTRACT_ID" "$LOCAL_HASH"
