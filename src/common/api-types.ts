export type Event = {
  id: number;
  createdBy: number;
  live_public: boolean;
  live: string[];
  stat: {
    participants: {
      count: number;
      list: { id: number; name: string; photo: string | null }[];
    };
  };
  themes: {
    id: number;
    name: string;
    visible: boolean;
    keywords: string[];
    photo: { url: string | null };
  }[];
  type: { id: number; name: string };
  info: string | null;
  moderation: string;
  status: string;
  access: string;
  full_info: string;
  full_name: string;
  date_start: string;
  date_end: string;
  format: string;
  space?: {
    id: number;
    name: string;
    email: string;
    phone: string;
    agenda: string[];
    photos: { full: string }[];
    address: {
      city: string;
      region: string;
      country: string;
      street: string;
      house: string;
      post_code: string;
      geo_point: string;
    };
  };
  halls?: {
    id: number;
    name: string;
    capacity: number;
    type: string;
    square: string | null;
    photos: { full: string }[];
  }[];
  photo: string;
  photo_180: string;
  photo_360: string;
  photo_520: string;
  timezone: { value: string; minutes: number };
  needStartNotification: boolean;
  delivered: boolean;
  registration_date_start: string;
  registration_date_end: string;
  is_competition: boolean;
  indexedAt: number;
  isFavorite: boolean;
  isLive: boolean;
  city: string;
  city_id: number;
  hash_tags: string[];
};
