import { useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { GradientScreen, Text, colors, spacing } from '@/components/ui';
import { ProfileView, type ProfileData } from '@/components/ProfileView';
import { type Post } from '@/components/PostCard';
import { consumeScrollToPostIntent } from '@/services/scrollToPost';
import { apiFetch } from '@/services/api';

type ProfileBundle = {
  profile: ProfileData;
  followersCount: number;
  followingCount: number;
};
type PostsPage = { items: Post[]; cursor: string | null; count: number };

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [extraPosts, setExtraPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scrollToPostId, setScrollToPostId] = useState<string | null>(null);
  const [scrollToPostSection, setScrollToPostSection] = useState<'comments' | 'reactions' | null>(null);
  const [scrollToReactionType, setScrollToReactionType] = useState<string | undefined>(undefined);

  // ── Profile + follow counts (cached) ──
  const { data: profileBundle, isLoading } = useQuery({
    queryKey: ['myProfile'],
    queryFn: async () => {
      const [profile, followers, following] = await Promise.all([
        apiFetch<ProfileData>('/profile'),
        apiFetch<{ count: number }>('/follows/followers'),
        apiFetch<{ count: number }>('/follows/following'),
      ]);
      return { profile, followersCount: followers.count, followingCount: following.count };
    },
  });

  // ── Own posts (cached first page) ──
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['myPosts'],
    queryFn: async () => {
      const data = await apiFetch<PostsPage>('/posts?limit=20');
      setCursor(data.cursor);
      setHasMore(data.count === 20);
      setExtraPosts([]);
      return data;
    },
  });

  const posts = [...(postsData?.items ?? []), ...extraPosts];

  // ── Check for scroll-to-post intent on focus ──
  useFocusEffect(
    useCallback(() => {
      const intent = consumeScrollToPostIntent();
      if (intent) {
        setScrollToPostId(intent.postId);
        setScrollToPostSection(intent.section);
        setScrollToReactionType(intent.reactionType);
      } else {
        setScrollToPostId(null);
        setScrollToPostSection(null);
        setScrollToReactionType(undefined);
      }
    }, [])
  );

  // ── Pagination ──
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<PostsPage>(`/posts?limit=20&cursor=${cursor}`);
      setExtraPosts((prev) => [...prev, ...data.items]);
      setCursor(data.cursor);
      setHasMore(data.count === 20);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, cursor]);

  const handlePostChanged = (updated: Post) => {
    queryClient.setQueryData<PostsPage>(['myPosts'], (old) =>
      old ? { ...old, items: old.items.map((p) => (p.id === updated.id ? updated : p)) } : old
    );
    setExtraPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await apiFetch(`/posts/${postId}`, { method: 'DELETE' });
      queryClient.setQueryData<PostsPage>(['myPosts'], (old) =>
        old ? { ...old, items: old.items.filter((p) => p.id !== postId) } : old
      );
      setExtraPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      // ignore
    }
  };

  if (isLoading) {
    return (
      <GradientScreen transparent>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen transparent>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }} />
        <View style={styles.headerActions}>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/create-post')}>
            <Ionicons name="add-circle-outline" size={26} color={colors.foreground} />
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/edit-profile')}>
            <Ionicons name="pencil-outline" size={22} color={colors.foreground} />
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={22} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      <ProfileView
        profile={profileBundle?.profile ?? null}
        followersCount={profileBundle?.followersCount ?? 0}
        followingCount={profileBundle?.followingCount ?? 0}
        isOwnProfile
        posts={posts}
        postsLoading={postsLoading || loadingMore}
        onLoadMore={loadMore}
        onPostChanged={handlePostChanged}
        onDeletePost={handleDeletePost}
        scrollToPostId={scrollToPostId}
        scrollToPostSection={scrollToPostSection}
        scrollToReactionType={scrollToReactionType}
      />
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerUsername: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIcon: {
    padding: 6,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
