import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors } from '../../src/theme';

const tabs = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'wardrobe', title: 'Wardrobe', icon: 'wardrobe' },
  { name: 'ask', title: 'Ask AI', icon: 'spark' },
  { name: 'planner', title: 'Planner', icon: 'calendar' },
  { name: 'profile', title: 'Profile', icon: 'profile' },
] as const;

export default function TabLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.ink,
    tabBarInactiveTintColor: '#7A7A7A',
    tabBarLabelStyle: styles.label,
    tabBarItemStyle: styles.item,
    tabBarStyle: styles.bar,
    tabBarHideOnKeyboard: true,
  }}>
    {tabs.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} options={{
      title: tab.title,
      tabBarIcon: ({ color, focused }) => <TabIcon name={tab.icon} color={typeof color === 'string' ? color : colors.muted} focused={focused} />,
    }} />)}
  </Tabs>;
}

function TabIcon({ name, color, focused }: { name: typeof tabs[number]['icon']; color: string; focused: boolean }) {
  const stroke = focused ? colors.ink : color;
  return <View style={[styles.iconWrap, focused && styles.iconWrapFocused]} accessibilityElementsHidden>
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {name === 'home' ? <><Path d="M3.5 10.7 12 3.8l8.5 6.9v9.1a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2v-9.1Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" /><Path d="M9.2 21v-6h5.6v6" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" /></> : null}
      {name === 'wardrobe' ? <><Rect x="4" y="4.5" width="16" height="15" rx="2" stroke={stroke} strokeWidth="1.8" /><Path d="M8 4.5V3h8v1.5M8 9h8M8 13h5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" /></> : null}
      {name === 'spark' ? <Path d="m12 2 1.65 6.35L20 10l-6.35 1.65L12 18l-1.65-6.35L4 10l6.35-1.65L12 2ZM19 16l.68 2.32L22 19l-2.32.68L19 22l-.68-2.32L16 19l2.32-.68L19 16Z" stroke={stroke} strokeWidth="1.55" strokeLinejoin="round" /> : null}
      {name === 'calendar' ? <><Rect x="4" y="5" width="16" height="15" rx="2" stroke={stroke} strokeWidth="1.8" /><Path d="M8 3v4M16 3v4M4 10h16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" /><Circle cx="8" cy="14" r=".8" fill={stroke} /><Circle cx="12" cy="14" r=".8" fill={stroke} /><Circle cx="16" cy="14" r=".8" fill={stroke} /></> : null}
      {name === 'profile' ? <><Circle cx="12" cy="8" r="3.3" stroke={stroke} strokeWidth="1.8" /><Path d="M5.2 21c.7-3.65 3.22-5.5 6.8-5.5s6.1 1.85 6.8 5.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" /></> : null}
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  bar: { height: 76, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#EAEAEA', backgroundColor: colors.paper, elevation: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 } },
  item: { paddingTop: 1 },
  label: { fontSize: 9, fontWeight: '700', marginTop: 0, letterSpacing: 0.1 },
  iconWrap: { width: 38, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconWrapFocused: { backgroundColor: '#FCE9E8' },
});
