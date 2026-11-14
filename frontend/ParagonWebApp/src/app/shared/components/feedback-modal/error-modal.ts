import { Component, input, output } from '@angular/core';
import { ActionDialog } from '../../directives/action-dialog';
let nextId = 0;
@Component({selector:'app-error-modal',standalone:true,imports:[ActionDialog],templateUrl:'./error-modal.html',styleUrl:'../../styles/action-dialog.scss'})
export class ErrorModal {
  readonly dialogId = 'error-dialog-' + nextId++;
  isOpen = input<boolean>(false);
  title = input<string>('Something went wrong');
  message = input<string>('Please try again.');
  details = input<string[]>([]);
  buttonText = input<string>('Close');
  closed = output<void>();
  close() { this.closed.emit(); }
}
