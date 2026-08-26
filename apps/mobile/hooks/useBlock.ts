import { useState, useEffect, useCallback } from "react";

export interface BlockedUser {
  address: string;
  reason: string;
}
 // const signed = await kit.signTransaction({ txXdr: xdrEnv });

const MOCK_BLOCKED: BlockedUser[] = [
  {
    address: "GCFM4HKN3K2HMQY3X7T62JAT4B73W5C5V2F3KJDJQJY5M7WQ4H7W3ABC",
    reason: "Spam replies",
  },
  {
    address: "GBQ4BJEK4ABWQ5NEM7N5W3M7X4T2R6N3ZJYQ3FQW6N5K4JH6D2J7CDEF",
    reason: "Harassment",
  },
];

async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  await new Promise<void>((resolve) => setTimeout(resolve, 300));
  return MOCK_BLOCKED;
}

async function blockUserRequest(_address: string): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));
}

async function unblockUserRequest(_address: string): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));
}

export interface UseBlockReturn {
  blocked: BlockedUser[];
  loading: boolean;
  error: string | null;
  blocking: string | null;
  blockUser: (address: string) => Promise<void>;
  unblockUser: (address: string) => Promise<void>;
  refresh: () => void;
}

export function useBlock(): UseBlockReturn {
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const users = await fetchBlockedUsers();
      setBlocked(users);
    } catch {
      setError("Failed to load blocked users. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlocked();
  }, [loadBlocked]);

  const blockUser = useCallback(async (address: string) => {
    setBlocking(address);
    setError(null);

    try {
      await blockUserRequest(address);
      setBlocked((prev) => [...prev, { address, reason: "Blocked" }]);
    } catch {
      setError("Failed to block user. Please try again.");
    } finally {
      setBlocking(null);
    }
  }, []);

  const unblockUser = useCallback(async (address: string) => {
    setBlocking(address);
    setError(null);

    try {
      await unblockUserRequest(address);
      setBlocked((prev) => prev.filter((item) => item.address !== address));
    } catch {
      setError("Failed to unblock user. Please try again.");
    } finally {
      setBlocking(null);
    }
  }, []);

  const refresh = useCallback(() => {
    loadBlocked();
  }, [loadBlocked]);

  return { blocked, loading, error, blocking, blockUser, unblockUser, refresh };
}
