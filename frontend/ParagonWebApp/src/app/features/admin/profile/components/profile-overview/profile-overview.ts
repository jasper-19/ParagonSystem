import { Component, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventEmitter } from '@angular/core';
import { StaffMember } from '../../../../../models/staff-member.model';
@Component({
  selector: 'app-profile-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-overview.html'
})
export class ProfileOverview {

  @Input() staff: StaffMember | null = null;

  avatarPreview: string | ArrayBuffer | null = null;
  defaultAvatar = 'assets/default-avatar.png';

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // For frontend only, just show a preview
    const reader = new FileReader();
    reader.onload = () => {
      this.avatarPreview = reader.result;
    };
    reader.readAsDataURL(file);
  }

  @Output() openEdit = new EventEmitter<void>();
}
