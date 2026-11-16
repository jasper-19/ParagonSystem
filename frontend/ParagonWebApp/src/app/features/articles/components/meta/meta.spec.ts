import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ArticleMeta } from './meta';

describe('Article link sharing', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const originalSecure = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
  const originalCopy = Object.getOwnPropertyDescriptor(document, 'execCommand');
  const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
  const originalUrl = window.location.href;
  let canonical: HTMLLinkElement | undefined;
  let existingCanonicals: Element[] = [];
  beforeEach(() => {
    existingCanonicals = Array.from(document.querySelectorAll('link[rel="canonical"]'));
    existingCanonicals.forEach(link => link.remove());
  });
  afterEach(() => {
    for (const [target, key, descriptor] of [[navigator, 'clipboard', originalClipboard], [window, 'isSecureContext', originalSecure], [document, 'execCommand', originalCopy], [navigator, 'share', originalShare]] as const) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
    canonical?.remove(); canonical = undefined;
    existingCanonicals.forEach(link => document.head.appendChild(link));
    window.history.replaceState(null, '', originalUrl);
    TestBed.resetTestingModule();
  });

  it('confirms success only when the clipboard accepts the article URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    const meta = TestBed.runInInjectionContext(() => new ArticleMeta());
    await meta.copyArticleLink();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(meta.linkCopied()).toBe(true);
    expect(meta.copyError()).toBe('');
  });

  it('reports failed clipboard and fallback writes without false success or a leaked textarea', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn().mockReturnValue(false) });
    const meta = TestBed.runInInjectionContext(() => new ArticleMeta());
    await meta.copyArticleLink();
    expect(meta.linkCopied()).toBe(false);
    expect(meta.copyError()).toContain('Copy the address from your browser');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('copies the canonical article URL without tracking parameters or fragments', async () => {
    window.history.replaceState(null, '', '/article/campus-news?utm_source=private#section');
    canonical = document.createElement('link'); canonical.rel = 'canonical';
    canonical.href = 'https://news.example/article/campus-news'; document.head.appendChild(canonical);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    const meta = TestBed.runInInjectionContext(() => new ArticleMeta());
    await meta.copyArticleLink();
    expect(writeText).toHaveBeenCalledWith('https://news.example/article/campus-news');
  });

  it('uses the same clean URL for native sharing and ignores a stale canonical from another article', async () => {
    window.history.replaceState(null, '', '/article/current-story?utm_source=private#section');
    canonical = document.createElement('link'); canonical.rel = 'canonical';
    canonical.href = 'https://news.example/article/previous-story'; document.head.appendChild(canonical);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    const meta = TestBed.runInInjectionContext(() => new ArticleMeta());
    meta.title = 'Current story';
    await meta.shareArticle();
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `${window.location.origin}/article/current-story`, title: 'Current story' }));
  });
});
