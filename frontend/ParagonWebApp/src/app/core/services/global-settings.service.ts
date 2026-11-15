import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, tap, throwError } from 'rxjs';
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
  private readonly destroyRef = inject(DestroyRef);
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
    const removeUpdateListener = this.socket.onGlobalSettingsUpdated(event => this.handleRemoteUpdate(event));
    const removeConnectListener = this.socket.on<void>('connect', () => {
      // Recover invalidations missed while the transport was disconnected.
      if (this.publicState()) this.refreshPublicSettings();
      if (this.state()) this.refreshFullSettings();
    });
    this.destroyRef.onDestroy(() => {
      removeUpdateListener?.();
      removeConnectListener?.();
    });
  }

  load(): Observable<GlobalSettingsSnapshot> {
    return this.http
      .get<GlobalSettingsSnapshot>(this.api)
      .pipe(tap(settings => this.acceptSnapshot(settings)));
  }

  loadPublic(version?: number): Observable<PublicGlobalSettings> {
    version ??= this.publicState() ? this.publicState()!.version + 1 : undefined;
    const url = version
      ? `${this.api}/public?settingsVersion=${version}`
      : `${this.api}/public`;
    return this.http
      .get<PublicGlobalSettings>(url)
      .pipe(
        tap(settings => {
          this.acceptPublic(settings);
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
          this.acceptSnapshot(settings);
        }),
        catchError(error => {
          // Keep dirty forms intact while exposing a fresh snapshot for the
          // existing "Load latest" action after an optimistic-lock conflict.
          if (error.status === 409) this.refreshFullSettings();
          return throwError(() => error);
        }),
      );
  }

  private acceptSnapshot(settings: GlobalSettingsSnapshot): void {
    if (settings.version < (this.state()?.version ?? 0)) return;
    this.state.set(settings);
    this.acceptPublic({
      general: settings.general,
      maintenance: {
        enabled: settings.maintenance.enabled,
        message: settings.maintenance.message,
      },
      version: settings.version,
    });
  }

  private acceptPublic(settings: PublicGlobalSettings): void {
    if (settings.version < (this.publicState()?.version ?? 0)) return;
    this.publicState.set(settings);
    this.applyGeneralSettings(settings.general);
  }

  private applyGeneralSettings(settings: GeneralGlobalSettings): void {
    this.document.title = `${settings.siteName} | ${settings.organizationName}`;
    this.document.documentElement.lang = 'en';
  }

  private handleRemoteUpdate(event: GlobalSettingsUpdatedPayload): void {
    const currentPublic = this.publicState();
    if (!currentPublic || currentPublic.version < event.version) {
      this.pendingPublicVersion = Math.max(this.pendingPublicVersion, event.version);
      this.refreshPublicSettings();
    }

    const current = this.state();
    if (current && current.version < event.version) {
      this.pendingFullVersion = Math.max(this.pendingFullVersion, event.version);
      this.refreshFullSettings();
    }
  }

  private refreshPublicSettings(retryStale = true): void {
    if (this.publicRefreshInFlight) return;
    const requestedVersion = this.pendingPublicVersion;
    let succeeded = false;
    this.publicRefreshInFlight = true;
    this.loadPublic(requestedVersion || undefined)
      .pipe(
        tap(() => succeeded = true),
        finalize(() => {
          this.publicRefreshInFlight = false;
          // Follow a newer event or retry one stale response, without looping
          // indefinitely against a lagging server.
          if (requestedVersion < this.pendingPublicVersion ||
            (succeeded && retryStale && (this.publicState()?.version ?? 0) < requestedVersion)) {
            this.refreshPublicSettings(false);
          }
        }),
      )
      .subscribe({
        error: error => {
          console.error('Unable to refresh public settings:', error);
        },
      });
  }

  private refreshFullSettings(retryStale = true): void {
    if (this.fullRefreshInFlight) return;
    const requestedVersion = this.pendingFullVersion;
    let succeeded = false;
    this.fullRefreshInFlight = true;
    this.load()
      .pipe(
        tap(() => succeeded = true),
        finalize(() => {
          this.fullRefreshInFlight = false;
          if (requestedVersion < this.pendingFullVersion ||
            (succeeded && retryStale && (this.state()?.version ?? 0) < requestedVersion)) {
            this.refreshFullSettings(false);
          }
        }),
      )
      .subscribe({
        error: error => {
          console.error('Unable to refresh global settings:', error);
        },
      });
  }
}
