import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ArticleMeta } from './meta';

describe('Article link sharing', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const originalSecure = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
  const originalCopy = Object.getOwnPropertyDescriptor(document, 'execCommand');
  afterEach(() => {
    for (const [target, key, descriptor] of [[navigator, 'clipboard', originalClipboard], [window, 'isSecureContext', originalSecure], [document, 'execCommand', originalCopy]] as const) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
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
});
