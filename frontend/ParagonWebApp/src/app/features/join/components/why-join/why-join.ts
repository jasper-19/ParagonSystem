import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface JoinBenefit {
  title: string;
  description: string;
}

@Component({
  selector: 'app-join-why',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './why-join.html',
})
export class WhyJoin {

  readonly sectionTitle = signal('Why Join Paragon');

  readonly benefits = signal<JoinBenefit[]>([
    {
      title: 'Report on Campus Life',
      description:
        'Cover events, initiatives, and stories that shape CSU Gonzaga. Gain hands-on experience reporting, interviewing, and documenting the student experience from the ground up.',
    },
    {
      title: 'Collaborate in a Real with Peers',
      description:
        'Work alongside student writers, editors, photographers, and designers. Pitch ideas, edit articles, and contribute to special issues.',
    },
    {
      title: 'Tell Stories That Matter',
      description:
        'Bring attention to issues, achievements, and voices across campus. Your work helps inform, inspire, and spark conversation within the student community.',
    },
  ]);

}