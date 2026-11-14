import { ChangeDetectionStrategy, Component, OnDestroy, effect, input, signal } from '@angular/core';

@Component({
  selector: 'app-page-loader', standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-loader.html',
  styleUrl: './page-loader.scss',
  host: {
    '[class.page-loader-host--overlay]': 'mode() === "overlay"',
    '[class.page-loader-host--block]': 'mode() === "block" && active()',
    '[class.page-loader-host--inline]': 'mode() === "inline" && active()',
    '[class.page-loader-host--reader]': 'variant() === "public" && skeleton() === "reader"',
  },
})
export class PageLoaderComponent implements OnDestroy {
  readonly active = input(true);
  readonly variant = input<'public' | 'admin'>('public');
  readonly mode = input<'block' | 'inline' | 'overlay'>('block');
  readonly label = input('Loading…');
  readonly delay = input(150);
  readonly inverse = input(false);
  readonly skeleton = input<'stories' | 'article' | 'board' | 'form' | 'reader'>('stories');
  readonly visible = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(onCleanup => {
      const active = this.active();
      const delay = this.delay();
      clearTimeout(this.timer);
      this.visible.set(false);
      if (active) {
        if (delay <= 0) this.visible.set(true);
        else this.timer = setTimeout(() => this.visible.set(true), delay);
      }
      onCleanup(() => clearTimeout(this.timer));
    });
  }

  ngOnDestroy(): void { clearTimeout(this.timer); }
}
