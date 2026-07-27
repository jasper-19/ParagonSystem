import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../config/api.config';
import {
  CreateAdminAccount,
  EligibleAdminStaff,
  ManagedUserAccount,
} from '../../models/user-account.model';

@Injectable({ providedIn: 'root' })
export class UserAccountsService {
  private readonly http = inject(HttpClient);
  private readonly api = API_ENDPOINTS.users;

  list(): Observable<ManagedUserAccount[]> {
    return this.http.get<ManagedUserAccount[]>(this.api);
  }

  listEligibleStaff(): Observable<EligibleAdminStaff[]> {
    return this.http.get<EligibleAdminStaff[]>(`${this.api}/eligible-staff`);
  }

  createAdmin(input: CreateAdminAccount): Observable<ManagedUserAccount> {
    return this.http.post<ManagedUserAccount>(this.api, input);
  }

  setActive(id: string, isActive: boolean): Observable<ManagedUserAccount> {
    return this.http.patch<ManagedUserAccount>(`${this.api}/${id}`, { isActive });
  }
}

