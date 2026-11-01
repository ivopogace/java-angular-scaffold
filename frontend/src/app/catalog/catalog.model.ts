export type ProductState = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export interface Product {
  id: string;
  name: string;
  priceMinor: number | null;
  currency: string | null;
  state: ProductState;
  publishedAt: string | null;
}

/** `priceMinor` and `currency` are set together or not at all. */
export interface CreateProductRequest {
  name: string;
  priceMinor?: number;
  currency?: string;
}
