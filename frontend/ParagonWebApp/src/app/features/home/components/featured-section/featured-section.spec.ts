import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Article } from '../../../../models/article.model';
import { FeaturedSection } from './featured-section';

describe('FeaturedSection rotation', () => {
  it('stays paused through focus and pointer changes until explicitly resumed', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    TestBed.configureTestingModule({ imports: [FeaturedSection], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(FeaturedSection);
    try {
      const articles = ['first', 'second'].map(id => ({ id, title: id, slug: id }) as Article);
      fixture.componentRef.setInput('articles', articles);
      fixture.detectChanges();
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('.featured-rotation');
      const section: HTMLElement = fixture.nativeElement.querySelector('section');

      button.click();
      section.dispatchEvent(new Event('mouseenter'));
      section.dispatchEvent(new Event('mouseleave'));
      button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      button.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      fixture.componentRef.setInput('articles', [...articles]);
      fixture.detectChanges();
      vi.advanceTimersByTime(14_000);
      expect(fixture.componentInstance.currentIndex).toBe(0);
      expect(button.textContent).toContain('Resume rotation');

      button.click();
      vi.advanceTimersByTime(7_000);
      expect(fixture.componentInstance.currentIndex).toBe(1);
    } finally {
      fixture.destroy();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
