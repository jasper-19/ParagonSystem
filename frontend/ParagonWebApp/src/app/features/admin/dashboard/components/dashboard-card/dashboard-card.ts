import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';

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
  //Variant-based color system for the card
  protected readonly colorClasses = computed(() => {
    switch (this.variant()) {
      case 'success':
        return {
          container:
            'border-emerald-200 bg-linear-to-br from-emerald-50 to-white',
          value: 'text-emerald-700',
          accent:
            'bg-emerald-100 text-emerald-700',
        };

      case 'info':
        return {
          container:
            'border-blue-200 bg-linear-to-br from-blue-50 to-white',
          value: 'text-blue-700',
          accent:
            'bg-blue-100 text-blue-700',
        };

      case 'warning':
        return {
          container:
            'border-amber-200 bg-linear-to-br from-amber-50 to-white',
          value: 'text-amber-700',
          accent:
            'bg-amber-100 text-amber-700',
        };

      case 'neutral':
        return {
          container:
            'border-slate-200 bg-linear-to-br from-slate-50 to-white',
          value: 'text-slate-700',
          accent:
            'bg-slate-100 text-slate-700',
        };

      default:
        return {
          container:
            'border-slate-200 bg-white',
          value: 'text-[#000035]',
          accent:
            'bg-[#000035]/5 text-[#000035]',
        };
    }
  });
}
