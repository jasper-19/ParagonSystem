import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Data, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { GlobalSettingsService } from '../../core/services/global-settings.service';
import { PublicGlobalSettings } from '../../models/global-settings.model';
import { PublicInformationPage } from './public-information';

describe('Public information pages', () => {
  let routeData: BehaviorSubject<Data>;
  const settings = signal<PublicGlobalSettings | null>(null);
  const pages = [
    ['our-story', 'Our Story'],
    ['ethics-policy', 'Ethics Policy'],
    ['contact-us', 'Contact Us'],
    ['privacy-policy', 'Privacy Policy'],
    ['terms-of-service', 'Terms of Service'],
  ] as const;
  const policyPages = ['ethics-policy', 'privacy-policy', 'terms-of-service'];

  function publicSettings(contactEmail: string): PublicGlobalSettings {
    return {
      general: {
        siteName: 'The Campus Journal', organizationName: 'Student Publications Office',
        contactEmail, logoUrl: '', timezone: 'Asia/Manila', dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
      },
      maintenance: { enabled: false, message: '' }, version: 1,
    };
  }

  beforeEach(() => {
    routeData = new BehaviorSubject<Data>({ page: 'our-story' });
    settings.set(null);
    TestBed.configureTestingModule({
      imports: [PublicInformationPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { data: routeData, snapshot: { get data() { return routeData.value; } } },
        },
        { provide: GlobalSettingsService, useValue: { publicSettings: settings } },
      ],
    });
  });

  afterEach(() => routeData.complete());

  function render(page: string): ComponentFixture<PublicInformationPage> {
    routeData.next({ page });
    const fixture = TestBed.createComponent(PublicInformationPage);
    fixture.detectChanges();
    return fixture;
  }

  for (const [page, title] of pages) {
    it(`renders ${title} as one accessible reading surface`, () => {
      const element: HTMLElement = render(page).nativeElement;
      expect(element.querySelectorAll('main')).toHaveLength(1);
      expect(element.querySelectorAll('h1')).toHaveLength(1);
      expect(element.querySelector('nav[aria-label="Breadcrumb"], nav[aria-label="About the publication"]'))
        .toBeNull();
      for (const [destination] of pages) {
        expect(element.querySelector('a[href="/' + destination + '"]')).toBeNull();
      }
      expect(element.querySelector('h1')?.textContent?.trim()).toBe(title);
      const ids = Array.from(element.querySelectorAll('[id]'), node => node.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  }

  for (const page of policyPages) {
    it(`identifies ${page} as a draft and provides working section destinations`, () => {
      const element: HTMLElement = render(page).nativeElement;
      expect(element.textContent).toMatch(/draft for editorial review/i);
      const sectionLinks = Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href*="#"]'));
      expect(sectionLinks.length).toBeGreaterThan(0);
      for (const link of sectionLinks) {
        const id = decodeURIComponent(new URL(link.href, 'https://example.test').hash.slice(1));
        expect(id).not.toBe('');
        expect(Array.from(element.querySelectorAll('[id]')).some(node => node.id === id)).toBe(true);
      }
    });
  }

  it('updates content when the router reuses the component for a different information page', () => {
    const fixture = render('our-story');
    const instance = fixture.componentInstance;
    routeData.next({ page: 'privacy-policy' });
    fixture.detectChanges();
    expect(fixture.componentInstance).toBe(instance);
    expect(fixture.nativeElement.querySelector('h1')?.textContent?.trim()).toBe('Privacy Policy');
    expect(fixture.nativeElement.textContent).toMatch(/draft for editorial review/i);

    routeData.next({ page: 'contact-us' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent?.trim()).toBe('Contact Us');
    expect(fixture.nativeElement.textContent).not.toMatch(/draft for editorial review/i);
  });

  it('moves section navigation to the heading and transfers keyboard focus', () => {
    const fixture = render('ethics-policy');
    const element: HTMLElement = fixture.nativeElement;
    const link = element.querySelector<HTMLAnchorElement>('nav[aria-label="On this page"] a')!;
    const id = new URL(link.href, 'https://example.test').hash.slice(1);
    const heading = Array.from(element.querySelectorAll<HTMLElement>('[id]')).find(node => node.id === id)!;
    const scroll = vi.fn();
    heading.scrollIntoView = scroll;
    const event = new MouseEvent('click', { button: 0, bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    expect(document.activeElement).toBe(heading);
  });

  it('uses the configured contact email and updates it when public settings change', () => {
    settings.set(publicSettings('editor@example.test'));
    const fixture = render('contact-us');
    const element: HTMLElement = fixture.nativeElement;
    const emailLinks = () => Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]'));
    expect(emailLinks().length).toBeGreaterThan(0);
    expect(emailLinks().every(link => decodeURIComponent(link.getAttribute('href')!).includes('editor@example.test'))).toBe(true);

    settings.set(publicSettings('newsroom@example.test'));
    fixture.detectChanges();
    expect(emailLinks().every(link => decodeURIComponent(link.getAttribute('href')!).includes('newsroom@example.test'))).toBe(true);
    expect(element.textContent).not.toContain('editor@example.test');
  });

  for (const email of ['', 'javascript:alert(1)', 'editor@example.test?bcc=other@example.test', 'editor@example.test\r\nBcc:other@example.test']) {
    it(`keeps a useful contact fallback without an unsafe or invented email (${JSON.stringify(email)})`, () => {
      settings.set(publicSettings(email));
      const element: HTMLElement = render('contact-us').nativeElement;
      expect(element.querySelector('a[href^="mailto:"]')).toBeNull();
      const facebook = element.querySelector<HTMLAnchorElement>('a[href="https://www.facebook.com/paragon.csug"]');
      expect(facebook).not.toBeNull();
      expect(element.textContent).not.toContain('Paragon.csu.edu.ph');
      expect(element.querySelector('a[href^="javascript:"]')).toBeNull();
    });
  }

  it('uses live publication settings instead of inventing an organization', () => {
    settings.set(publicSettings(''));
    const fixture = render('our-story');
    expect(fixture.nativeElement.textContent).toContain('Student Publications Office');
  });

  it('connects the publication story to reading, the board, and recruitment', () => {
    const element: HTMLElement = render('our-story').nativeElement;
    for (const destination of ['/top-stories', '/editorial-board', '/join']) {
      expect(element.querySelector(`a[href="${destination}"]`)).not.toBeNull();
    }
  });
});
