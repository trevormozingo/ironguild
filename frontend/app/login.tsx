import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, GradientScreen, Input, Text, colors, spacing } from '@/components/ui';
import { sendVerificationCode, verifyCode, getIdToken } from '@/services/auth';
import { config } from '@/config';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const codeSent = !!verificationId;

  const handleSendCode = async () => {
    setLoading(true);
    try {
      const { sessionInfo, code: autoCode } = await sendVerificationCode(phone);
      setVerificationId(sessionInfo);
      // In emulator mode, auto-fill the code
      if (autoCode) setCode(autoCode);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationId) return;
    setLoading(true);
    try {
      const { uid } = await verifyCode(verificationId, code);
      console.log('Signed in as', uid);

      // Fetch existing profile
      const token = getIdToken();
      const res = await fetch(`${config.apiBaseUrl}/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        router.replace('/(home)/feed');
      } else if (res.status === 404) {
        // No profile yet — go to create
        router.replace('/create-profile');
      } else {
        throw new Error(`Failed to fetch profile (${res.status})`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientScreen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text variant="title">Iron Guild</Text>
          <Text muted style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          {!codeSent ? (
            <>
              <Input
                placeholder="Phone Number"
                keyboardType="phone-pad"
                autoCapitalize="none"
                value={phone}
                onChangeText={setPhone}
              />
              <Button
                label="Send Verification Code"
                onPress={handleSendCode}
                disabled={!phone.trim()}
                loading={loading}
                style={styles.button}
              />
            </>
          ) : (
            <>
              <Text muted style={styles.codeHint}>
                Enter the code sent to {phone}
              </Text>
              <Input
                placeholder="Verification Code"
                keyboardType="number-pad"
                autoCapitalize="none"
                value={code}
                onChangeText={setCode}
              />
              <Button
                label="Verify & Sign In"
                onPress={handleVerifyCode}
                disabled={!code.trim()}
                loading={loading}
                style={styles.button}
              />
              <Button
                label="Use a different number"
                variant="ghost"
                onPress={() => { setVerificationId(null); setCode(''); }}
              />
            </>
          )}
        </View>
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
  form: {
    gap: spacing.md,
  },
  codeHint: {
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.sm,
  },
});
