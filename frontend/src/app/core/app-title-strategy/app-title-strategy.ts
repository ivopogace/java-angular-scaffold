import { inject, Service } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { APP_NAME } from '../../shared/app-name/app-name';

/** Document title: `"<route title> · <APP_NAME>"`, or the application name alone. */
@Service()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    this.title.setTitle(routeTitle ? `${routeTitle} · ${APP_NAME}` : APP_NAME);
  }
}
