/**
 * SonaLife animated splash.
 * Shows sonalife-splash.png (the existing PNG — do not change it).
 * Adds a gold progress bar animating left→right over 2500 ms.
 * Dismisses the native Expo splash immediately so only this component shows.
 */
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, View } from 'react-native';

const SPLASH = require('@/assets/images/sonalife-splash.png');

export function SonaSplashScreen() {
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Kill native splash immediately — this component is the only splash
  useEffect(() => { void SplashScreen.hideAsync().catch(() => {}); }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false, // width interpolation requires layout driver
    }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const barWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <ImageBackground
      source={SPLASH}
      style={s.root}
      resizeMode="cover">

      {/* Gold progress bar pinned to bottom */}
      <View style={s.track}>
        <Animated.View style={[s.fill, { width: barWidth }]} />
      </View>

    </ImageBackground>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  track: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  fill: {
    height: 3,
    backgroundColor: '#B8962E',
  },
});
