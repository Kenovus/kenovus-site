import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, typography } from '@/constants/designSystem';
import { getPostAuthHref, isPatientFacingRole } from '@/lib/authRouting';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';

const SUPPORT_EMAIL = 'support@kenovus.com';

export default function AccountRecoveryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refreshProfile, signOut } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [contacting, setContacting] = useState(false);

  const session = useAuthStore((s) => s.session);

  const onRetryLookup = async () => {
    setRetrying(true);
    try {
      await refreshProfile();
      const profile = useAuthStore.getState().profile;
      const patientOnboardingComplete = useAuthStore.getState().patientOnboardingComplete;
      const superAdminViewMode = useAuthStore.getState().superAdminViewMode;
      if (!profile) {
        Alert.alert(
          'Profile still missing',
          'We still could not find a linked profile for this account. Request an invite code or contact support below.',
        );
        return;
      }
      const onboardingComplete =
        !isPatientFacingRole(profile.role) || patientOnboardingComplete === true;
      Alert.alert('Linked', 'Your account is now linked. Taking you to your dashboard.');
      router.replace(getPostAuthHref(profile, onboardingComplete, superAdminViewMode));
    } finally {
      setRetrying(false);
    }
  };

  const onRequestInviteCode = async () => {
    const code = inviteCode.trim();
    if (!code) {
      Alert.alert('Invite code needed', 'Enter the invite code your clinic sent you.');
      return;
    }
    setSubmittingInvite(true);
    try {
      const email = session?.user.email ?? 'unknown-email';
      const message = `Kenovus account-link request\n\nEmail: ${email}\nAuth user id: ${session?.user.id ?? 'unknown-user-id'}\nInvite code entered: ${code}\n\nPlease link this auth account to the correct user profile.`;
      await Share.share({ message });
      Alert.alert(
        'Request prepared',
        'Your request details are ready to send. Your clinic admin can complete linking from the provisioning tool.',
      );
    } finally {
      setSubmittingInvite(false);
    }
  };

  const onContactSupport = async () => {
    setContacting(true);
    try {
      const email = session?.user.email ?? 'unknown-email';
      const subject = encodeURIComponent('Kenovus account link assistance');
      const body = encodeURIComponent(
        `Hi Kenovus Support,\n\nI can sign in, but my profile is not linked.\n\nEmail: ${email}\nAuth user id: ${session?.user.id ?? 'unknown-user-id'}\n\nPlease help link my account.\n`,
      );
      const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        Alert.alert(
          'Mail app unavailable',
          `Please email ${SUPPORT_EMAIL} and include your account email plus auth user id.`,
        );
        return;
      }
      await Linking.openURL(mailto);
    } finally {
      setContacting(false);
    }
  };

  const onSignOut = async () => {
    await signOut();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>Account Not Linked Yet</Text>
      <Text style={styles.subtitle}>
        Your login is valid, but this account is not linked to a clinic profile yet.
      </Text>

      <Card>
        <Text style={styles.cardTitle}>Recovery Options</Text>
        <Button variant="primary" loading={retrying} onPress={() => void onRetryLookup()}>
          Retry Profile Lookup
        </Button>

        <Text style={styles.label}>Invite Code</Text>
        <TextInput
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="Enter clinic invite code"
          placeholderTextColor={colors.gray2}
          autoCapitalize="characters"
          style={styles.input}
        />
        <Button variant="ghost" loading={submittingInvite} onPress={() => void onRequestInviteCode()}>
          Request Invite Code Link
        </Button>

        <View style={styles.spacer} />
        <Button variant="ghost" loading={contacting} onPress={() => void onContactSupport()}>
          Contact Support
        </Button>
        <Button variant="ghost" onPress={() => void onSignOut()}>
          Sign Out
        </Button>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black,
    paddingHorizontal: 24,
  },
  title: {
    ...typography.h1,
    color: colors.white,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 18,
  },
  cardTitle: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 12,
  },
  label: {
    ...typography.label,
    color: colors.goldLight,
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    ...typography.body,
    color: colors.white,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    backgroundColor: colors.dark2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  spacer: {
    height: 8,
  },
});
