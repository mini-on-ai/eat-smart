export type ItemStatus = "active" | "consumed" | "discarded" | "expired";

export type ItemCategory = {
  id: number;
  name: string;
  default_shelf_life_days: number;
  icon: string | null;
  locale_aliases: string[];
};

export type Nutrition = {
  off_code: string;
  product_name: string | null;
  nutriscore_grade: string | null; // "a" .. "e"
  energy_kcal_100g: number | null;
  proteins_100g: number | null;
  carbohydrates_100g: number | null;
  sugars_100g: number | null;
  fat_100g: number | null;
  salt_100g: number | null;
  image_url: string | null;
};

export type PantryItem = {
  id: string;
  household_id: string;
  name: string;
  category_id: number | null;
  quantity: number;
  initial_quantity: number | null;
  unit: string | null;
  added_at: string;
  expires_on: string; // YYYY-MM-DD
  purchased_at: string | null; // YYYY-MM-DD
  price: number | null;
  normalized_name: string | null;
  note: string | null;
  nutrition_data: Nutrition | null;
  status: ItemStatus;
  receipt_id: string | null;
  added_by: string;
  notified_3d: boolean;
  notified_1d: boolean;
  notified_0d: boolean;
  item_categories: ItemCategory | null;
};

export type NewPantryItem = {
  name: string;
  category_id: number | null;
  quantity: number;
  unit: string | null;
  expires_on: string;
};
