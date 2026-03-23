import { interval, map, switchMap, startWith, combineLatest, filter, catchError, EMPTY } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { Injectable, inject, Injector } from "@angular/core";
import { LocationService } from "./location.service";
import { toObservable } from "@angular/core/rxjs-interop";

// =====================================================
// TemperatureService
// - Emits current temperature for the user's coordinates
// - Uses `LocationService.coords` (Angular Signal) converted to an Observable
// - Polls the weather API every 60s (with an immediate start)
// - On API error, skips the current tick silently and logs the error
// =====================================================
@Injectable({
  providedIn: 'root'
})
export class TemperatureService {
  // Inject HttpClient and LocationService using Angular's inject() helper
  private http = inject(HttpClient);
  private locationService = inject(LocationService);
  private injector = inject(Injector);

  // Public helper that returns an Observable<number | null>
  // - Emits the latest temperature value from the open-meteo API
  // - Emits `null` if the response does not contain temperature
  getTemperature() {
    return combineLatest([
      // Convert the LocationService.coords signal into an Observable
      toObservable(this.locationService.coords, { injector: this.injector }).pipe(
        // Only continue when coords are present (non-null)
        filter((coords): coords is { latitude: number; longitude: number } => coords !== null)
      ),

      // Poll every 60 seconds; start immediately with `startWith(0)`
      interval(60000).pipe(startWith(0))
    ]).pipe(
      // For each tick (and coordinate), call the weather API
      switchMap(([coords]) => {
        const lat = coords.latitude;
        const lon = coords.longitude;
        const url =
          'https://api.open-meteo.com/v1/forecast?latitude=' +
          lat +
          '&longitude=' +
          lon +
          '&current_weather=true';

        return this.http.get<any>(url).pipe(
          catchError((err) => {
            // Log the error and skip this tick by returning EMPTY
            console.error('Temperature API error:', err);
            return EMPTY; // skip this interval tick on error
          })
        );
      }),

      // Map the API response to the numeric temperature value (or null)
      map((res) => res?.current_weather?.temperature ?? null)
    );
  }
}
