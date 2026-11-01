import { Component } from '@angular/core';

import { APP_NAME } from '../../shared/app-name/app-name';

@Component({
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {
  protected readonly appName = APP_NAME;
}
