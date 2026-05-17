import React, { useState } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView,
  TouchableOpacity, Platform,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const ASSETS = {
  bgDark: require('../assets/images/sona-bg-dark.png'),
  logo:   require('../assets/images/sona-logo-official.png'),
  model:  require('../assets/images/model-cutout.png'),
};

const GOLD       = '#c9a84c';
const GLASS      = 'rgba(255,255,255,0.07)';
const GLASS_BDR  = 'rgba(255,255,255,0.09)';
const WHITE      = '#ffffff';
const WHITE_MUTE = 'rgba(255,255,255,0.45)';
const WHITE_DIM  = 'rgba(255,255,255,0.36)';

function SparkleIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path d="M12 2L13.8 9.2L21 12L13.8 14.8L12 22L10.2 14.8L3 12L10.2 9.2Z" fill={GOLD}/>
      <Path d="M19.5 3L20.5 6.5L23 7.5L20.5 8.5L19.5 12L18.5 8.5L16 7.5L18.5 6.5Z" fill={GOLD} opacity={0.55}/>
    </Svg>
  );
}

function AppleIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 4s-1.5-2-3.5-2"/><Path d="M18.5 9s2 1.5 2 5c0 5-3.5 8-8.5 8s-8.5-3-8.5-8c0-4 2.5-6.5 5-6.5 1.5 0 2.5.5 3 .5s1.5-.5 3-.5c1.5 0 2.8.8 3.5 1.5z"/></Svg>;
}
function ScaleIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M2 13h20M2 13v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8"/><Path d="M12 13V7M8 10l4-3 4 3"/></Svg>;
}
function RunIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Circle cx={14.5} cy={3.5} r={1.5}/><Path d="M6 20l3.5-6.5L12 16l3-5 3 2.5"/><Path d="M5 12.5l4-3 2 2.5 4-5.5"/></Svg>;
}
function ClipIcon() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1z"/><Path d="M4 4h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><Path d="M9 11h6M9 15h4"/></Svg>;
}
function CamIcon() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><Circle cx={12} cy={13} r={4}/></Svg>;
}
function BarIcon() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 5v3M3 16v3M21 5v3M21 16v3M7 5v14M12 5v14M17 5v14M10 5v14M15 5v14"/></Svg>;
}
function PieIcon() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><Path d="M22 12A10 10 0 0 0 12 2v10z"/></Svg>;
}

function CalorieRing({ current, total }: { current: number; total: number }) {
  const r = 46, cx = 52, cy = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * (current / total);
  return (
    <Svg width={104} height={104} viewBox="0 0 104 104">
      <Defs>
        <LinearGradient id="goldD" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#c9a84c"/><Stop offset="55%" stopColor="#e2bd5a"/><Stop offset="100%" stopColor="#9e6b1e"/>
        </LinearGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={r} fill="rgba(25,28,34,0.65)" stroke="rgba(255,255,255,0.07)" strokeWidth={7}/>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#goldD)" strokeWidth={7} strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} rotation={-90} origin={`${cx},${cy}`}/>
    </Svg>
  );
}

function MacroBar({ label, val, max, color }: { label: string; val: number; max: number; color: string }) {
  return (
    <View style={s.macroRow}>
      <Text style={s.macroLabel}>{label}: {val}g / {max}g</Text>
      <View style={s.macroTrack}>
        <View style={[s.macroFill, { width: `${Math.round(val / max * 100)}%` as any, backgroundColor: color }]}/>
      </View>
    </View>
  );
}

const NAV = [
  { label: 'Home',      icon: (a: boolean) => <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a ? GOLD : WHITE_MUTE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 10L12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><Path d="M9 21V12h6v9"/></Svg> },
  { label: 'Sona',      icon: (a: boolean) => <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a ? GOLD : WHITE_MUTE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></Svg> },
  { label: 'Nutrition', icon: (a: boolean) => <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a ? GOLD : WHITE_MUTE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><Path d="M7 11v11"/><Path d="M21 2v3a4 4 0 0 1-4 4v11"/></Svg> },
  { label: 'Progress',  icon: (a: boolean) => <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a ? GOLD : WHITE_MUTE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M22 7L13.5 15.5 8.5 10.5 2 17"/><Path d="M16 7h6v6"/></Svg> },
  { label: 'Profile',   icon: (a: boolean) => <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a ? GOLD : WHITE_MUTE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Circle cx={12} cy={8} r={4}/><Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></Svg> },
];

export default function HomeScreenDark({ navigation }: any) {
  const [activeNav, setActiveNav] = useState(0);

  return (
    <View style={s.container}>
      <Image source={ASSETS.bgDark} style={s.bg} resizeMode="cover"/>
      {/* Vignette overlay */}
      <View style={s.vignette}/>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.headerRow}>
          <TouchableOpacity style={s.bellBtn}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><Path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </Svg>
          </TouchableOpacity>
          <Image source={ASSETS.logo} style={s.logo} resizeMode="contain"/>
          <TouchableOpacity>
            <Image source={ASSETS.model} style={s.avatar} resizeMode="cover"/>
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={s.greetWrap}>
          <Text style={s.greetName}>Good morning Lance</Text>
          <Text style={s.greetDate}>April 27</Text>
        </View>

        {/* AI Coach card */}
        <View style={s.coachCard}>
          <View style={s.coachContent}>
            <View style={s.titleRow}>
              <Text style={s.coachTitle}>AI Coach – "Sona"</Text>
              <SparkleIcon/>
            </View>
            <Text style={s.coachSub}>Your personalized plan{'\n'}is on track</Text>
            <TouchableOpacity style={s.askBtn} onPress={() => navigation?.navigate('Chat')}>
              <Text style={s.askTxt}>Ask anything...</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12h14M13 6l6 6-6 6"/>
              </Svg>
            </TouchableOpacity>
          </View>
          <Image source={ASSETS.model} style={s.coachImg} resizeMode="cover"/>
        </View>

        {/* 3 tiles */}
        <View style={s.tiles3}>
          {[{ Icon: AppleIcon, lbl: 'Log my food' }, { Icon: ScaleIcon, lbl: 'Log my weight' }, { Icon: RunIcon, lbl: 'Log exercise' }].map(({ Icon, lbl }, i) => (
            <TouchableOpacity key={i} style={s.tile3}>
              <Icon/>
              <Text style={s.tile3Lbl}>{lbl}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ring + macros */}
        <View style={s.statsRow}>
          <View style={s.ringWrap}>
            <CalorieRing current={1925} total={2500}/>
            <View style={s.ringCenter}>
              <Text style={s.ringNum}>1925</Text>
              <Text style={s.ringOf}>of 2500</Text>
              <Text style={s.ringKcal}>kcal</Text>
            </View>
          </View>
          <View style={s.macros}>
            <MacroBar label="Protein" val={180} max={220} color="#5BC4DC"/>
            <MacroBar label="Fat"     val={67}  max={90}  color="#E07878"/>
            <MacroBar label="Carbs"   val={150} max={250} color="#5EC47A"/>
          </View>
        </View>

        {/* Bottom 4 tiles */}
        <View style={s.tiles4}>
          {[{ Icon: ClipIcon, lbl: 'Build my Plan' }, { Icon: CamIcon, lbl: 'Meal scan' }, { Icon: BarIcon, lbl: 'Barcode scan' }, { Icon: PieIcon, lbl: 'Macros' }].map(({ Icon, lbl }, i) => (
            <TouchableOpacity key={i} style={s.tile4}>
              <Icon/>
              <Text style={s.tile4Lbl}>{lbl}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* Nav */}
      <View style={s.nav}>
        {NAV.map(({ label, icon }, i) => (
          <TouchableOpacity key={i} style={s.navItem} onPress={() => setActiveNav(i)}>
            {icon(activeNav === i)}
            <Text style={[s.navLbl, activeNav === i && s.navLblActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0F1115' },
  bg:          { position: 'absolute', inset: 0, width: '100%', height: '100%' } as any,
  vignette:    { position: 'absolute', inset: 0, backgroundColor: 'rgba(10,12,15,0.55)' } as any,
  scroll:      { flex: 1 },
  scrollContent: { paddingBottom: 80, paddingTop: Platform.OS === 'ios' ? 54 : 40 },

  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 4 },
  bellBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: GLASS, borderRadius: 10, borderWidth: 1, borderColor: GLASS_BDR },
  logo:       { height: 48, width: 120 },
  avatar:     { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' },

  greetWrap:  { paddingHorizontal: 18, marginTop: 12, marginBottom: 4 },
  greetName:  { fontFamily: 'Cormorant-Regular', fontSize: 25, color: WHITE, letterSpacing: 0.3, lineHeight: 30 },
  greetDate:  { fontFamily: 'DMSans-Regular', fontSize: 12, color: WHITE_DIM, marginTop: 4, letterSpacing: 0.4 },

  coachCard:   { marginHorizontal: 12, backgroundColor: GLASS, borderRadius: 18, borderWidth: 1, borderColor: GLASS_BDR, padding: 14, flexDirection: 'row', alignItems: 'flex-end', minHeight: 148, overflow: 'hidden', marginBottom: 8 },
  coachContent:{ flex: 1, justifyContent: 'space-between', minHeight: 124, zIndex: 1 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  coachTitle:  { fontFamily: 'Cormorant-SemiBold', fontSize: 16, color: WHITE, lineHeight: 22 },
  coachSub:    { fontFamily: 'DMSans-Regular', fontSize: 12, color: WHITE_MUTE, lineHeight: 18 },
  askBtn:      { marginTop: 12, backgroundColor: '#c9a84c', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '80%' },
  askTxt:      { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontFamily: 'DMSans-Medium' },
  coachImg:    { width: 118, height: 160, position: 'absolute', bottom: 0, right: 0, zIndex: 0 },

  tiles3:     { flexDirection: 'row', gap: 7, paddingHorizontal: 12, marginBottom: 8 },
  tile3:      { flex: 1, backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: GLASS_BDR, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 5, gap: 7 },
  tile3Lbl:   { fontSize: 10.5, color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontFamily: 'DMSans-Medium', lineHeight: 14 },

  statsRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 14, marginBottom: 8 },
  ringWrap:   { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringNum:    { fontSize: 22, fontWeight: '700', color: WHITE, letterSpacing: -0.5, fontFamily: 'DMSans-Bold', lineHeight: 26 },
  ringOf:     { fontSize: 9, color: WHITE_DIM, fontFamily: 'DMSans-Regular', lineHeight: 13, textAlign: 'center' },
  ringKcal:   { fontSize: 9, color: WHITE_DIM, fontFamily: 'DMSans-Regular', lineHeight: 13 },
  macros:     { flex: 1, gap: 10 },
  macroRow:   { gap: 4 },
  macroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.52)', fontFamily: 'DMSans-Regular' },
  macroTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 999, overflow: 'hidden' },
  macroFill:  { height: '100%', borderRadius: 999 },

  tiles4:     { flexDirection: 'row', gap: 6, paddingHorizontal: 12 },
  tile4:      { flex: 1, backgroundColor: GLASS, borderRadius: 12, borderWidth: 1, borderColor: GLASS_BDR, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 3, gap: 6 },
  tile4Lbl:   { fontSize: 9, color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontFamily: 'DMSans-Medium', lineHeight: 12 },

  nav:        { flexDirection: 'row', height: 60, backgroundColor: 'rgba(8,10,13,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, paddingBottom: Platform.OS === 'ios' ? 8 : 4 },
  navItem:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 6 },
  navLbl:     { fontSize: 9, fontFamily: 'DMSans-Medium', color: WHITE_MUTE },
  navLblActive: { color: GOLD },
});
