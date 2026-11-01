import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { expectNoAxeViolations } from '../../../testing/axe';
import { NotFound } from './not-found';

describe('NotFound', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NotFound);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says the page was not found', () => {
    expect(render().querySelector('h1')?.textContent).toContain('Page not found');
  });

  it('links back to the home page', () => {
    const link = render().querySelector('a');
    expect(link?.getAttribute('href')).toBe('/');
  });

  it('has no accessibility violations', async () => {
    await expectNoAxeViolations(render());
  });
});
