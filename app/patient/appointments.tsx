import { useRouter } from 'expo-router';
import { ImageBackground, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme/ThemeProvider';

const GOLD  = '#BF8D36';
const BLUE  = '#5BC4DC';
const GREEN = '#5EC47A';
const PINK  = '#E07878';
const BG_LIGHT = require('../../assets/images/sona-light-bg.png');
const BG_DARK  = require('../../assets/images/sona-bg-dark.png');

interface Appt {
  id: string; treatment: string; date: string; time: string;
  provider: string; status: 'upcoming' | 'completed' | 'cancelled'; notes?: string;
}

const UPCOMING: Appt[] = [
  { id:'1', treatment:'Botox — Forehead & Frown Lines', date:'May 22, 2026', time:'10:30 AM', provider:'Dr. Simi Batra',    status:'upcoming', notes:'Follow-up from April session' },
  { id:'2', treatment:'Hydrafacial Platinum',           date:'Jun 5, 2026',  time:'2:00 PM',  provider:'Aesthetician Maya',  status:'upcoming' },
];

const PAST: Appt[] = [
  { id:'3', treatment:'Semaglutide — GLP-1 Consult',  date:'Apr 28, 2026', time:'11:00 AM', provider:'Dr. Simi Batra',    status:'completed', notes:'Dosage adjusted to 0.5mg' },
  { id:'4', treatment:'IPL Photofacial',               date:'Apr 10, 2026', time:'1:00 PM',  provider:'Aesthetician Maya', status:'completed' },
  { id:'5', treatment:'Dermal Fillers — Lips',         date:'Mar 18, 2026', time:'3:30 PM',  provider:'Dr. Simi Batra',    status:'completed' },
  { id:'6', treatment:'Microneedling with PRP',        date:'Feb 14, 2026', time:'10:00 AM', provider:'Aesthetician Maya', status:'completed' },
];

const STATUS_COLOR: Record<Appt['status'], string> = { upcoming:BLUE, completed:GREEN, cancelled:PINK };
const STATUS_LABEL: Record<Appt['status'], string> = { upcoming:'Upcoming', completed:'Completed', cancelled:'Cancelled' };

function ApptCard({ a, CARD, BORD, TX, MT, CP, SH }: {
  a:Appt; CARD:string; BORD:string; TX:string; MT:string; CP:string; SH:object;
}) {
  const col = STATUS_COLOR[a.status];
  return (
    <View style={{ backgroundColor:CARD, borderRadius:18, borderWidth:1, borderColor:BORD, marginBottom:10, overflow:'hidden', ...SH }}>
      <View style={{ height:3, backgroundColor:col }}/>
      <View style={{ padding:16 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <Text style={{ fontFamily:'PTSerif_700Bold', fontSize:18, color:TX, flex:1, lineHeight:22, marginRight:8 }}>{a.treatment}</Text>
          <View style={{ backgroundColor:col+'20', borderRadius:8, paddingHorizontal:8, paddingVertical:3, borderWidth:1, borderColor:col+'50' }}>
            <Text style={{ fontFamily:'DMSans_500Medium', fontSize:10, color:col }}>{STATUS_LABEL[a.status]}</Text>
          </View>
        </View>
        <View style={{ flexDirection:'row', gap:16 }}>
          <Text style={{ fontFamily:'DMSans_400Regular', fontSize:12, color:MT }}>📅 {a.date}</Text>
          <Text style={{ fontFamily:'DMSans_400Regular', fontSize:12, color:MT }}>🕐 {a.time}</Text>
        </View>
        <Text style={{ fontFamily:'DMSans_400Regular', fontSize:12, color:MT, marginTop:5 }}>👩‍⚕️ {a.provider}</Text>
        {a.notes && (
          <View style={{ marginTop:10, paddingTop:10, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:BORD }}>
            <Text style={{ fontFamily:'DMSans_400Regular', fontSize:12, color:CP, fontStyle:'italic' }}>{a.notes}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';

  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.84)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const TX = tokens.colors.text, MT = tokens.colors.textMuted, CP = tokens.colors.textCaption;
  const SH = { shadowColor:'#3d2b1a', shadowOffset:{width:0,height:4} as const, shadowOpacity:0.12, shadowRadius:10, elevation:6 };

  return (
    <ImageBackground source={isDark ? BG_DARK : BG_LIGHT} style={{ flex:1 }} resizeMode="cover">
      <ScrollView
        contentContainerStyle={{ paddingTop:8, paddingBottom:insets.bottom+24, paddingHorizontal:16 }}
        showsVerticalScrollIndicator={false}>

        <Text style={{ fontFamily:'PTSerif_700Bold', fontSize:34, color:TX, marginBottom:2 }}>Appointments</Text>
        <Text style={{ fontFamily:'DMSans_400Regular', fontSize:12, color:MT, marginBottom:16 }}>
          {new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}
        </Text>

        {/* Book CTA */}
        <Pressable
          style={{ backgroundColor:GOLD, borderRadius:16, paddingVertical:16, paddingHorizontal:20, flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:20, ...SH }}
          onPress={() => Linking.openURL('https://cgnxz.myaestheticrecord.com/online-booking')}>
          <View>
            <Text style={{ fontFamily:'PTSerif_700Bold', fontSize:20, color:'#fff' }}>Book a Treatment</Text>
            <Text style={{ fontFamily:'DMSans_400Regular', fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:2 }}>Opens Aesthetic Record →</Text>
          </View>
          <Text style={{ fontSize:26 }}>✦</Text>
        </Pressable>

        {/* Upcoming */}
        <Text style={{ fontFamily:'DMSans_500Medium', fontSize:10, color:MT, letterSpacing:1.4, marginBottom:10 }}>UPCOMING</Text>
        {UPCOMING.map(a => <ApptCard key={a.id} a={a} CARD={CARD} BORD={BORD} TX={TX} MT={MT} CP={CP} SH={SH}/>)}

        {/* Post-treatment check-in prompt */}
        <Pressable
          onPress={() => router.push('/patient/progress/post-treatment' as never)}
          style={{ backgroundColor:BLUE+'15', borderRadius:14, borderWidth:1, borderColor:BLUE+'40', padding:14, marginBottom:16, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <View>
            <Text style={{ fontFamily:'DMSans_500Medium', fontSize:13, color:TX }}>Post-Treatment Check-In</Text>
            <Text style={{ fontFamily:'DMSans_400Regular', fontSize:12, color:MT, marginTop:2 }}>Log symptoms after your procedure</Text>
          </View>
          <Text style={{ fontFamily:'DMSans_400Regular', fontSize:18, color:MT }}>›</Text>
        </Pressable>

        {/* History */}
        <Text style={{ fontFamily:'DMSans_500Medium', fontSize:10, color:MT, letterSpacing:1.4, marginBottom:10 }}>TREATMENT HISTORY</Text>
        {PAST.map(a => <ApptCard key={a.id} a={a} CARD={CARD} BORD={BORD} TX={TX} MT={MT} CP={CP} SH={SH}/>)}

        <Text style={{ fontFamily:'DMSans_400Regular', fontSize:10, color:MT, textAlign:'center', marginTop:4 }}>
          Scheduling managed via Aesthetic Record
        </Text>

      </ScrollView>
    </ImageBackground>
  );
}
