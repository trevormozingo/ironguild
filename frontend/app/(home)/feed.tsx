import { useState, useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { GradientScreen, Text, colors, spacing, radii } from '@/components/ui';
import { PostCard, type Post } from '@/components/PostCard';
import { apiFetch } from '@/services/api';

type FeedPage = { items: Post[]; cursor: string | null; count: number };

export default function FeedScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [extraPosts, setExtraPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Initial feed load (cached, stale-while-revalidate) ──
  const { data: feedData, isLoading, isRefetching } = useQuery({
    queryKey: ['feed'],
    queryFn: async () => {
      const data = await apiFetch<FeedPage>('/feed?limit=20');
      // Reset pagination state when initial page refreshes
      setCursor(data.cursor);
      setHasMore(data.count === 20);
      setExtraPosts([]);
      return data;
    },
  });

  const posts = [...(feedData?.items ?? []), ...extraPosts];

  // ── Unread notification count (cached) ──
  const { data: unreadData } = useQuery({
    queryKey: ['unreadNotifCount'],
    queryFn: () => apiFetch<{ count: number }>('/profile/notifications/unread-count'),
  });
  const unreadNotifs = unreadData?.count ?? 0;

  // ── Pagination (append beyond first page) ──
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<FeedPage>(`/feed?limit=20&cursor=${cursor}`);
      setExtraPosts((prev) => [...prev, ...data.items]);
      setCursor(data.cursor);
      setHasMore(data.count === 20);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, cursor]);

  // ── Pull-to-refresh ──
  const onRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['unreadNotifCount'] });
  }, [queryClient]);

  const handlePostChanged = (updated: Post) => {
    // Update in query cache
    queryClient.setQueryData<FeedPage>(['feed'], (old) =>
      old ? { ...old, items: old.items.map((p) => (p.id === updated.id ? updated : p)) } : old
    );
    // Update in extra pages
    setExtraPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <GradientScreen transparent>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }} />
        <Pressable
          style={styles.bellButton}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.foreground} />
          {unreadNotifs > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadNotifs > 99 ? '99+' : unreadNotifs}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={styles.personButton}
          onPress={() => router.push('/friends')}
        >
          <Ionicons name="people-outline" size={24} color={colors.foreground} />
        </Pressable>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            showAuthor
            onPostChanged={handlePostChanged}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={isRefetching}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text muted>No posts in your feed yet. Follow some people!</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading || loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null
        }
      />
    </GradientScreen>
  );
}

const styles = StyleSheet.create({

  personButton: {
    padding: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  bellButton: {
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  feedHeader: {
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing['2xl'],
  },
  footerLoader: {
    paddingVertical: spacing.lg,
  },
});
