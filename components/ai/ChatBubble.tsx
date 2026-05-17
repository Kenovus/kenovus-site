import type { ReactNode } from 'react';
import Markdown from 'react-native-markdown-display';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/theme/ThemeProvider';

const GOLD = '#BF8D36';

type Props = { role: 'assistant' | 'user'; children: string; footer?: ReactNode };

export function ChatBubble({ role, children, footer }: Props) {
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const isAssistant = role === 'assistant';

  const assistantBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)';
  const assistantBdr = isDark ? 'rgba(191,141,54,0.28)' : 'rgba(191,141,54,0.22)';
  const userBg = isDark ? 'rgba(191,141,54,0.22)' : 'rgba(191,141,54,0.18)';
  const textColor = isDark ? '#F4F1E8' : '#232426';
  const mutedColor = isDark ? 'rgba(244,241,232,0.55)' : '#9a826a';

  const bubbleStyle = isAssistant
    ? [s.bubble, s.assistant, { backgroundColor: assistantBg, borderColor: assistantBdr }]
    : [s.bubble, s.user, { backgroundColor: userBg }];

  const mdStyles = StyleSheet.create({
    body:                   { margin: 0, padding: 0 },
    paragraph:              { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: textColor, marginBottom: 8, marginTop: 0 },
    strong:                 { color: textColor, fontWeight: '700' },
    em:                     { color: textColor, fontStyle: 'italic' },
    bullet_list:            { marginTop: 4, marginBottom: 6 },
    ordered_list:           { marginTop: 4, marginBottom: 6 },
    list_item:              { marginBottom: 4 },
    bullet_list_icon:       { color: GOLD },
    bullet_list_content:    { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: textColor },
    ordered_list_content:   { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: textColor },
    code_inline:            { color: GOLD, backgroundColor: 'rgba(191,141,54,0.12)', borderRadius: 4, paddingHorizontal: 4 },
    fence:                  { color: textColor, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 8 },
  });

  return (
    <View style={[s.wrap, isAssistant ? s.assistantWrap : s.userWrap]}>
      {isAssistant && <View style={[s.dot, { backgroundColor: GOLD }]} />}
      {!isAssistant && <View style={s.dotSpacer} />}

      <View style={bubbleStyle}>
        <Markdown style={mdStyles}>{children}</Markdown>
        {isAssistant && footer ? <View style={s.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:         { flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'flex-end' },
  assistantWrap: { justifyContent: 'flex-start' },
  userWrap:     { justifyContent: 'flex-end', flexDirection: 'row-reverse' },
  dot:          { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  dotSpacer:    { width: 8, height: 8, marginBottom: 8 },
  bubble:       { maxWidth: '86%', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  assistant:    { borderWidth: 1 },
  user:         {},
  footer:       { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
});
