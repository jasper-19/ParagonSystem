import { vi } from 'vitest';
import { LoaderService } from './loader.service';

describe('Public loader lifecycle', () => {
  let loader: LoaderService;
  let states: boolean[];
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    loader = new LoaderService();
    states = [];
    const subscription = loader.isLoading$.subscribe(value => states.push(value));
    unsubscribe = () => subscription.unsubscribe();
  });

  afterEach(() => {
    loader.reset();
    unsubscribe();
    vi.useRealTimers();
  });

  it('never flashes for work completed before the reveal delay', () => {
    loader.show();
    vi.advanceTimersByTime(149);
    expect(states).toEqual([false]);
    loader.hide();
    vi.advanceTimersByTime(1000);
    expect(states).toEqual([false]);
  });

  it('keeps the loader visible until every overlapping operation completes', () => {
    loader.show();
    vi.advanceTimersByTime(100);
    loader.show();
    vi.advanceTimersByTime(50);
    expect(states.at(-1)).toBe(true);
    vi.advanceTimersByTime(300);
    loader.hide();
    expect(states.at(-1)).toBe(true);
    loader.hide();
    expect(states.at(-1)).toBe(false);
    expect(states).toEqual([false, true, false]);
  });

  it('holds a revealed loader for its minimum visible duration', () => {
    loader.show();
    vi.advanceTimersByTime(150);
    loader.hide();
    vi.advanceTimersByTime(199);
    expect(states.at(-1)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(states.at(-1)).toBe(false);
  });

  it('cancels a pending hide when another operation starts', () => {
    loader.show();
    vi.advanceTimersByTime(150);
    loader.hide();
    vi.advanceTimersByTime(100);
    loader.show();
    vi.advanceTimersByTime(1000);
    expect(states.at(-1)).toBe(true);
    loader.hide();
    expect(states.at(-1)).toBe(false);
  });

  it('reset cancels stale reveal and hide timers without affecting later work', () => {
    loader.show();
    vi.advanceTimersByTime(50);
    loader.reset();
    vi.advanceTimersByTime(1000);
    expect(states.at(-1)).toBe(false);
    loader.show();
    vi.advanceTimersByTime(150);
    loader.hide();
    loader.reset();
    loader.show();
    vi.advanceTimersByTime(150);
    vi.advanceTimersByTime(50);
    expect(states.at(-1)).toBe(true);
    vi.advanceTimersByTime(200);
    loader.hide();
    expect(states.at(-1)).toBe(false);
  });

  it('ignores a completion token from before reset while new work remains active', () => {
    const oldToken = loader.show();
    loader.reset();
    const currentToken = loader.show();
    vi.advanceTimersByTime(350);
    loader.hide(oldToken);
    expect(states.at(-1)).toBe(true);
    loader.hide(currentToken);
    expect(states.at(-1)).toBe(false);
  });
  it('ignores unmatched completions so a later request still shows normally', () => {
    loader.hide();
    loader.hide();
    loader.show();
    vi.advanceTimersByTime(150);
    expect(states.at(-1)).toBe(true);
    vi.advanceTimersByTime(200);
    loader.hide();
    expect(states.at(-1)).toBe(false);
  });
});
