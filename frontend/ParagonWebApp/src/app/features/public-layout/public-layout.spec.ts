import { TestBed } from '@angular/core/testing';
import { NavigationCancel, NavigationCancellationCode, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { PublicLayout } from './public-layout';
import { LoaderService } from '../../shared/services/loader.service';

describe('Public navigation loader ownership', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('balances initial, overlapping, cancelled and destroyed navigations with owned tokens', () => {
    const events = new Subject<unknown>();
    let token = 0;
    const show = vi.fn(() => ++token);
    const hide = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: { events, currentNavigation: () => ({ id: 1 }) } },
      { provide: LoaderService, useValue: { show, hide } },
    ] });
    TestBed.runInInjectionContext(() => new PublicLayout());
    expect(show).toHaveBeenCalledTimes(1);
    events.next(new NavigationStart(2, '/top-stories'));
    events.next(new NavigationCancel(1, '/', 'Superseded', NavigationCancellationCode.SupersededByNewNavigation));
    expect(hide).toHaveBeenLastCalledWith(1);
    events.next(new NavigationEnd(2, '/top-stories', '/top-stories'));
    expect(hide).toHaveBeenLastCalledWith(2);
    events.next(new NavigationStart(3, '/admin'));
    TestBed.resetTestingModule();
    expect(hide).toHaveBeenLastCalledWith(3);
    events.next(new NavigationStart(4, '/'));
    expect(show).toHaveBeenCalledTimes(3);
  });
});
