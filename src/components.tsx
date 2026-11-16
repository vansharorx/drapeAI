import React, { PropsWithChildren, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Garment } from './types';
import { colors, radius, space } from './theme';

export function Page({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.paper }}><ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.page, style]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView></SafeAreaView>;
}

export function Header({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <View style={styles.headerRow}><View style={{ flex: 1 }}>
    {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
  </View>{action}</View>;
}

export function Button({ label, onPress, secondary = false, disabled = false, compact = false, icon }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; compact?: boolean; icon?: string }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, compact && styles.buttonCompact, disabled && styles.buttonDisabled, pressed && !disabled && styles.pressed]}>
    {icon ? <Text style={styles.buttonIcon}>{icon}</Text> : null}
    <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary, compact && styles.buttonTextCompact]}>{label}</Text>
  </Pressable>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionRow}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{action && onAction ? <Pressable onPress={onAction} hitSlop={8}><Text style={styles.inlineAction}>{action}</Text></Pressable> : null}</View>;
}

export function Chip({ label, selected, onPress, tone }: { label: string; selected?: boolean; onPress?: () => void; tone?: string }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
    {tone ? <View style={[styles.chipDot, { backgroundColor: tone }]} /> : null}
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </Pressable>;
}

export function GarmentCard({ garment, onPress, compact = false }: { garment: Garment; onPress: () => void; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${garment.name}, ${garment.category}`} onPress={onPress} style={({ pressed }) => [styles.garmentCard, compact && styles.garmentCardCompact, pressed && { opacity: 0.9 }]}>
    <GarmentArt garment={garment} />
    <View style={styles.cardText}>
      <Text numberOfLines={1} style={styles.cardName}>{garment.name}</Text>
      <Text numberOfLines={1} style={styles.cardMeta}>{garment.category} · {garment.availability}</Text>
    </View>
    {garment.availability !== 'Clean' ? <View style={styles.statusPill}><Text style={styles.statusText}>{garment.availability}</Text></View> : null}
  </Pressable>;
}

export function GarmentArt({ garment, height = 148 }: { garment: Garment; height?: number }) {
  const color = garment.color || '#B9B2A8';
  const [imageError, setImageError] = useState(false);
  return <View style={[styles.art, { height, backgroundColor: garment.imageUri ? colors.surface : '#F4F2EF' }]}>
    {garment.imageUri && !imageError ? <Image source={{ uri: garment.imageUri }} resizeMode="cover" style={StyleSheet.absoluteFill} onError={() => setImageError(true)} /> : <Svg width="100%" height="100%" viewBox="0 0 160 150">
      {garment.category === 'Bottoms' ? <>
        <Path d="M52 19h56l-4 47-8 65H72l-4-53-5 53H43l5-67z" fill={color} stroke="#00000018" strokeWidth="2" />
        <Path d="M52 29h55M81 20v57" stroke="#00000020" strokeWidth="2" />
      </> : garment.category === 'Dresses' ? <>
        <Path d="M64 22h32l8 25 27 74H29l27-74z" fill={color} stroke="#00000018" strokeWidth="2" />
        <Path d="M66 23c0 12 28 12 28 0M53 51h54" stroke="#FFFFFF70" strokeWidth="3" />
      </> : garment.category === 'Shoes' ? <>
        <Path d="M35 92c17-1 28-8 38-30l18 9 12 23 26 9c8 3 12 9 11 16H39c-11 0-15-11-4-27z" fill={color} stroke="#00000018" strokeWidth="2" />
        <Path d="M79 71l-6 18 24 9M98 97l12 7" stroke="#FFFFFF99" strokeWidth="3" />
      </> : garment.category === 'Accessories' ? <>
        <Path d="M47 73c0-27 15-43 33-43s33 16 33 43v46H47z" fill={color} stroke="#00000018" strokeWidth="2" />
        <Path d="M42 74h76M62 31l18 16 18-16" stroke="#FFFFFF70" strokeWidth="3" />
      </> : garment.category === 'Outerwear' ? <>
        <Path d="M58 24 80 37l22-13 28 19-12 24-11-6v69H53V61l-11 6-12-24z" fill={color} stroke="#00000018" strokeWidth="2" />
        <Path d="M80 37v93M57 61l13 7M103 61 90 68" stroke="#FFFFFF70" strokeWidth="3" />
      </> : <>
        <Path d="M58 23 80 36l22-13 31 22-14 25-14-8v65H55V62l-14 8-14-25z" fill={color} stroke="#00000018" strokeWidth="2" />
        <Path d="M80 36v91M58 25l10 26 12-15 12 15 10-26" stroke="#FFFFFF80" strokeWidth="3" />
      </>}
    </Svg>}
  </View>;
}

export function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return <View style={styles.empty}><View style={styles.emptyMark}><Text style={{ fontSize: 22, color: colors.accent }}>✳</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text>{action && onAction ? <Button label={action} onPress={onAction} compact /> : null}</View>;
}

export function Label({ children }: PropsWithChildren) { return <Text style={styles.label}>{children}</Text>; }

export const shared = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 52, backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 14, color: colors.ink, fontSize: 15 },
});

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34, gap: 24 },
  headerRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: colors.muted, fontSize: 10, letterSpacing: 1.8, fontWeight: '700', marginBottom: 5 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', letterSpacing: -0.7 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  inlineAction: { color: colors.accentDeep, fontSize: 13, fontWeight: '700' },
  button: { minHeight: 52, paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonSecondary: { backgroundColor: colors.surface },
  buttonCompact: { minHeight: 42, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  buttonTextSecondary: { color: colors.ink },
  buttonTextCompact: { fontSize: 13 },
  buttonIcon: { color: colors.ink, fontSize: 19, lineHeight: 20 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.86 },
  chip: { minHeight: 36, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  chipSelected: { backgroundColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: colors.paper },
  chipDot: { width: 9, height: 9, borderRadius: radius.pill, borderWidth: 0.5, borderColor: '#00000020' },
  garmentCard: { width: '48.5%', backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', marginBottom: 4 },
  garmentCardCompact: { width: 152, marginRight: 10 },
  art: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardText: { paddingHorizontal: 11, paddingTop: 10, paddingBottom: 12 },
  cardName: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  cardMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  statusPill: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#FFFFFFE8' },
  statusText: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  empty: { alignItems: 'center', paddingHorizontal: 26, paddingVertical: 24, borderRadius: radius.md, backgroundColor: '#FAFAFA', gap: 10 },
  emptyMark: { width: 46, height: 46, backgroundColor: colors.softRed, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 4 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 0 },
});
