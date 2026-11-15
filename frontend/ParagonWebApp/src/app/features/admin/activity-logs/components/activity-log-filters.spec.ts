import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ActivityLogFiltersComponent } from './activity-log-filters';

describe('Activity log filter interactions', () => {
  let fixture: ComponentFixture<ActivityLogFiltersComponent>;
  let component: ActivityLogFiltersComponent;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ActivityLogFiltersComponent] }).compileComponents();
    fixture = TestBed.createComponent(ActivityLogFiltersComponent); component = fixture.componentInstance;
    fixture.componentRef.setInput('modules', ['ARTICLES']); fixture.componentRef.setInput('actions', ['UPDATE']);
    fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('shows readable labels while submitting the original API filter codes', async () => {
    fixture.componentRef.setInput('modules', ['SYSTEM_SETTINGS', 'MEDIA', 'AUTH', 'STAFF']);
    fixture.componentRef.setInput('actions', ['LOGOUT_SESSION', 'REPLACE_PDF', 'AUTHENTICATION_FAILED']);
    fixture.detectChanges(); await fixture.whenStable();
    const module = fixture.nativeElement.querySelector('select[name="module"]') as HTMLSelectElement;
    const action = fixture.nativeElement.querySelector('select[name="action"]') as HTMLSelectElement;
    expect(Array.from(module.options).map(option => option.textContent?.trim())).toEqual([
      'All modules', 'System settings', 'Media library', 'Authentication', 'Staff directory',
    ]);
    expect(Array.from(action.options).map(option => option.textContent?.trim())).toEqual([
      'All actions', 'Session signed out', 'PDF replaced', 'Authentication failed',
    ]);
    const change = vi.fn(); component.filtersChange.subscribe(change);
    module.value = 'SYSTEM_SETTINGS'; module.dispatchEvent(new Event('change', { bubbles: true }));
    action.value = 'LOGOUT_SESSION'; action.dispatchEvent(new Event('change', { bubbles: true }));
    expect(change).toHaveBeenLastCalledWith({ module: 'SYSTEM_SETTINGS', action: 'LOGOUT_SESSION', dateFrom: undefined, search: undefined });
  });

  it('debounces and trims typed search while preserving selected filters', async () => {
    vi.useFakeTimers(); const change = vi.fn(); component.filtersChange.subscribe(change);
    component.filters.module = 'ARTICLES'; component.filters.action = 'UPDATE';
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = ' sample '; input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(299); expect(change).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(change).toHaveBeenLastCalledWith({ module: 'ARTICLES', action: 'UPDATE', dateFrom: undefined, search: 'sample' });
  });

  it('resets every filter immediately and discards a stale pending search', async () => {
    vi.useFakeTimers(); const change = vi.fn(); component.filtersChange.subscribe(change);
    component.filters = { module: 'ARTICLES', action: 'UPDATE', dateFrom: '2026-11-10', search: 'sample' };
    component.onSearchChange('sample'); component.clearFilters();
    expect(component.hasActiveFilters).toBe(false);
    expect(change).toHaveBeenCalledExactlyOnceWith({ module: undefined, action: undefined, dateFrom: undefined, search: undefined });
    await vi.advanceTimersByTimeAsync(300); expect(change).toHaveBeenCalledOnce();
  });

  it('guards filter actions while loading and focuses search when available', async () => {
    const change = vi.fn(); component.filtersChange.subscribe(change);
    component.filters.module = 'ARTICLES'; fixture.componentRef.setInput('loading', true); fixture.detectChanges(); await fixture.whenStable();
    component.clearFilters(); component.onFilterChange(); component.onSearchChange('ignored');
    expect(change).not.toHaveBeenCalled(); expect(component.filters.module).toBe('ARTICLES');
    expect(fixture.nativeElement.querySelector('input[type="search"]').disabled).toBe(true);
    fixture.componentRef.setInput('loading', false); fixture.detectChanges(); await fixture.whenStable(); component.focusSearch();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('input[type="search"]'));
  });
});
