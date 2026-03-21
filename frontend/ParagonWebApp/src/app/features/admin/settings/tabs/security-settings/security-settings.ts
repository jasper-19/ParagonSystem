import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterModule } from "@angular/router";

interface SecuritySettings {
  maxLoginAttempts  : number;
  lockoutDuration: number; // in minutes
  sessionTimeout: number; // in minutes
  requireStrongPasswords: boolean;
  enable2FA: boolean;
  enableActivityLogs: boolean;
}

@Component({
  selector: 'app-security-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './security-settings.html',
})

export class SecuritySettingsComponent implements OnInit {

  form!: FormGroup;
  isSubmitting = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadSettings();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      maxLoginAttempts: [5, [Validators.required, Validators.min(3), Validators.max(10)]],
      lockoutDuration: [10, [Validators.required, Validators.min(5), Validators.max(60)]],
      sessionTimeout: [30, [Validators.required, Validators.min(5), Validators.max(120)]],
      requireStrongPasswords: [true, [Validators.required]],
      enable2FA: [false, [Validators.required]],
      enableActivityLogs: [true, [Validators.required]]
    });
  }

  private loadSettings(): void {
    // TODO: Replace with API
    const mockSettings: SecuritySettings = {
      maxLoginAttempts: 5,
      lockoutDuration: 15,
      sessionTimeout: 30,
      requireStrongPasswords: true,
      enable2FA: false,
      enableActivityLogs: true
    };

    this.form.patchValue(mockSettings);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const settings: SecuritySettings = this.form.getRawValue();

    //TODO: API Call
    setTimeout(() => {
      console.log('Security Settings Saved:', settings);
      this.isSubmitting = false;
      alert('Security settings updated!');
    }, 800);
  }
}
