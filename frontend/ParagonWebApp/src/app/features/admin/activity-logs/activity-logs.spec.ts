import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ActivityLogsService } from '../../../core/services/activity-logs.service';
import { SocketService } from '../../../core/services/socket.service';
import { ActivityLog } from '../../../models/activity-log.model';
import { ActivityLogsComponent } from './activity-logs';

describe('Activity log workspace keyboard actions', () => {
  const log: ActivityLog = { id: 'sample-log', userId: 'sample-admin', action: 'UPDATE', module: 'ARTICLES', description: 'Synthetic activity record.', entityId: 'sample-article', entityType: 'ARTICLES', ipAddress: '192.0.2.1', createdAt: '2026-11-10T00:00:00Z' };
  let fixture: ComponentFixture<ActivityLogsComponent>;
  let getLogs: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    getLogs = vi.fn((filters: { page: number; limit: number }) => of({ items: [log], page: filters.page, limit: filters.limit, total: 30, totalPages: 3 }));
    await TestBed.configureTestingModule({ imports: [ActivityLogsComponent], providers: [provideRouter([]),
      { provide: ActivityLogsService, useValue: { getLogs, getFilterOptions: () => of({ modules: ['ARTICLES'], actions: ['UPDATE'] }) } },
      { provide: SocketService, useValue: { onActivityLogsUpdated: () => () => {} } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(ActivityLogsComponent); fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('focuses search with slash and protects normal input and modifier shortcuts', () => {
    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }); document.dispatchEvent(event);
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(event.defaultPrevented).toBe(true); expect(document.activeElement).toBe(search);
    const typing = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }); search.dispatchEvent(typing);
    expect(getLogs).toHaveBeenCalledOnce(); expect(typing.defaultPrevented).toBe(false);
    const modifier = new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }); document.dispatchEvent(modifier);
    expect(getLogs).toHaveBeenCalledOnce();
  });

  it('pages with arrow keys and keeps all global navigation inside an open details dialog', async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(fixture.componentInstance.currentPage()).toBe(2);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(fixture.componentInstance.currentPage()).toBe(1);
    const details = fixture.nativeElement.querySelector('button[aria-label^="View activity details"]') as HTMLButtonElement;
    details.click(); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.componentInstance.selectedLog()).toEqual(log);
    const focused = document.activeElement as HTMLElement;
    expect(focused.closest('[role="dialog"]')).not.toBeNull();
    const calls = getLogs.mock.calls.length;
    focused.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(focused);
    focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(getLogs).toHaveBeenCalledTimes(calls);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges(); expect(fixture.componentInstance.selectedLog()).toBeNull();
  });
});
