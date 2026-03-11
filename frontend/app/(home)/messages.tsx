import { StyleSheet, View } from 'react-native';
import { GradientScreen, Text, colors, spacing } from '@/components/ui';

export default function MessagesScreen() {
  return (
    <GradientScreen transparent>
      <View style={styles.center}>
        <Text muted>Your messages will appear here.</Text>
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
