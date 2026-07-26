"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getSupportedWalletProviders,
  resolveWalletProvider,
  type WalletProviderKind,
} from "@/lib/walletProviders";

const LS_KEY = "Kovara_wallet_address";
const LS_NETWORK_KEY = "Kovara_wallet_network";
const LS_PROVIDER_KEY = "Kovara_wallet_provider";

export interface WalletContextValue {
  address: string | null;
  connected: boolean;
  network: string | null;
  provider: WalletProviderKind | null;
  availableProviders: WalletProviderKind[];
  connect: (provider?: WalletProviderKind) => Promise<void>;
  disconnect: () => void;
  setProvider: (provider: WalletProviderKind) => void;
  error: string | null;
}

export const WalletContext = createContext<WalletContextValue>({
  address: null,
  connected: false,
  network: null,
  provider: null,
  availableProviders: ["freighter", "walletconnect"],
  connect: async () => {},
  disconnect: () => {},
  setProvider: () => {},
  error: null,
});

export function useWalletContext(): WalletContextValue {
  return useContext(WalletContext);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [provider, setProviderState] = useState<WalletProviderKind | null>(null);
  const [availableProviders, setAvailableProviders] = useState<WalletProviderKind[]>([
    "freighter",
    "walletconnect",
  ]);
  const [error, setError] = useState<string | null>(null);

  const detectFreighter = useCallback(async () => {
    if (typeof window === "undefined") return false;
    try {
      await import("@stellar/freighter-api");
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;

    const savedAddress = localStorage.getItem(LS_KEY);
    const savedNetwork = localStorage.getItem(LS_NETWORK_KEY);
    const savedProvider = localStorage.getItem(LS_PROVIDER_KEY) as WalletProviderKind | null;

    if (savedAddress) {
      setAddress(savedAddress);
      setNetwork(savedNetwork);
    }

    if (savedProvider && (savedProvider === "freighter" || savedProvider === "walletconnect")) {
      setProviderState(savedProvider);
    }

    const hydrate = async () => {
      const freighterAvailable = await detectFreighter();
      const supported = getSupportedWalletProviders({
        freighter: freighterAvailable,
        walletconnect: true,
      });

      if (!active) return;
      setAvailableProviders(supported);

      if (!savedAddress || !savedProvider || savedProvider !== "freighter" || !freighterAvailable) {
        return;
      }

      try {
        const { isConnected, getPublicKey, getNetwork } = await import("@stellar/freighter-api");
        const still = await isConnected();
        if (!still) {
          setAddress(null);
          setNetwork(null);
          localStorage.removeItem(LS_KEY);
          localStorage.removeItem(LS_NETWORK_KEY);
          return;
        }

        const [pub, net] = await Promise.all([getPublicKey(), getNetwork()]);
        if (pub) {
          setAddress(pub);
          setNetwork(net ?? null);
          localStorage.setItem(LS_KEY, pub);
          if (net) localStorage.setItem(LS_NETWORK_KEY, net);
        }
      } catch {
        // Leave the persisted state as-is if the extension is unavailable.
      }
    };

    void hydrate();

    return () => {
      active = false;
    };
  }, [detectFreighter]);

  const connect = useCallback(
    async (requestedProvider?: WalletProviderKind) => {
      const resolvedProvider = resolveWalletProvider(
        requestedProvider ?? provider ?? null,
        availableProviders
      );

      setError(null);

      try {
        if (resolvedProvider === "freighter") {
          const { requestAccess, getPublicKey, getNetwork } = await import("@stellar/freighter-api");
          await requestAccess();
          const [pub, net] = await Promise.all([getPublicKey(), getNetwork()]);
          if (!pub) throw new Error("No address returned from Freighter");
          setAddress(pub);
          setNetwork(net ?? null);
          setProviderState(resolvedProvider);
          localStorage.setItem(LS_KEY, pub);
          localStorage.setItem(LS_PROVIDER_KEY, resolvedProvider);
          if (net) localStorage.setItem(LS_NETWORK_KEY, net);
          return;
        }

        const loader = new Function("specifier", "return import(specifier)") as (
          specifier: string
        ) => Promise<Record<string, unknown>>;
        const mod = await loader("@walletconnect/sign-client");
        const SignClient = (mod.default ?? mod.SignClient) as {
          init: (...args: unknown[]) => Promise<any>;
        };

        const client = await SignClient.init({
          projectId: "demo-project-id",
          metadata: {
            name: "Kovara",
            description: "Kovara SocialFi wallet connection",
            url: "https://kovara.app",
            icons: [],
          },
        });

        const { uri, approval } = await client.connect({
          requiredNamespaces: {
            stellar: {
              methods: ["stellar_signXDR"],
              chains: ["stellar:testnet"],
              events: ["accountsChanged"],
            },
          },
        });

        if (uri) {
          window.open(uri, "_blank", "noopener,noreferrer");
        }

        const session = await approval();
        const account = session.namespaces.stellar?.accounts?.[0];
        const pub = account?.split(":").pop() ?? null;
        if (!pub) throw new Error("No Stellar account returned from WalletConnect");

        setAddress(pub);
        setNetwork("testnet");
        setProviderState(resolvedProvider);
        localStorage.setItem(LS_KEY, pub);
        localStorage.setItem(LS_PROVIDER_KEY, resolvedProvider);
        localStorage.setItem(LS_NETWORK_KEY, "testnet");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
        setAddress(null);
        setNetwork(null);
      }
    },
    [availableProviders, provider]
  );

  const disconnect = useCallback(() => {
    setAddress(null);
    setNetwork(null);
    setProviderState(null);
    setError(null);
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_NETWORK_KEY);
    localStorage.removeItem(LS_PROVIDER_KEY);
  }, []);

  const setProvider = useCallback((nextProvider: WalletProviderKind) => {
    setProviderState(nextProvider);
    localStorage.setItem(LS_PROVIDER_KEY, nextProvider);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        connected: !!address,
        network,
        provider,
        availableProviders,
        connect,
        disconnect,
        setProvider,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
