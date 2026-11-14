import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ActionDialog } from '../../directives/action-dialog';
let nextId = 0;
@Component({selector:'app-confirmation-modal',standalone:true,imports:[CommonModule,ActionDialog],templateUrl:'./confirmation-modal.html',styleUrl:'../../styles/action-dialog.scss'})
export class ConfirmationModal {
  readonly dialogId = 'confirmation-dialog-' + nextId++;
  title = input<string>('Confirm Action');
  message = input<string>('Are you sure you want to proceed?');
  confirmText = input<string>('Confirm');
  cancelText = input<string>('Cancel');
  isOpen = input<boolean>(false);
  variant = input<'default' | 'danger'>('default');
  confirmed = output<void>();
  cancelled = output<void>();
  close() { this.cancelled.emit(); }
  confirm() { this.confirmed.emit(); }
}
