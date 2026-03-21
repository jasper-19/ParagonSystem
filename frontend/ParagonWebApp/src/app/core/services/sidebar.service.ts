import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SidebarService {

  private readonly STORAGE_KEY = 'sidebarOpen';

  // ✅ Load initial state from localStorage
  private sidebarOpenSubject = new BehaviorSubject<boolean>(
    this.getInitialState()
  );

  sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  constructor() {
    // ✅ Persist changes automatically
    this.sidebarOpen$.subscribe(value => {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(value));
    });
  }

  toggleSidebar() {
    this.sidebarOpenSubject.next(!this.sidebarOpenSubject.value);
  }

  setSidebar(open: boolean) {
    this.sidebarOpenSubject.next(open);
  }

  get value() {
    return this.sidebarOpenSubject.value;
  }

  // ✅ Read from localStorage safely
  private getInitialState(): boolean {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  }
}
