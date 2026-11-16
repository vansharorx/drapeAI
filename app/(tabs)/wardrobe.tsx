import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, EmptyState, GarmentCard, Header } from '../../src/components';
import { useWardrobe } from '../../src/store/WardrobeProvider';
import { Category } from '../../src/types';
import { colors } from '../../src/theme';

const filters: Array<'All' | Category> = ['All', 'Tops', 'Bottoms', 'Dresses', 'Shoes', 'Outerwear', 'Accessories'];

export default function WardrobeScreen() {
  const router = useRouter();
  const { garments } = useWardrobe();
  const [filter, setFilter] = useState<'All' | Category>('All');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const visible = useMemo(() => garments.filter((item) => showArchived ? item.archived : !item.archived)
    .filter((item) => filter === 'All' || item.category === filter)
    .filter((item) => `${item.name} ${item.category} ${item.occasion}`.toLowerCase().includes(query.trim().toLowerCase())), [garments, filter, query, showArchived]);
  useFocusEffect(useCallback(() => { setQuery(''); }, []));

  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.paper }}>
    <FlatList
      data={visible}
      numColumns={2}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <GarmentCard garment={item} onPress={() => router.push({ pathname: '/garment/[id]', params: { id: item.id } })} />}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View style={styles.headerContent}>
        <Header eyebrow="YOUR CLOSET, IN ONE PLACE" title="Wardrobe" action={<Pressable accessibilityRole="button" accessibilityLabel="Add garment" onPress={() => router.push('/add-item')} style={styles.addCircle}><Text style={styles.addPlus}>＋</Text></Pressable>} />
        <View style={styles.searchBox}><Text style={styles.searchGlyph}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Find a piece" placeholderTextColor="#898989" returnKeyType="search" style={styles.searchInput} accessibilityLabel="Search wardrobe" />{query ? <Pressable onPress={() => setQuery('')} hitSlop={10}><Text style={styles.clear}>×</Text></Pressable> : null}</View>
        <View style={styles.filters}>{filters.map((item) => <Chip key={item} label={item} selected={filter === item} onPress={() => setFilter(item)} />)}</View>
        <View style={styles.listHeading}><Text style={styles.count}>{visible.length} {visible.length === 1 ? 'PIECE' : 'PIECES'}</Text><Pressable onPress={() => setShowArchived((value) => !value)}><Text style={styles.archiveToggle}>{showArchived ? 'View active' : 'Archived'}</Text></Pressable></View>
      </View>}
      ListEmptyComponent={<EmptyState title={showArchived ? 'Nothing archived' : 'No pieces found'} body={query ? 'Try another name or category.' : 'Add your first garment to start building your digital wardrobe.'} action="Add a garment" onAction={() => router.push('/add-item')} />}
      ListFooterComponent={<Button label="Add clothing" onPress={() => router.push('/add-item')} icon="＋" />}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  addCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  addPlus: { color: colors.paper, fontSize: 26, lineHeight: 29, fontWeight: '300' },
  searchBox: { minHeight: 50, backgroundColor: colors.surface, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 9 },
  searchGlyph: { fontSize: 25, color: colors.muted, marginTop: -4 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14, paddingVertical: 11 },
  clear: { color: colors.muted, fontSize: 23, paddingHorizontal: 3 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -4 },
  count: { fontSize: 10, color: colors.muted, fontWeight: '800', letterSpacing: 1.3 },
  archiveToggle: { color: colors.accentDeep, fontSize: 12, fontWeight: '700' },
  gridRow: { justifyContent: 'space-between', gap: 8 },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, gap: 10 },
  headerContent: { gap: 20, marginBottom: 4 },
});
