import { Component } from '@angular/core';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';

import { APP_NAME } from './shared/app-name/app-name';

@Component({
  imports: [MatToolbar, RouterLink, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly appName = APP_NAME;
}
