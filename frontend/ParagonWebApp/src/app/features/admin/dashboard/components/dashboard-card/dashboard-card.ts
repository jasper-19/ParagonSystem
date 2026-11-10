import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

export type DashboardCardVariant =
| 'default'
| 'info'
| 'warning'
| 'success'
| 'neutral';

@Component({
  selector: 'app-dashboard-card',
  imports: [CommonModule],
  templateUrl: './dashboard-card.html',
})
export class DashboardCard {
  readonly title = input.required<string>();
  readonly value = input.required<number | string>();

  readonly subtitle = input<string | undefined>();
  readonly variant =
    input<DashboardCardVariant>('default');
}
