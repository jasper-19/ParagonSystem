import { interval, map, switchMap, startWith, combineLatest, filter, catchError, EMPTY } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { Injectable, inject, Injector } from "@angular/core";
import { LocationService } from "./location.service";
import { toObservable } from "@angular/core/rxjs-interop";

@Injectable({
  providedIn: 'root'
})
export class TemperatureService {
  private http = inject(HttpClient);
  private locationService = inject(LocationService);
  private injector = inject(Injector);

  getTemperature() {
    return combineLatest([
      toObservable(this.locationService.coords, { injector: this.injector }).pipe(
        filter((coords): coords is { latitude: number; longitude: number } => coords !== null)
      ),
      interval(60000).pipe(startWith(0))
    ]).pipe(
      switchMap(([coords]) => {
        const lat = coords.latitude;
        const lon = coords.longitude;
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current_weather=true';
        return this.http.get<any>(url).pipe(
          catchError((err) => {
            console.error('Temperature API error:', err);
            return EMPTY; // skip this interval tick on error
          })
        );
      }),
      map((res) => res?.current_weather?.temperature ?? null)
    );
  }
}
