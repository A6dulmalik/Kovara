"use client";

import { useWallet } from "@/hooks/useWallet";

interface RequireWalletProps {
  /**
   * What is the user trying to do that requires authentication?
   * Used in the connect CTA messaging so the user understands why they
   * need to connect (e.g. "to publish a post").
   */
  action?: string;
  /** Rendered when the wallet is connected. */
  children: React.ReactNode;
}

/**
 * Client-side guard for routes and components that require a connected
 * Stellar wallet. Renders a focused "connect your wallet" CTA when the
 * wallet is not connected, otherwise renders `children`.
 *
 * Closes #122 — used by `/post/new` and any other route that publishes
 * on-chain state on behalf of the user.
 */
export function RequireWallet({ action, children }: RequireWalletProps) {
  const { connected, connect, provider, availableProviders, setProvider } = useWallet();

  if (connected) {
    return <>{children}</>;
  }

  const what = action ?? "continue";

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={`Authentication required ${what}`}
      className="mx-auto flex max-w-md flex-col items-center gap-6 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 p-10 text-center"
    >
      <div aria-hidden="true" className="text-5xl">
        🔗
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Connect your wallet</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          You need to connect a Stellar wallet {what}. Freighter works well for browser extensions,
          while WalletConnect supports mobile wallet apps.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <label className="sr-only" htmlFor="wallet-provider-select">
          Choose wallet provider
        </label>
        <select
          id="wallet-provider-select"
          value={provider ?? availableProviders[0] ?? "freighter"}
          onChange={(event) => setProvider(event.target.value as "freighter" | "walletconnect")}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          {availableProviders.map((option) => (
            <option key={option} value={option}>
              {option === "freighter" ? "Freighter" : "WalletConnect"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void connect(provider ?? undefined)}
          aria-label="Connect wallet"
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-[var(--background)]"
        >
          Connect Wallet
        </button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Need a browser extension? Install Freighter from the official site.
      </p>
    </div>
  );
}
