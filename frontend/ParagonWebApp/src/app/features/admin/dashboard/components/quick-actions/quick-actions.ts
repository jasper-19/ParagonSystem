import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

export interface QuickAction {
  label: string;
  description?: string;
  icon?: string; // e.g., FontAwesome class or Material icon name
  route: string; // Router path to navigate to
}

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './quick-actions.html',
})
export class QuickActions {

  @Input({ required: true }) actions!: QuickAction[];

}
