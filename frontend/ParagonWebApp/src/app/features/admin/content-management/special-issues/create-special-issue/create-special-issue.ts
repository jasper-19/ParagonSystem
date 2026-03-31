import { ConfirmationModal } from '../../../../../shared/components/confirmation-modal/confirmation-modal';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AsyncValidatorFn, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SpecialIssue, SpecialIssueType } from '../../../../../models/special-issue.model';
import { SpecialIssueService } from '../../../../../core/services/special-issue.service';
import { of, timer } from 'rxjs';
import { catchError, finalize, map, switchMap, take } from 'rxjs/operators';
import { CoverImagSelectorComponent } from '../../../media-library/components/cover-image-selector/cover-image-selector';
import { Media } from '../../../../../models/media.model';

type IssueStatus = SpecialIssue['status'];

@Component({
	selector: 'app-create-special-issue',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, ConfirmationModal, CoverImagSelectorComponent],
	templateUrl: './create-special-issue.component.html'
})
export class CreateSpecialIssueComponent {

	private fb = inject(NonNullableFormBuilder);
	private router = inject(Router);
	private route = inject(ActivatedRoute);
	private issueService = inject(SpecialIssueService);

	readonly editingId = signal<string | null>(null);
	readonly isEditMode = computed(() => this.editingId() !== null);

	readonly isSubmitting = signal(false);
	readonly slugManuallyEdited = signal(false);
	readonly selectedCoverMedia = signal<Media | null>(null);
	readonly selectedPdfName = signal<string | null>(null);

	readonly types: SpecialIssueType[] = ['Tabloid', 'Newsletter', 'Literary Folio'];
	readonly statuses: IssueStatus[] = ['draft', 'published'];

  //Confirm Modal State
  readonly showConfirmModal = signal(false);
  readonly confirmTitle = signal('');
  readonly confirmMessage = signal('');
  readonly confirmButtonText = signal('');

  //Minimum published date signal
  readonly minPublishDate = signal<string | null>(null);

	private readonly slugUniqueAsyncValidator: AsyncValidatorFn = (control) => {
		const slug = (control.value ?? '').toString();
		if (!slug) return of(null);

		return timer(250).pipe(
			switchMap(() => this.issueService.isSlugTaken(slug, this.editingId() ?? undefined)),
			map((taken) => (taken ? { slugTaken: true } : null)),
			catchError(() => of(null)),
			take(1)
		);
	};


  // Publish Date Validator: Ensures the publish date falls within the selected academic year
    private publishDateValidator = (control: import('@angular/forms').AbstractControl) => {

    const publishDate = control.value
    const academicYear = this.form?.controls.academicYear.value;

    if (!publishDate || !academicYear) return null;

    const startYear = parseInt(academicYear.split('-')[0], 10);
    const publishYear  = new Date(publishDate).getFullYear();

    if (publishYear < startYear) {
      return { publishDateTooEarly: true };
    }

    return null;
  }

  //Academic Year Validator
  private academicYearValidator = (control: import('@angular/forms').AbstractControl) => {
    const value = control.value;

    if (!value) return null;

    //must match YYYY-YYYY format
    const match = value.match(/^(\d{4})-(\d{4})$/);

    if (!match) {
      return { invalidAcademicYear: true };
    }

    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);

    if (end !== start + 1) {
      return { invalidAcademicYear: true };
    }

    return null;
  }

	readonly form = this.fb.group({
		title: ['', Validators.required],
		slug: ['', {
			validators: [Validators.required],
			asyncValidators: [this.slugUniqueAsyncValidator],
		}],
		type: ['Tabloid' as SpecialIssueType, Validators.required],
		academicYear: [
      '',
      [
        Validators.required, this.academicYearValidator]
    ],
		description: [''],
		coverImage: ['', Validators.required],
		pdfUrl: ['', Validators.required],
		publishedAt: [this.toDateInputValue(new Date()),
      [Validators.required, this.publishDateValidator]],
		status: ['draft' as IssueStatus, Validators.required]
	});

	readonly pdfDisplayText  = signal<string | null>(null);

	constructor() {
		this.initEditModeFromRoute();
		this.setupSlugAutoGeneration();

    this.form.controls.academicYear.valueChanges.subscribe(year => {

      if (!year) return;

      //expectd format: "2025-2026"
      const startYear = parseInt(year.split('-')[0], 10);

      if (!isNaN(startYear)) {

        const minDate = new Date(startYear, 0, 1);

        const minDateString = this.toDateInputValue(minDate);

        this.minPublishDate.set(minDateString);

        const currentDate = this.form.controls.publishedAt.value;

        if (currentDate && currentDate < minDateString) {
          this.form.controls.publishedAt.setValue(minDateString);
        }
      }
    });

	}

	private initEditModeFromRoute(): void {
    const slugParam = this.route.snapshot.paramMap.get('slug');
    if (!slugParam) return;

    const slug = String(slugParam).trim();
    if (!slug) return;

    this.isSubmitting.set(true);
    this.issueService.getIssueBySlug(slug).pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
			next: (issue) => {
				this.editingId.set(issue.id);
				this.loadIssueForEdit(issue.id);
			},
			error: () => {
				this.router.navigate(['/admin/all-special-issues']);
			},
		});
	}

	private loadIssueForEdit(id: string): void {
		const issue = this.issueService.getById(id);
		if (!issue) {
			this.router.navigate(['/admin/all-special-issues']);
			return;
		}

		this.slugManuallyEdited.set(true);
		this.form.patchValue({
			title: issue.title,
			slug: issue.slug,
			type: issue.type,
			academicYear: issue.academicYear,
			description: issue.description ?? '',
			coverImage: issue.coverImage,
			pdfUrl: issue.pdfUrl,
			publishedAt: this.toDateInputValue(new Date(issue.publishedAt)),
			status: issue.status
		}, { emitEvent: false });

		this.selectedCoverMedia.set(this.buildMediaFromUrl(issue.coverImage));
		this.pdfDisplayText.set(this.fileLabel(issue.pdfUrl));
		this.setMinPublishDateForAcademicYear(issue.academicYear);
	}

	private setupSlugAutoGeneration(): void {
		const titleControl = this.form.controls.title;
		const slugControl = this.form.controls.slug;

		titleControl.valueChanges.subscribe(title => {
			if (this.slugManuallyEdited()) return;
			const generated = this.generateSlug(title);
			slugControl.setValue(generated, { emitEvent: false });
		});
	}

	onSlugInput(): void {
		const value = this.form.controls.slug.value;
		if (!value) {
			this.slugManuallyEdited.set(false);
			return;
		}
		this.slugManuallyEdited.set(true);
	}

  private executeSave(): void {

  if (this.form.invalid || this.isSubmitting()) return;

  this.isSubmitting.set(true);

	const value = this.form.getRawValue();

	const existingIssue = this.isEditMode() ? this.issueService.getById(this.editingId()!) : undefined;
	const isPublishingNow = value.status === 'published' && (!existingIssue || existingIssue.status !== 'published');
	const publishedAt =
		value.status === 'published'
			? (isPublishingNow ? new Date() : (existingIssue?.publishedAt ?? new Date()))
			: new Date(value.publishedAt);

	const payload: Omit<SpecialIssue, 'id'> = {
		title: value.title,
		slug: value.slug,
		type: value.type,
		academicYear: value.academicYear,
		description: value.description || undefined,
		coverImage: value.coverImage,
		pdfUrl: value.pdfUrl,
		publishedAt,
		status: value.status
	};

	const request$ = this.isEditMode()
		? this.issueService.updateIssue(this.editingId()!, payload)
		: this.issueService.createIssue(payload);

	request$.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
		next: () => this.router.navigate(['/admin/all-special-issues']),
		error: (err) => console.error('Failed to save special issue:', err),
	});
}

  submit(): void {
  if (this.form.invalid || this.isSubmitting()) return;

  const isEdit = this.isEditMode();
  const status = this.form.controls.status.value;

  this.confirmTitle.set(
    isEdit ? 'Update Special Issue?' : 'Create Special Issue?'
  );

  this.confirmMessage.set(
    status === 'published'
      ? 'This issue will be publicly visible immediately.'
      : 'Save this special issue?'
  );

  this.confirmButtonText.set(
    isEdit ? 'Update' : 'Create'
  );

  this.showConfirmModal.set(true);
}

  onConfirmSave (): void {
  this.showConfirmModal.set(false);
  this.executeSave();
}

  onCancelSave(): void {
  this.showConfirmModal.set(false);
}

	private pdfObjectUrl: string | null = null;

	onCoverMediaChange(media: Media | null): void {
		this.selectedCoverMedia.set(media);
		this.form.controls.coverImage.setValue(media?.fileUrl || media?.filePath || '');
		this.form.controls.coverImage.markAsDirty();
	}

	onPdfSelected(event: Event): void {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;

	this.selectedPdfName.set(file.name);
	this.pdfDisplayText.set(file.name);

	const reader = new FileReader();
	reader.onload = () => {
		const result = reader.result as string;
		this.form.controls.pdfUrl.setValue(result);
		this.form.controls.pdfUrl.markAsDirty();
		this.form.controls.pdfUrl.markAsTouched();
	};

	reader.readAsDataURL(file);

  if (input) input.value = '';
}

  removePdf(): void {
  this.pdfObjectUrl = null;
  this.pdfDisplayText.set(null);
	this.selectedPdfName.set(null);

  this.form.controls.pdfUrl.setValue('');
}

	ngOnDestroy(): void {}

	cancel(): void {
		this.router.navigate(['/admin/all-special-issues']);
	}

	private generateSlug(value: string): string {
		return (value ?? '')
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-');
	}

	private toDateInputValue(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	private setMinPublishDateForAcademicYear(year: string): void {
		if (!year) return;
		const startYear = parseInt(year.split('-')[0], 10);
		if (Number.isNaN(startYear)) return;

		const minDate = new Date(startYear, 0, 1);
		this.minPublishDate.set(this.toDateInputValue(minDate));
	}

	private fileLabel(url: string | null | undefined): string | null {
		if (!url) return null;
		const raw = String(url);
		if (raw.startsWith('data:')) return 'Uploaded file';
		const name = raw.split('/').pop() ?? raw;
		return decodeURIComponent(name);
	}

	private buildMediaFromUrl(url: string | null | undefined): Media | null {
		const imageUrl = String(url ?? '').trim();
		if (!imageUrl) return null;

		const fileName = imageUrl.split('/').pop() || 'cover-image';
		const fallbackType = fileName.includes('.') ? fileName.split('.').pop() : 'image';

		return {
			id: `cover-${imageUrl}`,
			fileName,
			filePath: imageUrl,
			fileUrl: imageUrl,
			fileType: 'image',
			mimeType: `image/${fallbackType}`,
			size: 0,
			createdAt: new Date().toISOString(),
		};
	}
}
