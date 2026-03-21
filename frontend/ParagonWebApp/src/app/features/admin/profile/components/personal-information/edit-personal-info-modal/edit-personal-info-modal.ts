import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-personal-info-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-personal-info-modal.html'
})
export class EditPersonalInfoModal implements OnChanges {

  @Input() isOpen = false;
  @Input() user: any;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  editData: any = {};

  ngOnChanges(): void {
    if (this.user) {
      this.editData = { ...this.user };
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  saveChanges(): void {
    this.save.emit(this.editData);
  }
}
