import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

import { College } from '../models/college.model';

@Injectable({
  providedIn: 'root'
})
export class CollegeService {

  private readonly apiUrl = '/api/colleges';
  private http = inject(HttpClient);
  private colleges$?: Observable<College[]>;

  getColleges(): Observable<College[]> {
    if (!this.colleges$) {
      this.colleges$ = this.http.get<College[]>(this.apiUrl).pipe(shareReplay(1));
    }
    return this.colleges$;
  }
}

