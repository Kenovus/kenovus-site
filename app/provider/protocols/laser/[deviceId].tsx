import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

export default function LaserDeviceDetail() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Device</Text>
      <Text style={styles.body}>{deviceId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: 20,
  },
  title: {
    ...typography.h2,
    color: colors.white,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    marginTop: 8,
  },
});
