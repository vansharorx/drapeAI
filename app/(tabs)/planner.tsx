import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, EmptyState, GarmentArt, Header, Page, SectionTitle, shared } from '../../src/components';
import { useWardrobe } from '../../src/store/WardrobeProvider';
import { colors, radius } from '../../src/theme';

type DateField = 'start' | 'end';

export default function PlannerScreen() {
  const { trips, garments, addTrip, updateTrip, removeTrip } = useWardrobe();
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(trips[0]?.id ?? null);
  const [calendarField, setCalendarField] = useState<DateField | null>(null);
  const cleanItems = useMemo(() => garments.filter((item) => !item.archived && item.availability === 'Clean'), [garments]);

  function createTrip() {
    const place = destination.trim();
    const start = toIsoDate(startDate);
    const end = toIsoDate(endDate);
    if (!place) return Alert.alert('Add a destination', 'Enter a city or place for this trip.');
    if (!start || !end) return Alert.alert('Check your dates', 'Choose dates in MM-DD-YYYY format.');
    if (end < start) return Alert.alert('Check your dates', 'The return date must be the same day or later than the departure date.');
    addTrip({ destination: place, startDate: start, endDate: end, notes: notes.trim(), garmentIds: [] });
    setExpandedId(null);
    setDestination(''); setStartDate(''); setEndDate(''); setNotes('');
  }

  function selectDate(isoDate: string) {
    if (calendarField === 'start') setStartDate(displayDate(isoDate));
    if (calendarField === 'end') setEndDate(displayDate(isoDate));
    setCalendarField(null);
  }

  function suggestPack(tripId: string) {
    const byCategory = new Map(cleanItems.map((item) => [item.category, item]));
    const selected = [...byCategory.values()].slice(0, 6).map((item) => item.id);
    if (!selected.length) return Alert.alert('No clean pieces yet', 'Mark a garment clean or add clothing before making a packing list.');
    updateTrip(tripId, { garmentIds: selected });
  }

  return <Page>
    <Header eyebrow="TAKE YOUR CLOSET WITH YOU" title="Trip planner" />
    <View style={styles.weatherNote}><Text style={styles.weatherMark}>*</Text><View style={{ flex: 1 }}><Text style={styles.weatherTitle}>Pack with what you own</Text><Text style={styles.weatherBody}>Build a checklist from clean pieces and edit it item by item. Weather forecasts are not connected.</Text></View></View>

    <View style={styles.formCard}>
      <SectionTitle title="Plan a trip" />
      <Text style={styles.label}>DESTINATION</Text><TextInput value={destination} onChangeText={setDestination} placeholder="e.g. Jaipur" placeholderTextColor="#888" style={shared.input} returnKeyType="next" />
      <View style={styles.dateRow}>
        <DateInput label="LEAVE" value={startDate} onChangeText={(value) => setStartDate(dateInput(value))} onOpenCalendar={() => setCalendarField('start')} />
        <DateInput label="RETURN" value={endDate} onChangeText={(value) => setEndDate(dateInput(value))} onOpenCalendar={() => setCalendarField('end')} />
      </View>
      <Text style={styles.label}>EVENTS OR NOTES - OPTIONAL</Text><TextInput value={notes} onChangeText={setNotes} placeholder="Dinner, walking, one formal event..." placeholderTextColor="#888" style={shared.input} maxLength={180} />
      <Button label="Create trip" onPress={createTrip} />
    </View>

    <View style={{ gap: 12 }}><SectionTitle title="Your trips" />
      {trips.length ? trips.map((trip) => {
        const open = expandedId === trip.id;
        const packed = trip.garmentIds.map((id) => garments.find((item) => item.id === id)).filter((item) => item !== undefined);
        return <View key={trip.id} style={styles.tripCard}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setExpandedId(open ? null : trip.id)} style={styles.tripHeading}>
            <View style={styles.tripStamp}><Text style={styles.tripStampText}>{trip.startDate.slice(8, 10)}</Text><Text style={styles.tripStampMonth}>{trip.startDate.slice(5, 7)}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.tripDestination}>{trip.destination}</Text><Text style={styles.tripDates}>{displayDate(trip.startDate)} to {displayDate(trip.endDate)}</Text></View>
            <Text style={styles.chevron}>{open ? '-' : '+'}</Text>
          </Pressable>
          {open ? <View style={{ gap: 12 }}>
            {trip.notes ? <Text style={styles.tripNotes}>{trip.notes}</Text> : null}
            <Text style={styles.packingHeading}>PACKING CHECKLIST - {packed.length} PIECES</Text>
            {packed.length ? <View style={styles.packingGrid}>{packed.map((item) => <View key={item.id} style={styles.packingItem}><GarmentArt garment={item} height={95} /><Text style={styles.packingName} numberOfLines={1}>{item.name}</Text><Text style={styles.packingMeta}>{item.availability}</Text><Pressable onPress={() => updateTrip(trip.id, { garmentIds: trip.garmentIds.filter((id) => id !== item.id) })} accessibilityRole="button" accessibilityLabel={`Remove ${item.name} from packing list`}><Text style={styles.removeItem}>Remove</Text></Pressable></View>)}</View> : <Text style={styles.emptyPacking}>Choose clean pieces below or start with a suggested list.</Text>}
            <Text style={styles.packingHeading}>ADD OR REMOVE CLEAN PIECES</Text>
            {cleanItems.length ? <View style={styles.chooseList}>{cleanItems.map((item) => {
              const selected = trip.garmentIds.includes(item.id);
              return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => updateTrip(trip.id, { garmentIds: selected ? trip.garmentIds.filter((id) => id !== item.id) : [...trip.garmentIds, item.id] })} style={[styles.chooseItem, selected && styles.chooseItemSelected]}><Text style={[styles.check, selected && styles.checkSelected]}>{selected ? 'OK' : '+'}</Text><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.chooseName}>{item.name}</Text><Text style={styles.chooseMeta}>{item.category}</Text></View></Pressable>;
            })}</View> : <Text style={styles.emptyPacking}>No clean pieces are available. Add a garment or update its laundry status.</Text>}
            <View style={styles.tripActions}><Button label="Suggest a list" onPress={() => suggestPack(trip.id)} compact /><Button label="Delete trip" onPress={() => Alert.alert('Delete this trip?', 'The trip and its packing checklist will be removed.', [{ text: 'Keep trip', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => removeTrip(trip.id) }])} secondary compact /></View>
          </View> : <Text style={styles.packSummary}>{trip.garmentIds.length ? `${trip.garmentIds.length} pieces in your list` : 'Tap to make a packing checklist'}</Text>}
        </View>;
      }) : <EmptyState title="Your next trip, better packed" body="Add a destination and dates. DrapeAI will help you start a checklist from available garments." />}
    </View>
    <CalendarModal visible={calendarField !== null} value={calendarField === 'start' ? toIsoDate(startDate) : toIsoDate(endDate)} onClose={() => setCalendarField(null)} onSelect={selectDate} />
  </Page>;
}

function DateInput({ label, value, onChangeText, onOpenCalendar }: { label: string; value: string; onChangeText: (value: string) => void; onOpenCalendar: () => void }) {
  return <View style={styles.dateField}><Text style={styles.label}>{label}</Text><View style={styles.dateInputRow}><TextInput value={value} onChangeText={onChangeText} placeholder="MM-DD-YYYY" placeholderTextColor="#888" style={[shared.input, styles.dateInput]} keyboardType="number-pad" maxLength={10} /><Pressable accessibilityRole="button" accessibilityLabel={`Open ${label.toLowerCase()} calendar`} onPress={onOpenCalendar} style={styles.calendarButton}><Text style={styles.calendarButtonText}>CAL</Text></Pressable></View></View>;
}

function CalendarModal({ visible, value, onClose, onSelect }: { visible: boolean; value?: string; onClose: () => void; onSelect: (value: string) => void }) {
  const [viewDate, setViewDate] = useState(() => fromIsoDate(value) ?? new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + days) / 7) * 7 }, (_, index) => index - firstWeekday + 1);
  const selected = value ?? '';
  const iso = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.calendarCard}>
    <View style={styles.calendarHeader}><Pressable onPress={() => setViewDate(new Date(year, month - 1, 1))} style={styles.monthButton}><Text style={styles.monthButtonText}>{'<'}</Text></Pressable><Text style={styles.monthTitle}>{viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</Text><Pressable onPress={() => setViewDate(new Date(year, month + 1, 1))} style={styles.monthButton}><Text style={styles.monthButtonText}>{'>'}</Text></Pressable></View>
    <View style={styles.weekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekDay}>{day}</Text>)}</View>
    <View style={styles.days}>{cells.map((day, index) => day < 1 || day > days ? <View key={`blank-${index}`} style={styles.dayCell} /> : <Pressable key={day} accessibilityRole="button" accessibilityLabel={`Select ${month + 1}-${day}-${year}`} onPress={() => onSelect(iso(day))} style={[styles.dayCell, iso(day) === selected && styles.selectedDay]}><Text style={[styles.dayText, iso(day) === selected && styles.selectedDayText]}>{day}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelCalendar}><Text style={styles.cancelCalendarText}>Cancel</Text></Pressable>
  </View></View></Modal>;
}

function dateInput(value: string) { const digits = value.replace(/\D/g, '').slice(0, 8); return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('-'); }
function toIsoDate(value: string) { const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value); if (!match) return undefined; const iso = `${match[3]}-${match[1]}-${match[2]}`; const date = new Date(`${iso}T00:00:00Z`); return date.toISOString().slice(0, 10) === iso ? iso : undefined; }
function displayDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(5, 7)}-${value.slice(8, 10)}-${value.slice(0, 4)}` : value; }
function fromIsoDate(value?: string) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : undefined; }

const styles = StyleSheet.create({
  weatherNote: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: '#F6F4EF', alignItems: 'center' }, weatherMark: { color: '#A27A36', fontSize: 27, fontWeight: '800' }, weatherTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, weatherBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 }, formCard: { padding: 16, borderRadius: radius.md, backgroundColor: colors.surface, gap: 13 }, label: { fontSize: 9, color: colors.muted, fontWeight: '800', letterSpacing: 1.2 }, dateRow: { flexDirection: 'row', gap: 10 }, dateField: { flex: 1, gap: 8 }, dateInputRow: { flexDirection: 'row', gap: 6, alignItems: 'center' }, dateInput: { flex: 1, minWidth: 0, paddingHorizontal: 10, fontSize: 13 }, calendarButton: { width: 44, minHeight: 52, backgroundColor: colors.ink, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, calendarButtonText: { color: colors.paper, fontSize: 9, fontWeight: '800' }, tripCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 13 }, tripHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, tripStamp: { width: 48, height: 50, backgroundColor: colors.paper, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, tripStampText: { color: colors.ink, fontSize: 17, fontWeight: '800' }, tripStampMonth: { color: colors.accentDeep, fontSize: 9, fontWeight: '800' }, tripDestination: { color: colors.ink, fontSize: 16, fontWeight: '800' }, tripDates: { color: colors.muted, fontSize: 10, marginTop: 3 }, chevron: { color: colors.accentDeep, fontSize: 23, width: 24, textAlign: 'center' }, packSummary: { color: colors.muted, fontSize: 11, marginLeft: 60 }, tripNotes: { color: colors.ink, fontSize: 12, lineHeight: 17 }, packingHeading: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 }, packingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, packingItem: { width: '31%', borderRadius: 9, overflow: 'hidden', backgroundColor: colors.paper }, packingName: { color: colors.ink, fontSize: 9, fontWeight: '700', paddingHorizontal: 7, paddingTop: 6 }, packingMeta: { color: colors.muted, fontSize: 9, paddingHorizontal: 7, paddingTop: 3 }, removeItem: { color: colors.accentDeep, fontSize: 9, fontWeight: '700', paddingHorizontal: 7, paddingTop: 4, paddingBottom: 8 }, emptyPacking: { color: colors.muted, fontSize: 11 }, chooseList: { gap: 7 }, chooseItem: { minHeight: 54, backgroundColor: colors.paper, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'transparent' }, chooseItemSelected: { borderColor: colors.accent, backgroundColor: '#FFF8F7' }, check: { width: 28, height: 28, borderRadius: 14, textAlign: 'center', textAlignVertical: 'center', color: colors.muted, backgroundColor: colors.surface, fontSize: 11, fontWeight: '800', overflow: 'hidden' }, checkSelected: { color: colors.paper, backgroundColor: colors.accent }, chooseName: { color: colors.ink, fontSize: 12, fontWeight: '700' }, chooseMeta: { color: colors.muted, fontSize: 10, marginTop: 2 }, tripActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, modalBackdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 22 }, calendarCard: { backgroundColor: colors.paper, borderRadius: radius.md, padding: 18, gap: 14 }, calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, monthButtonText: { color: colors.ink, fontSize: 19, fontWeight: '800' }, monthTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, weekRow: { flexDirection: 'row' }, weekDay: { width: '14.2857%', textAlign: 'center', color: colors.muted, fontSize: 10, fontWeight: '800' }, days: { flexDirection: 'row', flexWrap: 'wrap' }, dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 18 }, dayText: { color: colors.ink, fontSize: 13, fontWeight: '600' }, selectedDay: { backgroundColor: colors.accent }, selectedDayText: { color: colors.paper, fontWeight: '800' }, cancelCalendar: { minHeight: 42, alignItems: 'center', justifyContent: 'center' }, cancelCalendarText: { color: colors.accentDeep, fontSize: 13, fontWeight: '800' },
});
