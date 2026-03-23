import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// =====================================================
// LocationService
// - Provides geolocation detection using the browser API
// - Exposes `city` and `coords` as signals for consumers
// - Uses OpenStreetMap Nominatim reverse geocoding to resolve city names
// =====================================================

@Injectable({ providedIn: 'root' })
export class LocationService {
  // ----- Public signals (state) -----
  // `city` holds the detected city name or status messages
  readonly city = signal<string | null>(null);

  // `coords` holds the numeric latitude/longitude once detected
  readonly coords = signal<{ latitude: number; longitude: number } | null>(null);

  // ----- Dependencies -----
  // `HttpClient` used only for reverse geocoding lookup
  constructor(private http: HttpClient) {}

  // =====================================================
  // Public API: detectLocation()
  // - Attempts to use the browser geolocation API
  // - Writes status strings to `city` for consumer feedback
  // - Populates `coords` with numeric latitude/longitude on success
  // - Performs a reverse geocode lookup to obtain a readable city name
  // =====================================================
  detectLocation() {
    // If the browser does not support geolocation, set status and exit
    if (!navigator.geolocation) {
      this.city.set('Location off');
      return;
    }

    // Request the current position from the browser
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // ---- Parse coordinates ----
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);

        // Validate numeric parsing
        if (isNaN(latitude) || isNaN(longitude)) {
          // If coordinates are not valid numbers, set unknown state
          this.city.set('Unknown');
          return;
        }

        // Save coords to signal for consumers interested in raw coords
        this.coords.set({ latitude, longitude });

        // ---- Reverse geocode to obtain city/town/village name ----
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
        this.http.get<any>(url).subscribe({
          next: res => {
            // Prefer `city`, then `town`, then `village`, otherwise 'Unknown'
            const city = res.address?.city || res.address?.town || res.address?.village || 'Unknown';
            this.city.set(city);
          },
          // On any HTTP error, set a safe unknown state
          error: () => this.city.set('Unknown')
        });
      },
      (error) => {
        // =====================================================
        // Error handling for geolocation request
        // - Map browser error codes to friendly status messages
        // =====================================================
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
      },
      // Options: prefer high accuracy but keep a reasonable timeout
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }
}
