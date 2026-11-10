import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StaffMember } from '../../../../../models/staff-member.model';

@Component({
  selector: 'app-profile-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-overview.html',
  styleUrl: './profile-overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileOverview {
  private readonly cdr = inject(ChangeDetectorRef);
  @Input() staff: StaffMember | null = null;
  @Input() loading = false;

  avatarPreview: string | ArrayBuffer | null = null;
  avatarStatus = '';

  get initials(): string {
    const name = this.staff?.fullName?.trim();
    if (!name) return 'A';

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.avatarStatus = 'Choose a PNG, JPEG, or WebP image.';
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.avatarStatus = 'Choose an image smaller than 5 MB.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.avatarPreview = reader.result;
      this.avatarStatus = 'Profile image preview updated. This preview is not saved yet.';
      this.cdr.markForCheck();
    };
    reader.onerror = () => {
      this.avatarStatus = 'The selected image could not be previewed.';
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }
}
