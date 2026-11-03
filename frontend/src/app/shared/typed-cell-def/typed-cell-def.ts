import { Directive, input } from '@angular/core';

/** `*matCellDef="let product; typedBy: products"` types the row, which Material's own leaves `any`. */
@Directive({
  // The input must share matCellDef's microsyntax prefix to be settable from `*matCellDef="…; typedBy: …"`.
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[matCellDefTypedBy]',
})
export class TypedCellDef<T> {
  readonly matCellDefTypedBy = input.required<readonly T[] | null | undefined>();

  static ngTemplateContextGuard<T>(
    _directive: TypedCellDef<T>,
    context: unknown,
  ): context is { $implicit: T } {
    return typeof context === 'object' && context !== null && '$implicit' in context;
  }
}
