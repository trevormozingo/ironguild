import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GradientScreen, SchemaForm, Text, colors, spacing } from '@/components/ui';
import { UpdateProfileSchema, UpdateProfileFields } from '@/models/profile';
import { getIdToken } from '@/services/auth';
import { uploadProfilePhoto } from '@/services/storage';
import { config } from '@/config';

export default function EditProfileScreen() {
  const router = useRouter();
  const [initialValues, setInitialValues] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = getIdToken();
        const res = await fetch(`${config.apiBaseUrl}/profile`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const profile = await res.json();
          setInitialValues({
            displayName: profile.displayName ?? '',
            bio: profile.bio ?? '',
            birthday: profile.birthday ?? '',
          });
          if (profile.profilePhoto) {
            setExistingPhotoUrl(profile.profilePhoto);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      const token = getIdToken();
      const authHeaders: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // Upload photo via backend if a new one was picked
      if (photoUri) {
        setUploadingPhoto(true);
        await uploadProfilePhoto(photoUri);
        setUploadingPhoto(false);
        // Backend already persisted the URL on the profile doc
      }

      const payload = { ...data };

      const res = await fetch(`${config.apiBaseUrl}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Failed to update profile (${res.status})`);
      }

      router.back();
    } catch (err: any) {
      setUploadingPhoto(false);
      Alert.alert('Error', err.message ?? 'Something went wrong');
    }
  };

  if (loading) {
    return (
      <GradientScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </GradientScreen>
    );
  }

  const displayUri = photoUri ?? existingPhotoUrl;

  return (
    <GradientScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text variant="heading">Edit Profile</Text>
        <View style={styles.backButton} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* Profile Photo Picker */}
        <View style={styles.photoSection}>
          <Pressable onPress={pickImage} style={styles.photoPressable}>
            <View style={styles.photoWrapper}>
              {displayUri ? (
                <Image source={{ uri: displayUri }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person" size={40} color={colors.muted} />
                </View>
              )}
            </View>
            <View style={styles.cameraOverlay}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
          <Text muted style={styles.photoHint}>Tap to change photo</Text>
        </View>

        {uploadingPhoto && (
          <View style={styles.uploadingBanner}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text muted style={{ marginLeft: spacing.sm }}>Uploading photo…</Text>
          </View>
        )}

        <SchemaForm
          fields={UpdateProfileFields}
          schema={UpdateProfileSchema}
          onSubmit={handleSubmit}
          submitLabel="Save"
          initialValues={initialValues ?? undefined}
        />
      </KeyboardAvoidingView>
    </GradientScreen>
  );
}

const PHOTO_SIZE = 100;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  photoPressable: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    position: 'relative',
  },
  photoWrapper: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    overflow: 'hidden',
  },
  photoImage: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  photoPlaceholder: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  photoHint: {
    marginTop: spacing.sm,
    fontSize: 12,
  },
  uploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
});
