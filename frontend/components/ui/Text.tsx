import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';
import { colors, fonts, fontSizes } from './theme';

type Variant = 'title' | 'heading' | 'body' | 'caption' | 'label';

interface TextProps extends RNTextProps {
  variant?: Variant;
  muted?: boolean;
}

export function Text({ variant = 'body', muted, style, ...rest }: TextProps) {
  return (
    <RNText
      style={[
        styles.base,
        variantStyles[variant],
        muted && styles.muted,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.foreground,
  },
  muted: {
    color: colors.mutedForeground,
  },
});

const variantStyles = StyleSheet.create({
  title: {
    fontSize: fontSizes['4xl'],
    ...fonts.bold,
  },
  heading: {
    fontSize: fontSizes.xl,
    ...fonts.semibold,
  },
  body: {
    fontSize: fontSizes.base,
    ...fonts.regular,
  },
  caption: {
    fontSize: fontSizes.sm,
    ...fonts.regular,
    color: colors.mutedForeground,
  },
  label: {
    fontSize: fontSizes.sm,
    ...fonts.medium,
  },
});
