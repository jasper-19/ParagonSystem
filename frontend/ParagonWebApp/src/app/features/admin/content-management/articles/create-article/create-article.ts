import { Component, inject, signal, ElementRef, HostListener, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  Validators,
  NonNullableFormBuilder,
  AsyncValidatorFn,
  ValidationErrors
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ArticleService } from '../../../../../core/services/article.service';
import { Article, ArticleCategory, ArticleStatus, CreateArticleDto } from '../../../../../models/article.model';
import { RichTextEditorComponent } from '../../../../../shared/components/rich-text-editor/rich-text-editor';
import { Observable, of, timer, forkJoin } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { BoardMember } from '../../../../../models/editorial-board.model';
import { catchError, debounceTime, distinctUntilChanged, first, map, switchMap, take } from 'rxjs/operators';
import { ConfirmationModal } from '../../../../../shared/components/confirmation-modal/confirmation-modal';
import { ErrorModal } from '../../../../../shared/components/feedback-modal/error-modal';
import { CoverImagSelectorComponent } from '../../../media-library/components/cover-image-selector/cover-image-selector';
import { Media } from '../../../../../models/media.model';
import { EditorialBoardService } from '../../../../../core/services/editorial-board.service';
import { SidebarService } from '../../../../../core/services/sidebar.service';
import { SocketService } from '../../../../../core/services/socket.service';
import { GlobalSettingsService } from '../../../../../core/services/global-settings.service';

interface CreateArticleForm {
  title: string;
  category: string;
  content: string;
  status: ArticleStatus;
  featured: boolean;
}

type CreditField = 'author' | 'photoby' | 'graphicby' | 'illusrationby';

type SelectedCredit = {
  staffId: string;
  name: string;
};

type TagCandidateType =
  | 'acronym'
  | 'phrase'
  | 'keyword';

type TagCandidate = {
  tag: string;
  normalized: string;
  score: number;
  type: TagCandidateType;
};

@Component({
  selector: 'app-create-article',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RichTextEditorComponent, ConfirmationModal, CoverImagSelectorComponent, ErrorModal],
  templateUrl: './create-article.html'
})
export class CreateArticleComponent implements OnDestroy {
  private fb = inject(NonNullableFormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private articleService = inject(ArticleService);
  private elementRef = inject(ElementRef);
  private editorialBoardService = inject(EditorialBoardService);
  private socketService = inject(SocketService);
  private sidebarService = inject(SidebarService);
  private globalSettingsService = inject(GlobalSettingsService);
  readonly globalSettings = this.globalSettingsService.settings;

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() !== null);
  readonly originalArticle = signal<Article | null>(null);

  //EB Data
  private allMembers: BoardMember[] = [];

  private removeEditorialBoardUpdatedListener:
    (() => void) | null = null;

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

  // Sidebar Signals
  readonly isSidebarOpen = toSignal(
    this.sidebarService.sidebarOpen$,
    {
      initialValue: this.sidebarService.value,
    }
  );

  // Form Signals
  readonly selectedCredits = signal<
    Record<CreditField, SelectedCredit[]>
  >({
    author: [],
    photoby: [],
    graphicby: [],
    illusrationby: [],
  });

  readonly saveButtonLabel = computed(() => {
    const isEdit = this.isEditMode();
    const isPublished =
      this.articleStatus() === 'Published';

    if (isEdit) {
      return isPublished
        ? 'Update & Publish'
        : 'Update Draft';
    }

    return isPublished
      ? 'Publish Article'
      : 'Save Draft';
  });

  readonly submittingLabel = computed(() => {
    if (this.isEditMode()) {
      return this.articleStatus() === 'Published'
        ? 'Updating & Publishing...'
        : 'Updating Draft...';
    }

    return this.articleStatus() === 'Published'
      ? 'Publishing...'
      : 'Saving Draft...';
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
  readonly MAX_SUGGESTED = 10;
  readonly MIN_SELECTED = 1;
  readonly MAX_SELECTED = 3;

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
  readonly publishingPolicyBlocked = computed(() => {
    const policy = this.globalSettings()?.publishingMedia;
    if (!policy || this.form.controls.status.value !== 'Published') return false;
    return (
      !policy.allowDirectPublishing ||
      (policy.requireFeaturedImage && !this.selectedImageMedia())
    );
  });

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



  // Error Modal Signals
  readonly showErrorModal = signal(false);
  readonly errorTitle = signal('Unable to Save Article');
  readonly errorMessage = signal(
    'The article could not be saved. Please try again.'
  );

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

private readonly handleEditorialBoardUpdated = (): void => {
  console.log(
    '📡 Active editorial board changed — refreshing article credit options'
  );

  this.refreshActiveBoardMembers();
};

  ngOnDestroy(): void {
    this.removeEditorialBoardUpdatedListener?.();
    this.removeEditorialBoardUpdatedListener = null;
  }

  // Auto-generate slug from title
  constructor() {
  this.setupSlugAutoGeneration();
  this.setupAutoTagGeneration();
  this.initializeArticleMode();
  this.socketService.onEditorialBoardUpdated(this.handleEditorialBoardUpdated);

  if (!this.isEditMode()) {
    this.restoreDraft();
  }

  this.setupAutosave();
}

  private extractUniqueBoardMembers(
    board: {
      sections: {
        members: BoardMember[];
      }[];
    }
  ): BoardMember[] {
    const uniqueMembers =
      new Map<string, BoardMember>();

    for (const section of board.sections) {
      for (const member of section.members) {
        if (!member.staffId) {
          continue;
        }

        uniqueMembers.set(
          member.staffId,
          member
        );
      }
    }

    return [
      ...uniqueMembers.values(),
    ];
  }

  private initializeArticleMode(): void {
    const slugParam =
      this.route.snapshot.paramMap.get(
        'slug'
      );

    const slug =
      String(slugParam ?? '').trim();

    if (!slug) {
      this.initializeCreateMode();
      return;
    }

    this.initializeEditMode(slug);
  }

  private initializeCreateMode(): void {
    this.editorialBoardService
      .loadAdminActiveBoard()
      .subscribe({
        error: err => {
          console.error(
            'Failed to load active editorial board members:',
            err
          );
        },
      });

    this.subscribeToBoardMembers();
  }

  private initializeEditMode(
    slug: string
  ): void {
    const article$ =
      this.articleService
        .getBySlug(slug)
        .pipe(take(1));

    const board$ =
      this.editorialBoardService
        .loadAdminActiveBoard()
        .pipe(
          switchMap(() =>
            this.editorialBoardService
              .board$
              .pipe(take(1))
          )
        );

    forkJoin({
      article: article$,
      board: board$,
    }).subscribe({
      next: ({
        article,
        board,
      }) => {
        this.allMembers =
          this.extractUniqueBoardMembers(
            board
          );

        this.originalArticle.set(
          article
        );

        this.editingId.set(
          article.id
        );

        this.autosaveKey =
          `edit-article-draft-${article.id}`;

        this.loadArticleForEdit(
          article
        );

        this.hydrateSelectedCreditsFromArticle(
          article
        );

        this.subscribeToBoardMembers();
      },

      error: err => {
        console.error(
          'Failed to initialize article editor:',
          err
        );

        this.router.navigate([
          '/admin/all-articles',
        ]);
      },
    });
  }

  private boardMembersSubscribed = false;

  private subscribeToBoardMembers(): void {
    if (this.boardMembersSubscribed) {
      return;
    }

    this.boardMembersSubscribed = true;

    this.editorialBoardService
      .board$
      .subscribe(board => {
        this.allMembers =
          this.extractUniqueBoardMembers(
            board
          );

        const activeField =
          this.activeCreditField();

        if (activeField) {
          this.updateCreditSuggestions(
            activeField,
            this.creditInput()[
              activeField
            ]
          );
        }
      });
  }

  private hydrateSelectedCreditsFromArticle(
    article: Article
  ): void {
    const credits =
      article.credits ?? [];

    const next:
      Record<
        CreditField,
        SelectedCredit[]
      > = {
        author: [],
        photoby: [],
        graphicby: [],
        illusrationby: [],
      };

    for (const credit of credits) {
      const selected: SelectedCredit = {
        staffId: credit.staffId,
        name: credit.creditedName,
      };

      switch (credit.creditType) {
        case 'author':
          next.author.push(selected);
          break;

        case 'photo':
          next.photoby.push(selected);
          break;

        case 'graphic':
          next.graphicby.push(selected);
          break;

        case 'illustration':
          next.illusrationby.push(
            selected
          );
          break;
      }
    }

    this.selectedCredits.set(next);

    this.syncCreditsFieldToForm(
      'author'
    );

    this.syncCreditsFieldToForm(
      'photoby'
    );

    this.syncCreditsFieldToForm(
      'graphicby'
    );

    this.syncCreditsFieldToForm(
      'illusrationby'
    );
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

  this.refreshSuggestedTags(
    article.excerpt ?? ''
  );

  // Hydrate multi-select UI state from stored comma-separated values.
  this.creditInput.set({ author: '', photoby: '', graphicby: '', illusrationby: '' });
  this.selectedCredits.set({ author: [], photoby: [], graphicby: [], illusrationby: [] });

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

  excerptControl.valueChanges
    .pipe(
      map(excerpt => String(excerpt ?? '').trim()),
      debounceTime(350),
      distinctUntilChanged()
    )
    .subscribe(excerpt => {
      this.refreshSuggestedTags(excerpt);
    });
}

private refreshSuggestedTags(excerpt: string): void {
  if (!excerpt) {
    this.suggestedTags.set([]);
    return;
  }

  const selectedTags = new Set(
    this.form.controls.tags.value.map(tag =>
      this.normalizeTag(tag)
    )
  );

  const suggestions = this.extractKeywords(excerpt)
    .filter(tag => !selectedTags.has(this.normalizeTag(tag)))
    .slice(0, this.MAX_SUGGESTED);

  this.suggestedTags.set(suggestions);
}

private normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ');
}

private extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been',
    'being', 'but', 'by', 'for', 'from', 'had', 'has',
    'have', 'he', 'her', 'hers', 'him', 'his', 'how',
    'i', 'if', 'in', 'into', 'is', 'it', 'its', 'of',
    'on', 'or', 'our', 'ours', 'she', 'that', 'the',
    'their', 'theirs', 'them', 'they', 'this', 'those',
    'through', 'to', 'under', 'was', 'we', 'were',
    'what', 'when', 'where', 'which', 'who', 'will',
    'with', 'would', 'you', 'your', 'yours',

    // Common low-value publication words
    'article', 'said', 'says', 'according', 'during',
    'after', 'before', 'also', 'more', 'most', 'new',
    'current', 'recent'
  ]);

  const normalizedText = text
    .normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-zA-Z0-9À-ÿ'&\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedText) {
    return [];
  }

  const rawWords = normalizedText.split(' ');

  const keywordTokens = rawWords
    .map(word => this.cleanKeywordToken(word))
    .filter((word): word is string => {
      if (!word) return false;

      const normalized = this.normalizeTag(word);

      return (
        !stopWords.has(normalized) &&
        this.isUsefulKeyword(word)
      );
    });

  const scores = new Map<string, number>();
  const displayValues = new Map<string, string>();

  // Score individual keywords.
  keywordTokens.forEach((word, index) => {
    const normalized = this.normalizeTag(word);

    let score = 1;

    // Reward acronyms such as CSU, CHED, DOST, AI.
    if (this.isAcronym(word)) {
      score += 2;
    }

    // Slightly reward earlier terms in the excerpt.
    if (index < 8) {
      score += 0.75;
    } else if (index < 16) {
      score += 0.35;
    }

    scores.set(
      normalized,
      (scores.get(normalized) ?? 0) + score
    );

    if (!displayValues.has(normalized)) {
      displayValues.set(
        normalized,
        this.formatSuggestedTag(word)
      );
    }
  });

  // Score useful adjacent two-word phrases.
  for (
    let index = 0;
    index < keywordTokens.length - 1;
    index++
  ) {
    const first = keywordTokens[index];
    const second = keywordTokens[index + 1];

    if (!first || !second) continue;

    const phrase = `${first} ${second}`;
    const normalizedPhrase = this.normalizeTag(phrase);

    let score = 2.25;

    if (index < 8) {
      score += 0.75;
    }

    if (
      this.isAcronym(first) ||
      this.isAcronym(second)
    ) {
      score += 0.5;
    }

    scores.set(
      normalizedPhrase,
      (scores.get(normalizedPhrase) ?? 0) + score
    );

    if (!displayValues.has(normalizedPhrase)) {
      displayValues.set(
        normalizedPhrase,
        this.formatSuggestedTag(phrase)
      );
    }
  }

  const candidates: TagCandidate[] =
    [...scores.entries()]
      .map(([normalized, score]) => {
        const tag =
          displayValues.get(normalized);

        if (!tag) {
          return null;
        }

        return {
          tag,
          normalized,
          score,
          type: this.getTagCandidateType(tag),
        };
      })
      .filter(
        (
          candidate
        ): candidate is TagCandidate =>
          candidate !== null
      )
      .sort(
        (first, second) =>
          second.score - first.score ||
          first.tag.localeCompare(second.tag)
      );

  return this.balanceTagCandidates(
    candidates,
    this.MAX_SUGGESTED
  );
}

private cleanKeywordToken(value: string): string {
  return value
    .trim()
    .replace(/^[-'&]+|[-'&]+$/g, '');
}

private isUsefulKeyword(value: string): boolean {
  const lettersOnly = value.replace(/[^a-zA-ZÀ-ÿ]/g, '');

  if (!lettersOnly) {
    return false;
  }

  if (this.isAcronym(value)) {
    return lettersOnly.length >= 2;
  }

  return lettersOnly.length >= 4;
}

private isAcronym(value: string): boolean {
  return /^[A-Z0-9]{2,8}$/.test(value);
}

private getTagCandidateType(
  tag: string
): TagCandidateType {
  const words = tag
    .trim()
    .split(/\s+/);

  if (
    words.length === 1 &&
    this.isAcronym(words[0])
  ) {
    return 'acronym';
  }

  if (words.length > 1) {
    return 'phrase';
  }

  return 'keyword';
}

private balanceTagCandidates(
  candidates: TagCandidate[],
  limit: number
): string[] {
  if (limit <= 0) {
    return [];
  }

  const grouped: Record<
    TagCandidateType,
    TagCandidate[]
  > = {
    keyword: [],
    phrase: [],
    acronym: [],
  };

  for (const candidate of candidates) {
    grouped[candidate.type].push(
      candidate
    );
  }

  const selected: TagCandidate[] = [];
  const selectedKeys =
    new Set<string>();

  const addCandidates = (
    source: TagCandidate[],
    quota: number
  ): void => {
    let added = 0;

    for (const candidate of source) {
      if (
        selected.length >= limit ||
        added >= quota
      ) {
        break;
      }

      if (
        selectedKeys.has(
          candidate.normalized
        )
      ) {
        continue;
      }

      selected.push(candidate);
      selectedKeys.add(
        candidate.normalized
      );

      added++;
    }
  };

  const keywordQuota =
    Math.min(4, limit);

  const phraseQuota =
    Math.min(
      3,
      Math.max(limit - keywordQuota, 0)
    );

  const acronymQuota =
    Math.min(
      2,
      Math.max(
        limit -
          keywordQuota -
          phraseQuota,
        0
      )
    );

  addCandidates(
    grouped.keyword,
    keywordQuota
  );

  addCandidates(
    grouped.phrase,
    phraseQuota
  );

  addCandidates(
    grouped.acronym,
    acronymQuota
  );

  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }

    if (
      selectedKeys.has(
        candidate.normalized
      )
    ) {
      continue;
    }

    selected.push(candidate);
    selectedKeys.add(
      candidate.normalized
    );
  }

  return selected
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.tag.localeCompare(
          second.tag
        )
    )
    .map(candidate => candidate.tag);
}


private formatSuggestedTag(value: string): string {
  return value
    .split(/\s+/)
    .map(word => {
      if (this.isAcronym(word)) {
        return word;
      }

      return word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase();
    })
    .join(' ');
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
  const cleanedTag = tag.trim();

  if (!cleanedTag) return;

  const normalizedTag =
    this.normalizeTag(cleanedTag);

  const alreadySelected = current.some(
    currentTag =>
      this.normalizeTag(currentTag) ===
      normalizedTag
  );

  if (alreadySelected) return;
  if (current.length >= this.MAX_SELECTED) return;

  this.tagsManuallyEdited.set(true);

  this.form.controls.tags.setValue([
    ...current,
    cleanedTag,
  ]);

  this.refreshSuggestedTags(
    this.form.controls.excerpt.value
  );
}

removeTag(tag: string): void {
  const current =
    this.form.controls.tags.value;

  if (current.length <= this.MIN_SELECTED) {
    return;
  }

  this.tagsManuallyEdited.set(true);

  const updated = current.filter(
    currentTag =>
      this.normalizeTag(currentTag) !==
      this.normalizeTag(tag)
  );

  this.form.controls.tags.setValue(updated);

  this.refreshSuggestedTags(
    this.form.controls.excerpt.value
  );
}

onCoverMediaChange(media: Media | null): void {
  this.selectedImageMedia.set(media);
  this.form.controls.image.setValue(media?.fileUrl || media?.filePath || '');
}

private hydrateSelectedCreditsFromForm(): void {
  const current = this.selectedCredits();
  const next: Record<CreditField, SelectedCredit[]> = {
    author: [...current.author],
    photoby: [...current.photoby],
    graphicby: [...current.graphicby],
    illusrationby: [...current.illusrationby],
  };
  const fields: CreditField[] = [
    'author',
    'photoby',
    'graphicby',
    'illusrationby',
  ];
  for (const field of fields) {
    if (next[field].length > 0) {
      continue;
    }
    const raw = String(
      this.form.controls[field].value ?? ''
    ).trim();

    if (!raw) {
      continue;
    }
    const names = raw
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);
    next[field] = names
      .map(name => {
        const member = this.allMembers.find(
          candidate =>
            candidate.name.trim().toLowerCase() ===
            name.toLowerCase()
        );
        if (!member?.staffId) {
          return null;
        }
        return {
          staffId: member.staffId,
          name: member.name,
        };
      })
      .filter(
        (credit): credit is SelectedCredit =>
          credit !== null
      );
  }
  this.selectedCredits.set(next);
}

private syncCreditsFieldToForm(
  field: CreditField
): void {
  const names = this.selectedCredits()[field]
    .map(credit => credit.name);
  this.form.controls[field].setValue(
    names.join(', ')
  );
}

private addCredit(
  field: CreditField,
  member: BoardMember
): void {
  const staffId = member.staffId;
  const name = member.name.trim();
  if (!staffId || !name) {
    return;
  }
  const current = this.selectedCredits();
  const existing = current[field];
  if (
    existing.some(
      credit => credit.staffId === staffId
    )
  ) {
    return;
  }
  this.selectedCredits.set({
    ...current,
    [field]: [
      ...existing,
      {
        staffId,
        name,
      },
    ],
  });
  this.syncCreditsFieldToForm(field);
}

removeCredit(
  field: CreditField,
  staffId: string
): void {
  const current = this.selectedCredits();
  const nextList = current[field].filter(
    credit => credit.staffId !== staffId
  );
  this.selectedCredits.set({
    ...current,
    [field]: nextList,
  });
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

isCreditStillActive(
  credit: SelectedCredit
): boolean {
  return this.allMembers.some(
    member => member.staffId === credit.staffId
  );
}

private updateCreditSuggestions(
  field: CreditField,
  raw: string
): void {
  const search = raw.trim().toLowerCase();
  const selectedIds = new Set(
    this.selectedCredits()[field].map(
      credit => credit.staffId
    )
  );
  const availableMembers =
    this.allMembers.filter(
      member =>
        !!member.staffId &&
        !selectedIds.has(member.staffId)
    );
  const filtered =
    !search || search.length < 2
      ? availableMembers
      : availableMembers.filter(member =>
          member.name
            .toLowerCase()
            .includes(search)
        );
  this.creditSuggestions.set(filtered);
  this.highlightedIndex.set(
    filtered.length ? 0 : -1
  );
}

private commitTypedCredit(
  field: CreditField
): void {
  const typed =
    this.creditInput()[field]
      .trim()
      .toLowerCase();
  if (!typed) return;
  const exactMatch = this.allMembers.find(
    member =>
      member.name.trim().toLowerCase() === typed
  );
  if (!exactMatch) {
    return;
  }
  this.addCredit(field, exactMatch);
  this.creditInput.set({
    ...this.creditInput(),
    [field]: '',
  });
}

private commitAllTypedCredits(): void {
  const fields: CreditField[] = ['author', 'photoby', 'graphicby', 'illusrationby'];
  for (const field of fields) this.commitTypedCredit(field);
}

selectCredit(member: BoardMember): void {
  const field = this.activeCreditField();
  if (!field) return;

  this.addCredit(field, member);
  this.creditInput.set({ ...this.creditInput(), [field]: '' });

  this.creditSuggestions.set([]);
  this.activeCreditField.set(null);
  this.highlightedIndex.set(-1);
}

private getSelectedCreditIds(
  field: CreditField
): string[] {
  return this.selectedCredits()[field]
    .map(credit => credit.staffId);
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
  this.refreshSuggestedTags(
    this.form.controls.excerpt.value
  );
  this.hydrateSelectedCreditsFromForm();
  this.selectedImageMedia.set(this.buildMediaFromUrl(this.form.controls.image.value));

  this.isRestoredDraft.set(true);
  this.lastSavedAt.set(new Date());

}

private executeSave(): void {
  this.commitAllTypedCredits();
  this.form.updateValueAndValidity();

  const selectedTags =
    this.form.controls.tags.value;

  const authorIds =
    this.getSelectedCreditIds('author');

  if (
    this.form.invalid ||
    selectedTags.length < this.MIN_SELECTED ||
    selectedTags.length > this.MAX_SELECTED ||
    authorIds.length === 0 ||
    this.isSubmitting()
  ) {
    if (authorIds.length === 0) {
      this.form.controls.author.markAsTouched();
    }

    return;
  }

  const raw = this.form.getRawValue();

  const dto: CreateArticleDto = {
    ...raw,

    authorIds,

    photoByIds:
      this.getSelectedCreditIds('photoby'),

    graphicByIds:
      this.getSelectedCreditIds('graphicby'),

    illustrationByIds:
      this.getSelectedCreditIds(
        'illusrationby'
      ),
  };

  this.isSubmitting.set(true);

  const id = this.editingId();

  if (id !== null) {
    const existing = this.originalArticle();

    if (!existing) {
      this.isSubmitting.set(false);
      return;
    }

    this.articleService
      .updateArticle(id, dto)
      .pipe(
        switchMap(updated => {
          this.originalArticle.set(updated);

          if (
            dto.status === 'Published' &&
            !updated.publishedAt
          ) {
            return this.articleService
              .publishArticle(id);
          }

          return of(updated);
        })
      )
      .subscribe({
        next: updated => {
          this.originalArticle.set(updated);
          localStorage.removeItem(
            this.autosaveKey
          );
          this.isSubmitting.set(false);

          this.router.navigate([
            '/admin/all-articles',
          ]);
        },

        error: err => {
          this.handleArticleSaveError(
            err,
            'update'
          );
        },
      });

    return;
  }

  this.articleService
    .createArticle(dto)
    .pipe(
      switchMap(created => {
        if (
          dto.status === 'Published' &&
          !created.publishedAt
        ) {
          return this.articleService
            .publishArticle(created.id);
        }

        return of(created);
      })
    )
    .subscribe({
      next: () => {
        localStorage.removeItem(
          this.autosaveKey
        );

        this.isSubmitting.set(false);

        this.router.navigate([
          '/admin/all-articles',
        ]);
      },

      error: err => {
        this.handleArticleSaveError(
          err,
          'create'
        );
      },
    });
}

private handleArticleSaveError(
  err: any,
  action: 'create' | 'update'
): void {
  console.error(
    `Failed to ${action} article`,
    err
  );

  this.isSubmitting.set(false);

  const backendMessage =
    err?.error?.error;

  const validationDetails =
    err?.error?.details;

  this.errorTitle.set(
    action === 'create'
      ? 'Unable to Create Article'
      : 'Unable to Update Article'
  );

  if (
    backendMessage ===
    'Only members of the active editorial board can be credited.'
  ) {
    this.errorMessage.set(
      'Only members of the active editorial board can be credited. Please remove or replace any inactive contributors before saving the article.'
    );
  } else if (
    Array.isArray(validationDetails) &&
    validationDetails.length > 0
  ) {
    this.errorMessage.set(
      validationDetails
        .map(
          (detail: any) =>
            `${detail.field}: ${detail.message}`
        )
        .join('\n')
    );
  } else {
    this.errorMessage.set(
      backendMessage ??
      `Failed to ${action} the article. Please try again.`
    );
  }

  this.showErrorModal.set(true);
}

closeErrorModal(): void {
  this.showErrorModal.set(false);
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
      event.preventDefault();
      this.closeCreditSuggestions();
      break;
  }

}

  private refreshActiveBoardMembers(): void {
    this.editorialBoardService
      .loadAdminActiveBoard()
      .subscribe({
        error: err => {
          console.error(
            'Failed to refresh active editorial board members:',
            err
          );
        },
      });
  }

readonly articleStatus = toSignal(
  this.form.controls.status.valueChanges,
  {
    initialValue: this.form.controls.status.value,
  }
);

private closeCreditSuggestions(): void {
  this.creditSuggestions.set([]);
  this.activeCreditField.set(null);
  this.highlightedIndex.set(-1);
}

@HostListener('document:click', ['$event'])
handleOutsideClick(event: MouseEvent): void {
  if (
    !this.elementRef.nativeElement.contains(
      event.target
    )
  ) {
    this.closeCreditSuggestions();
  }
}

@HostListener('window:resize')
onWindowResize(): void {
  this.closeCreditSuggestions();
}

}
