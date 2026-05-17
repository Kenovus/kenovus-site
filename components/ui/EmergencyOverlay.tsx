import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { EMERGENCY_UI_COPY } from '@/constants/emergency';
import { colors, typography } from '@/constants/designSystem';

type Props = {
  visible: boolean;
  onCall911: () => void;
  onDismiss: () => void;
};

export function EmergencyOverlay({ visible, onCall911, onDismiss }: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.header}>{EMERGENCY_UI_COPY.header}</Text>
          <Text style={styles.body}>{EMERGENCY_UI_COPY.body}</Text>
          <Text style={styles.subtext}>{EMERGENCY_UI_COPY.subtext}</Text>

          <Pressable
            onPress={() => {
              void Linking.openURL('tel:911');
              onCall911();
            }}
            style={styles.callBtn}>
            <Text style={styles.callBtnText}>{EMERGENCY_UI_COPY.callButton}</Text>
          </Pressable>

          <Pressable onPress={onDismiss} style={styles.continueBtn}>
            <Text style={styles.continueText}>{EMERGENCY_UI_COPY.continueButton}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.86)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 20,
  },
  header: {
    ...typography.h2,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  body: {
    ...typography.body,
    color: colors.white,
    lineHeight: 22,
    marginBottom: 10,
  },
  subtext: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 18,
  },
  callBtn: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  callBtnText: {
    ...typography.body,
    color: '#FFFFFF',
    fontSize: 16,
  },
  continueBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueText: {
    ...typography.body,
    color: colors.goldLight,
  },
});
