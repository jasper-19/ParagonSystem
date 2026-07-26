import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

type Coords = {
  latitude: number;
  longitude: number;
};

type CachedLocation = {
  city: string;
  coords: Coords;
  savedAt: number;
};

@Injectable({ providedIn: 'root' })
export class LocationService {
  readonly city = signal<string | null>(null);
  readonly coords = signal<Coords | null>(null);
  readonly isDetecting = signal(false);

  private readonly CACHE_KEY = 'paragon_user_location';
  private readonly CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

  constructor(private http: HttpClient) {}

  detectLocation(force = false): void {
    if (this.isDetecting()) return;

    if (!force && this.loadCachedLocation()) {
      return;
    }

    if (!navigator.geolocation) {
      this.city.set('Location off');
      return;
    }

    this.isDetecting.set(true);

    navigator.geolocation.getCurrentPosition(
      position => {
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          this.city.set('Unknown');
          this.isDetecting.set(false);
          return;
        }

        const coords = {
          latitude: Math.round(latitude * 100) / 100,
          longitude: Math.round(longitude * 100) / 100,
        };
        this.coords.set(coords);

        const url =
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
          `&lat=${latitude}&lon=${longitude}`;

        this.http.get<any>(url).subscribe({
          next: res => {
            const address = res.address ?? {};

            const city =
              address.city ||
              address.municipality ||
              address.town ||
              address.village ||
              address.county ||
              address.state ||
              'Unknown';

            this.city.set(city);
            this.saveCachedLocation(city, coords);
            this.isDetecting.set(false);
          },
          error: () => {
            this.city.set('Unknown');
            this.isDetecting.set(false);
          },
        });
      },
      error => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            this.city.set('Location denied');
            break;
          case error.POSITION_UNAVAILABLE:
            this.city.set('Position unavailable');
            break;
          case error.TIMEOUT:
            this.city.set('Location timeout');
            break;
          default:
            this.city.set('Unknown');
        }

        this.isDetecting.set(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 1000 * 60 * 30,
      }
    );
  }

  clearLocation(): void {
    sessionStorage.removeItem(this.CACHE_KEY);
    this.city.set(null);
    this.coords.set(null);
  }

  private loadCachedLocation(): boolean {
    const raw = sessionStorage.getItem(this.CACHE_KEY);
    if (!raw) return false;

    try {
      const cached = JSON.parse(raw) as CachedLocation;
      const isExpired = Date.now() - cached.savedAt > this.CACHE_DURATION;

      if (isExpired) return false;

      this.city.set(cached.city);
      this.coords.set(cached.coords);

      return true;
    } catch {
      sessionStorage.removeItem(this.CACHE_KEY);
      return false;
    }
  }

  private saveCachedLocation(city: string, coords: Coords): void {
    const data: CachedLocation = {
      city,
      coords,
      savedAt: Date.now(),
    };

    sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
  }
}
