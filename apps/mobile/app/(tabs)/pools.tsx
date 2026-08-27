import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { PoolCard } from "../../components/PoolCard";
import { usePools } from "../../hooks/usePools";
import { EmptyState } from "../../components/states/EmptyState";
import { ErrorState } from "../../components/states/ErrorState";
import { useTheme } from "../../theme/useTheme";

export default function PoolsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { pools, loading, error, errorCode, hasMore, loadMore, refresh } = usePools();

  const handlePoolPress = (poolId: string) => {
    router.push(`/pool/${poolId}`);
  };

  const isInitialLoad = loading && pools.length === 0;

  if (isInitialLoad) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pools</Text>
          <Text style={styles.subtitle}>Community funding pools</Text>
        </View>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.brand.primary} />
        </View>
      </View>
    );
  }

  if (error && pools.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pools</Text>
          <Text style={styles.subtitle}>Community funding pools</Text>
        </View>
        <ErrorState message={error} statusCode={errorCode} onRetry={refresh} />
      </View>
    );
  }

  if (pools.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pools</Text>
          <Text style={styles.subtitle}>Community funding pools</Text>
        </View>
        <EmptyState
          icon="◎"
          title="No pools available"
          subtitle="Check back soon for community funding opportunities"
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={loading && pools.length > 0}
          onRefresh={refresh}
          tintColor={theme.colors.brand.primary}
          colors={[theme.colors.brand.primary]}
        />
      }
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const nearBottom =
          layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;
        if (nearBottom && hasMore && !loading) {
          loadMore();
        }
      }}
      scrollEventThrottle={200}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Pools</Text>
        <Text style={styles.subtitle}>Community funding pools</Text>
      </View>

      <View style={styles.listContainer}>
        {pools.map((pool) => (
          <TouchableOpacity
            key={pool.pool_id}
            onPress={() => handlePoolPress(pool.pool_id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Pool ${pool.pool_id}`}
          >
            <PoolCard
              id={pool.pool_id}
              name={pool.token_symbol ?? pool.token}
              description={`${pool.admins.length} admin${pool.admins.length === 1 ? "" : "s"}`}
              totalValue={`${pool.balance.toString()}`}
              participants={pool.admins.length}
              onPress={() => handlePoolPress(pool.pool_id)}
            />
          </TouchableOpacity>
        ))}
      </View>

      {loading && pools.length > 0 ? (
        <ActivityIndicator
          style={styles.footer}
          color={theme.colors.brand.primary}
          size="small"
        />
      ) : null}

      {!hasMore && pools.length > 0 ? (
        <Text style={styles.endOfList}>You've reached the end</Text>
      ) : null}

      {hasMore && !loading ? (
        <TouchableOpacity
          style={styles.loadMoreButton}
          onPress={loadMore}
          accessibilityRole="button"
          accessibilityLabel="Load more pools"
        >
          <Text style={styles.loadMoreText}>Load more</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  contentContainer: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },
  listContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingVertical: 16,
  },
  endOfList: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
    paddingVertical: 16,
  },
  loadMoreButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
  },
  loadMoreText: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "600",
  },
});
