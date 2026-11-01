import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';

import { AppTitleStrategy } from './app-title-strategy';

@Component({ template: '' })
class Stub {}

describe('AppTitleStrategy', () => {
  function configure(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Stub, title: 'Home' },
          { path: 'untitled', component: Stub },
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
  }

  it('suffixes the route title with the application name', async () => {
    configure();
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Title).getTitle()).toBe('Home · Scaffold Starter');
  });

  it('falls back to the application name when the route has no title', async () => {
    configure();
    await RouterTestingHarness.create('/untitled');
    expect(TestBed.inject(Title).getTitle()).toBe('Scaffold Starter');
    expect(TestBed.inject(Router).url).toBe('/untitled');
  });
});
