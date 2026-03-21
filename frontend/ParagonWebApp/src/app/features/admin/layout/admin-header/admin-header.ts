import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  EventEmitter,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { AdminAuthService } from '../../../../core/services/admin-auth.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-admin-header',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './admin-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHeaderComponent implements OnInit, OnDestroy {
  @Input() isMobileView = false;
  @Input() isSidebarOpen = true;
  @Output() menuToggle = new EventEmitter<void>();

  private notificationService = inject(NotificationService);
  private auth = inject(AdminAuthService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  readonly now = signal(new Date());
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;

  private readonly me = toSignal(this.auth.me(), { initialValue: null as any });

  readonly adminName = computed(() => String(this.me()?.user?.username ?? 'Admin'));
  readonly adminRole = computed(() => {
    const role = this.me()?.user?.role;
    if (role === 'admin') return 'Administrator';
    if (role === 'staff') return 'Staff';
    return '—';
  });

  /** Proxy to the service signal so the template binds to live data. */
  readonly notifications = this.notificationService.notifications;

  readonly dropdownOpen = signal(false);

  toggleNotifications(): void {
    this.dropdownOpen.update(v => !v);
  }

  closeNotifications(): void {
    this.dropdownOpen.set(false);
  }

  markAllAsRead(): void {
    this.notificationService.markAllRead();
    this.closeNotifications();
  }

  get unreadCount(): number {
    return this.notifications().length;
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.relative');

    if (!clickedInside && this.dropdownOpen()) {
      this.closeNotifications();
    }
  }

  ngOnInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        if (this.destroyed) return;
        this.now.set(new Date());
        this.cdr.detectChanges();
      }, 1000);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearInterval(this.timer);
  }
}
