import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, Header, Label, Page, shared } from '../src/components';
import { useWardrobe } from '../src/store/WardrobeProvider';
import { Category } from '../src/types';
import { colors, radius } from '../src/theme';

const categories: Category[] = ['Tops', 'Bottoms', 'Dresses', 'Shoes', 'Outerwear', 'Accessories'];
const swatches = ['#E8E5DC', '#222222', '#6F88A8', '#8B5C3C', '#CBBDA9', '#E53935', '#27374B', '#8F9B80'];

export default function AddItemScreen() {
  const router = useRouter();
  const { addGarment } = useWardrobe();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Tops');
  const [color, setColor] = useState(swatches[0]);
  const [occasion, setOccasion] = useState('Everyday');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function choosePhoto(camera: boolean) {
    try {
      setBusy(true);
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera permission needed', 'Allow camera access in Android Settings to take a clothing photo, or choose one from your gallery.');
          return;
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.82 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.82, selectionLimit: 1 });
      if (result.canceled || !result.assets[0]?.uri) return;
      setImageUri(result.assets[0].uri);
    } catch {
      Alert.alert('Could not add that photo', 'Try another image or continue by entering garment details manually.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const garmentName = name.trim();
    if (!garmentName) return Alert.alert('Give it a name', 'Add a short name so you can find this piece later.');
    try {
      setBusy(true);
      let persistentUri = imageUri;
      if (imageUri) {
        const localDir = new Directory(Paths.document, 'wardrobe');
        if (!localDir.exists) localDir.create({ intermediates: true });
        const destination = new File(localDir, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`);
        await new File(imageUri).copy(destination);
        persistentUri = destination.uri;
      }
      addGarment({ name: garmentName, category, color, occasion, imageUri: persistentUri });
      router.back();
    } catch {
      Alert.alert('Could not save this garment', 'Check available storage and try again. Your photo has not been added to the wardrobe.');
    } finally {
      setBusy(false);
    }
  }

  return <Page style={{ paddingTop: 8 }}>
    <Header eyebrow="ADD TO YOUR CLOSET" title="A new piece" action={<Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>} />
    <View style={styles.photoFrame}>{imageUri ? <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={styles.photoPrompt}><Text style={styles.photoGlyph}>▧</Text><Text style={styles.photoTitle}>A photo helps you recognize it</Text><Text style={styles.photoBody}>Choose a clear image of one clothing item. It stays in this app's private storage on this device.</Text></View>}</View>
    <View style={styles.photoActions}><Button label="Take photo" onPress={() => choosePhoto(true)} compact secondary icon="⌑" disabled={busy} /><Button label={imageUri ? 'Change photo' : 'Choose photo'} onPress={() => choosePhoto(false)} compact icon="＋" disabled={busy} /></View>

    <View style={styles.fieldGroup}><Label>WHAT DO YOU CALL IT?</Label><TextInput value={name} onChangeText={setName} placeholder="e.g. White Oxford shirt" placeholderTextColor="#888" style={shared.input} autoCapitalize="sentences" maxLength={48} returnKeyType="done" /></View>
    <View style={styles.fieldGroup}><Label>CATEGORY</Label><View style={styles.chips}>{categories.map((item) => <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />)}</View></View>
    <View style={styles.fieldGroup}><Label>MAIN COLOR</Label><View style={styles.swatches}>{swatches.map((swatch) => <Pressable key={swatch} onPress={() => setColor(swatch)} accessibilityRole="button" accessibilityLabel={`Select color ${swatch}`} accessibilityState={{ selected: color === swatch }} style={[styles.swatch, { backgroundColor: swatch }, color === swatch && styles.swatchSelected]} />)}</View></View>
    <View style={styles.fieldGroup}><Label>WHEN WOULD YOU WEAR IT?</Label><View style={styles.chips}>{['Everyday', 'Work', 'Formal', 'Evening', 'Travel', 'Smart casual'].map((item) => <Chip key={item} label={item} selected={occasion === item} onPress={() => setOccasion(item)} />)}</View></View>
    <View style={styles.explain}><Text style={styles.explainMark}>i</Text><Text style={styles.explainText}>Enter the garment details yourself. Automatic clothing recognition is not available in this release.</Text></View>
    <Button label="Save to wardrobe" onPress={save} disabled={busy} />
  </Page>;
}

const styles = StyleSheet.create({
  close: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: colors.ink, fontSize: 27, lineHeight: 30 },
  photoFrame: { height: 240, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoPrompt: { alignItems: 'center', paddingHorizontal: 30, gap: 7 },
  photoGlyph: { fontSize: 32, color: colors.accent },
  photoTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  photoBody: { color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  photoActions: { flexDirection: 'row', gap: 9 },
  fieldGroup: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#00000020' },
  swatchSelected: { borderWidth: 3, borderColor: colors.accent },
  explain: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 12, backgroundColor: '#F6F4EF' },
  explainMark: { width: 18, height: 18, lineHeight: 18, textAlign: 'center', borderRadius: 9, backgroundColor: '#E9E1D3', color: colors.ink, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  explainText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
});
