import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-join-hero',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './join-hero.html',
})
export class JoinHero {

  // Future-ready content signals (CMS-ready pattern)
  readonly title = signal('Join Paragon');
  readonly highlight = signal('Liberate Voices, Amplify the Truth');
  readonly subtitle = signal(
    'Become part of a student-led editorial board dedicated to producing journalism that liberates voices, amplifies the truth, and creates meaningful impact on campus.'
  );

}