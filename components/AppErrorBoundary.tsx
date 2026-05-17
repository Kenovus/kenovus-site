/**
 * Global error boundary — catches uncaught render errors and shows a friendly
 * "Something went wrong" screen instead of a white freeze or crash.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface State {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[SonaLife] render error caught by boundary:', error, info);
  }

  reset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.root}>
        <Text style={s.logo}>✦</Text>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.body}>
          SonaLife hit an unexpected error. Tap below to restart — your data is safe.
        </Text>
        {__DEV__ && (
          <Text style={s.debug} numberOfLines={4}>{this.state.message}</Text>
        )}
        <Pressable onPress={this.reset} style={s.btn}>
          <Text style={s.btnTxt}>Restart App</Text>
        </Pressable>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#080604', alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo:   { fontSize: 48, color: '#BF8D36', marginBottom: 20 },
  title:  { fontFamily: 'PTSerif_400Regular', fontSize: 26, color: '#F4F1E8', marginBottom: 12, textAlign: 'center' },
  body:   { fontFamily: 'DMSans_400Regular', fontSize: 15, color: 'rgba(244,241,232,0.65)', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  debug:  { fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#E07878', textAlign: 'center', marginBottom: 24, opacity: 0.75 },
  btn:    { backgroundColor: '#BF8D36', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  btnTxt: { fontFamily: 'DMSans_500Medium', fontSize: 16, color: '#fff' },
});
