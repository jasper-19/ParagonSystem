import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-join-final-cta',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './join-final-cta.html',
})
export class JoinFinalCta {

  readonly title = signal('Ready to Make an Impact?');

  readonly subtitle = signal(
    'Join a publication that liberates voices, amplifies the truth, and shapes the narrative of our generation.'
  );

}
