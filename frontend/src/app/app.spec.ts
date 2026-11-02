import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { expectNoAxeViolations } from '../testing/axe';
import { App } from './app';
import { APP_NAME } from './shared/app-name/app-name';

describe('App', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders a toolbar titled with the application name', async () => {
    const toolbar = (await render()).querySelector('mat-toolbar');
    expect(toolbar?.textContent).toContain(APP_NAME);
  });

  it('hosts a router outlet', async () => {
    expect((await render()).querySelector('router-outlet')).not.toBeNull();
  });

  it('has no accessibility violations', async () => {
    await expectNoAxeViolations(await render());
  });
});
