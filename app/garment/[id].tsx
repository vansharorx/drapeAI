import { File } from 'expo-file-system';
import { Directory, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, GarmentArt, Header, Label, Page, shared } from '../../src/components';
import { useWardrobe } from '../../src/store/WardrobeProvider';
import { Availability, Category } from '../../src/types';
import { colors, radius } from '../../src/theme';

const categories: Category[] = ['Tops', 'Bottoms', 'Dresses', 'Shoes', 'Outerwear', 'Accessories'];
const availabilities: Availability[] = ['Clean', 'Dirty', 'Reserved'];
const swatches = ['#E8E5DC', '#222222', '#6F88A8', '#8B5C3C', '#CBBDA9', '#E53935', '#27374B', '#8F9B80'];

export default function GarmentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { garments, updateGarment, removeGarment } = useWardrobe();
  const garment = useMemo(() => garments.find((item) => item.id === params.id), [garments, params.id]);
  const [name, setName] = useState(garment?.name ?? '');
  const [occasion, setOccasion] = useState(garment?.occasion ?? 'Everyday');
  const [photoBusy, setPhotoBusy] = useState(false);
  if (!garment) return <Page><Header title="Piece not found" /><Text style={{ color: colors.muted }}>This garment may have been removed.</Text><Button label="Back to wardrobe" onPress={() => router.back()} /></Page>;
  const item = garment;

  function confirmDelete() {
    Alert.alert('Delete this garment?', 'It will also be removed from saved looks and trip lists.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
        if (item.imageUri?.startsWith('file://')) { try { new File(item.imageUri).delete(); } catch { /* local image may already be gone */ } }
        removeGarment(item.id); router.back();
      } },
    ]);
  }

  async function replacePhoto(camera: boolean) {
    try {
      setPhotoBusy(true);
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera permission needed', 'Allow camera access in Android Settings, or choose a photo from your gallery.');
          return;
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.82 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.82, selectionLimit: 1 });
      const uri = result.canceled ? undefined : result.assets[0]?.uri;
      if (!uri) return;
      const directory = new Directory(Paths.document, 'wardrobe');
      if (!directory.exists) directory.create({ intermediates: true });
      const destination = new File(directory, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
      await new File(uri).copy(destination);
      const oldUri = item.imageUri;
      updateGarment(item.id, { imageUri: destination.uri });
      if (oldUri?.startsWith('file://')) { try { new File(oldUri).delete(); } catch { /* leave the previous image if cleanup fails */ } }
    } catch {
      Alert.alert('Could not update the photo', 'Try another image or check the available storage on this device.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    const oldUri = item.imageUri;
    updateGarment(item.id, { imageUri: undefined });
    if (oldUri?.startsWith('file://')) { try { new File(oldUri).delete(); } catch { /* the metadata change still removes the photo from the app */ } }
  }

  return <Page style={{ paddingTop: 8 }}>
    <Header eyebrow="WARDROBE DETAIL" title="Edit piece" action={<Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>} />
    <View style={styles.photo}><GarmentArt garment={item} height={275} /></View>
    <View style={styles.photoActions}><Button label="Take photo" onPress={() => replacePhoto(true)} compact secondary disabled={photoBusy} /><Button label={item.imageUri ? 'Change photo' : 'Choose photo'} onPress={() => replacePhoto(false)} compact disabled={photoBusy} />{item.imageUri ? <Pressable accessibilityRole="button" onPress={removePhoto} disabled={photoBusy} style={styles.removePhoto}><Text style={styles.removePhotoText}>Remove</Text></Pressable> : null}{photoBusy ? <ActivityIndicator color={colors.accent} /> : null}</View>
    <View style={styles.fieldGroup}><Label>NAME</Label><TextInput value={name} onChangeText={setName} onEndEditing={() => updateGarment(item.id, { name: name.trim() || item.name })} placeholder="Garment name" style={shared.input} maxLength={48} /></View>
    <View style={styles.fieldGroup}><Label>CATEGORY</Label><View style={styles.chips}>{categories.map((category) => <Chip key={category} label={category} selected={item.category === category} onPress={() => updateGarment(item.id, { category })} />)}</View></View>
    <View style={styles.fieldGroup}><Label>MAIN COLOR</Label><View style={styles.swatches}>{swatches.map((swatch) => <Pressable key={swatch} onPress={() => updateGarment(item.id, { color: swatch })} accessibilityRole="button" accessibilityLabel={`Set color to ${swatch}`} accessibilityState={{ selected: item.color === swatch }} style={[styles.swatch, { backgroundColor: swatch }, item.color === swatch && styles.swatchSelected]} />)}</View></View>
    <View style={styles.fieldGroup}><Label>OCCASION TAGS</Label><View style={styles.chips}>{['Everyday', 'Work', 'Formal', 'Evening', 'Travel', 'Smart casual'].map((item) => <Chip key={item} label={item} selected={occasion.split(', ').includes(item)} onPress={() => {
      const next = occasion.split(', ').filter(Boolean);
      const updated = next.includes(item) ? next.filter((entry) => entry !== item) : [...next, item];
      setOccasion(updated.join(', ')); updateGarment(garment.id, { occasion: updated.join(', ') });
    }} />)}</View></View>
    <View style={styles.fieldGroup}><Label>AVAILABILITY</Label><View style={styles.chips}>{availabilities.map((availability) => <Chip key={availability} label={availability} selected={item.availability === availability} onPress={() => updateGarment(item.id, { availability })} />)}</View><Text style={styles.helper}>Only clean, active garments are used in outfit suggestions.</Text></View>
    <View style={styles.actionRow}><Button label={item.favorite ? '♥  Favorited' : '♡  Add to favorites'} onPress={() => updateGarment(item.id, { favorite: !item.favorite })} secondary /><Button label={item.archived ? 'Restore' : 'Archive'} onPress={() => updateGarment(item.id, { archived: !item.archived })} secondary /></View>
    <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.delete}><Text style={styles.deleteText}>Delete garment</Text></Pressable>
  </Page>;
}

const styles = StyleSheet.create({
  close: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: colors.ink, fontSize: 27, lineHeight: 30 },
  photo: { height: 270, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  photoActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  removePhoto: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 8 },
  removePhotoText: { color: colors.accentDeep, fontSize: 12, fontWeight: '700' },
  fieldGroup: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#00000020' },
  swatchSelected: { borderWidth: 3, borderColor: colors.accent },
  helper: { color: colors.muted, fontSize: 10 },
  actionRow: { gap: 9 },
  delete: { paddingVertical: 14, alignItems: 'center' },
  deleteText: { color: colors.error, fontSize: 13, fontWeight: '700' },
});
