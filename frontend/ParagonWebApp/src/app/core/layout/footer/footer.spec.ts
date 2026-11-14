import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GlobalSettingsService } from '../../services/global-settings.service';
import { Footer } from './footer';

describe('Footer', () => {
  it('renders public navigation with isolated settings and router dependencies', () => {
    TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([]), { provide: GlobalSettingsService, useValue: { publicSettings: signal(null) } }],
    });
    const fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/join"]')).not.toBeNull();
  });
});
