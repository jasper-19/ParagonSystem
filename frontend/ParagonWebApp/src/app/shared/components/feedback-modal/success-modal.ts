import { Component, input, output } from '@angular/core';
import { ActionDialog } from '../../directives/action-dialog';
let nextId = 0;
@Component({selector:'app-success-modal',standalone:true,imports:[ActionDialog],templateUrl:'./success-modal.html',styleUrl:'../../styles/action-dialog.scss'})
export class SuccessModal {
  readonly dialogId = 'success-dialog-' + nextId++;
  isOpen = input<boolean>(false);
  title = input<string>('Success');
  message = input<string>('Operation completed successfully.');

  buttonText = input<string>('Close');
  closed = output<void>();
  close() { this.closed.emit(); }
}
