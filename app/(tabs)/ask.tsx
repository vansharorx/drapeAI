import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, EmptyState, GarmentArt, Header, Page, SectionTitle } from '../../src/components';
import { useWardrobe } from '../../src/store/WardrobeProvider';
import { Garment } from '../../src/types';
import { colors, radius } from '../../src/theme';

const occasions = ['Everyday', 'Work', 'Date night', 'Wedding', 'Interview', 'Travel'];
type Outfit = { title: string; occasion: string; items: Garment[]; explanation: string; caveat: string };

export default function AskScreen() {
  const router = useRouter();
  const { garments, looks, addLook, removeLook } = useWardrobe();
  const [prompt, setPrompt] = useState('');
  const [occasion, setOccasion] = useState('Everyday');
  const [outfits, setOutfits] = useState<Outfit[] | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const eligible = useMemo(() => garments.filter((item) => !item.archived && item.availability === 'Clean'), [garments]);

  function generate() {
    const text = normalize(`${occasion} ${prompt}`);
    const pool = eligible;
    const dresses = pool.filter((item) => item.category === 'Dresses');
    const tops = pool.filter((item) => item.category === 'Tops');
    const bottoms = pool.filter((item) => item.category === 'Bottoms');
    const shoes = pool.filter((item) => item.category === 'Shoes');
    const layers = pool.filter((item) => item.category === 'Outerwear' || item.category === 'Accessories');
    const combinations: Garment[][] = [];
    for (const dress of dresses) {
      if (shoes.length) for (const shoe of shoes) combinations.push([dress, shoe]);
      else combinations.push([dress]);
    }
    for (const top of tops) for (const bottom of bottoms) {
      for (const shoe of shoes.slice(0, 3)) combinations.push([top, bottom, shoe]);
      if (!shoes.length) combinations.push([top, bottom]);
    }
    const seen = new Set<string>();
    const unique = combinations
      .filter((items) => new Set(items.map((item) => item.id)).size === items.length && items.length >= 2)
      .map((items) => ({ items, key: items.map((item) => item.id).sort().join('|') }))
      .filter(({ key }) => !seen.has(key) && Boolean(seen.add(key)))
      .sort((left, right) => scoreOutfit(right.items, text, occasion) - scoreOutfit(left.items, text, occasion))
      .slice(0, 3)
      .map(({ items }) => items);
    const results: Outfit[] = unique.map((items, index) => {
      const addLayer = layers.find((item) => !items.includes(item));
      const complete = addLayer && index === 0 ? [...items, addLayer] : items;
      const names = complete.map((item) => item.name);
      const hasOccasionMatch = complete.some((item) => normalize(item.occasion).split(', ').some((tag) => text.includes(tag)));
      return {
        title: index === 0 ? 'A considered combination' : index === 1 ? 'Another way to wear it' : 'A different direction',
        occasion,
        items: complete,
        explanation: `${names.join(' + ')} — all marked clean in your wardrobe. ${hasOccasionMatch ? 'At least one piece is tagged for this occasion.' : 'These pieces are paired from what is currently available; their occasion tags do not confirm dress-code fit.'}`,
        caveat: hasOccasionMatch ? 'This suggestion is based on your item tags, not a verified dress code.' : 'Your wardrobe tags do not confirm that this meets the occasion’s dress code.',
      };
    });
    setOutfits(results);
    setSavedIds([]);
  }

  function save(outfit: Outfit) {
    if (savedIds.includes(outfit.items.map((item) => item.id).join('|'))) return;
    const id = outfit.items.map((item) => item.id).join('|');
    addLook({ title: outfit.title, occasion: outfit.occasion, garmentIds: outfit.items.map((item) => item.id), explanation: outfit.explanation });
    setSavedIds((current) => [...current, id]);
    Alert.alert('Look saved', 'You can find it again in your saved looks.');
  }

  function toggleSave(outfit: Outfit, isSaved: boolean) {
    const key = outfit.items.map((item) => item.id).join('|');
    if (isSaved) {
      removeLookFor(outfit, looks, removeLook);
      setSavedIds((current) => current.filter((entry) => entry !== key));
    } else save(outfit);
  }

  return <Page>
    <Header eyebrow="A STYLIST THAT STARTS WITH YOUR CLOSET" title="Ask DrapeAI" />
    <View style={styles.intro}><View style={styles.spark}><Text style={{ color: colors.accent, fontSize: 20 }}>✳</Text></View><View style={{ flex: 1 }}><Text style={styles.introTitle}>What are you getting dressed for?</Text><Text style={styles.introBody}>Suggestions use clean pieces you added. Matching currently runs locally; it is not a live AI stylist.</Text></View></View>
    <TextInput value={prompt} onChangeText={setPrompt} placeholder="A relaxed dinner, a presentation, a rainy commute…" placeholderTextColor="#858585" multiline maxLength={240} style={styles.prompt} accessibilityLabel="Describe what you need an outfit for" />
    <View style={styles.context}><Text style={styles.contextLabel}>OCCASION</Text><View style={styles.chips}>{occasions.map((item) => <Chip key={item} label={item} selected={occasion === item} onPress={() => setOccasion(item)} />)}</View></View>
    <Button label="Find combinations" onPress={generate} icon="✳" />
    <View style={styles.previewBadge}><View style={styles.greenDot} /><Text style={styles.previewText}>LOCAL OUTFIT MATCHING · {eligible.length} CLEAN PIECES</Text></View>

    {outfits ? <View style={{ gap: 14 }}>
      <SectionTitle title={outfits.length ? 'Your combinations' : 'A few more pieces will help'} />
      {outfits.length ? outfits.map((outfit) => {
        const key = outfit.items.map((item) => item.id).join('|');
        const saved = savedIds.includes(key) || looks.some((look) => look.occasion === outfit.occasion && [...look.garmentIds].sort().join('|') === [...outfit.items.map((item) => item.id)].sort().join('|'));
        return <View key={key} style={styles.outfitCard}>
          <View style={styles.outfitHeading}><View style={{ flex: 1 }}><Text style={styles.outfitOccasion}>{occasion.toUpperCase()} · PREVIEW</Text><Text style={styles.outfitTitle}>{outfit.title}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove saved look' : 'Save look'} accessibilityState={{ selected: saved }} onPress={() => toggleSave(outfit, saved)} style={styles.saveCircle}><Text style={{ color: saved ? colors.accentDeep : colors.ink, fontSize: 19 }}>{saved ? '♥' : '♡'}</Text></Pressable></View>
          <View style={styles.itemStrip}>{outfit.items.map((item) => <View key={item.id} style={styles.itemBox}><GarmentArt garment={item} height={102} /><Text numberOfLines={1} style={styles.itemName}>{item.name}</Text><Text style={styles.itemCategory}>{item.category}</Text></View>)}</View>
          <Text style={styles.explanation}>{outfit.explanation}</Text><Text style={styles.caveat}>{outfit.caveat}</Text>
        </View>;
      }) : <EmptyState title={eligible.length ? 'Add a few more pieces' : 'Start with your wardrobe'} body="To suggest a combination, DrapeAI needs clean pieces from at least two categories, such as a top and bottoms." action="Add a garment" onAction={() => router.push('/add-item')} />}
      <Text style={styles.previewFootnote}>Suggestions are matched on this device from your garment categories and occasion tags. DrapeAI does not verify dress codes, weather, or fit.</Text>
    </View> : null}

    {!outfits && looks.length ? <View style={{ gap: 10 }}><SectionTitle title="Saved looks" />{looks.slice(0, 3).map((look) => <View key={look.id} style={styles.savedRow}><Text style={styles.savedHeart}>♥</Text><View style={{ flex: 1 }}><Text style={styles.savedTitle}>{look.title}</Text><Text style={styles.savedMeta}>{look.occasion} · {look.garmentIds.length} pieces</Text></View><Pressable onPress={() => removeLook(look.id)} accessibilityLabel="Remove saved look"><Text style={styles.remove}>×</Text></Pressable></View>)}</View> : null}
  </Page>;
}

function removeLookFor(outfit: Outfit, looks: ReturnType<typeof useWardrobe>['looks'], removeLook: ReturnType<typeof useWardrobe>['removeLook']) {
  const ids = [...outfit.items.map((item) => item.id)].sort().join('|');
  const found = looks.find((look) => look.occasion === outfit.occasion && [...look.garmentIds].sort().join('|') === ids);
  if (found) removeLook(found.id);
}

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9, ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreOutfit(items: Garment[], request: string, occasion: string) {
  const matchingTags = items.filter((item) => normalize(item.occasion).split(', ').some((tag) => tag && request.includes(tag))).length;
  const favorites = items.filter((item) => item.favorite).length;
  const hasFootwear = items.some((item) => item.category === 'Shoes');
  const hasDress = items.some((item) => item.category === 'Dresses');
  const categoryFit = hasDress || (items.some((item) => item.category === 'Tops') && items.some((item) => item.category === 'Bottoms'));
  const broadTags = items.filter((item) => normalize(item.occasion).includes(normalize(occasion))).length;
  return matchingTags * 8 + favorites * 2 + (hasFootwear ? 2 : 0) + (categoryFit ? 3 : 0) + broadTags * 5;
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  spark: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.softRed, alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  introBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  prompt: { minHeight: 120, backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, color: colors.ink, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  context: { gap: 10 },
  contextLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#EFF5F0', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  previewText: { fontSize: 9, color: '#3C684D', fontWeight: '800', letterSpacing: 0.6 },
  outfitCard: { borderRadius: radius.md, backgroundColor: colors.surface, padding: 14, gap: 12 },
  outfitHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outfitOccasion: { color: colors.accentDeep, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  outfitTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 4 },
  saveCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  itemStrip: { flexDirection: 'row', gap: 7 },
  itemBox: { flex: 1, minWidth: 0, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.paper },
  itemName: { paddingHorizontal: 7, paddingTop: 7, color: colors.ink, fontSize: 10, fontWeight: '700' },
  itemCategory: { paddingHorizontal: 7, paddingBottom: 8, paddingTop: 2, color: colors.muted, fontSize: 9 },
  explanation: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  caveat: { color: colors.warning, fontSize: 10, lineHeight: 15 },
  previewFootnote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, padding: 13, borderRadius: 12 },
  savedHeart: { fontSize: 17, color: colors.accentDeep },
  savedTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  savedMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  remove: { fontSize: 23, color: colors.muted, paddingHorizontal: 4 },
});
