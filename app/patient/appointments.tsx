import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { guidedScreen } from '@/constants/guidedUi';

export default function AppointmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.title}>Appointments</Text>
      <Text style={styles.body}>
        Guided mode keeps booking one tap away. Full scheduling UI lands with the Book flow.
      </Text>
      <Button onPress={() => router.push('/patient/book')} variant="primary">
        Book a visit
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 22,
  },
  title: {
    fontFamily: 'CormorantGaramond_300Light',
    fontSize: 32,
    color: colors.white,
    marginBottom: 12,
  },
  body: {
    ...typography.body,
    fontSize: guidedScreen.bodyFontSize,
    color: colors.gray1,
    lineHeight: 24,
    marginBottom: 24,
  },
});
