import { Directive, input } from '@angular/core';

/**
 * Types the row of a `*matCellDef` template: `*matCellDef="let product; typedBy: products"`
 * makes `product` a `Product` for the template type checker instead of `any`. Material's own
 * cell definition carries no type, so a typo in a row expression would otherwise compile.
 */
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
