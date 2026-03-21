import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-categories-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './categories-hero.html'
})
export class CategoriesHero {

  /**
   * Main title displayed in hero
   * Example: "All Stories" or selected category
   */
  readonly title = input<string>('All Stories');

  /**
   * Small label above title
   * Default: CURATED CONTENT
   */
  readonly label = input<string>('CURATED CONTENT');

  /**
   * Optional description/subtitle
   */
  readonly subtitle = input<string | undefined>(undefined);

}
