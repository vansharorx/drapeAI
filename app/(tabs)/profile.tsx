import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Header, Page, SectionTitle, shared } from '../../src/components';
import { useWardrobe } from '../../src/store/WardrobeProvider';
import { colors, radius } from '../../src/theme';

export default function ProfileScreen() {
  const { garments, looks, trips, profileName, updateProfileName, storageWarning, clearAllData } = useWardrobe();
  const [name, setName] = useState(profileName);
  const favorites = garments.filter((item) => item.favorite && !item.archived);
  useEffect(() => setName(profileName), [profileName]);
  function saveProfile() { updateProfileName(name); Alert.alert('Profile saved', 'Your profile name is saved on this device.'); }
  function clearData() {
    Alert.alert('Delete all local data?', 'This permanently removes your profile, wardrobe, photos, saved looks, and trips from this device.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete everything', style: 'destructive', onPress: clearAllData },
    ]);
  }
  function googleSignIn() {
    Alert.alert('Google backup needs setup', 'Google sign-in and cloud backup need a deployed DrapeAI server plus an Android OAuth client ID from the project owner. They are not configured in this review APK, so your data remains only on this device.');
  }
  const shownName = profileName || 'Your wardrobe';

  return <Page>
    <Header eyebrow="YOUR STYLE, YOUR CALL" title="Profile" />
    <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{shownName.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.profileName}>{shownName}</Text><Text style={styles.profileMeta}>Personal style space</Text></View><View style={styles.localBadge}><View style={styles.localDot} /><Text style={styles.localText}>ON DEVICE</Text></View></View>
    {storageWarning ? <View accessibilityRole="alert" style={styles.warning}><Text style={styles.warningText}>DrapeAI could not read or save wardrobe data. Your current changes may not persist. Free up device storage or delete the unreadable local data below.</Text></View> : null}
    <View style={styles.counts}><Count value={String(garments.length)} label="PIECES" /><Count value={String(favorites.length)} label="FAVORITES" /><Count value={String(looks.length)} label="SAVED LOOKS" /><Count value={String(trips.length)} label="TRIPS" /></View>
    <View><SectionTitle title="Personal profile" /><View style={styles.infoCard}><Text style={styles.inputLabel}>DISPLAY NAME</Text><TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#888" style={shared.input} maxLength={40} autoCapitalize="words" /><Button label="Save profile" onPress={saveProfile} compact /></View></View>
    <View><SectionTitle title="Backup and sign-in" /><View style={styles.infoCard}><Text style={styles.infoTitle}>Google account</Text><Text style={styles.infoBody}>Use a Google account to save your wardrobe across devices when secure cloud backup is activated.</Text><Button label="Continue with Google" onPress={googleSignIn} secondary compact /><Text style={styles.setupNote}>Cloud backup is not yet configured in this APK. Your data stays private on this phone until it is activated.</Text></View></View>
    <View><SectionTitle title="About DrapeAI" /><View style={styles.infoCard}><Info title="Stored on this device" body="Your wardrobe details and photos stay in this app's private storage. They do not sync to another device or an account; uninstalling the app removes them." /><Info title="Styling tools" body="Outfit suggestions use local wardrobe rules. AI recognition, cloud backup, accounts, and weather services are not connected." /><Info title="Your control" body="Camera and photo permissions are requested only when you add or change a garment photo. You can delete all local data below." /></View></View>
    <View><SectionTitle title="Laundry & availability" /><View style={styles.infoCard}><Info title="Update a garment's status" body="Open a wardrobe item to mark it clean, dirty, or reserved. Outfit suggestions use only clean active pieces." /></View></View>
    <View style={styles.restoreBlock}><Text style={styles.restoreTitle}>Delete on-device data</Text><Text style={styles.restoreBody}>Remove your profile, garments, saved looks, trips, and stored clothing photos from this device.</Text><Button label="Delete all data" onPress={clearData} secondary /></View>
    <Text style={styles.version}>DRAPEAI - ANDROID - 1.0.0</Text>
  </Page>;
}

function Count({ value, label }: { value: string; label: string }) { return <View style={styles.count}><Text style={styles.countValue}>{value}</Text><Text style={styles.countLabel}>{label}</Text></View>; }
function Info({ title, body }: { title: string; body: string }) { return <View style={styles.info}><Text style={styles.infoTitle}>{title}</Text><Text style={styles.infoBody}>{body}</Text></View>; }

const styles = StyleSheet.create({
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, backgroundColor: colors.surface, borderRadius: radius.md }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.paper, fontSize: 22, fontWeight: '800' }, profileName: { color: colors.ink, fontSize: 15, fontWeight: '800' }, profileMeta: { color: colors.muted, fontSize: 11, marginTop: 4 }, localBadge: { backgroundColor: '#E7EFE9', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 }, localDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success }, localText: { color: '#3C684D', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 }, counts: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 15 }, count: { flex: 1, alignItems: 'center', gap: 4 }, countValue: { color: colors.ink, fontSize: 18, fontWeight: '800' }, countLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 }, infoCard: { backgroundColor: colors.surface, padding: 15, borderRadius: radius.md, gap: 10 }, info: { paddingVertical: 3 }, infoTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, infoBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 }, inputLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }, setupNote: { color: colors.muted, fontSize: 10, lineHeight: 14 }, restoreBlock: { backgroundColor: '#FAF8F7', padding: 15, borderRadius: radius.md, gap: 8 }, restoreTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' }, restoreBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 4 }, version: { color: '#9A9A9A', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, textAlign: 'center', marginTop: 2 }, warning: { padding: 12, borderRadius: 12, backgroundColor: '#FFF3DD' }, warningText: { color: '#684A1D', fontSize: 11, lineHeight: 16 },
});
