import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { expectNoAxeViolations } from '../testing/axe';
import { App } from './app';
import { APP_NAME } from './shared/app-name/app-name';

describe('App', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders a toolbar titled with the application name', () => {
    const toolbar = render().querySelector('mat-toolbar');
    expect(toolbar?.textContent).toContain(APP_NAME);
  });

  it('hosts a router outlet', () => {
    expect(render().querySelector('router-outlet')).not.toBeNull();
  });

  it('has no accessibility violations', async () => {
    await expectNoAxeViolations(render());
  });
});
