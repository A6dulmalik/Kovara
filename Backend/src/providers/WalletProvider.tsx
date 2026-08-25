import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '../components/ui/use-toast';

interface WalletContextType {
  address: string | null;
  networkId: string | null;
  isCorrectNetwork: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  validateNetwork: () => boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Expected network identifier from environment configuration
const EXPECTED_NETWORK_PASSPHRASE = process.env.REACT_APP_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const { toast } = useToast();

  const isCorrectNetwork = networkId === EXPECTED_NETWORK_PASSPHRASE;

  const validateNetwork = (): boolean => {
    if (!isCorrectNetwork) {
      toast({
        title: 'Network Mismatch Detected',
        description: `Your wallet is connected to an unsupported network. Please switch to: ${EXPECTED_NETWORK_PASSPHRASE}`,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const connectWallet = async () => {
    try {
      // Integration check with browser wallet extension (e.g., Freighter)
      if (!(window as any).freighter) {
        throw new Error('Freighter wallet extension not found.');
      }

      const userPublicKey = await (window as any).freighter.getAddress();
      const currentNetwork = await (window as any).freighter.getNetwork();

      setAddress(userPublicKey);
      setNetworkId(currentNetwork);

      if (currentNetwork !== EXPECTED_NETWORK_PASSPHRASE) {
        toast({
          title: 'Network Warning',
          description: `Connected to ${currentNetwork}. App requires ${EXPECTED_NETWORK_PASSPHRASE}.`,
          variant: 'warning',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Connection Failed',
        description: error.message || 'Could not connect to wallet.',
        variant: 'destructive',
      });
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setNetworkId(null);
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        networkId,
        isCorrectNetwork,
        connectWallet,
        disconnectWallet,
        validateNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};