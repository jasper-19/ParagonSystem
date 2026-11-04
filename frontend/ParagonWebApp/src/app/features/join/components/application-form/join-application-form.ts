import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  HostListener,
  Input,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, Subject } from 'rxjs';
import { catchError, startWith, switchMap, tap } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { JoinPosition } from '../../models/join-position.model';
import { JoinApplication, YearLevel } from '../../models/join-application.model';
import { ApplicationService } from '../../../../core/services/application.service';
import { CollegeService } from '../../services/college.service';
import { College } from '../../models/college.model';

@Component({
  selector: 'app-join-application-form',
  standalone: true,
  imports: [ CommonModule, ReactiveFormsModule, RouterModule, ],
  templateUrl: './join-application-form.html',
})

export class JoinApplicationForm {
  @ViewChild('applicationForm')
  private applicationForm?: ElementRef<HTMLFormElement>;
  @ViewChild('submissionDialog')
  private submissionDialog?: ElementRef<HTMLElement>;
  private readonly destroyRef = inject(DestroyRef);
  private feedbackOpen = false;
  private feedbackFocus: HTMLElement | null = null;
  private previousOverflow = '';
  private feedbackTimer?: ReturnType<typeof setTimeout>;

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
  readonly collegeError = signal(false);
  readonly collegesLoading = signal(true);
  private readonly collegeRequests = new Subject<void>();
  readonly colleges = toSignal(
    this.collegeRequests.pipe(
      startWith(undefined),
      switchMap(() => {
        this.collegeError.set(false);
        this.collegesLoading.set(true);
        return this.collegeService.getColleges().pipe(
          tap(() => this.collegesLoading.set(false)),
          catchError(() => {
            this.collegeError.set(true);
            this.collegesLoading.set(false);
            return of([] as College[]);
          })
        );
      })
    ),
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
    effect(() => {
      const open = this.showConfirmModal() || this.showSuccessModal() || this.showSubmissionError();
      if (open && !this.feedbackOpen) {
        this.feedbackFocus = document.activeElement as HTMLElement | null;
        this.previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        clearTimeout(this.feedbackTimer);
        this.feedbackTimer = setTimeout(() => this.submissionDialog?.nativeElement.focus());
      } else if (!open && this.feedbackOpen) {
        document.body.style.overflow = this.previousOverflow;
        clearTimeout(this.feedbackTimer);
        this.feedbackTimer = setTimeout(() => this.feedbackFocus?.focus());
      }
      this.feedbackOpen = open;
    });
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.feedbackTimer);
      if (this.feedbackOpen) document.body.style.overflow = this.previousOverflow;
    });

    // Preselect position
    effect(() => {
      const position = this._preselectedPosition();
      const positions = this._positions();
      if (position) {
        this.selectedPositions.set(positions.some(item => item.id === position) ? [
          { positionId: position, categories: [] }
        ] : []);
      }
    });

    // Program validation
    effect(() => {
      const programs = this.availablePrograms();
      const programControl = this.form.get('programId');

      if (!programControl) return;

      if (programs.length > 0) {
        programControl.enable({ emitEvent: false });
        if (!programs.some(program => program.id === programControl.value)) {
          programControl.reset('', { emitEvent: false });
        }
        programControl.setValidators([Validators.required]);
      } else {
        programControl.clearValidators();
        programControl.reset('', { emitEvent: false });
        programControl.disable({ emitEvent: false });
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
    if (this.isSubmitting()) return;
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
      const invalidPosition = this.selectedPositions().find(selected => {
        const position = this.positions.find(item => item.id === selected.positionId);
        return (position?.subRoles?.length ?? 0) > 0 && selected.categories.length === 0;
      });
      const positionInput = invalidPosition
        ? [...(form?.querySelectorAll<HTMLElement>('[data-position-input]') ?? [])].find(input => input.dataset['positionInput'] === invalidPosition.positionId)
        : form?.querySelector<HTMLElement>('[data-position-input]');
      const target = form?.querySelector<HTMLElement>('.ng-invalid:not(form)') ?? positionInput;

      target?.focus();
      target?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      });
    });
  }

  closeFeedback(): void {
    this.showConfirmModal.set(false);
    this.showSuccessModal.set(false);
    this.showSubmissionError.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onFeedbackKeydown(event: KeyboardEvent): void {
    if (!this.feedbackOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeFeedback();
      return;
    }
    if (event.key !== 'Tab') return;
    const panel = this.submissionDialog?.nativeElement;
    const buttons = panel?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    if (!buttons?.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  retryColleges(): void {
    this.collegeRequests.next();
  }
}
