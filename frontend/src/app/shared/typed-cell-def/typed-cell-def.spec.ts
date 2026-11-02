import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTableModule } from '@angular/material/table';

import { TypedCellDef } from './typed-cell-def';

interface Row {
  name: string;
}

@Component({
  imports: [MatTableModule, TypedCellDef],
  template: `
    <table mat-table [dataSource]="rows">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Name</th>
        <td mat-cell *matCellDef="let row; typedBy: rows">{{ row.name.toUpperCase() }}</td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="['name']"></tr>
      <tr mat-row *matRowDef="let row; columns: ['name']"></tr>
    </table>
  `,
})
class Host {
  readonly rows: Row[] = [{ name: 'Mug' }, { name: 'Poster' }];
}

describe('TypedCellDef', () => {
  it('leaves the cell template rendering as before while typing its row', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const cells = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('td')).map(
      (cell) => cell.textContent?.trim(),
    );
    expect(cells).toEqual(['MUG', 'POSTER']);
  });
});
