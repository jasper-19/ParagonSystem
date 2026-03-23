import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// =====================================================
// SidebarService
// - Manages sidebar open/closed state
// - Persists state to localStorage under `sidebarOpen`
// - Exposes an Observable `sidebarOpen$` for UI consumers
// =====================================================

@Injectable({ providedIn: 'root' })
export class SidebarService {

  // ----- Storage key -----
  private readonly STORAGE_KEY = 'sidebarOpen';

  // ----- Internal subject holding current state -----
  // Load initial state from localStorage (or default to `true`)
  private sidebarOpenSubject = new BehaviorSubject<boolean>(this.getInitialState());

  // ----- Public observable for components to subscribe to -----
  sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  constructor() {
    // Persist changes automatically: subscribe and write to localStorage
    this.sidebarOpen$.subscribe(value => {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(value));
    });
  }

  // Toggle the sidebar state (open <-> closed)
  toggleSidebar() {
    this.sidebarOpenSubject.next(!this.sidebarOpenSubject.value);
  }

  // Explicitly set the sidebar state
  setSidebar(open: boolean) {
    this.sidebarOpenSubject.next(open);
  }

  // Synchronous getter for current value
  get value() {
    return this.sidebarOpenSubject.value;
  }

  // Read initial state from localStorage safely; default to true
  private getInitialState(): boolean {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  }
}
