import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, validate } from '@angular/forms/signals';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { parseMoneyToMinor } from '../../shared/money/money';
import { CreateProductRequest } from '../catalog.model';
import { CatalogService } from '../catalog.service';

const NAME_MAX_LENGTH = 120;
const CURRENCY = 'EUR';

@Component({
  selector: 'app-product-form',
  imports: [
    FormField,
    FormRoot,
    MatAnchor,
    MatButton,
    MatError,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
    RouterLink,
  ],
  styleUrl: './product-form.scss',
  templateUrl: './product-form.html',
})
export class ProductForm {
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  private readonly model = signal({ name: '', price: '' });

  protected readonly productForm = form(
    this.model,
    (path) => {
      validate(path.name, ({ value }) => {
        const name = value().trim();
        if (name === '') {
          return {
            kind: 'required',
            message: $localize`:@@catalog.form.name.required:Enter a name.`,
          };
        }
        return name.length > NAME_MAX_LENGTH
          ? {
              kind: 'maxLength',
              message: $localize`:@@catalog.form.name.maxLength:Use at most ${NAME_MAX_LENGTH}:max: characters.`,
            }
          : undefined;
      });
      validate(path.price, ({ value }) => {
        const price = value().trim();
        return price === '' || parseMoneyToMinor(price) !== null
          ? undefined
          : {
              kind: 'amount',
              message: $localize`:@@catalog.form.price.invalid:Enter an amount such as 12.50.`,
            };
      });
    },
    { submission: { action: () => this.save() } },
  );

  private async save(): Promise<undefined> {
    try {
      await firstValueFrom(this.catalog.create(this.request()));
    } catch {
      this.snackBar.open(
        $localize`:@@catalog.form.saveFailed:Could not save the product. Try again.`,
        $localize`:@@catalog.dismiss:Dismiss`,
      );
      return;
    }
    await this.router.navigateByUrl('/catalog');
  }

  private request(): CreateProductRequest {
    const { name, price } = this.model();
    const priceMinor = parseMoneyToMinor(price);
    return priceMinor === null
      ? { name: name.trim() }
      : { name: name.trim(), priceMinor, currency: CURRENCY };
  }
}
