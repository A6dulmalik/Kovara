export type WalletProviderKind = "freighter" | "walletconnect";

export interface WalletProviderOption {
  id: WalletProviderKind;
  label: string;
  description: string;
}

export const walletProviderOptions: WalletProviderOption[] = [
  {
    id: "freighter",
    label: "Freighter",
    description: "Browser extension for desktop and web signing",
  },
  {
    id: "walletconnect",
    label: "WalletConnect",
    description: "Mobile and wallet apps via WalletConnect",
  },
];

export function resolveWalletProvider(
  provider: WalletProviderKind | null | undefined,
  supported: WalletProviderKind[]
): WalletProviderKind {
  if (provider && supported.includes(provider)) {
    return provider;
  }

  return supported[0] ?? "freighter";
}

export function getSupportedWalletProviders(
  availability: Partial<Record<WalletProviderKind, boolean>>
): WalletProviderKind[] {
  return walletProviderOptions
    .map((option) => option.id)
    .filter((id) => availability[id] !== false);
}
