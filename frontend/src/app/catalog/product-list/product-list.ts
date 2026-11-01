import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { formatMoney } from '../../shared/money/money';
import { Product, ProductState } from '../catalog.model';
import { CatalogService } from '../catalog.service';

const CONFLICT_MESSAGES: Record<string, string> = {
  NO_PRICE: 'Add a price before publishing.',
  NOT_DRAFT: 'Only draft products can be published.',
  NOT_PUBLISHED: 'Only published products can be retired.',
};
const FALLBACK_MESSAGE = 'Something went wrong. Try again.';

const STATE_LABELS: Record<ProductState, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  RETIRED: 'Retired',
};

@Component({
  selector: 'app-product-list',
  imports: [MatAnchor, MatButton, MatTableModule, RouterLink],
  styleUrl: './product-list.scss',
  templateUrl: './product-list.html',
})
export class ProductList {
  private readonly catalog = inject(CatalogService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly products = this.catalog.products;
  protected readonly columns = ['name', 'price', 'state', 'actions'];

  protected price(product: Product): string {
    return product.priceMinor === null || product.currency === null
      ? 'No price'
      : formatMoney(product.priceMinor, product.currency);
  }

  protected stateLabel(product: Product): string {
    return STATE_LABELS[product.state];
  }

  protected publish(product: Product): void {
    this.change(this.catalog.publish(product.id));
  }

  protected retire(product: Product): void {
    this.change(this.catalog.retire(product.id));
  }

  private change(request: Observable<Product>): void {
    request.subscribe({
      error: (error: unknown) => this.snackBar.open(messageFor(error), 'Dismiss'),
    });
  }
}

function messageFor(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 409) {
    const reason: unknown = error.error?.reason;
    return typeof reason === 'string'
      ? (CONFLICT_MESSAGES[reason] ?? FALLBACK_MESSAGE)
      : FALLBACK_MESSAGE;
  }
  return FALLBACK_MESSAGE;
}
