import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { expectNoAxeViolations } from '../../../testing/axe';
import { Home } from './home';

describe('Home', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the application name as its heading', () => {
    expect(render().querySelector('h1')?.textContent).toContain('Scaffold Starter');
  });

  it('has no accessibility violations', async () => {
    await expectNoAxeViolations(render());
  });
});
