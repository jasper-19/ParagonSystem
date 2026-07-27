import { Component } from '@angular/core';
import { ScrollRevealDirective } from '../../scroll-reveal.directive';

@Component({
  selector: 'app-welcome-banner',
  standalone: true,
  imports: [ScrollRevealDirective],
  templateUrl: './welcome-banner.html',
})
export class WelcomeBanner {}
