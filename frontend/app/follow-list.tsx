import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientScreen, Text, colors, spacing } from '@/components/ui';
import { getIdToken } from '@/services/auth';
import { config } from '@/config';

type FollowUser = {
  id: string;
  username: string;
  displayName: string;
  profilePhoto?: string | null;
};

type Tab = 'followers' | 'following';

export default function FollowListScreen() {
  const router = useRouter();
  const { tab: initialTab, uid } = useLocalSearchParams<{ tab?: string; uid?: string }>();
  const [tab, setTab] = useState<Tab>(
    initialTab === 'following' ? 'following' : 'followers',
  );
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = getIdToken();
        const headers: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const followersUrl = uid
          ? `${config.apiBaseUrl}/follows/${uid}/followers`
          : `${config.apiBaseUrl}/follows/followers`;
        const followingUrl = uid
          ? `${config.apiBaseUrl}/follows/${uid}/following`
          : `${config.apiBaseUrl}/follows/following`;
        const [followersRes, followingRes] = await Promise.all([
          fetch(followersUrl, { headers }),
          fetch(followingUrl, { headers }),
        ]);
        if (followersRes.ok) {
          const data = await followersRes.json();
          setFollowers(data.followers);
        }
        if (followingRes.ok) {
          const data = await followingRes.json();
          setFollowing(data.following);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const data = tab === 'followers' ? followers : following;

  const renderItem = ({ item }: { item: FollowUser }) => (
    <Pressable
      style={styles.userRow}
      onPress={() => router.push(`/user/${item.username}` as any)}
    >
      {item.profilePhoto ? (
        <Image source={{ uri: item.profilePhoto }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>
            {item.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>{item.displayName}</Text>
        <Text muted>@{item.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
    </Pressable>
  );

  return (
    <GradientScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'followers' && styles.tabActive]}
          onPress={() => setTab('followers')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'followers' && styles.tabTextActive,
            ]}
          >
            Followers
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'following' && styles.tabActive]}
          onPress={() => setTab('following')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'following' && styles.tabTextActive,
            ]}
          >
            Following
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text muted>
                {tab === 'followers'
                  ? 'No followers yet.'
                  : "You're not following anyone yet."}
              </Text>
            </View>
          }
        />
      )}
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
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.foreground,
  },
  tabText: {
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.foreground,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing['2xl'],
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.muted,
    marginRight: spacing.md,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 18,
    color: colors.foreground,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontWeight: '600',
    color: colors.foreground,
  },
});
