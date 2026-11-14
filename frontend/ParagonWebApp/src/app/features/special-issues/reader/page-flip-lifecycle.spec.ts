import { vi } from 'vitest';
import { PageFlip } from 'page-flip';
import { ownPageFlipAnimation } from './page-flip-lifecycle';

describe('PageFlip animation ownership', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it('stops the actual installed engine without changing browser globals or prototypes', () => {
    vi.useFakeTimers();
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    const request = vi.fn((callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
    const cancel = vi.fn((frame: number) => frames.delete(frame));
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const book = new PageFlip(container, { width: 200, height: 300, size: 'fixed', usePortrait: true });
    const stop = ownPageFlipAnimation(book);
    book.loadFromHTML([document.createElement('div'), document.createElement('div')]);
    vi.advanceTimersByTime(5); // PageFlip's init/layout timer.
    expect(frames.size).toBe(1);
    const [firstId, callback] = [...frames.entries()][0];
    frames.delete(firstId);
    callback(16);
    expect(frames.size).toBe(1);
    stop();
    expect(frames.size).toBe(0);
    expect(cancel).toHaveBeenCalledOnce();
    expect(globalThis.requestAnimationFrame).toBe(request);
    expect(Object.getOwnPropertyDescriptor(book, 'render')?.get).toBeUndefined();
    book.destroy();
    expect(container.isConnected).toBe(false);
  });
  it('fails before starting an incompatible renderer', () => {
    const book: { render?: unknown } = {};
    ownPageFlipAnimation(book);
    expect(() => { book.render = {}; }).toThrow('Unsupported publication viewer renderer');
  });
});
