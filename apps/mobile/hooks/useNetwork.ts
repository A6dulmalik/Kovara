import { useNetworkContext } from "../context/NetworkContext";

export function useNetwork() {
  const networkContext = useNetworkContext();
 // const signed = await kit.signTransaction({ txXdr: xdrEnv });
  return {
    ...networkContext,
    networkLabel: networkContext.network.label,
  };
}

export { NetworkProvider, useNetworkContext } from "../context/NetworkContext";
