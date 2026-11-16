export type Category = 'Tops' | 'Bottoms' | 'Dresses' | 'Shoes' | 'Outerwear' | 'Accessories';
export type Availability = 'Clean' | 'Dirty' | 'Reserved';

export type Garment = {
  id: string;
  name: string;
  category: Category;
  color: string;
  occasion: string;
  imageUri?: string;
  availability: Availability;
  archived: boolean;
  favorite: boolean;
  createdAt: string;
};

export type SavedLook = {
  id: string;
  title: string;
  occasion: string;
  garmentIds: string[];
  explanation: string;
  createdAt: string;
};

export type TripPlan = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  notes: string;
  garmentIds: string[];
};

export type WardrobeData = {
  profileName: string;
  garments: Garment[];
  looks: SavedLook[];
  trips: TripPlan[];
};
