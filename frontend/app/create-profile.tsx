import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GradientScreen, SchemaForm, Text, colors, spacing } from '@/components/ui';
import { CreateProfileSchema, CreateProfileFields } from '@/models/profile';
import { getIdToken } from '@/services/auth';
import { config } from '@/config';

export default function CreateProfileScreen() {
  const router = useRouter();

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      const token = getIdToken();
      const res = await fetch(`${config.apiBaseUrl}/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Failed to create profile (${res.status})`);
      }

      console.log('Profile created');
      router.replace('/(home)/feed');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong');
    }
  };

  return (
    <GradientScreen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text variant="title">Create Profile</Text>
          <Text muted style={styles.subtitle}>Set up your profile to get started</Text>
        </View>

        <SchemaForm
          fields={CreateProfileFields}
          schema={CreateProfileSchema}
          onSubmit={handleSubmit}
          submitLabel="Create Profile"
        />
      </KeyboardAvoidingView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  subtitle: {
    marginTop: spacing.sm,
  },
});
