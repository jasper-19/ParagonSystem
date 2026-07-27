import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { API_ENDPOINTS } from '../config/api.config';
import {
  GeneralGlobalSettings,
  GlobalSettingsSection,
  GlobalSettingsSnapshot,
  MaintenanceGlobalSettings,
  NotificationGlobalSettings,
  PublicGlobalSettings,
  PublishingMediaGlobalSettings,
} from '../../models/global-settings.model';
import {
  GlobalSettingsUpdatedPayload,
  SocketService,
} from './socket.service';

type SectionData = {
  general: GeneralGlobalSettings;
  publishingMedia: PublishingMediaGlobalSettings;
  notifications: NotificationGlobalSettings;
  maintenance: MaintenanceGlobalSettings;
};

const SECTION_PATHS: Record<GlobalSettingsSection, string> = {
  general: 'general',
  publishingMedia: 'publishing-media',
  notifications: 'notifications',
  maintenance: 'maintenance',
};

@Injectable({ providedIn: 'root' })
export class GlobalSettingsService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly socket = inject(SocketService);
  private readonly api = API_ENDPOINTS.settings;
  private readonly state = signal<GlobalSettingsSnapshot | null>(null);
  private readonly publicState = signal<PublicGlobalSettings | null>(null);

  readonly settings = this.state.asReadonly();
  readonly publicSettings = this.publicState.asReadonly();
  private fullRefreshInFlight = false;
  private publicRefreshInFlight = false;
  private pendingFullVersion = 0;
  private pendingPublicVersion = 0;

  constructor() {
    this.socket.onGlobalSettingsUpdated(event => this.handleRemoteUpdate(event));
  }

  load(): Observable<GlobalSettingsSnapshot> {
    return this.http
      .get<GlobalSettingsSnapshot>(this.api)
      .pipe(tap(settings => this.state.set(settings)));
  }

  loadPublic(version?: number): Observable<PublicGlobalSettings> {
    const url = version
      ? `${this.api}/public?settingsVersion=${version}`
      : `${this.api}/public`;
    return this.http
      .get<PublicGlobalSettings>(url)
      .pipe(
        tap(settings => {
          this.publicState.set(settings);
          this.applyGeneralSettings(settings.general);
        }),
      );
  }

  updateSection<K extends GlobalSettingsSection>(
    section: K,
    data: SectionData[K],
    expectedVersion: number,
  ): Observable<GlobalSettingsSnapshot> {
    return this.http
      .patch<GlobalSettingsSnapshot>(`${this.api}/${SECTION_PATHS[section]}`, {
        data,
        expectedVersion,
      })
      .pipe(
        tap(settings => {
          this.state.set(settings);
          const currentPublic = this.publicState();
          if (currentPublic) {
            this.publicState.set({
              general: settings.general,
              maintenance: {
                enabled: settings.maintenance.enabled,
                message: settings.maintenance.message,
              },
              version: settings.version,
            });
          }
          this.applyGeneralSettings(settings.general);
        }),
      );
  }

  private applyGeneralSettings(settings: GeneralGlobalSettings): void {
    this.document.title = `${settings.siteName} | ${settings.organizationName}`;
    this.document.documentElement.lang = 'en';
  }

  private handleRemoteUpdate(event: GlobalSettingsUpdatedPayload): void {
    const currentPublic = this.publicState();
    if (currentPublic && currentPublic.version < event.version) {
      this.pendingPublicVersion = Math.max(this.pendingPublicVersion, event.version);
      this.refreshPublicSettings();
    }

    const current = this.state();
    if (current && current.version < event.version) {
      this.pendingFullVersion = Math.max(this.pendingFullVersion, event.version);
      this.refreshFullSettings();
    }
  }

  private refreshPublicSettings(): void {
    if (this.publicRefreshInFlight) return;
    const requestedVersion = this.pendingPublicVersion;
    this.publicRefreshInFlight = true;
    this.loadPublic(requestedVersion)
      .pipe(
        finalize(() => {
          this.publicRefreshInFlight = false;
          if ((this.publicState()?.version ?? 0) < this.pendingPublicVersion) {
            this.refreshPublicSettings();
          }
        }),
      )
      .subscribe({
        error: error => {
          this.pendingPublicVersion = this.publicState()?.version ?? 0;
          console.error('Unable to refresh public settings:', error);
        },
      });
  }

  private refreshFullSettings(): void {
    if (this.fullRefreshInFlight) return;
    this.fullRefreshInFlight = true;
    this.load()
      .pipe(
        finalize(() => {
          this.fullRefreshInFlight = false;
          if ((this.state()?.version ?? 0) < this.pendingFullVersion) {
            this.refreshFullSettings();
          }
        }),
      )
      .subscribe({
        error: error => {
          this.pendingFullVersion = this.state()?.version ?? 0;
          console.error('Unable to refresh global settings:', error);
        },
      });
  }
}
