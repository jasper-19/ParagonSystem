import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

import { College } from '../models/college.model';

import { API_ENDPOINTS } from '../../../core/config/api.config';

@Injectable({
  providedIn: 'root'
})
export class CollegeService {

  private readonly apiUrl = API_ENDPOINTS.colleges;
  private http = inject(HttpClient);
  private colleges$?: Observable<College[]>;

  getColleges(): Observable<College[]> {
    if (!this.colleges$) {
      this.colleges$ = this.http.get<College[]>(this.apiUrl).pipe(shareReplay(1));
    }
    return this.colleges$;
  }
}

