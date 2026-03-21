import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { AnalyticsMode } from '../../dashboard.facade';

export interface AnalyticsMetric {
  label: string;
  value: number;
  change?: number;
}

@Component({
  selector: 'app-analytics-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics-section.html',
})
export class AnalyticsSection implements AfterViewInit, OnChanges {

readonly modes: AnalyticsMode[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly'
];

  @Input({ required: true }) metrics!: AnalyticsMetric[];

  @Input({ required: true }) selectedMode!: AnalyticsMode;
  @Output() modeChange = new EventEmitter<AnalyticsMode>();

  @Input({ required: true }) trendData!: {
    labels: string[];
    articles: number[];
    applications: number[];
  };

  @Output() rangeChange = new EventEmitter<number>();

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  ngAfterViewInit(): void {
    this.initializeChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['metrics'] || changes['trendData']) && this.chart) {
      this.updateChart();
    }
  }

private initializeChart(): void {
  const ctx = this.chartCanvas.nativeElement.getContext('2d');
  if (!ctx) return;

  this.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: this.trendData.labels,
      datasets: [
        {
          label: 'Articles',
          data: this.trendData.articles,
          tension: 0.4,
          borderWidth: 2
        },
        {
          label: 'Applications',
          data: this.trendData.applications,
          tension: 0.4,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

private updateChart(): void {
  if (!this.chart) return;

  this.chart.data.labels = this.trendData.labels;
  this.chart.data.datasets[0].data = this.trendData.articles;
  this.chart.data.datasets[1].data = this.trendData.applications;

  this.chart.update();
}

  private generateLabels(days: number): string[] {
    const interval = days === 7 ? 1 : days === 30 ? 5 : 10;
    return Array.from({ length: days / interval }, (_, i) =>
      `Day ${i * interval + 1}`
    );
  }

  // Temporary mock trend generator
  // Later this should come from backend aggregation
  private generateMockTrend(total: number): number[] {
    const points = 6;
    const base = total / points;

    return Array.from({ length: points }, () =>
      Math.round(base + Math.random() * base * 0.6)
    );
  }
}
