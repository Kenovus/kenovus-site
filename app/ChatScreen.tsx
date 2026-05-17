import React, { useState, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

const ASSETS = {
  bgLight: require('../assets/images/sona-light-bg.png'),
};

const GOLD      = '#c9a84c';
const DARK_TEXT = '#2a1e10';
const MUTED     = '#9a826a';
const TILE_BG   = 'rgba(255,255,255,0.82)';
const TILE_BDR  = 'rgba(200,180,150,0.3)';

function LotusGold({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={Math.round(size * 0.82)} viewBox="0 0 80 65" fill="none" stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M40 10C40 10 30 22 20 24C25 16 35 8 40 10Z"/>
      <Path d="M40 10C40 10 50 22 60 24C55 16 45 8 40 10Z"/>
      <Path d="M40 10C40 10 28 30 18 40C22 28 34 14 40 10Z"/>
      <Path d="M40 10C40 10 52 30 62 40C58 28 46 14 40 10Z"/>
      <Path d="M28 48C32 42 38 39 40 39C42 39 48 42 52 48"/>
    </Svg>
  );
}

const CHIPS = [
  'Adjust my macros', 'My weight', 'Am I on track?',
  'InBody trends', 'My labs', 'Book an appointment', 'Make a payment',
];

const INITIAL_MESSAGES = [
  {
    id: '1', role: 'sona',
    text: "Hey Lance!\nYou're 180g short of your protein today. Want some ideas to help you hit your goal?",
    time: '9:41 AM',
  },
  {
    id: '2', role: 'user',
    text: 'Yes, what can I eat with around 40g of protein?',
    time: '9:42 AM',
  },
  {
    id: '3', role: 'sona',
    text: 'Here are some great options that fit your goals:',
    time: '9:43 AM',
    foods: [
      { name: 'Greek Yogurt + Berries', desc: '1 cup Greek yogurt, ½cup berries', g: 23 },
      { name: 'Protein Shake',          desc: '1 scoop whey protein',             g: 24 },
      { name: 'Grilled Chicken Breast', desc: '4 oz chicken breast',              g: 26 },
    ],
  },
];

export default function ChatScreen({ navigation }: any) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    const newMsg = { id: Date.now().toString(), role: 'user', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Image source={ASSETS.bgLight} style={s.bg} resizeMode="cover"/>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={DARK_TEXT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6"/>
          </Svg>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <LotusGold size={36}/>
          <Text style={s.headerTitle}>SONA</Text>
          <Text style={s.headerSub}>AI Coach</Text>
        </View>
        <View style={{ width: 36 }}/>
      </View>

      {/* Insight banner */}
      <View style={s.insight}>
        <Text style={s.insightTitle}>Today's insight</Text>
        <Text style={s.insightText}>You're 180g away from your protein target. Let's crush it today.</Text>
      </View>

      {/* Lotus orb */}
      <View style={s.orbWrap}>
        <View style={s.orbOuter}>
          <View style={s.orbInner}>
            <LotusGold size={30}/>
          </View>
        </View>
      </View>

      <Text style={s.helpTitle}>What would you like help with?</Text>

      {/* Chips */}
      <View style={s.chips}>
        {CHIPS.map((c, i) => (
          <TouchableOpacity key={i} style={s.chip} onPress={() => setInput(c)}>
            <Text style={s.chipTxt}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={s.msgs}
        contentContainerStyle={s.msgsContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map(m => (
          <View key={m.id} style={[s.msgRow, m.role === 'user' ? s.msgRowUser : s.msgRowSona]}>
            {m.role === 'sona' ? (
              <View style={s.sonaBubble}>
                <Text style={s.sonaText}>{m.text}</Text>
                {m.foods && (
                  <View style={s.foodList}>
                    {m.foods.map((f, fi) => (
                      <View key={fi} style={s.foodItem}>
                        <View>
                          <Text style={s.foodName}>{f.name}</Text>
                          <Text style={s.foodDesc}>{f.desc}</Text>
                        </View>
                        <View style={s.foodGrams}>
                          <Text style={s.foodG}>{f.g}g</Text>
                          <Text style={s.foodGLbl}>protein</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={s.msgTime}>{m.time}</Text>
              </View>
            ) : (
              <View style={s.userBubble}>
                <Text style={s.userText}>{m.text}</Text>
                <Text style={s.msgTimeUser}>{m.time}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Input bar */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask Sona anything..."
          placeholderTextColor={MUTED}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        {/* Mic */}
        <TouchableOpacity style={s.iconBtn}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V3z"/>
            <Path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8"/>
          </Svg>
        </TouchableOpacity>
        {/* Send */}
        <TouchableOpacity style={s.iconBtn} onPress={sendMessage}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 12h14M13 6l6 6-6 6"/>
          </Svg>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F5EDE4' },
  bg:           { position: 'absolute', inset: 0, width: '100%', height: '100%' } as any,

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 8 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle:  { fontFamily: 'Cormorant-SemiBold', fontSize: 16, color: DARK_TEXT, letterSpacing: 3.5, lineHeight: 18, marginTop: 2 },
  headerSub:    { fontFamily: 'DMSans-Regular', fontSize: 9, color: MUTED, letterSpacing: 2.5 },

  insight:      { marginHorizontal: 12, marginBottom: 8, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(200,160,50,0.3)', borderRadius: 12, padding: 10 },
  insightTitle: { fontFamily: 'DMSans-SemiBold', fontSize: 10.5, color: '#9a6e1a', marginBottom: 2 },
  insightText:  { fontFamily: 'DMSans-Regular', fontSize: 10.5, color: '#7a5a14', lineHeight: 15 },

  orbWrap:      { alignItems: 'center', marginBottom: 6 },
  orbOuter:     { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' },
  orbInner:     { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', alignItems: 'center', justifyContent: 'center' },

  helpTitle:    { fontFamily: 'Cormorant-SemiBold', fontSize: 15, color: DARK_TEXT, textAlign: 'center', marginBottom: 8 },

  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: 10, justifyContent: 'center', marginBottom: 6 },
  chip:         { backgroundColor: TILE_BG, borderWidth: 1, borderColor: TILE_BDR, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 },
  chipTxt:      { fontSize: 10, color: DARK_TEXT, fontFamily: 'DMSans-Medium' },

  msgs:         { flex: 1 },
  msgsContent:  { padding: 10, gap: 8 },
  msgRow:       { width: '100%' },
  msgRowSona:   { alignItems: 'flex-start' },
  msgRowUser:   { alignItems: 'flex-end' },

  sonaBubble:   { backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: TILE_BDR, borderRadius: 14, borderBottomLeftRadius: 4, padding: 10, maxWidth: '85%' },
  sonaText:     { fontFamily: 'DMSans-Regular', fontSize: 11.5, color: DARK_TEXT, lineHeight: 17 },
  foodList:     { marginTop: 8, gap: 6 },
  foodItem:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: 'rgba(180,155,120,0.25)', paddingTop: 5 },
  foodName:     { fontFamily: 'DMSans-SemiBold', fontSize: 10.5, color: DARK_TEXT },
  foodDesc:     { fontFamily: 'DMSans-Regular', fontSize: 9.5, color: MUTED },
  foodGrams:    { alignItems: 'flex-end' },
  foodG:        { fontFamily: 'DMSans-Bold', fontSize: 11, color: GOLD },
  foodGLbl:     { fontFamily: 'DMSans-Regular', fontSize: 9, color: MUTED },
  msgTime:      { fontFamily: 'DMSans-Regular', fontSize: 8.5, color: MUTED, marginTop: 4, textAlign: 'right' },

  userBubble:   { backgroundColor: '#c9a84c', borderRadius: 14, borderBottomRightRadius: 4, padding: 10, maxWidth: '80%' },
  userText:     { fontFamily: 'DMSans-Regular', fontSize: 11.5, color: 'rgba(255,255,255,0.94)', lineHeight: 17 },
  msgTimeUser:  { fontFamily: 'DMSans-Regular', fontSize: 8.5, color: 'rgba(255,255,255,0.55)', marginTop: 4, textAlign: 'right' },

  inputBar:     { flexDirection: 'row', gap: 7, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, paddingBottom: Platform.OS === 'ios' ? 28 : 10, backgroundColor: 'rgba(245,238,228,0.95)', borderTopWidth: 0.5, borderTopColor: 'rgba(180,155,120,0.35)' },
  input:        { flex: 1, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: TILE_BDR, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 11.5, color: DARK_TEXT, fontFamily: 'DMSans-Regular' },
  iconBtn:      { width: 34, height: 34, borderRadius: 17, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
});
