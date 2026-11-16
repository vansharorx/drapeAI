import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WardrobeProvider, useWardrobe } from '../src/store/WardrobeProvider';
import { colors } from '../src/theme';

export default function RootLayout() {
  return <SafeAreaProvider><WardrobeProvider><AppNavigator /></WardrobeProvider></SafeAreaProvider>;
}

function AppNavigator() {
  const { ready } = useWardrobe();
  if (!ready) return <><StatusBar style="light" /><BrandedLoader /></>;
  return <><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'slide_from_right' }}>
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="add-item" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="garment/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
  </Stack></>;
}

function BrandedLoader() {
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0.35)).current;
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.parallel([Animated.timing(scale, { toValue: 1, duration: 680, easing: Easing.out(Easing.cubic), useNativeDriver: true }), Animated.timing(opacity, { toValue: 1, duration: 680, useNativeDriver: true })]),
      Animated.parallel([Animated.timing(scale, { toValue: 0.88, duration: 680, easing: Easing.in(Easing.cubic), useNativeDriver: true }), Animated.timing(opacity, { toValue: 0.35, duration: 680, useNativeDriver: true })]),
    ]));
    const sweep = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 1350, easing: Easing.inOut(Easing.quad), useNativeDriver: false }));
    pulse.start(); sweep.start();
    return () => { pulse.stop(); sweep.stop(); };
  }, [opacity, progress, scale]);
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['12%', '100%'] });
  return <View style={styles.loader}><Animated.View style={[styles.loaderMark, { transform: [{ scale }], opacity }]}><Text style={styles.loaderMarkText}>D</Text><View style={styles.loaderAccent} /></Animated.View><Text style={styles.loaderTitle}>DrapeAI</Text><Text style={styles.loaderCaption}>YOUR PERSONAL STYLIST</Text><View accessibilityRole="progressbar" accessibilityLabel="Loading DrapeAI" style={styles.progressTrack}><Animated.View style={[styles.progressFill, { width: barWidth }]} /></View></View>;
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48 },
  loaderMark: { width: 86, height: 86, borderRadius: 24, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginBottom: 20, overflow: 'hidden' },
  loaderMarkText: { color: colors.ink, fontSize: 53, fontWeight: '900', letterSpacing: -4, marginLeft: -4 },
  loaderAccent: { position: 'absolute', width: 31, height: 5, backgroundColor: colors.accent, right: 12, top: 42 },
  loaderTitle: { color: colors.paper, fontSize: 27, fontWeight: '800', letterSpacing: -0.7 },
  loaderCaption: { color: '#AFAFAF', fontSize: 9, fontWeight: '700', letterSpacing: 2, marginTop: 8 },
  progressTrack: { width: 118, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF2B', marginTop: 28, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.accent },
});
