import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { CreateProductRequest, Product } from './catalog.model';

const PRODUCTS_URL = '/api/catalog/products';

/** The catalog REST API; the product list is shared and refreshed after every change. */
@Service()
export class CatalogService {
  private readonly http = inject(HttpClient);

  readonly products = httpResource<Product[]>(() => PRODUCTS_URL);

  create(request: CreateProductRequest): Observable<Product> {
    return this.http.post<Product>(PRODUCTS_URL, request).pipe(tap(() => this.reload()));
  }

  publish(id: string): Observable<Product> {
    return this.http
      .post<Product>(`${PRODUCTS_URL}/${encodeURIComponent(id)}/publish`, null)
      .pipe(tap(() => this.reload()));
  }

  retire(id: string): Observable<Product> {
    return this.http
      .post<Product>(`${PRODUCTS_URL}/${encodeURIComponent(id)}/retire`, null)
      .pipe(tap(() => this.reload()));
  }

  reload(): void {
    this.products.reload();
  }
}
