import {
  AfterViewInit,
  DestroyRef,
  Directive,
  ElementRef,
  Injectable,
  Input,
  NgZone,
  PLATFORM_ID,
  Renderer2,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type HomeRevealVariant = 'fade' | 'up' | 'left' | 'right' | 'scale';

@Injectable({ providedIn: 'root' })
class HomeScrollRevealObserver {
  private readonly zone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly callbacks = new Map<Element, () => void>();
  private observer: IntersectionObserver | null = null;

  observe(element: Element, reveal: () => void): () => void {
    if (!isPlatformBrowser(this.platformId)) {
      reveal();
      return () => undefined;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveal();
      return () => undefined;
    }

    this.callbacks.set(element, reveal);
    this.getObserver().observe(element);

    return () => {
      this.callbacks.delete(element);
      this.observer?.unobserve(element);
    };
  }

  private getObserver(): IntersectionObserver {
    if (this.observer) return this.observer;

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;

            this.callbacks.get(entry.target)?.();
            this.callbacks.delete(entry.target);
            this.observer?.unobserve(entry.target);
          }
        },
        {
          root: null,
          rootMargin: '0px 0px -8% 0px',
          threshold: 0.12,
        },
      );
    });

    return this.observer!;
  }
}

@Directive({
  selector: '[appScrollReveal]',
  standalone: true,
  host: {
    class: 'home-reveal',
    '[class.home-reveal--fade]': "variant === 'fade'",
    '[class.home-reveal--up]': "variant === 'up'",
    '[class.home-reveal--left]': "variant === 'left'",
    '[class.home-reveal--right]': "variant === 'right'",
    '[class.home-reveal--scale]': "variant === 'scale'",
  },
})
export class ScrollRevealDirective implements AfterViewInit {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly observer = inject(HomeScrollRevealObserver);
  private readonly destroyRef = inject(DestroyRef);

  @Input('appScrollReveal') variant: HomeRevealVariant = 'up';
  @Input() revealDelay = 0;

  ngAfterViewInit(): void {
    const element = this.elementRef.nativeElement;
    const delay = Math.min(Math.max(this.revealDelay, 0), 420);

    this.renderer.setStyle(element, '--home-reveal-delay', `${delay}ms`);

    const stopObserving = this.observer.observe(element, () => {
      this.renderer.addClass(element, 'home-reveal--visible');
    });

    this.renderer.addClass(element, 'home-reveal--ready');
    this.destroyRef.onDestroy(stopObserving);
  }
}
