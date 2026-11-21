import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  EventEmitter,
  computed,
  inject,
  signal,
  AfterViewChecked
} from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { AdminAuthService } from '../../../../core/services/admin-auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { PublicationDatePipe } from '../../../../shared/pipes/publication-date.pipe';

@Component({
  selector: 'app-admin-header',
  imports: [CommonModule, PublicationDatePipe],
  standalone: true,
  // Keep the stream and unread state within this authenticated admin view.
  providers: [NotificationService],
  templateUrl: './admin-header.html',
  styleUrl: './admin-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHeaderComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input() isMobileView = false;
  @Input() isSidebarOpen = true;
  @Output() menuToggle = new EventEmitter<void>();

  @ViewChild('notificationContainer')
  private notificationContainer?: ElementRef<HTMLElement>;

  @ViewChild('notificationButton')
  private notificationButton?: ElementRef<HTMLButtonElement>;

  @ViewChild('notificationPanel')
  private notificationPanel?: ElementRef<HTMLElement>;

  private notificationService = inject(NotificationService);
  private readonly auth = inject(AdminAuthService);

  readonly now = signal(new Date());
  private minuteAlignmentTimer?: ReturnType<typeof setTimeout>;
  private minuteTimer?: ReturnType<typeof setInterval>;
  private hasFocusedDropdown = false;

  private readonly me = toSignal(this.auth.me(), { initialValue: null, });

  readonly adminName = computed(() => String(this.me()?.user?.username ?? 'Admin'));
  readonly adminRole = computed(() => {
    const role = this.me()?.user?.role;
    if (role === 'admin') return 'Administrator';
    if (role === 'staff') return 'Staff';
    return '—';
  });

  /** Proxy to the service signal so the template binds to live data. */
  readonly notifications = this.notificationService.notifications;
  readonly notificationsLoading = this.notificationService.loading;
  readonly notificationsError = this.notificationService.error;
  readonly notificationsSessionExpired = this.notificationService.sessionExpired;
  readonly markingNotificationsRead = this.notificationService.markingRead;

  readonly dropdownOpen = signal(false);

  toggleNotifications(): void {
    if (this.dropdownOpen()) {
      this.closeNotifications(true);
      return;
    }

    this.dropdownOpen.set(true);
  }

  closeNotifications(
    restoreFocus = false
  ): void {
    if (!this.dropdownOpen()) {
      return;
    }

    this.dropdownOpen.set(false);

    if (restoreFocus) {
      queueMicrotask(() => {
        this.notificationButton
          ?.nativeElement
          .focus();
      });
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllRead();
  }

  retryNotifications(): void {
    this.notificationService.refresh();
  }

  get unreadCount(): number {
    return this.notifications().length;
  }

  // Close dropdown when clicking outside
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.dropdownOpen()) {
      return;
    }

    const container =
      this.notificationContainer?.nativeElement;

    const target = event.target;

    if (
      !container ||
      !(target instanceof Node) ||
      container.contains(target)
    ) {
      return;
    }

    this.closeNotifications();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    if (
      !(event instanceof KeyboardEvent) ||
      !this.dropdownOpen()
    ) {
      return;
    }

    event.preventDefault();
    this.closeNotifications(true);
  }

@HostListener('document:keydown', ['$event'])
onKeydown(event: KeyboardEvent): void {

  if (
    !this.dropdownOpen() ||
    event.key !== 'Tab'
  ) {
    return;
  }

  const panel =
    this.notificationPanel?.nativeElement;

  if (!panel) return;

  const focusable = panel.querySelectorAll<HTMLElement>(
    `
      button,
      a[href],
      input,
      select,
      textarea,
      [tabindex]:not([tabindex="-1"])
    `
  );

  if (!focusable.length) {
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (
    event.shiftKey &&
    document.activeElement === first
  ) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (
    !event.shiftKey &&
    document.activeElement === last
  ) {
    event.preventDefault();
    first.focus();
  }
}

  ngOnInit(): void {
    this.now.set(new Date());

    const millisecondsUntilNextMinute =
      60_000 - (Date.now() % 60_000);

    this.minuteAlignmentTimer = setTimeout(() => {
      this.now.set(new Date());

      this.minuteTimer = setInterval(() => {
        this.now.set(new Date());
      }, 60_000);
    }, millisecondsUntilNextMinute);
  }

  ngOnDestroy(): void {
    if (this.minuteAlignmentTimer) {
      clearTimeout(this.minuteAlignmentTimer);
    }

    if (this.minuteTimer) {
      clearInterval(this.minuteTimer);
    }
  }

  ngAfterViewChecked(): void {
    if (
      this.dropdownOpen() &&
      !this.hasFocusedDropdown &&
      this.notificationPanel
    ) {
      this.notificationPanel.nativeElement.focus();
      this.hasFocusedDropdown = true;
    }

    if (!this.dropdownOpen()) {
      this.hasFocusedDropdown = false;
    }
  }
}
