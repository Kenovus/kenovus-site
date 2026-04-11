import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

export default function ProviderPatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Patient {id}</Text>
      <Text style={styles.body}>Clinical overview · tabs ship in Week 1</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/provider/patient/[id]/glp1',
              params: { id: String(id) },
            })
          }
          style={styles.tab}>
          <Text style={styles.tabText}>GLP-1</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/provider/patient/[id]/inbody',
              params: { id: String(id) },
            })
          }
          style={styles.tab}>
          <Text style={styles.tabText}>InBody</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/provider/patient/[id]/labs',
              params: { id: String(id) },
            })
          }
          style={styles.tab}>
          <Text style={styles.tabText}>Labs</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/provider/patient/[id]/laser',
              params: { id: String(id) },
            })
          }
          style={styles.tab}>
          <Text style={styles.tabText}>Laser</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/provider/patient/[id]/photos',
              params: { id: String(id) },
            })
          }
          style={styles.tab}>
          <Text style={styles.tabText}>Photos</Text>
        </Pressable>
      </View>
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
    marginBottom: 8,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  tabText: {
    ...typography.body,
    color: colors.goldLight,
    fontSize: 13,
  },
});
