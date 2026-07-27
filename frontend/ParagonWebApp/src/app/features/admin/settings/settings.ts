import {
  ChangeDetectionStrategy,
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  QueryList,
  ViewChildren,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { GeneralSettingsComponent } from './tabs/general-settings/general-settings';
import { UsersSettingsComponent } from './tabs/users-settings/users-settings';
import { PublishingMediaSettingsComponent } from './tabs/publishing-media-settings/publishing-media-settings';
import { NotificationSettingsComponent } from './tabs/notification-settings/notification-settings';
import { MaintenanceSettingsComponent } from './tabs/maintenance-settings/maintenance-settings';
import { GlobalSettingsService } from '../../../core/services/global-settings.service';

type SettingsTab =
  | 'general'
  | 'publishing-media'
  | 'notifications'
  | 'maintenance'
  | 'users';

interface SettingsTabDefinition {
  id: SettingsTab;
  label: string;
  description: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    GeneralSettingsComponent,
    UsersSettingsComponent,
    PublishingMediaSettingsComponent,
    NotificationSettingsComponent,
    MaintenanceSettingsComponent,
  ],
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly settingsService = inject(GlobalSettingsService);

  readonly tabs: SettingsTabDefinition[] = [
    {
      id: 'general',
      label: 'General',
      description: 'Identity and localization',
    },
    {
      id: 'publishing-media',
      label: 'Publishing & Media',
      description: 'Workflow and upload policy',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'System-wide event alerts',
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      description: 'Availability controls',
    },
    {
      id: 'users',
      label: 'User Accounts',
      description: 'Administrative access',
    },
  ];

  readonly activeTab = signal<SettingsTab>('general');
  readonly loading = signal(true);
  readonly loadError = signal('');
  @ViewChildren('settingsTab')
  private tabButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const requested = params.get('tab') as SettingsTab | null;
        this.activeTab.set(
          this.tabs.some(tab => tab.id === requested) ? requested! : 'general',
        );
        queueMicrotask(() => this.scrollActiveTabIntoView());
      });
    this.loadSettings();
  }

  ngAfterViewInit(): void {
    this.scrollActiveTabIntoView();
  }

  setTab(tab: SettingsTab): void {
    if (this.activeTab() === tab) return;
    void this.router.navigate(['/admin/settings', tab]);
  }

  tabKeydown(event: KeyboardEvent, currentTab: SettingsTab): void {
    const currentIndex = this.tabs.findIndex(tab => tab.id === currentTab);
    let targetIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      targetIndex = (currentIndex + 1) % this.tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      targetIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = this.tabs.length - 1;
    }

    if (targetIndex === null) return;
    event.preventDefault();
    const target = this.tabs[targetIndex];
    this.setTab(target.id);
    this.tabButtons.get(targetIndex)?.nativeElement.focus();
  }

  loadSettings(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.settingsService
      .load()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        error: error => {
          console.error('Unable to load global settings:', error);
          this.loadError.set(
            'Global settings could not be loaded. Check the server connection and try again.',
          );
        },
      });
  }

  private scrollActiveTabIntoView(): void {
    const index = this.tabs.findIndex(tab => tab.id === this.activeTab());
    this.tabButtons?.get(index)?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }
}
