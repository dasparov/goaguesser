export interface CuratorDot {
  id: string;
  lat: number;
  lng: number;
}

export interface BasketSpot {
  imageId: string;
  name: string;
  lat: number;
  lng: number;
}

export type FetchStatus = 'zoom-in' | 'loading' | 'ready' | 'error';
