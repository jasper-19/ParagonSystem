import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Header } from '../../core/layout/header/header';
import { Footer } from '../../core/layout/footer/footer';
import { LoaderComponent } from '../../shared/components/loader/loader';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, Header, Footer, LoaderComponent],
  templateUrl: './public-layout.html',
})
export class PublicLayout {}