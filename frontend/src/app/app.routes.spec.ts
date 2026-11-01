import { isStandalone } from '@angular/core';

import { routes } from './app.routes';

describe('routes', () => {
  const lazy = routes.filter((route) => route.loadComponent);

  it('declares at least one lazy route', () => {
    expect(lazy.length).toBeGreaterThan(0);
  });

  it.each(lazy.map((route) => [route.path ?? '', route] as const))(
    'resolves "%s" to a component class',
    async (_path, route) => {
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(typeof component).toBe('function');
      expect(isStandalone(component as never)).toBe(true);
    },
  );

  it('gives every route a title', () => {
    for (const route of routes) {
      expect(route.title, `route "${route.path}"`).toBeTruthy();
    }
  });
});
