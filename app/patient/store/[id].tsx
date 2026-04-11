import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

export default function StoreProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Product</Text>
      <Text style={styles.body}>id: {id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: 24,
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
