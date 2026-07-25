// State 2: A wallet provider is available but the user has not connected yet
export function NotConnectedState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="text-5xl">🔗</div>
      <div>
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-[var(--text-muted)] max-w-xs">
          Choose Freighter or WalletConnect and approve the connection to access Kovara.
        </p>
      </div>
      <button onClick={onConnect} className="btn-primary">
        Connect Wallet
      </button>
    </div>
  );
}
