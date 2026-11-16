import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PageLoaderComponent } from './page-loader';

describe('Shared page loader', () => {
  let fixture: ComponentFixture<PageLoaderComponent>;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [PageLoaderComponent] });
    fixture = TestBed.createComponent(PageLoaderComponent);
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  const status = (): HTMLElement | null => fixture.nativeElement.querySelector('[role="status"]');

  it('reserves the public layout immediately while delaying its loading announcement', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.public-skeleton')).not.toBeNull();
    expect(status()).toBeNull();
    expect(fixture.nativeElement.querySelector('.page-loader__sr-only')).toBeNull();
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.page-loader')).toBeNull();
  });

  it('continues to delay the entire admin loader', () => {
    fixture.componentRef.setInput('variant', 'admin');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.page-loader')).toBeNull();
    vi.advanceTimersByTime(150);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.spinner')).not.toBeNull();
    expect(status()).not.toBeNull();
  });

  it('delays its accessible loading status and cancels fast loads', () => {
    fixture.detectChanges();
    vi.advanceTimersByTime(149);
    fixture.detectChanges();
    expect(status()).toBeNull();
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(status()).toBeNull();
  });

  it('announces the supplied label once revealed and removes it on completion', () => {
    fixture.componentRef.setInput('label', 'Loading campus stories');
    fixture.detectChanges();
    vi.advanceTimersByTime(150);
    fixture.detectChanges();
    expect(status()).not.toBeNull();
    expect(status()?.textContent).toContain('Loading campus stories');
    expect(fixture.nativeElement.querySelectorAll('[role="status"]').length).toBe(1);
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    expect(status()).toBeNull();
  });

  it('supports an immediate admin status when the service already delayed its reveal', () => {
    fixture.componentRef.setInput('active', false);
    fixture.componentRef.setInput('variant', 'admin');
    fixture.componentRef.setInput('mode', 'inline');
    fixture.componentRef.setInput('delay', 0);
    fixture.componentRef.setInput('label', 'Refreshing workspace');
    fixture.detectChanges();
    expect(status()).toBeNull();
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    expect(status()?.textContent).toContain('Refreshing workspace');
  });

  it('uses decorative skeletons for public pages without a spinner or focusable placeholders', () => {
    fixture.componentRef.setInput('delay', 0);
    fixture.componentRef.setInput('label', 'Loading campus stories');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.spinner')).toBeNull();
    const skeleton = fixture.nativeElement.querySelector('.public-skeleton[aria-hidden="true"]') as HTMLElement;
    expect(skeleton).not.toBeNull();
    expect(skeleton.children.length).toBeGreaterThan(0);
    expect(skeleton.querySelector('a, button, input, select, textarea, [tabindex="0"]')).toBeNull();
    expect(status()?.getAttribute('aria-hidden')).not.toBe('true');
    expect(status()?.textContent).toContain('Loading campus stories');
  });

  it('uses the decorative admin spinner while announcing its loading label', () => {
    fixture.componentRef.setInput('variant', 'admin');
    fixture.componentRef.setInput('delay', 0);
    fixture.componentRef.setInput('label', 'Loading publication workspace');
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('.spinner') as HTMLElement;
    expect(spinner).not.toBeNull();
    expect(spinner.getAttribute('aria-hidden')).toBe('true');
    expect(spinner.textContent?.trim()).toBe('');
    expect(fixture.nativeElement.querySelectorAll('[role="status"]').length).toBe(1);
    expect(status()?.textContent).toContain('Loading publication workspace');
  });

  it.each([
    ['home', '.skeleton-feature'],
    ['stories', '.skeleton-story'],
    ['article', '.skeleton-article'],
    ['issues', '.skeleton-issue-feature'],
    ['board', '.skeleton-person'],
    ['recruitment', '.skeleton-recruitment-hero'],
    ['search', '.skeleton-search-row'],
    ['form', '.skeleton-form'],
    ['reader', '.skeleton-paper'],
  ] as const)('provides a decorative %s layout while keeping one accessible announcement', (layout, selector) => {
    fixture.componentRef.setInput('skeleton', layout);
    fixture.componentRef.setInput('delay', 0);
    fixture.componentRef.setInput('label', 'Loading publication content');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector(`.public-skeleton[aria-hidden="true"] ${selector}`)).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.spinner')).toBeNull();
    expect(fixture.nativeElement.querySelector('.public-skeleton a, .public-skeleton button, .public-skeleton input, .public-skeleton [tabindex]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[role="status"]').length).toBe(1);
    expect(status()?.querySelector('.page-loader__sr-only')?.textContent).toBe('Loading publication content');
  });

  it('replaces the old page layout when the requested skeleton changes', () => {
    fixture.componentRef.setInput('skeleton', 'home');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.skeleton-feature')).not.toBeNull();
    fixture.componentRef.setInput('skeleton', 'issues');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.skeleton-feature')).toBeNull();
    expect(fixture.nativeElement.querySelector('.skeleton-issue-feature')).not.toBeNull();
  });

  it('uses compact skeleton bars for inline public work and preserves the reader page preview', () => {
    fixture.componentRef.setInput('mode', 'inline');
    fixture.componentRef.setInput('skeleton', 'article');
    fixture.componentRef.setInput('delay', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.skeleton-inline')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.skeleton-article')).toBeNull();

    fixture.componentRef.setInput('skeleton', 'reader');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.skeleton-inline')).toBeNull();
    expect(fixture.nativeElement.querySelector('.skeleton-paper')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.spinner')).toBeNull();
  });

  it('starts a fresh delay after a cancelled load instead of reusing its timer', () => {
    fixture.detectChanges();
    vi.advanceTimersByTime(100);
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(50);
    fixture.detectChanges();
    expect(status()).toBeNull();
    vi.advanceTimersByTime(100);
    fixture.detectChanges();
    expect(status()).not.toBeNull();
  });

  it('clears a pending reveal when destroyed', () => {
    fixture.detectChanges();
    const pending = vi.getTimerCount();
    expect(pending).toBeGreaterThan(0);
    fixture.destroy();
    expect(vi.getTimerCount()).toBeLessThan(pending);
    vi.advanceTimersByTime(1000);
  });
});
