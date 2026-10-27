export type VehicleCategory = "cars" | "motorcycles" | "trucks";

export interface FipePriceHistory {
  month: string;
  price: string;
  reference: string;
}

export interface FipeVehicle {
  id: string;
  category: VehicleCategory;
  yearCode: string;
  brand: string;
  model: string;
  codeFipe: string;
  fuel: string;
  fuelAcronym: string;
  modelYear: number;
  price: string;
  priceValue: number;
  referenceMonth: string;
  referenceCode: string;
}

export interface VehicleFilters {
  query: string;
  minPrice: number | null;
  maxPrice: number | null;
  category?: VehicleCategory | "all";
  brand?: string;
  model?: string;
  modelYear?: number | null;
}
