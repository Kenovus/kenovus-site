import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGrad, Path, Stop, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { computeTimelineToGoal } from '@/lib/dailyPlan';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { useAuth } from '@/hooks/useAuth';

const GOLD  = '#BF8D36';
const BLUE  = '#5BC4DC';
const PINK  = '#E07878';
const GREEN = '#5EC47A';

const BG_LIGHT = require('../../../assets/images/sona-light-bg.png');
const BG_DARK  = require('../../../assets/images/sona-bg-dark.png');

// ── Placeholder data ──────────────────────────────────────────────────────────
const WEIGHT_DATA  = [{ d:'Mar 16',v:196.2},{d:'Mar 23',v:194.8},{d:'Mar 30',v:192.5},{d:'Apr 6',v:191.0},{d:'Apr 13',v:189.4},{d:'Apr 20',v:188.6},{d:'Apr 27',v:187.9}];
const BODYFAT_DATA = [{ d:'Mar 16',v:28.4},{d:'Mar 23',v:27.9},{d:'Mar 30',v:27.5},{d:'Apr 6',v:27.0},{d:'Apr 13',v:26.6},{d:'Apr 20',v:26.2},{d:'Apr 27',v:25.8}];
// Subcutaneous vs visceral breakdown
const SUBCUT_DATA  = [{ d:'Mar 16',v:22.1},{d:'Mar 23',v:21.7},{d:'Mar 30',v:21.4},{d:'Apr 6',v:21.0},{d:'Apr 13',v:20.7},{d:'Apr 20',v:20.4},{d:'Apr 27',v:20.1}];
const VISCERAL_DATA= [{ d:'Mar 16',v:6.3},{d:'Mar 23',v:6.2},{d:'Mar 30',v:6.1},{d:'Apr 6',v:6.0},{d:'Apr 13',v:5.9},{d:'Apr 20',v:5.8},{d:'Apr 27',v:5.7}];
const MUSCLE_DATA  = [{ d:'Mar 16',v:120.1},{d:'Mar 23',v:120.4},{d:'Mar 30',v:120.9},{d:'Apr 6',v:121.2},{d:'Apr 13',v:121.8},{d:'Apr 20',v:122.1},{d:'Apr 27',v:122.5}];

type Tab = 'overview' | 'body' | 'metrics';

// ── Line chart ─────────────────────────────────────────────────────────────────
function LineChart({ data, color, width = 340, series2, series2Color }: { data:{d:string;v:number}[]; color:string; width?:number; series2?:{d:string;v:number}[]; series2Color?:string }) {
  const H=170; const PL=46,PR=16,PT=14,PB=40;
  const IW=width-PL-PR; const IH=H-PT-PB;
  const vals=data.map(d=>d.v);
  const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1,pad=rng*0.20;
  // If series2 provided, extend axis range to cover both datasets
  const allVals = series2 ? [...vals, ...series2.map(d=>d.v)] : vals;
  const mn2=Math.min(...allVals), mx2=Math.max(...allVals), rng2=mx2-mn2||1, pad2=rng2*0.20;
  const lo=mn2-pad2, hi=mx2+pad2;
  const xf=(i:number)=>PL+(i/(data.length-1))*IW;
  const yf=(v:number)=>PT+(1-(v-lo)/(hi-lo))*IH;
  const pts=data.map((d,i)=>({x:xf(i),y:yf(d.v)}));
  let line=`M${pts[0].x} ${pts[0].y}`;
  for(let i=1;i<pts.length;i++){
    const cx=(pts[i-1].x+pts[i].x)/2;
    line+=` C${cx} ${pts[i-1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
  }
  const fill=line+` L${pts[pts.length-1].x} ${yf(lo)} L${pts[0].x} ${yf(lo)} Z`;

  // series2 path
  const pts2=series2?series2.map((d,i)=>({x:xf(i),y:yf(d.v)})):[];
  let line2='';
  if(pts2.length>1){
    line2=`M${pts2[0].x} ${pts2[0].y}`;
    for(let i=1;i<pts2.length;i++){const cx2=(pts2[i-1].x+pts2[i].x)/2;line2+=` C${cx2} ${pts2[i-1].y} ${cx2} ${pts2[i].y} ${pts2[i].x} ${pts2[i].y}`;}
  }

  const ticks=[lo,(lo+hi)/2,hi];
  const xLabels=data.filter((_,i)=>i===0||i===Math.floor(data.length/2)||i===data.length-1);
  return (
    <Svg width={width} height={H}>
      <Defs>
        <SvgGrad id="gf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22}/>
          <Stop offset="1" stopColor={color} stopOpacity={0}/>
        </SvgGrad>
      </Defs>
      {ticks.map((v,i)=>(
        <Line key={i} x1={PL} y1={yf(v)} x2={PL+IW} y2={yf(v)}
          stroke="rgba(180,155,100,0.18)" strokeWidth={1}
          strokeDasharray={i===0?undefined:'4,4'}/>
      ))}
      {ticks.map((v,i)=>(
        <SvgText key={i} x={PL-6} y={yf(v)+3.5} fontSize={9}
          fill="rgba(154,130,106,0.9)" textAnchor="end" fontFamily="DMSans_400Regular">
          {Math.round(v*10)/10}
        </SvgText>
      ))}
      <Path d={fill} fill="url(#gf)"/>
      <Path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i)=>(<Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} stroke="white" strokeWidth={1.5}/>))}
      {/* Series 2 */}
      {line2&&<Path d={line2} fill="none" stroke={series2Color||BLUE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3"/>}
      {pts2.map((p,i)=>(<Circle key={`s2-${i}`} cx={p.x} cy={p.y} r={3} fill={series2Color||BLUE} stroke="white" strokeWidth={1.2}/>))}
      {xLabels.map((item,i)=>{
        const idx=data.indexOf(item);
        return (
          <SvgText key={i} x={xf(idx)} y={H-8} fontSize={9}
            fill="rgba(154,130,106,0.9)" textAnchor="middle" fontFamily="DMSans_400Regular">
            {item.d}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ── Stat pill ──────────────────────────────────────────────────────────────────
function StatRow({ label, value, delta, color, sub, CARD, BORD, TX, MT, CP }: {
  label:string; value:string; delta:string; color:string; sub:string;
  CARD:string; BORD:string; TX:string; MT:string; CP:string;
}) {
  const up=delta.startsWith('+');
  return (
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:14,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:BORD}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:36,height:36,borderRadius:10,backgroundColor:color+'18',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:color+'30'}}>
          <Text style={{fontSize:16}}>{sub}</Text>
        </View>
        <Text style={{fontFamily:'DMSans_500Medium',fontSize:14,color:TX}}>{label}</Text>
      </View>
      <View style={{alignItems:'flex-end'}}>
        <Text style={{fontFamily:'DMSans_500Medium',fontSize:16,color,fontWeight:'700'}}>{value}</Text>
        <Text style={{fontFamily:'DMSans_400Regular',fontSize:11,color:up?GREEN:PINK}}>{delta}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProgressIndex() {
  const insets=useSafeAreaInsets();
  const router=useRouter();
  const {tokens,resolvedTheme}=useAppTheme();
  const isDark=resolvedTheme==='dark';
  const { user } = useAuth();
  const [tab,setTab]=useState<Tab>('overview');
  const [timeline, setTimeline] = useState<{ message: string; weeksToGoal: number | null } | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    void fetchPatientIdForAuthUser(user.id).then(async (pid) => {
      if (!pid) return;
      const t = await computeTimelineToGoal(pid);
      setTimeline(t);
    });
  }, [user?.id]);

  const CARD=isDark?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.86)';
  const BORD=isDark?'rgba(191,141,54,0.22)':'rgba(191,141,54,0.18)';
  const TX=tokens.colors.text;
  const MT=tokens.colors.textMuted;
  const CP=tokens.colors.textCaption;
  const SH={shadowColor:'#3d2b1a',shadowOffset:{width:0,height:4} as const,shadowOpacity:0.14,shadowRadius:12,elevation:8};

  const TABS:Array<{id:Tab;label:string}> = [
    {id:'overview',label:'Overview'},
    {id:'body',    label:'Body'},
    {id:'metrics', label:'Metrics'},
  ];

  // Weight delta (first vs last)
  const wFirst=WEIGHT_DATA[0].v, wLast=WEIGHT_DATA[WEIGHT_DATA.length-1].v;
  const wDelta=(wLast-wFirst).toFixed(1);

  return (
    <ImageBackground source={isDark?BG_DARK:BG_LIGHT} style={{flex:1}} resizeMode="cover">

      {/* ── Sticky title ── */}
      <View style={{paddingTop:8,paddingHorizontal:16,paddingBottom:6}}>
        <Text style={{fontFamily:'PTSerif_400Regular',fontSize:34,color:TX,marginBottom:2}}>Progress</Text>
        <Text style={{fontFamily:'DMSans_400Regular',fontSize:12,color:MT}}>
          {new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{paddingBottom:insets.bottom+24,paddingHorizontal:16}}
        showsVerticalScrollIndicator={false}>

        {/* ── Scan CTA card ───────────────────────────────────────────── */}
        <Pressable onPress={()=>router.push('/patient/progress/scan' as never)}
          style={{backgroundColor:isDark?'rgba(191,141,54,0.14)':'rgba(191,141,54,0.10)',borderRadius:18,borderWidth:1,borderColor:GOLD+'50',padding:16,marginBottom:12,flexDirection:'row',alignItems:'center',gap:12,...SH}}>
          <View style={{width:48,height:48,borderRadius:14,backgroundColor:GOLD+'20',borderWidth:1,borderColor:GOLD+'40',alignItems:'center',justifyContent:'center'}}>
            <Text style={{fontSize:24}}>🤳</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={{fontFamily:'DMSans_500Medium',fontSize:15,color:TX}}>Skin & Body Scan</Text>
            <Text style={{fontFamily:'DMSans_400Regular',fontSize:12,color:MT,marginTop:2}}>AI-powered aesthetic analysis · Start your first scan</Text>
          </View>
          <Text style={{fontFamily:'DMSans_400Regular',fontSize:18,color:GOLD}}>›</Text>
        </Pressable>

        {/* ── 3 Tabs ──────────────────────────────────────────────────── */}
        <View style={{flexDirection:'row',backgroundColor:CARD,borderRadius:14,borderWidth:1,borderColor:BORD,padding:4,marginBottom:16,...SH}}>
          {TABS.map(t=>{
            const active=t.id===tab;
            return (
              <Pressable key={t.id} onPress={()=>setTab(t.id)}
                style={{flex:1,paddingVertical:9,alignItems:'center',borderRadius:10,
                  backgroundColor:active?GOLD:'transparent'}}>
                <Text style={{fontFamily:'DMSans_500Medium',fontSize:13,color:active?'#fff':MT}}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ══ OVERVIEW TAB ══════════════════════════════════════════════ */}
        {/* ── Timeline to Goal ─────────────────────────────────────────── */}
        {timeline && (
          <View style={{backgroundColor:CARD,borderRadius:16,borderWidth:1,borderColor:BORD,padding:16,marginBottom:12,...SH}}>
            <Text style={{fontFamily:'DMSans_500Medium',fontSize:10,color:MT,letterSpacing:1.4,marginBottom:8}}>📈 TIMELINE TO GOAL</Text>
            <Text style={{fontFamily:'PTSerif_400Regular',fontSize:16,color:TX,lineHeight:22,marginBottom:timeline.weeksToGoal ? 8 : 0}}>{timeline.message}</Text>
            {timeline.weeksToGoal && (
              <View style={{backgroundColor:GOLD+'18',borderRadius:10,paddingHorizontal:14,paddingVertical:8,alignSelf:'flex-start',borderWidth:1,borderColor:GOLD+'40'}}>
                <Text style={{fontFamily:'DMSans_500Medium',fontSize:14,color:GOLD}}>~{timeline.weeksToGoal} weeks</Text>
              </View>
            )}
          </View>
        )}

        {tab==='overview'&&(
          <>
            {/* Weight chart card */}
            <View style={{backgroundColor:CARD,borderRadius:20,borderWidth:1,borderColor:BORD,padding:16,marginBottom:12,...SH}}>
              <Text style={{fontFamily:'DMSans_500Medium',fontSize:12,color:MT,letterSpacing:1.2,marginBottom:6}}>WEIGHT</Text>
              <View style={{flexDirection:'row',alignItems:'baseline',gap:8,marginBottom:2}}>
                <Text style={{fontFamily:'PTSerif_400Regular',fontSize:38,color:TX,lineHeight:42}}>
                  {wLast} <Text style={{fontSize:18}}>lbs</Text>
                </Text>
              </View>
              <Text style={{fontFamily:'DMSans_400Regular',fontSize:13,color:Number(wDelta)<0?GREEN:PINK,marginBottom:14}}>
                {Number(wDelta)<0?'↓':'↑'} {Math.abs(Number(wDelta))} lbs vs start
              </Text>
              <View style={{alignItems:'center'}}>
                <LineChart data={WEIGHT_DATA} color={GOLD} width={330}/>
              </View>
              <Pressable
                onPress={()=>router.push('/patient/progress/weight' as never)}
                style={{marginTop:12,alignSelf:'flex-end'}}>
                <Text style={{fontFamily:'DMSans_400Regular',fontSize:12,color:GOLD}}>Log weight →</Text>
              </Pressable>
            </View>

            {/* Body Composition card */}
            <View style={{backgroundColor:CARD,borderRadius:20,borderWidth:1,borderColor:BORD,padding:16,marginBottom:12,...SH}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <Text style={{fontFamily:'DMSans_500Medium',fontSize:15,color:TX}}>Body Composition</Text>
                <Pressable onPress={()=>router.push('/patient/progress/body-composition' as never)}>
                  <Text style={{fontFamily:'DMSans_400Regular',fontSize:12,color:GOLD}}>See details</Text>
                </Pressable>
              </View>
              <StatRow label="Body Fat"    value="26.2%"    delta="↓ 2.2%"    color={PINK}  sub="🩻" CARD={CARD} BORD={BORD} TX={TX} MT={MT} CP={CP}/>
              <StatRow label="Muscle Mass" value="122.5 lbs" delta="↑ 2.4 lbs" color={BLUE}  sub="💪" CARD={CARD} BORD={BORD} TX={TX} MT={MT} CP={CP}/>
              <StatRow label="BMI"         value="26.4"     delta="↓ 0.8"      color={GREEN} sub="⚖️" CARD={CARD} BORD={BORD} TX={TX} MT={MT} CP={CP}/>
            </View>

            {/* GLP-1 check-in prompt */}
            <Pressable
              onPress={()=>router.push('/patient/progress/glp1-checkin' as never)}
              style={{backgroundColor:GOLD+'18',borderRadius:16,borderWidth:1,borderColor:GOLD+'40',padding:16,marginBottom:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <View>
                <Text style={{fontFamily:'DMSans_500Medium',fontSize:14,color:TX}}>GLP-1 Weekly Check-In</Text>
                <Text style={{fontFamily:'DMSans_400Regular',fontSize:12,color:MT,marginTop:2}}>Log symptoms · Track side effects</Text>
              </View>
              <Text style={{fontSize:20,color:GOLD}}>›</Text>
            </Pressable>
          </>
        )}

        {/* ══ BODY TAB ══════════════════════════════════════════════════ */}
        {tab==='body'&&(
          <>
            {/* Subcutaneous fat — own card */}
            <View style={{backgroundColor:CARD,borderRadius:20,borderWidth:1,borderColor:BORD,padding:16,marginBottom:10,...SH}}>
              <Text style={{fontFamily:'DMSans_500Medium',fontSize:10,color:MT,letterSpacing:1.2,marginBottom:6}}>SUBCUTANEOUS FAT</Text>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:2}}>
                <Text style={{fontFamily:'PTSerif_400Regular',fontSize:32,color:TX,lineHeight:36}}>20.1<Text style={{fontSize:16}}>%</Text></Text>
                <Text style={{fontFamily:'DMSans_400Regular',fontSize:13,color:GREEN}}>↓ 2.0% since start</Text>
              </View>
              <Text style={{fontFamily:'DMSans_400Regular',fontSize:11,color:CP,marginBottom:10}}>Stored under skin — responds to diet &amp; exercise</Text>
              <LineChart data={SUBCUT_DATA} color={PINK} width={330}/>
              <Pressable onPress={()=>router.push('/patient/progress/bodyfat' as never)}
                style={{marginTop:8,alignSelf:'flex-end'}}>
                <Text style={{fontFamily:'DMSans_400Regular',fontSize:12,color:GOLD}}>Log body fat →</Text>
              </Pressable>
            </View>

            {/* Visceral fat — own card */}
            <View style={{backgroundColor:CARD,borderRadius:20,borderWidth:1,borderColor:BORD,padding:16,marginBottom:12,...SH}}>
              <Text style={{fontFamily:'DMSans_500Medium',fontSize:10,color:MT,letterSpacing:1.2,marginBottom:6}}>VISCERAL FAT</Text>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:2}}>
                <Text style={{fontFamily:'PTSerif_400Regular',fontSize:32,color:TX,lineHeight:36}}>5.7<Text style={{fontSize:16}}> level</Text></Text>
                <Text style={{fontFamily:'DMSans_400Regular',fontSize:13,color:GREEN}}>↓ 0.6 since start</Text>
              </View>
              <Text style={{fontFamily:'DMSans_400Regular',fontSize:11,color:CP,marginBottom:10}}>Fat around organs — key metabolic health marker</Text>
              <LineChart data={VISCERAL_DATA} color={BLUE} width={330}/>
            </View>

            {/* Muscle chart */}
            <View style={{backgroundColor:CARD,borderRadius:20,borderWidth:1,borderColor:BORD,padding:16,marginBottom:12,...SH}}>
              <Text style={{fontFamily:'DMSans_500Medium',fontSize:12,color:MT,letterSpacing:1.2,marginBottom:6}}>MUSCLE MASS</Text>
              <View style={{flexDirection:'row',alignItems:'baseline',gap:6,marginBottom:2}}>
                <Text style={{fontFamily:'PTSerif_400Regular',fontSize:38,color:TX,lineHeight:42}}>122.5<Text style={{fontSize:18}}> lbs</Text></Text>
              </View>
              <Text style={{fontFamily:'DMSans_400Regular',fontSize:13,color:GREEN,marginBottom:14}}>↑ 2.4 lbs since start</Text>
              <LineChart data={MUSCLE_DATA} color={BLUE} width={330}/>
              <Pressable onPress={()=>router.push('/patient/progress/inbody' as never)}
                style={{marginTop:12,alignSelf:'flex-end'}}>
                <Text style={{fontFamily:'DMSans_400Regular',fontSize:12,color:GOLD}}>InBody details →</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* ══ METRICS TAB ══════════════════════════════════════════════ */}
        {tab==='metrics'&&(
          <View style={{backgroundColor:CARD,borderRadius:20,borderWidth:1,borderColor:BORD,overflow:'hidden',...SH}}>
            <Text style={{fontFamily:'DMSans_500Medium',fontSize:10,color:MT,letterSpacing:1.4,paddingHorizontal:16,paddingTop:14,paddingBottom:10}}>ALL METRICS</Text>
            {[
              {href:'/patient/progress/weight',          label:'Weight',          sub:'187.9 lbs  ↓6.3',  dot:GOLD},
              {href:'/patient/progress/bodyfat',         label:'Body Fat',        sub:'26.2%  ↓2.2%',     dot:PINK},
              {href:'/patient/progress/inbody',          label:'InBody Analysis', sub:'Last: Apr 28',      dot:BLUE},
              {href:'/patient/progress/body-composition',label:'Body Composition',sub:'Muscle 122.5 lbs',  dot:GREEN},
              {href:'/patient/progress/glp1-checkin',    label:'GLP-1 Check-In',  sub:'Weekly log',        dot:GOLD},
              {href:'/patient/progress/labs',            label:'Labs',            sub:'Last: Apr 15',      dot:GOLD},
              {href:'/patient/progress/training',        label:'Training',        sub:'Last: May 9',       dot:BLUE},
              {href:'/patient/progress/photos',          label:'Progress Photos', sub:'3 sets',            dot:GOLD},
            {href:'/patient/profile/skin-insight',     label:'Skin Insight',    sub:'AI skin analysis',   dot:PINK},
            ].map((item,i)=>(
              <Pressable key={item.href} onPress={()=>router.push(item.href as never)}
                style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
                  paddingHorizontal:16,paddingVertical:14,
                  borderTopWidth:i===0?0:StyleSheet.hairlineWidth,borderTopColor:BORD}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
                  <View style={{width:8,height:8,borderRadius:4,backgroundColor:item.dot}}/>
                  <View>
                    <Text style={{fontFamily:'DMSans_500Medium',fontSize:14,color:TX}}>{item.label}</Text>
                    <Text style={{fontFamily:'DMSans_400Regular',fontSize:11,color:CP,marginTop:1}}>{item.sub}</Text>
                  </View>
                </View>
                <Text style={{fontFamily:'DMSans_400Regular',fontSize:18,color:MT}}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

      </ScrollView>

    </ImageBackground>
  );
}
