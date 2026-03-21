import {Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges} from "@angular/core";
import { CommonModule } from "@angular/common";
import {  ReactiveFormsModule, FormBuilder, FormGroup, Validators, } from "@angular/forms";

export interface UserFormValue {
  id?: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  password?: string;
}

@Component({
  selector: 'app-user-modal',
  standalone: true,
  imports : [CommonModule, ReactiveFormsModule],
  templateUrl: './user-modal.html',
})
export class UserModalComponent implements OnInit, OnChanges {

  @Input() isOpen = false;
  @Input() userData: UserFormValue | null = null

  @Output() save = new EventEmitter<UserFormValue>();
  @Output() close = new EventEmitter<void>();

  form!: FormGroup;
  isEditMode = false;
  isSubmitting = false;

  roles = ['Admin', 'User', 'Editor'];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes?: SimpleChanges): void {
    if (this.userData) {
      this.isEditMode = true;
      this.form.patchValue(this.userData);
    } else {
      this.isEditMode = false;
      this.form.reset({  status: 'active' , role: 'Staff' });
    }
  }

  initializeForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['Staff', Validators.required],
      status: ['active', Validators.required],
      password: ['', []], // Conditional
    });
  }

  submit(): void {
    if (!this.isEditMode) {
      this.form.get('password')?.setValidators([
        Validators.required,
        Validators.minLength(6)
      ]);
      this.form.get('password')?.updateValueAndValidity();
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const value: UserFormValue = {
      ...this.form.value,
      id: this.userData?.id
    };

    setTimeout(() => {
      this.save.emit(value);
      this.isSubmitting = false;
      this.close.emit();
    }, 500);
  }

  onClose(): void {
    this.close.emit();
  }
}
