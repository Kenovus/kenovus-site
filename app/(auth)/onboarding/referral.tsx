import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, typography } from '@/constants/designSystem';

export default function OnboardingReferral() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hasReferral, setHasReferral] = useState<boolean | null>(null);
  const [referralCode, setReferralCode] = useState('');

  const next = () => {
    if (hasReferral && referralCode.trim()) {
      /* Week 4: insert into referrals with referred_by_code */
    }
    router.replace('/(auth)/onboarding/ui_mode');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.step}>Step 6 of 7</Text>
      <Text style={styles.title}>Were you referred by someone?</Text>
      <Text style={styles.body}>If a friend shared SonaLife with you, add their code here.</Text>

      <View style={styles.row}>
        <Pressable
          onPress={() => setHasReferral(true)}
          style={[styles.choice, hasReferral === true && styles.choiceOn]}>
          <Text style={[styles.choiceText, hasReferral === true && styles.choiceTextOn]}>Yes</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setHasReferral(false);
            setReferralCode('');
          }}
          style={[styles.choice, hasReferral === false && styles.choiceOn]}>
          <Text style={[styles.choiceText, hasReferral === false && styles.choiceTextOn]}>No</Text>
        </Pressable>
      </View>

      {hasReferral === true ? (
        <Card style={styles.card}>
          <Text style={styles.label}>Referral code</Text>
          <TextInput
            autoCapitalize="characters"
            onChangeText={setReferralCode}
            placeholder="SARAH2026"
            placeholderTextColor={colors.gray2}
            style={styles.input}
            value={referralCode}
          />
        </Card>
      ) : null}

      <Button onPress={next} variant="primary">
        Continue
      </Button>
      <Button onPress={next} style={styles.skip} variant="ghost">
        Skip
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
  step: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 10,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 10,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  choice: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: 'center',
  },
  choiceOn: {
    borderColor: colors.gold,
    backgroundColor: colors.goldDim,
  },
  choiceText: {
    ...typography.body,
    color: colors.white,
  },
  choiceTextOn: {
    color: colors.dark,
    fontFamily: 'Jost_300Light',
  },
  card: {
    marginBottom: 20,
  },
  label: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 8,
  },
  input: {
    ...typography.body,
    color: colors.white,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.dark2,
  },
  skip: {
    marginTop: 12,
  },
});
