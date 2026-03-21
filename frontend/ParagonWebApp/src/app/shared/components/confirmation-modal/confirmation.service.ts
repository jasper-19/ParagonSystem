import { Injectable, signal } from '@angular/core';

export type ConfirmationVariant = 'default' | 'danger';

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationVariant;
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  readonly isOpen = signal(false);
  readonly title = signal('Confirm Action');
  readonly message = signal('Are you sure you want to proceed?');
  readonly confirmText = signal('Confirm');
  readonly cancelText = signal('Cancel');
  readonly variant = signal<ConfirmationVariant>('default');

  private resolver: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmationOptions): Promise<boolean> {
    // If a confirmation is already open, cancel it.
    this.resolver?.(false);
    this.resolver = null;

    this.title.set(options.title);
    this.message.set(options.message);
    this.confirmText.set(options.confirmText ?? 'Confirm');
    this.cancelText.set(options.cancelText ?? 'Cancel');
    this.variant.set(options.variant ?? 'default');

    this.isOpen.set(true);

    return new Promise<boolean>(resolve => {
      this.resolver = resolve;
    });
  }

  accept(): void {
    this.isOpen.set(false);
    this.resolver?.(true);
    this.resolver = null;
  }

  cancel(): void {
    this.isOpen.set(false);
    this.resolver?.(false);
    this.resolver = null;
  }
}
