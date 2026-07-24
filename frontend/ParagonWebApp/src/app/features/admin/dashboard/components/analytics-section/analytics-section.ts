import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { AnalyticsMode } from '../../../../../models/dashboard-feed.model';

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
export class AnalyticsSection implements AfterViewInit, OnChanges, OnDestroy {

protected readonly Math = Math;

readonly modes: AnalyticsMode[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly'
];

  @Input() loading = false;
  @Input({ required: true }) metrics!: AnalyticsMetric[];

  @Input({ required: true }) selectedMode!: AnalyticsMode;
  @Output() modeChange = new EventEmitter<AnalyticsMode>();

  @Input({ required: true }) trendData!: {
    labels: string[];
    articles: number[];
    applications: number[];
  };

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  ngAfterViewInit(): void {
    this.initializeChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['trendData'] &&
      this.chart
    ) {
      this.updateChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }

  private initializeChart(): void {
    const canvas =
      this.chartCanvas?.nativeElement;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext('2d');

    if (!context) {
      return;
    }

    this.chart?.destroy();

    this.chart = new Chart(context, {
      type: 'line',

      data: {
        labels: this.trendData.labels,

        datasets: [
          {
            label: 'Articles',
            data: this.trendData.articles,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
          {
            label: 'Applications',
            data: this.trendData.applications,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
        ],
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
          mode: 'index',
          intersect: false,
        },

        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              padding: 16,
            },
          },

          tooltip: {
            mode: 'index',
            intersect: false,
          },
        },

        scales: {
          x: {
            grid: {
              display: false,
            },

            ticks: {
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
              maxTicksLimit: 8,
            },
          },

          y: {
            beginAtZero: true,

            ticks: {
              precision: 0,
            },

            grid: {
              drawTicks: false,
            },
          },
        },

        animation: {
          duration: 250,
        },
      },
    });
  }

  private updateChart(): void {
    if (!this.chart) {
      return;
    }

    this.chart.data.labels = [
      ...this.trendData.labels,
    ];

    this.chart.data.datasets[0].data = [
      ...this.trendData.articles,
    ];

    this.chart.data.datasets[1].data = [
      ...this.trendData.applications,
    ];

    this.chart.update('none');
  }

  getAbsoluteChange(value: number): number {
    return Math.abs(value);
  }
}
