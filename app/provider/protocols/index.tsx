import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

export default function ProtocolsIndex() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Clinic protocol library</Text>
      <Pressable onPress={() => router.push('/provider/protocols/laser')} style={styles.row}>
        <Text style={styles.link}>Laser & devices</Text>
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
    marginBottom: 20,
  },
  row: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  link: {
    ...typography.body,
    color: colors.goldLight,
  },
});
