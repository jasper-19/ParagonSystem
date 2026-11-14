import { vi } from 'vitest';
import { AdminLoaderService } from './admin-loader.service';

describe('Admin loader lifecycle', () => {
  let loader: AdminLoaderService;
  let states: boolean[];
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    loader = new AdminLoaderService();
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
    loader.begin();
    vi.advanceTimersByTime(149);
    expect(states).toEqual([false]);
    loader.end();
    vi.advanceTimersByTime(1000);
    expect(states).toEqual([false]);
  });

  it('keeps the loader visible until every overlapping operation completes', () => {
    loader.begin();
    vi.advanceTimersByTime(100);
    loader.begin();
    vi.advanceTimersByTime(50);
    expect(states.at(-1)).toBe(true);
    vi.advanceTimersByTime(300);
    loader.end();
    expect(states.at(-1)).toBe(true);
    loader.end();
    expect(states.at(-1)).toBe(false);
    expect(states).toEqual([false, true, false]);
  });

  it('holds a revealed loader for its minimum visible duration', () => {
    loader.begin();
    vi.advanceTimersByTime(150);
    loader.end();
    vi.advanceTimersByTime(199);
    expect(states.at(-1)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(states.at(-1)).toBe(false);
  });

  it('cancels a pending hide when another operation starts', () => {
    loader.begin();
    vi.advanceTimersByTime(150);
    loader.end();
    vi.advanceTimersByTime(100);
    loader.begin();
    vi.advanceTimersByTime(1000);
    expect(states.at(-1)).toBe(true);
    loader.end();
    expect(states.at(-1)).toBe(false);
  });

  it('reset cancels stale reveal and hide timers without affecting later work', () => {
    loader.begin();
    vi.advanceTimersByTime(50);
    loader.reset();
    vi.advanceTimersByTime(1000);
    expect(states.at(-1)).toBe(false);
    loader.begin();
    vi.advanceTimersByTime(150);
    loader.end();
    loader.reset();
    loader.begin();
    vi.advanceTimersByTime(150);
    vi.advanceTimersByTime(50);
    expect(states.at(-1)).toBe(true);
    vi.advanceTimersByTime(200);
    loader.end();
    expect(states.at(-1)).toBe(false);
  });

  it('ignores a completion token from before reset while new work remains active', () => {
    const oldToken = loader.begin();
    loader.reset();
    const currentToken = loader.begin();
    vi.advanceTimersByTime(350);
    loader.end(oldToken);
    expect(states.at(-1)).toBe(true);
    loader.end(currentToken);
    expect(states.at(-1)).toBe(false);
  });
  it('ignores unmatched completions so a later request still shows normally', () => {
    loader.end();
    loader.end();
    loader.begin();
    vi.advanceTimersByTime(150);
    expect(states.at(-1)).toBe(true);
    vi.advanceTimersByTime(200);
    loader.end();
    expect(states.at(-1)).toBe(false);
  });
});
