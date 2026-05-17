import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';

type Props = {
  title: string;
  body: string;
};

export function ConsumerPaywallCard({ title, body }: Props) {
  const router = useRouter();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Button variant="primary" onPress={() => router.push('/patient/profile/consumer_plan')}>
        View plans
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 14,
    backgroundColor: 'rgba(201,168,76,0.12)',
    gap: 10,
    marginVertical: 8,
  },
  title: { ...typography.h2, color: colors.white, fontSize: 18 },
  body: { ...typography.body, color: colors.gray1 },
});
