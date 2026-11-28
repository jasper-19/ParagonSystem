import { CommonModule } from '@angular/common';
import { Directive, forwardRef, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { CreateArticleComponent } from './create-article';
import { ArticleService } from '../../../../../core/services/article.service';
import { EditorialBoardService } from '../../../../../core/services/editorial-board.service';
import { SocketService } from '../../../../../core/services/socket.service';
import { SidebarService } from '../../../../../core/services/sidebar.service';
import { GlobalSettingsService } from '../../../../../core/services/global-settings.service';
import { Article } from '../../../../../models/article.model';

@Directive({ selector: 'app-rich-text-editor', standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => StubArticleEditor), multi: true }] })
class StubArticleEditor implements ControlValueAccessor {
  writeValue(): void {}
  registerOnChange(): void {}
  registerOnTouched(): void {}
}

const writer = { staffId: 'writer-id', name: 'Campus Writer', position: 'Writer' };
const photographer = { staffId: 'photo-id', name: 'Staff Photographer', position: 'Photographer' };
const board = { sections: [{ members: [writer, photographer] }] };
const base = { id: 'story-id', title: 'Campus Story', slug: 'campus-story', excerpt: 'Introduction',
  content: '<p>Body</p>', image: '', author: writer.name, photoby: '', graphicby: '', illusrationby: '',
  category: 'News', tags: ['campus'], status: 'Draft', featured: false, views: 0, createdAt: new Date(),
  credits: [{ staffId: writer.staffId, creditedName: writer.name, creditType: 'author' }] } satisfies Article;

describe('Article photo credits', () => {
  let fixture: ComponentFixture<CreateArticleComponent>;
  let create: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); localStorage.clear(); vi.useRealTimers(); });

  async function setup(article?: Article) {
    const params = convertToParamMap(article ? { slug: article.slug } : {});
    create = vi.fn(() => of(base)); update = vi.fn(() => of(base));
    TestBed.configureTestingModule({ imports: [CreateArticleComponent], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: params } } },
      { provide: ArticleService, useValue: { isSlugTaken: () => of(false), createArticle: create,
        updateArticle: update, getEditorBySlug: () => of(article), publishArticle: () => of(base) } },
      { provide: EditorialBoardService, useValue: { board$: new BehaviorSubject(board), loadAdminActiveBoard: () => of(board) } },
      { provide: SocketService, useValue: { onEditorialBoardUpdated: vi.fn() } },
      { provide: SidebarService, useValue: { sidebarOpen$: of(false) } },
      { provide: GlobalSettingsService, useValue: { settings: signal(null) } },
    ] });
    // Keep the real form template and credit controls; unrelated editors and
    // media pickers do not need HTTP or upload setup in these regression tests.
    TestBed.overrideComponent(CreateArticleComponent, { set: {
      imports: [CommonModule, ReactiveFormsModule, StubArticleEditor], schemas: [NO_ERRORS_SCHEMA],
    } });
    fixture = TestBed.createComponent(CreateArticleComponent);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }
  function type(name: string) {
    const input = fixture.nativeElement.querySelector('#photo-credit-input') as HTMLInputElement;
    input.focus(); input.value = name;
    input.dispatchEvent(new Event('input', { bubbles: true })); fixture.detectChanges();
    return input;
  }
  async function save() {
    fixture.componentInstance.form.patchValue({ ...base, tags: ['campus'] });
    fixture.componentInstance.onCreditFocus('author');
    fixture.componentInstance.selectCredit(writer);
    await fixture.whenStable();
    fixture.componentInstance.onConfirmSave();
  }

  it('adds an external name with commas using Enter and saves it separately from staff IDs', async () => {
    const component = await setup();
    const input = type(' Campus News Agency, Inc. ');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(component.selectedCredits().photoby).toEqual([{ staffId: null, name: 'Campus News Agency, Inc.' }]);
    await save();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ photoByIds: [], externalPhotoCredits: ['Campus News Agency, Inc.'] }));
  });

  it('supports mixed staff and external chips and removes only the chosen external name', async () => {
    const component = await setup();
    component.onCreditFocus('photoby'); component.selectCredit(photographer);
    type('Outside Person'); component.addExternalPhotoCredit();
    type('Other Organization'); component.addExternalPhotoCredit();
    component.removeCredit('photoby', null, 'Outside Person');
    expect(component.selectedCredits().photoby.map(c => c.name)).toEqual(['Staff Photographer', 'Other Organization']);
    type('other organization'); component.addExternalPhotoCredit();
    expect(component.selectedCredits().photoby.length).toBe(2);
    await save();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ photoByIds: [photographer.staffId], externalPhotoCredits: ['Other Organization'] }));
  });

  it('hydrates external and historical staff credits during editing and explicitly saves removals', async () => {
    const revision = 'a'.repeat(64);
    const component = await setup({ ...base, revision, photoby: 'Former Photographer, Agency, Inc.', credits: [...base.credits!,
      { staffId: 'former-id', creditedName: 'Former Photographer', creditType: 'photo' },
      { staffId: null, creditedName: 'Agency, Inc.', creditType: 'photo' }] });
    expect(component.selectedCredits().photoby.map(c => c.name)).toEqual(['Former Photographer', 'Agency, Inc.']);
    component.removeCredit('photoby', null, 'Agency, Inc.');
    await save();
    expect(update).toHaveBeenCalledWith(base.id, expect.objectContaining({ photoByIds: ['former-id'], externalPhotoCredits: [] }), revision);
  });

  it('retains a legacy text credit as one whole name', async () => {
    const legacy = 'Archive, Community Organization';
    const component = await setup({ ...base, photoby: legacy });
    expect(component.selectedCredits().photoby).toEqual([{ staffId: null, name: legacy }]);
    await save();
    expect(update).toHaveBeenCalledWith(base.id, expect.objectContaining({ externalPhotoCredits: [legacy] }), undefined);
  });

  it('restores structured draft credits without splitting comma-containing names or losing staff links', async () => {
    localStorage.setItem('create-article-draft', JSON.stringify({ ...base, photoby: 'Staff Photographer, Agency, Inc.',
      selectedCredits: { author: [{ staffId: writer.staffId, name: writer.name }],
        photoby: [{ staffId: photographer.staffId, name: photographer.name }, { staffId: null, name: 'Agency, Inc.' }],
        graphicby: [], illusrationby: [] } }));
    const component = await setup();
    expect(component.selectedCredits().photoby).toEqual([{ staffId: photographer.staffId, name: photographer.name }, { staffId: null, name: 'Agency, Inc.' }]);
    await save();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ photoByIds: [photographer.staffId], externalPhotoCredits: ['Agency, Inc.'] }));
  });

  it('keeps explicitly removed draft credits empty and preserves legacy drafts without structured credits', async () => {
    localStorage.setItem('create-article-draft', JSON.stringify({ ...base, photoby: 'Stale Agency',
      selectedCredits: { photoby: [] } }));
    const component = await setup();
    expect(component.selectedCredits().photoby).toEqual([]);
    expect(component.form.controls.photoby.value).toBe('');
  });

  it('restores a legacy draft photo string without splitting organization commas', async () => {
    localStorage.setItem('create-article-draft', JSON.stringify({ ...base, photoby: 'Archive, Inc.' }));
    const component = await setup();
    expect(component.selectedCredits().photoby).toEqual([{ staffId: null, name: 'Archive, Inc.' }]);
  });

  it('selects the highlighted staff suggestion with Enter without submitting the form', async () => {
    const component = await setup();
    const input = type('Staff Photo');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(component.selectedCredits().photoby).toEqual([{ staffId: photographer.staffId, name: photographer.name }]);
    expect(create).not.toHaveBeenCalled();
  });

  it('renders HTML-looking names as text and enforces the combined length limit', async () => {
    const component = await setup();
    const name = '<img src=x onerror=alert(1)>';
    type(name); component.addExternalPhotoCredit(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(name);
    expect(fixture.nativeElement.querySelector('img[src="x"]')).toBeNull();
    type('x'.repeat(2000)); component.addExternalPhotoCredit();
    expect(component.photoCreditError()).toBeTruthy();
    expect(component.selectedCredits().photoby.length).toBe(1);
  });
});
