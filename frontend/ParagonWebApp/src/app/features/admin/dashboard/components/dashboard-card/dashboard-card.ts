import { CommonModule } from '@angular/common';
import { Component, computed, Input } from '@angular/core';

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

  @Input({ required: true }) title!: string;
  @Input({ required: true }) value!: number | string;

  @Input() subtitle?: string;
  @Input() variant: DashboardCardVariant = 'default';

  //Variant-based color system for the card
  protected readonly colorClasses = computed(() => {
    switch (this.variant) {
      case 'default':
        return {
          value: 'text-green-600',
          accent: 'bg-green-100  text-green-600',
        };
      case 'success':
        return {
          value: 'text-emerald-600',
          accent: 'bg-emerald-100 text-emerald-700',
        };
      case 'info':
        return {
          value: 'text-blue-600',
          accent: 'bg-blue-100 text-blue-600',
        };
      case 'warning':
        return {
          value: 'text-yellow-600',
          accent: 'bg-yellow-100 text-yellow-600',
        };
          case 'neutral':
          return {
            value: 'text-gray-600',
            accent: 'bg-gray-100 text-gray-600',
          };
        default:
          return {
            value: 'text-gray-600',
            accent: 'bg-gray-100 text-gray-600',
          };
    }
  })
}
