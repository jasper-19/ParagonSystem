import { Component, inject, signal, ElementRef, HostListener, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  NonNullableFormBuilder,
  AsyncValidatorFn,
  ValidationErrors
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ArticleService } from '../../../../../core/services/article.service';
import { StaffService } from '../../../../../core/services/staff.service';
import { Article, ArticleCategory, ArticleStatus } from '../../../../../models/article.model';
import { RichTextEditorComponent } from '../../../../../shared/components/rich-text-editor/rich-text-editor';
import { Observable, combineLatest, startWith, of, timer } from 'rxjs';
import { BoardMember, EditorialBoardData } from '../../../../../models/editorial-board.model';
import { catchError, debounceTime, distinctUntilChanged, first, map, switchMap } from 'rxjs/operators';
import { ConfirmationModal } from '../../../../../shared/components/confirmation-modal/confirmation-modal';
import { CoverImagSelectorComponent } from '../../../media-library/components/cover-image-selector/cover-image-selector';
import { Media } from '../../../../../models/media.model';

interface CreateArticleForm {
  title: string;
  category: string;
  content: string;
  status: ArticleStatus;
  featured: boolean;
}

type CreditField = 'author' | 'photoby' | 'graphicby' | 'illusrationby';

@Component({
  selector: 'app-create-article',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RichTextEditorComponent, ConfirmationModal, CoverImagSelectorComponent],
  templateUrl: './create-article.html'
})
export class CreateArticleComponent {
  private fb = inject(NonNullableFormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private articleService = inject(ArticleService);
  private staffService = inject(StaffService);
  private elementRef = inject(ElementRef);

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() !== null);
  readonly originalArticle = signal<Article | null>(null);

  //EB Data
  private allMembers: BoardMember[] = [];

  //Credits Shared Signals
  readonly creditSuggestions = signal<BoardMember[]>([]);
  readonly activeCreditField = signal<CreditField | null>(null);
  readonly highlightedIndex  = signal<number>(-1);
  readonly creditInput = signal<Record<CreditField, string>>({
    author: '',
    photoby: '',
    graphicby: '',
    illusrationby: '',
  });
  readonly selectedCredits = signal<Record<CreditField, string[]>>({
    author: [],
    photoby: [],
    graphicby: [],
    illusrationby: [],
  });

  //Autosave Signals
  readonly lastSavedAt = signal<Date | null>(null);
  readonly isRestoredDraft = signal(false);

  private autosaveKey = 'create-article-draft';

  readonly isSubmitting = signal(false);

  readonly slugManuallyEdited = signal(false);

  // For auto-generating tags from excerpt
  readonly suggestedTags = signal<string[]>([]);
  readonly tagsManuallyEdited = signal(false);

  //Tag Limits
  readonly MAX_SUGGESTED = 6;
  readonly MIN_SELECTED = 1;
  readonly MAX_SELECTED = 2;

  //Article Catergory Options
  readonly categories: ArticleCategory[] = [
  'News',
  'Feature',
  'Editorial',
  'Sports',
  'Column',
  'DevCom',
  'Literary'
];

  //Image State
  readonly selectedImageMedia = signal<Media | null>(null);

  //Confirm Modal
  readonly showConfirmModal = signal(false);

  readonly confirmTitle = signal('');
  readonly confirmMessage = signal('');
  readonly confirmButtonText = signal('');

  private slugUniqueValidator: AsyncValidatorFn = (control): Observable<ValidationErrors | null> => {
    const slug = String(control.value ?? '').trim();
    if (!slug) return of(null);

    return timer(250).pipe(
      switchMap(() => this.articleService.isSlugTaken(slug, this.editingId() ?? undefined)),
      map((taken) => (taken ? { slugTaken: true } : null)),
      catchError(() => of(null)),
      first()
    );
  };

  readonly form = this.fb.group({
    title: ['', Validators.required],
    slug: ['', [Validators.required], [this.slugUniqueValidator]],
    excerpt: ['', Validators.required],
    content: ['', Validators.required],
    image: [''],

    author: ['', Validators.required],
    photoby: [''],
    graphicby: [''],
    illusrationby: [''],

    category: [null as unknown as ArticleCategory, Validators.required],
    tags: [[] as string[]],

    status: ['Draft' as ArticleStatus],
    featured: [false]
  });

  readonly statuses: ArticleStatus[] = [
    'Draft',
    'Published'
  ];


  // Auto-generate slug from title
  constructor() {
  this.initEditModeFromRoute();
  this.setupSlugAutoGeneration();
  this.setupAutoTagGeneration();
  this.initializeMembers();

  if (!this.isEditMode()) {
    this.restoreDraft();
  }

  this.setupAutosave();
}

private initEditModeFromRoute(): void {

  const slugParam = this.route.snapshot.paramMap.get('slug');
  if (!slugParam) return;

  const slug = String(slugParam).trim();
  if (!slug) return;

  this.articleService.getBySlug(slug).subscribe({
    next: (article) => {
      this.originalArticle.set(article);
      this.editingId.set(article.id);
      this.autosaveKey = `edit-article-draft-${article.id}`;
      this.loadArticleForEdit(article);
    },
    error: () => this.router.navigate(['/admin/all-articles']),
  });
}

private loadArticleForEdit(article: Article): void {

  // In edit mode, keep the current slug unless user intentionally edits it.
  this.slugManuallyEdited.set(true);

  this.form.patchValue({
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    content: article.content,
    image: article.image,

    author: article.author,
    photoby: article.photoby,
    graphicby: article.graphicby,
    illusrationby: article.illusrationby,

    category: article.category,
    tags: article.tags ?? [],

    status: article.status,
    featured: article.featured
  }, { emitEvent: false });

  // Hydrate multi-select UI state from stored comma-separated values.
  this.creditInput.set({ author: '', photoby: '', graphicby: '', illusrationby: '' });
  this.selectedCredits.set({ author: [], photoby: [], graphicby: [], illusrationby: [] });
  this.hydrateSelectedCreditsFromForm();

  this.selectedImageMedia.set(this.buildMediaFromUrl(article.image));
}
private setupSlugAutoGeneration(): void {

    const titleControl = this.form.controls.title;
    const slugControl = this.form.controls.slug;

    titleControl.valueChanges.subscribe(title => {

      // If slug manually edited → stop auto update
      if (this.slugManuallyEdited()) return;

      const generated = this.generateSlug(title);
      slugControl.setValue(generated, { emitEvent: false });
    });

  }

private setupAutoTagGeneration(): void {

  const excerptControl = this.form.controls.excerpt;

  excerptControl.valueChanges.subscribe(excerpt => {

    const cleanText = excerpt?.trim() ?? '';

    // If excerpt empty → reset everything
    if (!cleanText) {
      this.suggestedTags.set([]);
      this.tagsManuallyEdited.set(false);
      this.form.controls.tags.setValue([]);
      return;
    }

    const generated = this.extractKeywords(cleanText)
      .slice(0, this.MAX_SUGGESTED);

    this.suggestedTags.set(generated);

  });

}

private extractKeywords(text: string): string[] {

  const stopWords = [
    'the','and','or','to','of','in','a','an',
    'is','are','was','were','for','with','on',
    'at','by','from','as','that','this','it'
  ];

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word =>
      word.length > 4 && !stopWords.includes(word)
    );

  const frequency: Record<string, number> = {};

  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }

  return Object.entries(frequency)
  .sort((a, b) => b[1] - a[1])
  .map(entry => entry[0]);
}

    private generateSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')     // remove special chars
    .replace(/\s+/g, '-')             // spaces → dash
    .replace(/-+/g, '-');             // collapse dashes
}

onSlugInput(): void {
  const slugValue =  this.form.controls.slug.value;
  const expected = this.generateSlug(this.form.controls.title.value ?? '');

  // If slug matches the auto-generated value, keep it in "auto" mode.
  if (slugValue === expected) {
    this.slugManuallyEdited.set(false);
    return;
  }

  if (!slugValue) {
    this.slugManuallyEdited.set(false);
    return;
  }

  this.slugManuallyEdited.set(true);
}

  //tag handler

onTagsInput(event: Event): void {
  this.tagsManuallyEdited.set(true);

  const input = event.target as HTMLInputElement;

  const tags = input.value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);

  this.form.controls.tags.setValue(tags);
}

addTag(tag: string): void {

  const current = this.form.controls.tags.value;

  if (current.includes(tag)) return;

  if (current.length >= this.MAX_SELECTED) return;

  this.tagsManuallyEdited.set(true);

  this.form.controls.tags.setValue([...current, tag]);
}

removeTag(tag: string): void {

  const current = this.form.controls.tags.value;

  if (current.length <= this.MIN_SELECTED) return;

  this.tagsManuallyEdited.set(true);

  const updated = this.form.controls.tags.value
    .filter(t => t !== tag);

  this.form.controls.tags.setValue(updated);
}

onCoverMediaChange(media: Media | null): void {
  this.selectedImageMedia.set(media);
  this.form.controls.image.setValue(media?.fileUrl || media?.filePath || '');
}

  //Initialize Members for Author AutoComplete — fetch staff from backend
private initializeMembers(): void {
    // Subscribe to staff$ so we receive backend data when it arrives (async)
    this.staffService.staff$.subscribe(staffList => {
      this.allMembers = staffList.map(s => ({
        name: s.fullName,
        position: s.assignedRole ?? s.subRole ?? '',
        initials: s.fullName?.split(' ').map(p => p[0]).join('').substring(0,2).toUpperCase(),
        staffId: s.id,
      }));
      this.hydrateSelectedCreditsFromForm();
    });
  }

private setupCreditAutocomplete(
  _fieldName: CreditField
): void {
  // (Deprecated) old single-select implementation was removed in favor of multi-select.
}

private hydrateSelectedCreditsFromForm(): void {
  const current = this.selectedCredits();
  const next: Record<CreditField, string[]> = { ...current };

  const fields: CreditField[] = ['author', 'photoby', 'graphicby', 'illusrationby'];
  for (const field of fields) {
    if (next[field].length) continue;
    const raw = String(this.form.controls[field].value ?? '').trim();
    if (!raw) continue;
    next[field] = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  this.selectedCredits.set(next);
}

private syncCreditsFieldToForm(field: CreditField): void {
  const names = this.selectedCredits()[field];
  this.form.controls[field].setValue(names.join(', '));
}

private addCredit(field: CreditField, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;

  const current = this.selectedCredits();
  const existing = current[field];
  if (existing.some((n) => n.toLowerCase() === trimmed.toLowerCase())) return;

  const next = { ...current, [field]: [...existing, trimmed] };
  this.selectedCredits.set(next);
  this.syncCreditsFieldToForm(field);
}

removeCredit(field: CreditField, name: string): void {
  const current = this.selectedCredits();
  const nextList = current[field].filter((n) => n !== name);
  this.selectedCredits.set({ ...current, [field]: nextList });
  this.syncCreditsFieldToForm(field);
}

onCreditFocus(field: CreditField): void {
  this.activeCreditField.set(field);
  this.highlightedIndex.set(0);
  this.updateCreditSuggestions(field, this.creditInput()[field]);
}

onCreditInput(field: CreditField, event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = input.value ?? '';
  this.creditInput.set({ ...this.creditInput(), [field]: value });
  this.activeCreditField.set(field);
  this.highlightedIndex.set(0);
  this.updateCreditSuggestions(field, value);
}

private updateCreditSuggestions(_field: CreditField, raw: string): void {
  const search = raw.trim().toLowerCase();

  if (!search || search.length < 2) {
    this.creditSuggestions.set(this.allMembers);
    this.highlightedIndex.set(this.allMembers.length ? 0 : -1);
    return;
  }

  const filtered = this.allMembers.filter((member) =>
    member.name.toLowerCase().includes(search)
  );

  this.creditSuggestions.set(filtered);
  this.highlightedIndex.set(filtered.length ? 0 : -1);
}

private commitTypedCredit(field: CreditField): void {
  const typed = this.creditInput()[field].trim();
  if (!typed) return;

  this.addCredit(field, typed);
  this.creditInput.set({ ...this.creditInput(), [field]: '' });
}

private commitAllTypedCredits(): void {
  const fields: CreditField[] = ['author', 'photoby', 'graphicby', 'illusrationby'];
  for (const field of fields) this.commitTypedCredit(field);
}

selectCredit(member: BoardMember): void {
  const field = this.activeCreditField();
  if (!field) return;

  this.addCredit(field, member.name);
  this.creditInput.set({ ...this.creditInput(), [field]: '' });

  this.creditSuggestions.set([]);
  this.activeCreditField.set(null);
  this.highlightedIndex.set(-1);
}

//autosave methods
private setupAutosave(): void {

  this.form.valueChanges
    .pipe(
      debounceTime(1500),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    )
    .subscribe(value => {

      localStorage.setItem(
        this.autosaveKey,
        JSON.stringify(value)
      );

      this.lastSavedAt.set(new Date());

    });

}

private restoreDraft(): void {

  const saved = localStorage.getItem(this.autosaveKey);

  if (!saved) return;

  const parsed = JSON.parse(saved);

  this.form.patchValue(parsed);
  this.hydrateSelectedCreditsFromForm();
  this.selectedImageMedia.set(this.buildMediaFromUrl(this.form.controls.image.value));

  this.isRestoredDraft.set(true);
  this.lastSavedAt.set(new Date());

}

private executeSave(): void {
  this.commitAllTypedCredits();
  this.form.updateValueAndValidity();

  const selectedTags = this.form.controls.tags.value;

  if (
    this.form.invalid ||
    selectedTags.length < this.MIN_SELECTED ||
    selectedTags.length > this.MAX_SELECTED ||
    this.isSubmitting()
  ) {
    return;
  }

  this.isSubmitting.set(true);

  const raw = this.form.getRawValue();
  const id = this.editingId();

  if (id !== null) {

    const existing = this.originalArticle();
    if (!existing) {
      this.isSubmitting.set(false);
      return;
    }

    this.articleService.updateArticle(id, raw).pipe(
      switchMap((updated) => {
        this.originalArticle.set(updated);
        if (raw.status === 'Published' && !updated.publishedAt) {
          return this.articleService.publishArticle(id);
        }
        return of(updated);
      })
    ).subscribe({
      next: (updated) => {
        this.originalArticle.set(updated);
        localStorage.removeItem(this.autosaveKey);
        this.isSubmitting.set(false);
        this.router.navigate(['/admin/all-articles']);
      },
      error: (err) => {
        console.error('Failed to update article', err);
        this.isSubmitting.set(false);
        const details = err?.error?.details;
        if (Array.isArray(details) && details.length) {
          alert(details.map((d: any) => `${d.field}: ${d.message}`).join('\n'));
        } else {
          alert('Failed to update the article. Please try again.');
        }
      }
    });

  } else {
    this.articleService.createArticle(raw).pipe(
      switchMap((created) => {
        if (raw.status === 'Published' && !created.publishedAt) {
          return this.articleService.publishArticle(created.id);
        }
        return of(created);
      })
    ).subscribe({
      next: () => {
        localStorage.removeItem(this.autosaveKey);
        this.isSubmitting.set(false);
        this.router.navigate(['/admin/all-articles']);
      },
      error: (err) => {
        console.error('Failed to create article', err);
        this.isSubmitting.set(false);
        const details = err?.error?.details;
        if (Array.isArray(details) && details.length) {
          alert(details.map((d: any) => `${d.field}: ${d.message}`).join('\n'));
        } else {
          alert('Failed to create the article. Please try again.');
        }
      }
    });
  }
}

//submit
submit(): void {

  this.commitAllTypedCredits();
  this.form.updateValueAndValidity();

  const selectedTags = this.form.controls.tags.value;

  if (
    this.form.invalid ||
    selectedTags.length < this.MIN_SELECTED ||
    selectedTags.length > this.MAX_SELECTED ||
    this.isSubmitting()
  ) {
    return;
  }

  const isEdit = this.editingId() !== null;
  const status = this.form.controls.status.value;

  this.confirmTitle.set(
    isEdit ? 'Update Article?' : 'Create Article?'
  );

  this.confirmMessage.set(
    status === 'Published'
      ? 'This article will be publicly visible immediately.'
      : 'Save this article?'
  );

  this.confirmButtonText.set(
    isEdit ? 'Update' : 'Create'
  );

  this.showConfirmModal.set(true);
}


onConfirmSave( ): void {
  this.showConfirmModal.set(false);
  this.executeSave();
}

onCancelSave(): void {
  this.showConfirmModal.set(false);
}

cancel(): void {
  const id = this.editingId();
  this.router.navigate(['/admin/all-articles']);


  // Always clear any autosaved draft for the current mode.
  localStorage.removeItem(this.autosaveKey);
  this.isRestoredDraft.set(false);
  this.lastSavedAt.set(null);

  if (id !== null) {
    // Edit mode: reload original article values (true "refresh").
    this.tagsManuallyEdited.set(false);
    this.suggestedTags.set([]);

    this.creditSuggestions.set([]);
    this.activeCreditField.set(null);
    this.highlightedIndex.set(-1);

    const original = this.originalArticle();
    if (original) {
      this.loadArticleForEdit(original);
      return;
    }

    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.articleService.getBySlug(slug).subscribe({
        next: (article) => {
          this.originalArticle.set(article);
          this.loadArticleForEdit(article);
        },
        error: () => this.router.navigate(['/admin/all-articles']),
      });
      return;
    }
    return;
  }

  // Create mode: clear to a blank form.
  this.clearFormState();
}

private clearFormState(): void {

  localStorage.removeItem(this.autosaveKey);

  this.slugManuallyEdited.set(false);
  this.tagsManuallyEdited.set(false);
  this.suggestedTags.set([]);
  this.creditInput.set({ author: '', photoby: '', graphicby: '', illusrationby: '' });
  this.selectedCredits.set({ author: [], photoby: [], graphicby: [], illusrationby: [] });

  this.creditSuggestions.set([]);
  this.activeCreditField.set(null);
  this.highlightedIndex.set(-1);

  this.selectedImageMedia.set(null);

  this.isRestoredDraft.set(false);
  this.lastSavedAt.set(null);

  this.editingId.set(null);
  this.autosaveKey = 'create-article-draft';

  this.form.reset({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    image: '',

    author: '',
    photoby: '',
    graphicby: '',
    illusrationby: '',

    category: null as unknown as ArticleCategory,
    tags: [],

    status: 'Draft' as ArticleStatus,
    featured: false
  }, { emitEvent: false });
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

//Keyboard navigation for credit suggestions
handleKeyDown(event: KeyboardEvent): void {

  const suggestions = this.creditSuggestions();

  if (!suggestions.length) return;

  switch (event.key) {

    case 'ArrowDown':
      event.preventDefault();
      this.highlightedIndex.update(i =>
        i < suggestions.length - 1 ? i + 1 : 0
      );
      break;

    case 'ArrowUp':
      event.preventDefault();
      this.highlightedIndex.update(i =>
        i > 0 ? i - 1 : suggestions.length - 1
      );
      break;

    case 'Enter':
      event.preventDefault();
      const index = this.highlightedIndex();
      if (index >= 0) {
        this.selectCredit(suggestions[index]);
      }
      break;

    case 'Escape':
      this.creditSuggestions.set([]);
      this.activeCreditField.set(null);
      this.highlightedIndex.set(-1);
      break;
  }

}

@HostListener('document:click', ['$event'])
handleOutsideClick(event: MouseEvent): void {

  if (!this.elementRef.nativeElement.contains(event.target)) {
    this.creditSuggestions.set([]);
    this.activeCreditField.set(null);
    this.highlightedIndex.set(-1);
  }

}

}
