import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

export default function LaserDeviceList() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sona devices</Text>
      <Pressable
        onPress={() => router.push('/provider/protocols/laser/sample-device')}
        style={styles.row}>
        <Text style={styles.body}>Sample device · settings + training</Text>
      </Pressable>
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
    marginBottom: 16,
  },
  row: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
  },
});
