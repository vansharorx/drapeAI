import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, GarmentArt, Header, Page, SectionTitle } from '../../src/components';
import { useWardrobe } from '../../src/store/WardrobeProvider';
import { colors, radius } from '../../src/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { garments, looks, ready } = useWardrobe();
  const active = garments.filter((item) => !item.archived);
  const clean = active.filter((item) => item.availability === 'Clean');
  const latestLook = looks[0];
  const latestItems = latestLook ? latestLook.garmentIds.map((id) => garments.find((item) => item.id === id)).filter((item) => item !== undefined) : [];

  return <Page>
    <Header eyebrow="DrapeAI · YOUR PERSONAL STYLIST" title={'Get dressed,\nwith less guesswork.'} />
    <View style={styles.hero}>
      <View style={styles.heroStripe} />
      <Text style={styles.heroEyebrow}>A GOOD PLACE TO START</Text>
      <Text style={styles.heroTitle}>Your clothes.{"\n"}A fresh point of view.</Text>
      <Text style={styles.heroBody}>Build a wardrobe you can see, then find combinations hiding in it.</Text>
      <Button label="Ask for an outfit" onPress={() => router.navigate('/(tabs)/ask')} icon="↗" />
    </View>

    <View style={styles.statsRow}>
      <Stat value={ready ? String(active.length).padStart(2, '0') : '—'} label="IN YOUR WARDROBE" />
      <View style={styles.statDivider} />
      <Stat value={ready ? String(clean.length).padStart(2, '0') : '—'} label="READY TO WEAR" />
      <View style={styles.statDivider} />
      <Stat value={String(looks.length).padStart(2, '0')} label="SAVED LOOKS" />
    </View>

    <View>
      <SectionTitle title="Your latest look" action="Ask AI" onAction={() => router.navigate('/(tabs)/ask')} />
      {latestLook ? <Pressable onPress={() => router.navigate('/(tabs)/ask')} style={styles.lookCard}>
        <View style={styles.lookCopy}><Text style={styles.lookTag}>{latestLook.occasion.toUpperCase()}</Text><Text style={styles.lookTitle}>{latestLook.title}</Text><Text numberOfLines={2} style={styles.lookDescription}>{latestLook.explanation}</Text></View>
        <View style={styles.lookArt}>{latestItems.slice(0, 2).map((item) => <View key={item.id} style={styles.miniItem}><GarmentArt garment={item} height={92} /></View>)}</View>
      </Pressable> : <EmptyState title="Your first look is waiting" body="Ask for an outfit and DrapeAI will start with clothes marked clean in your wardrobe." action="Get a suggestion" onAction={() => router.navigate('/(tabs)/ask')} />}
    </View>

    <View>
      <SectionTitle title="Make it yours" />
      <View style={styles.actionRow}>
        <QuickAction number="01" title="Add a piece" body="Bring your real closet in." onPress={() => router.push('/add-item')} />
        <QuickAction number="02" title="Plan a trip" body="Pack around the days ahead." onPress={() => router.navigate('/(tabs)/planner')} />
      </View>
    </View>

    <View style={styles.note}><Text style={styles.noteMark}>✳</Text><Text style={styles.noteText}>Outfit suggestions only use clothes you added and marked clean. Your wardrobe stays on this device; it is not synced or backed up.</Text></View>
  </Page>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function QuickAction({ number, title, body, onPress }: { number: string; title: string; body: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.7 }]}>
    <Text style={styles.quickNumber}>{number}</Text><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickBody}>{body}</Text><Text style={styles.quickArrow}>↗</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  hero: { padding: 22, paddingTop: 20, backgroundColor: colors.ink, borderRadius: radius.lg, overflow: 'hidden', gap: 12 },
  heroStripe: { position: 'absolute', right: -30, top: 20, width: 130, height: 190, borderWidth: 1, borderColor: '#FFFFFF19', transform: [{ rotate: '24deg' }] },
  heroEyebrow: { color: '#D9D9D9', fontSize: 10, letterSpacing: 1.7, fontWeight: '700' },
  heroTitle: { color: colors.paper, fontSize: 28, fontWeight: '800', lineHeight: 32, letterSpacing: -0.7 },
  heroBody: { color: '#C6C6C6', fontSize: 13, lineHeight: 19, maxWidth: 260, marginBottom: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { color: colors.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700', textAlign: 'center' },
  statDivider: { height: 32, width: 1, backgroundColor: colors.line },
  lookCard: { backgroundColor: colors.surface, borderRadius: radius.md, minHeight: 164, overflow: 'hidden', flexDirection: 'row' },
  lookCopy: { flex: 1, justifyContent: 'center', padding: 16, gap: 8 },
  lookTag: { color: colors.accentDeep, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  lookTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  lookDescription: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  lookArt: { width: 86, paddingVertical: 9, paddingRight: 9, gap: 6 },
  miniItem: { flex: 1, borderRadius: 9, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', gap: 10 },
  quickAction: { flex: 1, minHeight: 134, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface },
  quickNumber: { color: colors.accentDeep, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  quickTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 15 },
  quickBody: { color: colors.muted, fontSize: 11, marginTop: 5, lineHeight: 15 },
  quickArrow: { position: 'absolute', right: 14, top: 13, color: colors.ink, fontSize: 17 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 2 },
  noteMark: { color: colors.accent, fontSize: 17 },
  noteText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
});
