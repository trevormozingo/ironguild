import { useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { GradientScreen, colors, spacing } from '@/components/ui';
import { ProfileView, type ProfileData } from '@/components/ProfileView';
import { type Post } from '@/components/PostCard';
import { getUid } from '@/services/auth';
import { apiFetch } from '@/services/api';
import { getOrCreateConversation } from '@/services/messaging';

type PostsPage = { items: Post[]; cursor: string | null; count: number };

export default function UserProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { username } = useLocalSearchParams<{ username: string }>();

  const [extraPosts, setExtraPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // ── Profile data (cached by username) ──
  const { data: profile, isLoading } = useQuery({
    queryKey: ['userProfile', username],
    queryFn: () => apiFetch<ProfileData>(`/profile/${username}`),
    enabled: !!username,
  });

  // ── Follow counts + follow status (depends on profile.id) ──
  const { data: followData } = useQuery({
    queryKey: ['userFollowData', profile?.id],
    queryFn: async () => {
      const [followers, following, myFollowing] = await Promise.all([
        apiFetch<{ count: number }>(`/follows/${profile!.id}/followers`),
        apiFetch<{ count: number }>(`/follows/${profile!.id}/following`),
        apiFetch<{ following: { id: string }[] }>('/follows/following'),
      ]);
      const amFollowing = myFollowing.following.some((u) => u.id === profile!.id);
      setIsFollowing(amFollowing);
      return { followersCount: followers.count, followingCount: following.count };
    },
    enabled: !!profile?.id,
  });

  // ── User's posts (cached first page by uid) ──
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['userPosts', profile?.id],
    queryFn: async () => {
      const data = await apiFetch<PostsPage>(`/posts/user/${profile!.id}?limit=20`);
      setCursor(data.cursor);
      setHasMore(data.count === 20);
      setExtraPosts([]);
      return data;
    },
    enabled: !!profile?.id,
  });

  const posts = [...(postsData?.items ?? []), ...extraPosts];

  // ── Pagination ──
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor || !profile) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<PostsPage>(`/posts/user/${profile.id}?limit=20&cursor=${cursor}`);
      setExtraPosts((prev) => [...prev, ...data.items]);
      setCursor(data.cursor);
      setHasMore(data.count === 20);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, cursor, profile]);

  const handleFollow = async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      await apiFetch(`/follows/${profile.id}`, { method });
      setIsFollowing(!isFollowing);
      // Update cached follow data
      queryClient.setQueryData<{ followersCount: number; followingCount: number }>(
        ['userFollowData', profile.id],
        (old) => old ? { ...old, followersCount: old.followersCount + (isFollowing ? -1 : 1) } : old
      );
    } catch {
      // ignore
    } finally {
      setFollowLoading(false);
    }
  };

  const handlePostChanged = (updated: Post) => {
    queryClient.setQueryData<PostsPage>(['userPosts', profile?.id], (old) =>
      old ? { ...old, items: old.items.map((p) => (p.id === updated.id ? updated : p)) } : old
    );
    setExtraPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleMessage = useCallback(async () => {
    const myUid = getUid();
    if (!myUid || !profile) return;
    const conversationId = await getOrCreateConversation(myUid, profile.id);
    router.push({
      pathname: '/conversation',
      params: { conversationId, otherUid: profile.id },
    });
  }, [profile, router]);

  if (isLoading) {
    return (
      <GradientScreen>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
      </View>

      <ProfileView
        profile={profile ?? null}
        followersCount={followData?.followersCount ?? 0}
        followingCount={followData?.followingCount ?? 0}
        isOwnProfile={profile?.id === getUid()}
        posts={posts}
        postsLoading={postsLoading || loadingMore}
        onLoadMore={loadMore}
        onPostChanged={handlePostChanged}
        followListParams={profile ? `&uid=${profile.id}` : ''}
        isFollowing={isFollowing}
        followLoading={followLoading}
        onFollowToggle={profile?.id !== getUid() ? handleFollow : undefined}
        onMessage={profile?.id !== getUid() ? handleMessage : undefined}
      />
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
