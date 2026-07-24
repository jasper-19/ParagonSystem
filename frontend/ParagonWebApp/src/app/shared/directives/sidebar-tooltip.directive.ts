import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  Renderer2,
  inject,
} from '@angular/core';

type TooltipPlacement = 'right' | 'left' | 'top' | 'bottom';

@Directive({
  selector: '[appSidebarTooltip]',
  standalone: true,
})
export class SidebarTooltipDirective implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  private showTimer: number | null = null;

  @Input('appSidebarTooltip') text = '';
  @Input() tooltipEnabled = true;
  @Input() tooltipPlacement: TooltipPlacement = 'right';

  private tooltipElement: HTMLElement | null = null;
  private arrowElement: HTMLElement | null = null;

  private readonly removeScrollListener = this.renderer.listen(
    'window',
    'scroll',
    () => this.positionTooltip(),
    { capture: true }
  );

  private readonly removeResizeListener = this.renderer.listen(
    'window',
    'resize',
    () => this.positionTooltip()
  );

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.show();
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.hide();
  }

  @HostListener('focusin')
  onFocusIn(): void {
    this.show();
  }

  @HostListener('focusout')
  onFocusOut(): void {
    this.hide();
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.hide();
  }

  ngOnDestroy(): void {
    this.hide(true);
    this.removeScrollListener();
    this.removeResizeListener();
  }

  private show(): void {
    if (
      !this.tooltipEnabled ||
      !this.text.trim() ||
      this.tooltipElement ||
      this.showTimer !== null
    ) {
      return;
    }

    this.showTimer = window.setTimeout(() => {
      this.showTimer = null;

      // Recheck because the pointer may have left during the delay.
      if (!this.tooltipEnabled || !this.text.trim() || this.tooltipElement) {
        return;
      }

      this.createTooltip();
    }, 120);
  }

  private createTooltip(): void {
    const tooltip = this.renderer.createElement('div') as HTMLElement;
    const arrow = this.renderer.createElement('span') as HTMLElement;
    const accent = this.renderer.createElement('span') as HTMLElement;

    this.tooltipElement = tooltip;
    this.arrowElement = arrow;

    this.renderer.setAttribute(tooltip, 'role', 'tooltip');

    this.renderer.addClass(tooltip, 'fixed');
    this.renderer.addClass(tooltip, 'z-[9999]');
    this.renderer.addClass(tooltip, 'pointer-events-none');
    this.renderer.addClass(tooltip, 'flex');
    this.renderer.addClass(tooltip, 'items-center');
    this.renderer.addClass(tooltip, 'whitespace-nowrap');
    this.renderer.addClass(tooltip, 'rounded-xl');
    this.renderer.addClass(tooltip, 'bg-white');
    this.renderer.addClass(tooltip, 'px-3.5');
    this.renderer.addClass(tooltip, 'py-2');
    this.renderer.addClass(tooltip, 'text-xs');
    this.renderer.addClass(tooltip, 'font-semibold');
    this.renderer.addClass(tooltip, 'tracking-wide');
    this.renderer.addClass(tooltip, 'text-[#000035]');
    this.renderer.addClass(
      tooltip,
      'shadow-[0_12px_32px_rgba(0,0,53,0.35)]'
    );
    this.renderer.addClass(tooltip, 'ring-1');
    this.renderer.addClass(tooltip, 'ring-[#F4B400]/40');

    this.renderer.addClass(tooltip, 'opacity-0');
    this.renderer.addClass(tooltip, 'translate-x-1');
    this.renderer.addClass(tooltip, 'scale-95');
    this.renderer.addClass(tooltip, 'transition-[opacity,transform]');
    this.renderer.addClass(tooltip, 'duration-150');
    this.renderer.addClass(tooltip, 'ease-out');
    this.renderer.addClass(tooltip, 'motion-reduce:transition-none');

    this.renderer.addClass(arrow, 'absolute');
    this.renderer.addClass(arrow, 'h-2.5');
    this.renderer.addClass(arrow, 'w-2.5');
    this.renderer.addClass(arrow, 'rotate-45');
    this.renderer.addClass(arrow, 'bg-white');

    this.renderer.addClass(accent, 'mr-2');
    this.renderer.addClass(accent, 'inline-block');
    this.renderer.addClass(accent, 'h-4');
    this.renderer.addClass(accent, 'w-1');
    this.renderer.addClass(accent, 'shrink-0');
    this.renderer.addClass(accent, 'rounded-full');
    this.renderer.addClass(accent, 'bg-[#F4B400]');

    const textNode = this.renderer.createText(this.text.trim());

    this.renderer.appendChild(tooltip, arrow);
    this.renderer.appendChild(tooltip, accent);
    this.renderer.appendChild(tooltip, textNode);
    this.renderer.appendChild(document.body, tooltip);

    this.positionTooltip();

    requestAnimationFrame(() => {
      if (this.tooltipElement !== tooltip) return;

      this.renderer.removeClass(tooltip, 'opacity-0');
      this.renderer.removeClass(tooltip, 'translate-x-1');
      this.renderer.removeClass(tooltip, 'scale-95');

      this.renderer.addClass(tooltip, 'opacity-100');
      this.renderer.addClass(tooltip, 'translate-x-0');
      this.renderer.addClass(tooltip, 'scale-100');
    });
  }

  private clearShowTimer(): void {
    if (this.showTimer === null) return;

    window.clearTimeout(this.showTimer);
    this.showTimer = null;
  }

  private hide(immediate = false): void {
    this.clearShowTimer();

    const tooltip = this.tooltipElement;

    if (!tooltip) return;

    this.tooltipElement = null;
    this.arrowElement = null;

    if (immediate) {
      if (tooltip.parentNode) {
        this.renderer.removeChild(document.body, tooltip);
      }
      return;
    }

    this.renderer.removeClass(tooltip, 'opacity-100');
    this.renderer.removeClass(tooltip, 'translate-x-0');
    this.renderer.removeClass(tooltip, 'scale-100');

    this.renderer.addClass(tooltip, 'opacity-0');
    this.renderer.addClass(tooltip, 'translate-x-1');
    this.renderer.addClass(tooltip, 'scale-95');

    window.setTimeout(() => {
      if (tooltip.parentNode) {
        this.renderer.removeChild(document.body, tooltip);
      }
    }, 150);
  }

  private positionTooltip(): void {
    if (!this.tooltipElement || !this.arrowElement) return;

    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    const gap = 12;
    const viewportPadding = 8;

    let top = 0;
    let left = 0;

    this.resetArrowClasses();

    switch (this.tooltipPlacement) {
      case 'left':
        top = hostRect.top + hostRect.height / 2 - tooltipRect.height / 2;
        left = hostRect.left - tooltipRect.width - gap;

        this.renderer.addClass(this.arrowElement, '-right-1');
        this.renderer.addClass(this.arrowElement, 'top-1/2');
        this.renderer.addClass(this.arrowElement, '-translate-y-1/2');
        break;

      case 'top':
        top = hostRect.top - tooltipRect.height - gap;
        left = hostRect.left + hostRect.width / 2 - tooltipRect.width / 2;

        this.renderer.addClass(this.arrowElement, '-bottom-1');
        this.renderer.addClass(this.arrowElement, 'left-1/2');
        this.renderer.addClass(this.arrowElement, '-translate-x-1/2');
        break;

      case 'bottom':
        top = hostRect.bottom + gap;
        left = hostRect.left + hostRect.width / 2 - tooltipRect.width / 2;

        this.renderer.addClass(this.arrowElement, '-top-1');
        this.renderer.addClass(this.arrowElement, 'left-1/2');
        this.renderer.addClass(this.arrowElement, '-translate-x-1/2');
        break;

      case 'right':
      default:
        top = hostRect.top + hostRect.height / 2 - tooltipRect.height / 2;
        left = hostRect.right + gap;

        this.renderer.addClass(this.arrowElement, '-left-1');
        this.renderer.addClass(this.arrowElement, 'top-1/2');
        this.renderer.addClass(this.arrowElement, '-translate-y-1/2');
        break;
    }

    top = Math.max(
      viewportPadding,
      Math.min(top, window.innerHeight - tooltipRect.height - viewportPadding)
    );

    left = Math.max(
      viewportPadding,
      Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding)
    );

    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }

  private resetArrowClasses(): void {
    if (!this.arrowElement) return;

    const classes = [
      '-left-1',
      '-right-1',
      '-top-1',
      '-bottom-1',
      'left-1/2',
      'top-1/2',
      '-translate-x-1/2',
      '-translate-y-1/2',
    ];

    for (const className of classes) {
      this.renderer.removeClass(this.arrowElement, className);
    }
  }
}
