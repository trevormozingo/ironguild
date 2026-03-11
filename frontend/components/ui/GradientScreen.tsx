import { StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export const gradientColors = ['#ffffff', '#eaeeff', '#727272'] as const;
export const gradientStart = { x: 0, y: 0 };
export const gradientEnd = { x: 1, y: 1 };

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  transparent?: boolean;
};

/**
 * Full-screen gradient background with SafeAreaView.
 * Pass transparent={true} when a parent already provides the gradient.
 */
export function GradientScreen({ children, style, transparent }: Props) {
  if (transparent) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: 'transparent' }, style]}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient
      colors={[...gradientColors]}
      start={gradientStart}
      end={gradientEnd}
      style={styles.gradient}
    >
      <SafeAreaView style={[styles.safe, style]}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
});
