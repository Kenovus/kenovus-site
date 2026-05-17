import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { LotusOrb } from '@/components/ui/LotusOrb';

const GOLD = '#BF8D36';
const BG   = require('../../../assets/images/sona-bg-dark.png');
const LOGO = require('../../../assets/images/sona-logo-gold.png');

export default function OnboardingWelcome() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:1200, delay:300, easing:Easing.inOut(Easing.quad), useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:1000, delay:300, easing:Easing.out(Easing.quad),   useNativeDriver:true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <View style={{ flex:1 }}>
      <Image source={BG} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(20,13,6,0.88)']}
        start={{ x:0, y:0 }} end={{ x:0, y:1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ flex:1, paddingTop:insets.top+16, paddingBottom:insets.bottom+32, paddingHorizontal:32 }}>

        <Animated.View style={{ alignItems:'center', opacity:fadeAnim, marginTop:16, marginBottom:20 }}>
          <Image source={LOGO} style={{ width:100, height:56 }} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={{ alignItems:'center', marginBottom:28, opacity:fadeAnim }}>
          <LotusOrb size={200} isDark={true} isListening={false} />
        </Animated.View>

        <Animated.View style={{ alignItems:'center', opacity:fadeAnim, transform:[{ translateY:slideAnim }] }}>
          <Text style={{ fontFamily:'PTSerif_400Regular', fontSize:38, color:'#F4F1E8', textAlign:'center', lineHeight:44, marginBottom:12 }}>
            Welcome to{'\n'}SonaLife
          </Text>
          <Text style={{ fontFamily:'DMSans_400Regular', fontSize:15, color:'rgba(244,241,232,0.68)', textAlign:'center', lineHeight:22, marginBottom:8 }}>
            Your personal AI wellness coach{'\n'}from Sona Med Spa
          </Text>
          <Text style={{ fontFamily:'DMSans_400Regular', fontSize:11, color:'rgba(191,141,54,0.80)', textAlign:'center', letterSpacing:1.8, marginBottom:44 }}>
            ROOTED IN BEAUTY · GUIDED BY SCIENCE
          </Text>

          <Pressable
            onPress={() => router.push('/(auth)/onboarding/patient-path' as never)}
            style={{ backgroundColor:GOLD, borderRadius:16, paddingVertical:16, width:'100%', alignItems:'center', marginBottom:14,
              shadowColor:GOLD, shadowOpacity:0.4, shadowRadius:16, shadowOffset:{width:0,height:6}, elevation:10 }}>
            <Text style={{ fontFamily:'DMSans_500Medium', fontSize:16, color:'#fff', fontWeight:'600' }}>Get Started</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/login' as never)}>
            <Text style={{ fontFamily:'DMSans_400Regular', fontSize:13, color:'rgba(244,241,232,0.50)' }}>
              Already have an account? <Text style={{ color:GOLD }}>Sign in</Text>
            </Text>
          </Pressable>
        </Animated.View>

      </View>
    </View>
  );
}
