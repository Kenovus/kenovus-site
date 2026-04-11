import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

type Props = { role: 'assistant' | 'user'; children: string };

export function ChatBubble({ role, children }: Props) {
  const isAssistant = role === 'assistant';
  return (
    <View style={[styles.wrap, isAssistant ? styles.assistantWrap : styles.userWrap]}>
      <Text style={styles.emoji}>{isAssistant ? '🤖' : ''}</Text>
      <View style={[styles.bubble, isAssistant ? styles.assistant : styles.user]}>
        <Text style={[styles.text, isAssistant ? styles.textAssistant : styles.textUser]}>
          {children}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 10,
    alignItems: 'flex-end',
  },
  assistantWrap: {
    justifyContent: 'flex-start',
  },
  userWrap: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  emoji: {
    width: 28,
    fontSize: 22,
    textAlign: 'center',
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  assistant: {
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  user: {
    backgroundColor: colors.goldDim,
  },
  text: {
    ...typography.body,
    lineHeight: 22,
  },
  textAssistant: {
    color: colors.white,
  },
  textUser: {
    color: colors.dark,
  },
});
