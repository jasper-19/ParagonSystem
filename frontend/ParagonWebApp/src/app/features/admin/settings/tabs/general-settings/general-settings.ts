import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

interface GeneralSettingsFormValue {
  logo: File | string | null;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  pagination: number;
  landingPage: string;
  breadcrumbs: boolean;
}

interface GeneralSettings {
  logo: string | null;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  pagination: number;
  landingPage: string;
  breadcrumbs: boolean;
}

@Component({
  selector: 'app-general-settings',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './general-settings.html',
})
export class GeneralSettingsComponent implements OnInit {
  logoPreview: string | null = null;
  isSubmitting = false;

  form!: FormGroup<{
    logo: FormControl<File | string | null>;
    timezone: FormControl<string>;
    dateFormat: FormControl<string>;
    timeFormat: FormControl<string>;
    pagination: FormControl<number>;
    landingPage: FormControl<string>;
    breadcrumbs: FormControl<boolean>;
  }>;

  readonly systemInfo = {
    systemName: 'CSU Gonzaga Paragon Publication System',
    organization: 'Cagayan State University - Gonzaga'
  }

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.initializeForm();
    this.loadSettings();
  }

  private initializeForm() {
    this.form = new FormGroup({
      logo: new FormControl<File | string | null>(null),
      timezone: new FormControl<string>('Asia/Manila', { nonNullable: true, validators: Validators.required }),
      dateFormat: new FormControl<string>('YYYY-MM-DD', { nonNullable: true, validators: Validators.required }),
      timeFormat: new FormControl<string>('12h', { nonNullable: true, validators: Validators.required }),
      pagination: new FormControl<number>(10, { nonNullable: true, validators: [Validators.required, Validators.min(5), Validators.max(100)] }),
      landingPage: new FormControl<string>('dashboard', { nonNullable: true, validators: Validators.required }),
      breadcrumbs: new FormControl<boolean>(true, { nonNullable: true })
    });
  }

  private loadSettings() {
    //TODO: Replace with API call to load settings from backend
    const mockData: GeneralSettings = {
      logo: null,
      timezone: 'Asia/Manila',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '12h',
      pagination: 10,
      landingPage: 'dashboard',
      breadcrumbs: true
    }
    this.form.patchValue(mockData);
    this.logoPreview = mockData.logo;
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.form.controls.logo.setValue(file);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.logoPreview = reader.result;
      }
    };
    reader.readAsDataURL(file);
  }
  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const formData = new FormData();
    const values = this.form.getRawValue() as {
      logo: File | string | null;
      timezone: string;
      dateFormat: string;
      timeFormat: string;
      pagination: number;
      landingPage: string;
      breadcrumbs: boolean;
    };

    (Object.keys(values) as Array<keyof typeof values>).forEach((key) => {
      const val = values[key];

      if (val instanceof File) {
        formData.append(String(key), val);
      } else if (val !== null && typeof val === 'object') {
        formData.append(String(key), JSON.stringify(val));
      } else {
        formData.append(String(key), String(val ?? ''));
      }
    });

    // TODO: Replace with API call to save settings to backend
    setTimeout(() => {
      console.log('Settings saved:', values);
      this.isSubmitting = false;
      alert('Settings saved successfully!');
    }, 1000);
  }
}
