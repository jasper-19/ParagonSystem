import { PdfRenderQueue } from './pdf-render-queue';

describe('PDF canvas work queue', () => {
  it('bounds active work and releases a slot after failure', async () => {
    const queue = new PdfRenderQueue(2);
    let active = 0;
    let maxActive = 0;
    const release: (() => void)[] = [];
    const work = () => queue.run(async () => {
      active++; maxActive = Math.max(maxActive, active);
      await new Promise<void>(resolve => release.push(resolve));
      active--;
    });
    const tasks = [work(), work(), work(), work()];
    await Promise.resolve();
    expect(release.length).toBe(2);
    release.splice(0).forEach(resolve => resolve());
    await Promise.all(tasks.slice(0, 2));
    await Promise.resolve(); await Promise.resolve();
    release.splice(0).forEach(resolve => resolve());
    await Promise.all(tasks);
    expect(maxActive).toBe(2);
    await expect(queue.run(() => Promise.reject(new Error('failed')))).rejects.toThrow('failed');
    await expect(queue.run(() => Promise.resolve('next'))).resolves.toBe('next');
  });
  it('rejects pending work on teardown without running it', async () => {
    const queue = new PdfRenderQueue(1);
    let finish!: () => void;
    const first = queue.run(() => new Promise<void>(resolve => finish = resolve));
    const second = queue.run(() => Promise.resolve('never'));
    const rejected = expect(second).rejects.toThrow('cancelled');
    queue.cancelPending();
    await rejected;
    finish();
    await first;
  });
});
