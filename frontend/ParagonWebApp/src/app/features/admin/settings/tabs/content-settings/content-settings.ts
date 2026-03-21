import { Component, OnInit } from "@angular/core";
import { ReactiveFormsModule,FormBuilder, FormGroup } from "@angular/forms";
import { ContentSettigns } from "../../../../../models/content-settings.model";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";

@Component({
  selector: 'app-content-settings',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule],
  templateUrl: './content-settings.html',
})

export class ContentSettingsComponent implements OnInit {

  form!:  FormGroup;
  saving = false

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.initForm();
    this.loadSettings();
  }

  private initForm(): void {
    this.form = this.fb.group({
      autoPublish: [false],
      requiredApproval: [false],
      allowDrafts: [true],

      schedulingEnabled: [false],
      defaultPublishDelayMinutes: [0],
      contentExpirationDays: [null],

      requiredFeatureImage: [false],
      allowMultipleCategories: [true],
      allowTags: [true],

      maxWordCount: [null],

      enableRevisionHistory: [true],

      maxImageSizeMB: [5],
      allowedFileTypes: ['jpg', 'png', 'webp'],

      enableMediaCompression: [false],
    });
  }

  private loadSettings(): void {
    //TODO: Replace with API later
    const mockSettings: ContentSettigns = {
      autoPublish: true,
      requiredApproval: false,
      allowDrafts: true,
      schedulingEnabled: true,
      defaultPublishDelayMinutes: 15,
      contentExpirationDays: 30,
      requiredFeatureImage: true,
      allowMultipleCategories: true,
      allowTags: true,
      maxWordCount: 2000,
      enableRevisionHistory: true,
      maxImageSizeMB: 5,
      allowedFileTypes: ['jpg', 'png', 'webp'],
      enableMediaCompression: false,
    };

    this.form.patchValue(mockSettings);
  }

  submit() {
    if (this.form.invalid) return;

    this.saving = true;

    const value: ContentSettigns = this.form.getRawValue();

    //TODO: Call API to save settings
    console.log('Saving content settings:', value);

    setTimeout(() => {
      this.saving = false;
      alert('Content settings updated!');
    }, 800);
  }
}
