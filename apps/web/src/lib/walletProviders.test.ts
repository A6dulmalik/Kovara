import test from "node:test";
import assert from "node:assert/strict";
import { resolveWalletProvider, type WalletProviderKind } from "./walletProviders";

test("resolveWalletProvider falls back to the first supported provider", () => {
  const provider = resolveWalletProvider(undefined, ["freighter", "walletconnect"]);
  assert.equal(provider, "freighter");
});

test("resolveWalletProvider accepts an explicit provider", () => {
  const provider = resolveWalletProvider("walletconnect", ["freighter", "walletconnect"]);
  assert.equal(provider, "walletconnect");
});

test("resolveWalletProvider rejects unsupported providers", () => {
  assert.throws(() => resolveWalletProvider("albedo" as WalletProviderKind, ["freighter", "walletconnect"]));
});
