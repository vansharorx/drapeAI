import { Garment, WardrobeData } from './types';

export const initialData: WardrobeData = {
  profileName: '',
  garments: [],
  looks: [],
  trips: [],
};

export const categoryColors: Record<Garment['category'], string> = {
  Tops: '#D7C7B0', Bottoms: '#7185A0', Dresses: '#413E44', Shoes: '#A57756', Outerwear: '#41536A', Accessories: '#B6A16E',
};
