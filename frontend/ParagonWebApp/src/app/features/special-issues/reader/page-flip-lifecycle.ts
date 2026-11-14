/**
 * PageFlip 2.0.7 starts an unbounded RAF loop and exposes no stop method.
 * Scope this compatibility adapter to one instance: replace the renderer's start
 * before loadFromHTML assigns it. Never patch browser globals or library prototypes.
 * The dependency is pinned to 2.0.7 because this shim uses its private renderer
 * shape; upgrade it together with the installed-engine lifecycle regression.
 * The shape checks deliberately fail before starting an incompatible renderer.
 */
interface PageFlipRenderer {
  start(): void;
  update(): void;
  render(time: number): void;
}

export function ownPageFlipAnimation(book: object): () => void {
  let renderer: PageFlipRenderer | undefined;
  let frame: number | undefined;
  let stopped = false;
  const descriptor = Object.getOwnPropertyDescriptor(book, 'render');
  if (descriptor && !descriptor.configurable) throw new Error('Unsupported publication viewer');
  Object.defineProperty(book, 'render', {
    configurable: true,
    get: () => renderer,
    set: (value: PageFlipRenderer) => {
      if (!value || typeof value.start !== 'function' || typeof value.update !== 'function' || typeof value.render !== 'function') {
        throw new Error('Unsupported publication viewer renderer');
      }
      renderer = value;
      value.start = () => {
        if (stopped || frame !== undefined) return;
        value.update();
        const tick = (time: number) => {
          if (stopped) return;
          value.render(time);
          if (!stopped) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      };
    },
  });
  return () => {
    stopped = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    // Restore a plain property; PageFlip.destroy/getRender still need this instance.
    Object.defineProperty(book, 'render', { configurable: true, writable: true, value: renderer });
  };
}
