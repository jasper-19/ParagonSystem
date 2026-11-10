import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { GlobalSettingsService } from '../../../core/services/global-settings.service';
import { SettingsComponent } from './settings';

describe('Settings navigation', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const navigate = vi.fn();

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ tab: 'maintenance' }));
    navigate.mockReset();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: Router, useValue: { navigate } },
        { provide: GlobalSettingsService, useValue: { load: () => of(undefined) } },
      ],
    }).overrideComponent(SettingsComponent, {
      set: { template: '@for (tab of tabs; track tab.id) { <button #settingsTab>{{tab.label}}</button> }', imports: [] },
    }).compileComponents();
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: () => {} });
    }
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy(); params.complete(); TestBed.resetTestingModule(); vi.restoreAllMocks();
  });

  it('follows recognized route tabs and falls back to general for an unknown route', () => {
    expect(fixture.componentInstance.activeTab()).toBe('maintenance');
    params.next(convertToParamMap({ tab: 'unrecognized' }));
    expect(fixture.componentInstance.activeTab()).toBe('general');
    fixture.componentInstance.setTab('general');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('wraps arrow navigation and supports Home/End while focusing the routed destination', () => {
    const component = fixture.componentInstance;
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    for (const [key, current, targetIndex] of [
      ['ArrowLeft', 'general', 4], ['ArrowRight', 'users', 0],
      ['End', 'notifications', 4], ['Home', 'users', 0],
    ] as const) {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      component.tabKeydown(event, current);
      expect(event.defaultPrevented).toBe(true);
      expect(navigate).toHaveBeenLastCalledWith(['/admin/settings', component.tabs[targetIndex].id]);
      expect(document.activeElement).toBe(buttons[targetIndex]);
    }
    navigate.mockClear();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    component.tabKeydown(tab, 'general');
    expect(tab.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
