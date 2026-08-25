import React from 'react';
import { useWallet } from '../../providers/WalletProvider';

export const TransactionForm: React.FC = () => {
  const { address, validateNetwork, connectWallet } = useWallet();

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      await connectWallet();
      return;
    }

    // Guard: Block signing if wallet network differs from Soroban endpoint configuration
    if (!validateNetwork()) {
      return;
    }

    // Proceed with transaction submission flow
    console.log('Executing transaction on verified network...');
  };

  return (
    <form onSubmit={handleSubmitTransaction} className="space-y-4">
      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md">
        {address ? 'Submit Transaction' : 'Connect Wallet'}
      </button>
    </form>
  );
};