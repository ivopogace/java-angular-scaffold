import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';

import { injectFormatMoney } from '../../shared/money/money';
import { TypedCellDef } from '../../shared/typed-cell-def/typed-cell-def';
import { Product, ProductState } from '../catalog.model';
import { CatalogService } from '../catalog.service';

const CONFLICT_MESSAGES: Record<string, string> = {
  NO_PRICE: $localize`:@@catalog.conflict.noPrice:Add a price before publishing.`,
  NOT_DRAFT: $localize`:@@catalog.conflict.notDraft:Only draft products can be published.`,
  NOT_PUBLISHED: $localize`:@@catalog.conflict.notPublished:Only published products can be retired.`,
};
const FALLBACK_MESSAGE = $localize`:@@catalog.error.generic:Something went wrong. Try again.`;
const DISMISS = $localize`:@@catalog.dismiss:Dismiss`;
const NO_PRICE = $localize`:@@catalog.list.noPrice:No price`;

const STATE_LABELS: Record<ProductState, string> = {
  DRAFT: $localize`:@@catalog.state.draft:Draft`,
  PUBLISHED: $localize`:@@catalog.state.published:Published`,
  RETIRED: $localize`:@@catalog.state.retired:Retired`,
};

@Component({
  selector: 'app-product-list',
  imports: [MatAnchor, MatButton, MatTableModule, RouterLink, TypedCellDef],
  styleUrl: './product-list.scss',
  templateUrl: './product-list.html',
})
export class ProductList {
  private readonly catalog = inject(CatalogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formatMoney = injectFormatMoney();

  private readonly inFlight = signal<ReadonlySet<string>>(new Set());

  protected readonly products = this.catalog.loadProducts();
  protected readonly columns = ['name', 'price', 'state', 'actions'];

  protected price(product: Product): string {
    return product.priceMinor === null || product.currency === null
      ? NO_PRICE
      : this.formatMoney(product.priceMinor, product.currency);
  }

  protected stateLabel(product: Product): string {
    return STATE_LABELS[product.state];
  }

  protected publishLabel(product: Product): string {
    return $localize`:@@catalog.list.publishProduct:Publish ${product.name}:name:`;
  }

  protected retireLabel(product: Product): string {
    return $localize`:@@catalog.list.retireProduct:Retire ${product.name}:name:`;
  }

  protected busy(product: Product): boolean {
    return this.inFlight().has(product.id);
  }

  protected publish(product: Product): void {
    this.change(product, this.catalog.publish(product.id));
  }

  protected retire(product: Product): void {
    this.change(product, this.catalog.retire(product.id));
  }

  /** Runs one change per product at a time, so a double click sends one request. */
  private change(product: Product, request: Observable<Product>): void {
    if (this.busy(product)) {
      return;
    }
    this.mark(product.id, true);
    request.pipe(finalize(() => this.mark(product.id, false))).subscribe({
      next: () => this.products.reload(),
      error: (error: unknown) => this.snackBar.open(messageFor(error), DISMISS),
    });
  }

  private mark(id: string, busy: boolean): void {
    this.inFlight.update((ids) => {
      const next = new Set(ids);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
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
