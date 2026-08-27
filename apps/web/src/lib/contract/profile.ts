import { 
  SorobanRpc, 
  TransactionBuilder, 
  Networks, 
  Contract, 
  scValToNative, 
  nativeToScVal 
} from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
const CONTRACT_ID = process.env.NEXT_PUBLIC_PROFILE_CONTRACT_ID || '';

const server = new SorobanRpc.Server(RPC_URL);
const contract = new Contract(CONTRACT_ID);

export interface ProfileData {
  username: string;
  bio: string;
  avatarUrl: string;
}

export class ProfileContractClient {
  /**
   * Invokes the contract to set or update a user profile on-chain.
   */
  static async setProfile(userPublicKey: string, profile: ProfileData): Promise<string> {
    if (!CONTRACT_ID) {
      throw new Error('Profile contract ID is not configured');
    }

    try {
      // 1. Get account details for sequence number
      const account = await server.getAccount(userPublicKey);

      // 2. Build the contract invocation transaction
      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'set_profile',
            nativeToScVal(userPublicKey, { type: 'address' }),
            nativeToScVal(profile.username, { type: 'string' }),
            nativeToScVal(profile.bio, { type: 'string' }),
            nativeToScVal(profile.avatarUrl, { type: 'string' })
          )
        )
        .setTimeout(30)
        .build();

      // 3. Simulate transaction to estimate resource fee and verify validity
      const simulation = await server.simulateTransaction(tx);
      if (SorobanRpc.isSimulationError(simulation)) {
        throw new Error(`Simulation failed: ${simulation.error}`);
      }

      // 4. Assemble simulated transaction resources
      const assembledTx = SorobanRpc.assembleTransaction(tx, simulation).build();

      // 5. Request signature from Freighter wallet
      const signedXdr = await signTransaction(assembledTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      // 6. Submit transaction to Soroban network
      const sendResponse = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as any
      );

      if (sendResponse.status === 'ERROR') {
        throw new Error(`Transaction submission failed: ${JSON.stringify(sendResponse.errorResultXDR)}`);
      }

      // 7. Poll for transaction confirmation status
      let result = await server.getTransaction(sendResponse.hash);
      let attempts = 0;
      while (result.status === 'NOT_FOUND' && attempts < 15) {
        await new Promise((r) => setTimeout(r, 2000));
        result = await server.getTransaction(sendResponse.hash);
        attempts++;
      }

      if (result.status !== 'SUCCESS') {
        throw new Error(`Transaction failed or timed out: ${result.status}`);
      }

      return sendResponse.hash;
    } catch (err: any) {
      console.error('Failed to set profile on Soroban contract:', err);
      throw new Error(err.message || 'On-chain profile update failed');
    }
  }

  /**
   * Fetches profile data directly from the Soroban contract.
   */
  static async getProfile(userPublicKey: string): Promise<ProfileData | null> {
    if (!CONTRACT_ID) return null;

    try {
      const tx = new TransactionBuilder(await server.getAccount(userPublicKey), {
        fee: '100000',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call('get_profile', nativeToScVal(userPublicKey, { type: 'address' }))
        )
        .setTimeout(30)
        .build();

      const simulation = await server.simulateTransaction(tx);
      if (SorobanRpc.isSimulationError(simulation) || !simulation.result?.retval) {
        return null;
      }

      const rawVal = scValToNative(simulation.result.retval);
      if (!rawVal) return null;

      return {
        username: rawVal.username || '',
        bio: rawVal.bio || '',
        avatarUrl: rawVal.avatar_url || rawVal.avatarUrl || '',
      };
    } catch (err) {
      console.error('Failed to fetch profile from contract:', err);
      return null;
    }
  }
}