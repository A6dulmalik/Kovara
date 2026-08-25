import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Assuming a provider or hook exists to access the KovaraClient and current user
// If not, this would be replaced with the appropriate state management for the user session
import { useKovara } from "./useKovara";

export const useFollow = (targetAddress: string) => {
  const { client, address: me } = useKovara();
  const queryClient = useQueryClient();

  // Fetch initial follow status
  const { data: isFollowing, isLoading } = useQuery({
    queryKey: ["isFollowing", me, targetAddress],
    queryFn: async () => {
      if (!me) return false;
      // Check first page of following list for the target address
      const following = await client.getFollowing(me, 0, 50);
      return following.includes(targetAddress);
    },
    enabled: !!me && !!targetAddress,
  });

  const updateCache = async (newStatus: boolean) => {
    await queryClient.cancelQueries({ queryKey: ["isFollowing", me, targetAddress] });
    await queryClient.cancelQueries({ queryKey: ["followerCount", targetAddress] });

    const previousStatus = queryClient.getQueryData(["isFollowing", me, targetAddress]);
    const previousCount =
      (queryClient.getQueryData(["followerCount", targetAddress]) as number) || 0;

    queryClient.setQueryData(["isFollowing", me, targetAddress], newStatus);
    queryClient.setQueryData(
      ["followerCount", targetAddress],
      newStatus ? previousCount + 1 : Math.max(0, previousCount - 1)
    );

    return { previousStatus, previousCount };
  };

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Authentication required");
      return await client.follow(me, targetAddress);
    },
    onMutate: () => updateCache(true),
    onError: (err, _, context) => {
      queryClient.setQueryData(["isFollowing", me, targetAddress], context?.previousStatus);
      queryClient.setQueryData(["followerCount", targetAddress], context?.previousCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", me, targetAddress] });
      queryClient.invalidateQueries({ queryKey: ["followerCount", targetAddress] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Authentication required");
      return await client.unfollow(me, targetAddress);
    },
    onMutate: () => updateCache(false),
    onError: (err, _, context) => {
      queryClient.setQueryData(["isFollowing", me, targetAddress], context?.previousStatus);
      queryClient.setQueryData(["followerCount", targetAddress], context?.previousCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", me, targetAddress] });
      queryClient.invalidateQueries({ queryKey: ["followerCount", targetAddress] });
    },
  });
 // const signed = await kit.signTransaction({ txXdr: xdrEnv });
  const toggleFollow = useCallback(() => {
    if (isLoading || followMutation.isPending || unfollowMutation.isPending) return;

    if (isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  }, [isFollowing, isLoading, followMutation, unfollowMutation]);

  // Aggregate errors for the component
  const error = (followMutation.error as Error) || (unfollowMutation.error as Error);

  return {
    isFollowing,
    isLoading: isLoading || followMutation.isPending || unfollowMutation.isPending,
    toggleFollow,
    error,
  };
};
