import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Input,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
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
  imports: [ CommonModule, ReactiveFormsModule, RouterModule, ConfirmationModal, SuccessModal, ErrorModal, ],
  templateUrl: './join-application-form.html',
})

export class JoinApplicationForm {
  @ViewChild('applicationForm')
  private applicationForm?: ElementRef<HTMLFormElement>;

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
  private readonly applicationService = inject(ApplicationService);
  private readonly collegeService = inject(CollegeService);

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
  readonly attemptedSubmit = signal(false);
  readonly showConfirmModal = signal(false);
  readonly showSuccessModal = signal(false);
  readonly showErrorModal = signal(false);
  readonly colleges = toSignal(
    this.collegeService.getColleges(),
    { initialValue: [] as College[] }
  );

  //ERROR MODAL STATE
  readonly showSubmissionError = signal(false);
  readonly submissionErrorTitle = signal('Unable to Submit Application');
  readonly submissionErrorMessage = signal(
    'An unexpected error occurred. Please try again.'
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
    motivation: ['', [Validators.required, Validators.minLength(30)]],
  });

  // ========================
  // REACTIVE SIGNALS
  // ========================

  private collegeIdSignal = toSignal(
    this.form.get('collegeId')!.valueChanges,
    { initialValue: this.form.get('collegeId')!.value }
  );

  // ========================
  // COMPUTED VALUES
  // ========================

  readonly availablePrograms = computed(() => {
    const collegeId = this.collegeIdSignal();
    const college = this.colleges().find(c => c.id === collegeId);
    return college?.programs ?? [];
  });

  readonly selectedPositions = signal<
    { positionId: string; categories: string[] }[]
    >([]);

  // ========================
  // EFFECTS
  // ========================

  constructor() {

    // Preselect position
    effect(() => {
      const position = this._preselectedPosition();
      if (position) {
        this.selectedPositions.set([
          { positionId: position, categories: [] }
        ]);
      }
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
    this.attemptedSubmit.set(true);

    if (
      this.form.invalid ||
      this.selectedPositions().length === 0 ||
      this.hasInvalidSelectedPosition()
    ) {
      this.form.markAllAsTouched();
      this.focusFirstInvalidField();
      return;
    }

    this.attemptedSubmit.set(false);
    this.showConfirmModal.set(true);
  }

  confirmSubmission() {
    if (
      this.form.invalid ||
      this.selectedPositions().length === 0 ||
      this.hasInvalidSelectedPosition()
    ) {
      this.showConfirmModal.set(false);
      this.attemptedSubmit.set(true);
      this.form.markAllAsTouched();
      this.focusFirstInvalidField();
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
      selectedPositions: this.selectedPositions(),
      motivation: value.motivation
    };

    this.applicationService.submit(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.form.reset();
        this.selectedPositions.set([]);
        this.attemptedSubmit.set(false);
        this.showSuccessModal.set(true);
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        const httpError = err as {
          status?: number;
          error?: {
            error?: string;
          };
        };
        if (httpError.status === 403) {
          this.submissionErrorTitle.set('Applications Are Closed');
          this.submissionErrorMessage.set(
            httpError.error?.error ??
            'Applications are no longer accepting submissions.'
          );
          this.showSubmissionError.set(true);
          this.applicationService.refreshApplicationSettings();
          return;
        }
        this.submissionErrorTitle.set('Unable to Submit Application');
        this.submissionErrorMessage.set(
          httpError.error?.error ??
          'An unexpected error occurred while submitting your application. Please try again.'
        );
        this.showSubmissionError.set(true);
      },
    });
  }

  isPositionSelected(positionId: string): boolean {
    return this.selectedPositions().some(p => p.positionId === positionId);
  }

  togglePosition(positionId: string): void {
    const current = this.selectedPositions();

    if (this.isPositionSelected(positionId)) {
      this.selectedPositions.set(
        current.filter(p => p.positionId !== positionId)
      );
      return;
    }

    this.selectedPositions.set([
      ...current,
      { positionId, categories: [] }
    ]);
  }

  isCategorySelected(positionId: string, category: string): boolean {
    return this.selectedPositions().some(
      p => p.positionId === positionId && p.categories.includes(category)
    );
  }

  toggleCategory(positionId: string, category: string): void {
    this.selectedPositions.update(current =>
      current.map(p => {
        if (p.positionId !== positionId) return p;

        const exists = p.categories.includes(category);

        return {
          ...p,
          categories: exists
            ? p.categories.filter(c => c !== category)
            : [...p.categories, category]
        };
      })
    );
  }

  hasInvalidSelectedPosition(): boolean {
    return this.selectedPositions().some(selected => {
      const position = this.positions.find(p => p.id === selected.positionId);
      const requiresCategories = (position?.subRoles?.length ?? 0) > 0;

      return !position || (requiresCategories && selected.categories.length === 0);
    });
  }

  private focusFirstInvalidField(): void {
    setTimeout(() => {
      const form = this.applicationForm?.nativeElement;
      const target = form?.querySelector<HTMLElement>(
        '.ng-invalid:not(form), [data-position-input]'
      );

      target?.focus();
      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }

  closeSubmissionError(): void {
    this.showSubmissionError.set(false);
  }
}
