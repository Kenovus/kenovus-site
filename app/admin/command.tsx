import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';

export default function AdminCommand() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>Kenovus command</Text>
      <Text style={styles.body}>Super admin home (Section 14) · MRR, clinics, alerts.</Text>
      <Button onPress={() => void signOut()} style={styles.out} variant="ghost">
        Sign out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 24,
  },
  title: {
    ...typography.h1,
    color: colors.white,
    marginBottom: 12,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
  },
  out: {
    marginTop: 32,
    alignSelf: 'flex-start',
  },
});
