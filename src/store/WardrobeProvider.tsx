import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialData } from '../seed';
import { Availability, Garment, SavedLook, TripPlan, WardrobeData } from '../types';

const STORAGE_KEY = 'drapeai.wardrobe.v1';
type WardrobeContextValue = WardrobeData & {
  ready: boolean;
  storageWarning: boolean;
  addGarment: (garment: Omit<Garment, 'id' | 'createdAt' | 'availability' | 'archived' | 'favorite'>) => void;
  updateGarment: (id: string, changes: Partial<Garment>) => void;
  removeGarment: (id: string) => void;
  addLook: (look: Omit<SavedLook, 'id' | 'createdAt'>) => void;
  removeLook: (id: string) => void;
  addTrip: (trip: Omit<TripPlan, 'id'>) => void;
  updateTrip: (id: string, changes: Partial<TripPlan>) => void;
  removeTrip: (id: string) => void;
  clearAllData: () => void;
  updateProfileName: (name: string) => void;
};

const Context = createContext<WardrobeContextValue | null>(null);

export function WardrobeProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<WardrobeData>(initialData);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [storageWritable, setStorageWritable] = useState(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!mounted) return;
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (!isWardrobeData(parsed)) throw new Error('Saved wardrobe data is invalid');
          setData(removeLegacyStarterItems(parsed));
        }
      })
      .then(() => { if (mounted) setStorageWritable(true); })
      .catch(() => { if (mounted) setStorageWarning(true); })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready || !storageWritable) return;
    const snapshot = JSON.stringify(data);
    writeQueue.current = writeQueue.current.then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot)).then(() => setStorageWarning(false)).catch(() => setStorageWarning(true));
  }, [data, ready, storageWritable]);

  const addGarment = useCallback((item: Omit<Garment, 'id' | 'createdAt' | 'availability' | 'archived' | 'favorite'>) => {
    const garment: Garment = { ...item, id: createId(), createdAt: new Date().toISOString(), availability: 'Clean', archived: false, favorite: false };
    setData((current) => ({ ...current, garments: [garment, ...current.garments] }));
  }, []);
  const updateGarment = useCallback((id: string, changes: Partial<Garment>) => {
    setData((current) => ({ ...current, garments: current.garments.map((item) => item.id === id ? { ...item, ...changes, id: item.id } : item) }));
  }, []);
  const removeGarment = useCallback((id: string) => {
    setData((current) => ({
      ...current,
      garments: current.garments.filter((item) => item.id !== id),
      looks: current.looks.map((look) => ({ ...look, garmentIds: look.garmentIds.filter((garmentId) => garmentId !== id) })),
      trips: current.trips.map((trip) => ({ ...trip, garmentIds: trip.garmentIds.filter((garmentId) => garmentId !== id) })),
    }));
  }, []);
  const addLook = useCallback((look: Omit<SavedLook, 'id' | 'createdAt'>) => {
    setData((current) => ({ ...current, looks: [{ ...look, id: createId(), createdAt: new Date().toISOString() }, ...current.looks] }));
  }, []);
  const removeLook = useCallback((id: string) => setData((current) => ({ ...current, looks: current.looks.filter((look) => look.id !== id) })), []);
  const addTrip = useCallback((trip: Omit<TripPlan, 'id'>) => setData((current) => ({ ...current, trips: [{ ...trip, id: createId() }, ...current.trips] })), []);
  const updateTrip = useCallback((id: string, changes: Partial<TripPlan>) => setData((current) => ({ ...current, trips: current.trips.map((trip) => trip.id === id ? { ...trip, ...changes, id: trip.id } : trip) })), []);
  const removeTrip = useCallback((id: string) => setData((current) => ({ ...current, trips: current.trips.filter((trip) => trip.id !== id) })), []);
  const updateProfileName = useCallback((name: string) => setData((current) => ({ ...current, profileName: name.trim().slice(0, 40) })), []);
  const clearAllData = useCallback(() => {
    const images = new Directory(Paths.document, 'wardrobe');
    if (images.exists) {
      for (const entry of images.list()) if (entry instanceof File) { try { entry.delete(); } catch { /* continue cleaning remaining local images */ } }
    }
    setStorageWritable(true);
    setData({ ...initialData, garments: [], looks: [], trips: [] });
  }, []);

  const value = useMemo(() => ({ ...data, ready, storageWarning, addGarment, updateGarment, removeGarment, addLook, removeLook, addTrip, updateTrip, removeTrip, clearAllData, updateProfileName }), [data, ready, storageWarning, addGarment, updateGarment, removeGarment, addLook, removeLook, addTrip, updateTrip, removeTrip, clearAllData, updateProfileName]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWardrobe() {
  const value = useContext(Context);
  if (!value) throw new Error('useWardrobe must be used inside WardrobeProvider');
  return value;
}

function isWardrobeData(value: unknown): value is WardrobeData {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.garments) || !Array.isArray(record.looks) || !Array.isArray(record.trips)) return false;
  if (record.profileName !== undefined && !isBoundedString(record.profileName, 0, 40)) return false;
  const categories = new Set(['Tops', 'Bottoms', 'Dresses', 'Shoes', 'Outerwear', 'Accessories']);
  const availability = new Set(['Clean', 'Dirty', 'Reserved']);
  const validGarments = record.garments.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const garment = item as Record<string, unknown>;
    return isBoundedString(garment.id, 1, 100) && isBoundedString(garment.name, 1, 48) && categories.has(String(garment.category)) && isBoundedString(garment.color, 1, 32) && isBoundedString(garment.occasion, 0, 160) && availability.has(String(garment.availability)) && typeof garment.archived === 'boolean' && typeof garment.favorite === 'boolean' && typeof garment.createdAt === 'string' && Number.isFinite(Date.parse(garment.createdAt)) && (garment.imageUri === undefined || isBoundedString(garment.imageUri, 1, 2048));
  });
  const validLooks = record.looks.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const look = item as Record<string, unknown>;
    return isBoundedString(look.id, 1, 100) && isBoundedString(look.title, 1, 80) && isBoundedString(look.occasion, 1, 80) && isBoundedString(look.explanation, 0, 500) && isStringArray(look.garmentIds, 40) && typeof look.createdAt === 'string' && Number.isFinite(Date.parse(look.createdAt));
  });
  const validTrips = record.trips.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const trip = item as Record<string, unknown>;
    return isBoundedString(trip.id, 1, 100) && isBoundedString(trip.destination, 1, 100) && isDateOnly(trip.startDate) && isDateOnly(trip.endDate) && String(trip.endDate) >= String(trip.startDate) && isBoundedString(trip.notes, 0, 180) && isStringArray(trip.garmentIds, 100);
  });
  return validGarments && validLooks && validTrips;
}

function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

function isStringArray(value: unknown, max: number): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((entry) => isBoundedString(entry, 1, 100));
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function removeLegacyStarterItems(data: WardrobeData): WardrobeData {
  const starterIds = new Set(data.garments.filter((item) => item.id.startsWith('sample-')).map((item) => item.id));
  if (!starterIds.size) return { ...data, profileName: typeof data.profileName === 'string' ? data.profileName : '' };
  const garments = data.garments.filter((item) => !starterIds.has(item.id));
  const looks = data.looks.map((look) => ({ ...look, garmentIds: look.garmentIds.filter((id) => !starterIds.has(id)) }))
    .filter((look) => look.garmentIds.length >= 2);
  const trips = data.trips.map((trip) => ({ ...trip, garmentIds: trip.garmentIds.filter((id) => !starterIds.has(id)) }));
  return { profileName: typeof data.profileName === 'string' ? data.profileName : '', garments, looks, trips };
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type { Availability };
