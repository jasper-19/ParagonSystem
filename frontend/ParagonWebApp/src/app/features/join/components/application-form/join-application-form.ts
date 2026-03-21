import {
  Component,
  inject,
  Input,
  signal,
  computed,
  effect
} from '@angular/core';

import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators
} from '@angular/forms';

import { toSignal } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';

import { JoinPosition } from '../../models/join-position.model';
import { JoinApplication, YearLevel } from '../../models/join-application.model';
import { ApplicationService } from '../../../../core/services/application.service';

import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { SuccessModal } from '../../../../shared/components/feedback-modal/success-modal';
import { ErrorModal } from '../../../../shared/components/feedback-modal/error-modal';
import { CollegeService } from '../../services/college.service';
import { College } from '../../models/college.model';
@Component({
  selector: 'app-join-application-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ConfirmationModal,
    SuccessModal,
    ErrorModal,
  ],
  templateUrl: './join-application-form.html',
})
export class JoinApplicationForm {

  // ========================
  // INPUTS (Signal-backed)
  // ========================

  private _positions = signal<JoinPosition[]>([]);
  @Input()
  set positions(value: JoinPosition[]) {
    this._positions.set(value || []);
  }
  get positions(): JoinPosition[] {
    return this._positions();
  }

  private _preselectedPosition = signal<string | null>(null);
  @Input()
  set preselectedPosition(value: string | null) {
    this._preselectedPosition.set(value ?? null);
  }
  get preselectedPosition(): string | null {
    return this._preselectedPosition();
  }

  // ========================
  // SERVICES
  // ========================

  private fb = inject(FormBuilder);
  private applicationService = inject(ApplicationService);
  private collegeService = inject(CollegeService);

  // ========================
  // UI STATE
  // ========================

  readonly YEAR_LEVEL_OPTIONS: { value: string; label: string }[] = [
    { value: '1st_year', label: '1st Year' },
    { value: '2nd_year', label: '2nd Year' },
    { value: '3rd_year', label: '3rd Year' },
    { value: '4th_year', label: '4th Year' },
  ];

  readonly isSubmitting = signal(false);
  readonly showConfirmModal = signal(false);
  readonly showSuccessModal = signal(false);
  readonly showErrorModal = signal(false);
  readonly colleges = toSignal(
    this.collegeService.getColleges(),
    { initialValue: [] as College[] }
  );

  // ========================
  // FORM (nonNullable = strict typing)
  // ========================

  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    studentId: ['',
      [Validators.required,
      Validators.pattern(/^\d{2}-\d{5}$/)
      ]
    ],
    yearLevel: ['', Validators.required],
    collegeId: ['', Validators.required],
    programId: ['', Validators.required],
    positionId: ['', Validators.required],
    subRole: ['', Validators.required],
    motivation: ['', [Validators.required, Validators.minLength(30)]],
  });

  // ========================
  // REACTIVE SIGNALS
  // ========================

  private positionIdSignal = toSignal(
    this.form.get('positionId')!.valueChanges,
    { initialValue: this.form.get('positionId')!.value }
  );

  private collegeIdSignal = toSignal(
    this.form.get('collegeId')!.valueChanges,
    { initialValue: this.form.get('collegeId')!.value }
  );

  // ========================
  // COMPUTED VALUES
  // ========================

  readonly subRoleOptions = computed(() => {
    const positionId = this.positionIdSignal();
    const positions = this._positions(); // IMPORTANT: use signal

    const pos = positions.find(p => p.id === positionId);
    return pos?.subRoles?.map(s => s.name) ?? [];
  });

  readonly availablePrograms = computed(() => {
    const collegeId = this.collegeIdSignal();
    const college = this.colleges().find(c => c.id === collegeId);
    return college?.programs ?? [];
  });

  // ========================
  // EFFECTS
  // ========================

  constructor() {

    // Preselect position
    effect(() => {
      const position = this._preselectedPosition();
      if (position) {
        this.form.patchValue({ positionId: position });
      }
    });

    // SubRole validation
    effect(() => {
      const options = this.subRoleOptions();
      const subRoleControl = this.form.get('subRole');

      if (!subRoleControl) return;

      if (options.length > 0) {
        subRoleControl.setValidators([Validators.required]);
      } else {
        subRoleControl.clearValidators();
        subRoleControl.reset();
      }

      subRoleControl.updateValueAndValidity();
    });

    // Program validation
    effect(() => {
      const programs = this.availablePrograms();
      const programControl = this.form.get('programId');

      if (!programControl) return;

      if (programs.length > 0) {
        programControl.setValidators([Validators.required]);
      } else {
        programControl.clearValidators();
        programControl.reset();
      }

      programControl.updateValueAndValidity();
    });
  }

  // ========================
  // SUBMIT FLOW
  // ========================

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.showConfirmModal.set(true);
  }

  confirmSubmission() {

    if (this.form.invalid) {
      this.showConfirmModal.set(false);
      this.form.markAllAsTouched();
      return;
    }

    this.showConfirmModal.set(false);
    this.isSubmitting.set(true);

    const value = this.form.getRawValue();

    const payload: JoinApplication = {
      fullName: value.fullName,
      email: value.email,
      studentId: value.studentId,
      yearLevel: value.yearLevel as YearLevel,
      collegeId: value.collegeId,
      programId: value.programId,
      positionId: value.positionId,
      subRole: value.subRole || undefined,
      motivation: value.motivation
    };

    this.applicationService.submit(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.form.reset();
        this.showSuccessModal.set(true);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.showErrorModal.set(true);
      }
    });
  }
}
