// State 1: No supported wallet provider detected
export function NotInstalledState() {
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="text-5xl">🔌</div>
      <div>
        <h2 className="text-2xl font-bold mb-2">Wallet connection required</h2>
        <p className="text-[var(--text-muted)] max-w-xs">
          Install Freighter for browser-based signing or use WalletConnect with a mobile wallet to
          get started.
        </p>
      </div>
      <a
        href="https://freighter.app"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary"
      >
        Install Freighter
      </a>
      <p className="text-xs text-[var(--text-muted)]">After installing, refresh this page.</p>
    </div>
  );
}
