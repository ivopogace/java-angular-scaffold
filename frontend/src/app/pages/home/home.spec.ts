import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { expectNoAxeViolations } from '../../../testing/axe';
import { APP_NAME } from '../../shared/app-name/app-name';
import { Home } from './home';

describe('Home', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the application name as its heading', async () => {
    expect((await render()).querySelector('h1')?.textContent).toContain(APP_NAME);
  });

  it('has no accessibility violations', async () => {
    await expectNoAxeViolations(await render());
  });
});
