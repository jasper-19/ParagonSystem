import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';

export type QuickActionIcon =
  | 'square-pen'
  | 'file-up'
  | 'clipboard-check'
  | 'images';

export interface QuickAction {
  label: string;
  description?: string;
  icon: QuickActionIcon;
  route: string;
}

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
  ],
  templateUrl: './quick-actions.html',
})
export class QuickActions {
  readonly actions =
    input.required<QuickAction[]>();
}
