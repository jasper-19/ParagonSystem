import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class LocationService {
  readonly city = signal<string | null>(null);
  readonly coords = signal<{ latitude: number; longitude: number } | null>(null);

  constructor(private http: HttpClient) {}

  detectLocation() {
    if (!navigator.geolocation) {
      this.city.set('Location off');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);

        if (isNaN(latitude) || isNaN(longitude)) {
          this.city.set('Unknown');
          return;
        }

        // Save coords to signal
        this.coords.set({ latitude, longitude });

        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
        this.http.get<any>(url).subscribe({
          next: res => {
            const city = res.address?.city || res.address?.town || res.address?.village || 'Unknown';
            this.city.set(city);
          },
          error: () => this.city.set('Unknown')
        });
      },
      (error) => {
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
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }
}
